/**
 * Note creation from templates.
 *
 * This module handles creating new notes from Templater-style templates.
 * It supports:
 * - Title Case filename generation
 * - Template argument substitution
 * - Automatic template_version injection
 * - Title field injection
 * - Content injection into template sections
 * - Unique filename generation on collision (Obsidian-style: "Title 1.md")
 *
 * @module create
 */
import path from "node:path";
import { ensureDirSync, writeTextFileSync } from "@sidequest/core/fs";
import { getErrorMessage } from "@sidequest/core/utils";

import type { ParaObsidianConfig } from "../config/index";
import { parseFrontmatter, serializeFrontmatter } from "../frontmatter/index";
import { generateUniqueNotePath } from "../inbox/core/engine-utils";
import { resolveVaultPath } from "../shared/fs";
import {
	applyDateSubstitutions,
	detectTitlePromptKey,
	getTemplate,
} from "../templates/index";
import { applyTitlePrefix } from "../utils/title";
import { stripWikilinksOrValue } from "../utils/wikilinks";
import { insertIntoNote, replaceSectionContent } from "./insert";

/**
 * Options for creating a new note from a template.
 */
export interface CreateOptions {
	/** Template name (without .md extension). */
	readonly template: string;
	/** Title for the new note. Will be used for filename and title field. */
	readonly title: string;
	/** Destination directory relative to vault. Defaults to template's configured folder. */
	readonly dest?: string;
	/** Arguments to substitute for Templater prompts in the template. */
	readonly args?: Record<string, string>;
	/** Extra frontmatter fields to add (merged after template processing). */
	readonly extraFrontmatter?: Record<string, unknown>;
	/**
	 * Content to embed in the note body (replaces {{content}} placeholder).
	 * Used for Type A documents where markdown is the source of truth.
	 */
	readonly content?: string;
}

/**
 * Result of injecting content into multiple sections.
 */
export interface InjectSectionsResult {
	/** List of heading names that were successfully injected. */
	readonly injected: string[];
	/** List of sections that were skipped with reasons. */
	readonly skipped: Array<{ heading: string; reason: string }>;
}

/**
 * Converts a note title to a valid Title Case filename.
 *
 * Removes invalid filename characters, applies Title Case,
 * and appends .md extension.
 *
 * @param title - The note title to convert
 * @returns Sanitized filename with .md extension
 *
 * @example
 * ```typescript
 * titleToFilename('my new project'); // 'My New Project.md'
 * titleToFilename('what/is:this?');  // 'What Is This.md'
 * ```
 */
function titleToFilename(title: string): string {
	const cleaned = title
		.trim()
		// Remove invalid filename characters
		.replace(/[/\\:*?"<>|]/g, "")
		.replace(/'/g, "")
		.split(" ")
		.filter(Boolean)
		// Apply Title Case to each word
		.map((w, i) => {
			if (i === 0) return w[0]?.toUpperCase() + w.slice(1);
			return w[0]?.toUpperCase() + w.slice(1);
		})
		.join(" ");
	return `${cleaned}.md`;
}

/**
 * Checks if a value represents null in frontmatter.
 *
 * Handles various null representations:
 * - YAML null: `null`
 * - Quoted null: `"null"`
 * - Wikilink with null: `"[[null]]"` (quoted string in YAML)
 * - Array with null: `[[null]]` (parsed as nested arrays)
 *
 * @param value - The value to check
 * @returns True if the value represents null
 */
function isNullPlaceholder(value: unknown): boolean {
	if (value === null) return true;
	if (value === "null") return true;
	// Handle quoted wikilink case like "[[null]]" which stays as string
	if (typeof value === "string" && value === "[[null]]") return true;
	// Handle array case like [[null]] which parses as [["null"]] or [null]
	if (Array.isArray(value)) {
		if (value.length === 1) {
			const inner = value[0];
			if (inner === null || inner === "null") return true;
			if (Array.isArray(inner) && inner.length === 1) {
				return inner[0] === null || inner[0] === "null";
			}
		}
	}
	return false;
}

/**
 * Applies args directly to frontmatter fields with null placeholders.
 *
 * This handles templates that use `null` or `"null"` as placeholder values
 * instead of Templater prompts. For each arg key that matches a frontmatter
 * field name, if the field's value is null, it's replaced with the arg value.
 *
 * **Wikilink handling**: If an arg value contains wikilinks (e.g., `[[Travel]]`),
 * it's wrapped in quotes for valid YAML.
 *
 * @param attributes - Parsed frontmatter attributes object
 * @param args - Key-value pairs to apply
 * @returns Updated attributes with null placeholders replaced
 *
 * @example
 * ```typescript
 * const attrs = { title: "null", status: null, area: [["null"]] };
 * const result = applyArgsToFrontmatter(attrs, {
 *   title: "My Trip",
 *   status: "active",
 *   area: "[[Travel]]"
 * });
 * // { title: "My Trip", status: "active", area: "[[Travel]]" }
 * ```
 */
export function applyArgsToFrontmatter(
	attributes: Record<string, unknown>,
	args: Record<string, string>,
): Record<string, unknown> {
	const result = { ...attributes };

	for (const [key, value] of Object.entries(args)) {
		// Only replace if the field exists and is a null placeholder
		if (key in result && isNullPlaceholder(result[key])) {
			result[key] = value;
		}
	}

	return result;
}

/**
 * Substitutes Templater-style prompt placeholders with provided values.
 *
 * Replaces both single-argument and two-argument Templater prompts:
 * - `<% tp.system.prompt("key") %>` - required field
 * - `<% tp.system.prompt("key", "default") %>` - optional field with default
 *
 * Also handles unmatched optional prompts by replacing them with their defaults.
 *
 * **Wikilink handling:**
 * - If template wraps prompt in `[[...]]` and value contains `[[...]]`,
 *   strips brackets from value to prevent `[[[[Home]]]]`
 * - If value is a wikilink and prompt is unquoted in YAML frontmatter,
 *   wraps value in quotes to produce valid YAML (`area: "[[Home]]"`)
 *   This prevents YAML from parsing `[[Test Area]]` as nested arrays
 *
 * @param content - Template content with Templater prompts
 * @param args - Key-value pairs to substitute
 * @returns Content with prompts replaced by values
 *
 * @example
 * ```typescript
 * const template = 'Project: <% tp.system.prompt("name") %>';
 * applyArgsToTemplate(template, { name: 'My Project' });
 * // 'Project: My Project'
 *
 * const template2 = 'URL: <% tp.system.prompt("url", "") %>';
 * applyArgsToTemplate(template2, { url: 'https://example.com' });
 * // 'URL: https://example.com'
 *
 * const template3 = 'URL: <% tp.system.prompt("url", "") %>';
 * applyArgsToTemplate(template3, {});
 * // 'URL: ' (default value used)
 *
 * // Wikilink in quoted template - strips brackets to prevent double-wrapping
 * const template4 = 'area: "[[<% tp.system.prompt("Area") %>]]"';
 * applyArgsToTemplate(template4, { Area: '[[Home]]' });
 * // 'area: "[[Home]]"' (not [[[[Home]]]])
 *
 * // Wikilink in unquoted template - adds quotes for valid YAML
 * const template5 = 'area: <% tp.system.prompt("Area") %>';
 * applyArgsToTemplate(template5, { Area: '[[Work]]' });
 * // 'area: "[[Work]]"' (quotes prevent YAML array parsing)
 * ```
 */
export function applyArgsToTemplate(
	content: string,
	args: Record<string, string>,
): string {
	let output = content;

	// First, replace provided args
	for (const [key, value] of Object.entries(args)) {
		// Match both single-argument and two-argument forms
		// Single: <% tp.system.prompt("key") %>
		// Double: <% tp.system.prompt("key", "default") %>
		const singleArg = `<% tp.system.prompt("${key}") %>`;
		const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const doubleArgPattern = `<% tp\\.system\\.prompt\\("${escapedKey}"\\s*,\\s*"[^"]*"\\s*\\)\\s*%>`;
		const doubleArg = new RegExp(doubleArgPattern, "g");

		// Check if the prompt is wrapped in wikilinks in the template
		// Need to check both single-arg and double-arg forms
		const wrappedSingleArg = `[[${singleArg}]]`;
		const wrappedDoubleArgPattern = new RegExp(
			`\\[\\[<% tp\\.system\\.prompt\\("${escapedKey}"\\s*,\\s*"[^"]*"\\s*\\)\\s*%>\\]\\]`,
		);
		const isWrappedInWikilinks =
			output.includes(wrappedSingleArg) || wrappedDoubleArgPattern.test(output);

		// Determine effective value based on context:
		// 1. If template wraps prompt in [[...]], strip [[...]] from value to prevent [[[[...]]]]
		// 2. If value contains [[...]] and prompt is unquoted in YAML, wrap in quotes for valid YAML
		let effectiveValue: string;
		if (isWrappedInWikilinks) {
			// Template has [[<% ... %>]], strip wikilinks from value
			effectiveValue = stripWikilinksOrValue(value);
		} else if (value.match(/^\[\[.+\]\]$/)) {
			// Value is a wikilink and template doesn't wrap it
			// Check if we're in a YAML context (frontmatter) and unquoted
			// Pattern: "key: <% tp.system.prompt(...) %>" (unquoted)
			const isInUnquotedYaml =
				new RegExp(
					`^\\s*\\w+:\\s*<% tp\\.system\\.prompt\\("${escapedKey}"`,
					"m",
				).test(output) ||
				new RegExp(
					`^\\s*\\w+:\\s*<% tp\\.system\\.prompt\\("${escapedKey}"\\s*,`,
					"m",
				).test(output);

			if (isInUnquotedYaml) {
				// Wrap wikilink in quotes to produce valid YAML
				// area: [[Work]] → area: "[[Work]]"
				effectiveValue = `"${value}"`;
			} else {
				effectiveValue = value;
			}
		} else {
			effectiveValue = value;
		}

		output = output.replaceAll(singleArg, effectiveValue);
		output = output.replace(doubleArg, effectiveValue);
	}

	// Second, replace any remaining optional prompts (with defaults) with their default values
	// Match: <% tp.system.prompt("any", "default") %>
	const optionalPromptRegex =
		/<% tp\.system\.prompt\("([^"]+)"\s*,\s*"([^"]*)"\s*\)\s*%>/g;
	output = output.replace(optionalPromptRegex, (_match, _key, defaultValue) => {
		return defaultValue;
	});

	// Third, replace any remaining required prompts (single-arg) with empty strings
	// This prevents YAML parse errors from unsubstituted patterns like:
	// area: "[[<% tp.system.prompt("Area") %>]]" which contains nested quotes
	// Match: <% tp.system.prompt("any") %>
	const requiredPromptRegex = /<% tp\.system\.prompt\("([^"]+)"\)\s*%>/g;
	output = output.replace(requiredPromptRegex, "");

	return output;
}

/**
 * Creates a new note from a template.
 *
 * This function:
 * 1. Loads the specified template
 * 2. Replaces all `<% tp.date.now(...) %>` patterns with actual dates
 * 3. Replaces all `<% tp.system.prompt(...) %>` patterns with provided args
 * 4. Injects template_version and title into frontmatter
 * 5. Creates the file with Title Case filename
 *
 * @param config - Para-obsidian configuration
 * @param options - Creation options (template, title, dest, args)
 * @returns Created file path and content
 * @throws Error if template not found or file already exists
 *
 * @example
 * ```typescript
 * const { filePath, content } = createFromTemplate(config, {
 *   template: 'project',
 *   title: 'New Feature',
 *   dest: 'Projects',
 *   args: {
 *     'Project title': 'New Feature',
 *     'Target completion date (YYYY-MM-DD)': '2025-12-31',
 *     'Area': '[[Development]]'
 *   }
 * });
 * // Creates 'Projects/New Feature.md' with dates auto-filled
 * ```
 */
export function createFromTemplate(
	config: ParaObsidianConfig,
	options: CreateOptions,
): { filePath: string; content: string } {
	const tpl = getTemplate(config, options.template);
	if (!tpl) throw new Error(`Template not found: ${options.template}`);

	// Apply template-specific title prefix (e.g., "🎫 Booking -" for booking template)
	const displayTitle = applyTitlePrefix(
		options.title,
		options.template,
		config,
	);

	// Resolve destination: explicit > config default > vault root
	const destDir =
		options.dest ?? config.defaultDestinations?.[options.template] ?? "";
	const filename = titleToFilename(displayTitle);
	const initialTarget = resolveVaultPath(
		config.vault,
		path.join(destDir, filename),
	);

	// Generate unique path if file already exists (Obsidian-style: "Title 1.md")
	const uniqueAbsolutePath = generateUniqueNotePath(initialTarget.absolute);
	const target = {
		absolute: uniqueAbsolutePath,
		relative: path.relative(config.vault, uniqueAbsolutePath),
	};

	// Apply template substitutions:
	// 1. First, replace all date patterns (tp.date.now) with actual dates
	// 2. Then, replace all prompt patterns (tp.system.prompt) with provided args
	//    - Auto-detect the title prompt key (e.g., "Title", "Project title", "Resource title")
	//    - Inject displayTitle using the detected key for automatic substitution
	let filled = applyDateSubstitutions(tpl.content);
	const titleKey = detectTitlePromptKey(tpl);
	const argsWithTitle = { [titleKey]: displayTitle, ...options.args };
	filled = applyArgsToTemplate(filled, argsWithTitle);

	const { attributes: rawAttributes, body: rawBody } = parseFrontmatter(filled);

	// Apply args to frontmatter fields with null placeholders
	// This handles templates that use null instead of Templater prompts
	const argsForFrontmatter = { title: displayTitle, ...options.args };
	const attributes = applyArgsToFrontmatter(
		rawAttributes,
		argsForFrontmatter,
	) as Record<string, unknown>;

	// Also replace null in the H1 title if present (# null → # My Title)
	let body = rawBody;
	if (body.match(/^#\s+null\s*$/m)) {
		body = body.replace(/^#\s+null\s*$/m, `# ${displayTitle}`);
	}

	// Replace {{content}} placeholder with embedded content (Type A documents)
	// This enables extracted markdown to become the note body
	if (options.content) {
		body = body.replace(/\{\{content\}\}/g, options.content);
	} else {
		// Remove {{content}} placeholder if no content provided
		body = body.replace(/\{\{content\}\}/g, "");
	}

	// Inject title if not provided by args/template substitution
	if (!attributes.title || attributes.title === "null") {
		attributes.title = displayTitle;
	}

	// Merge in extra frontmatter fields (e.g., LLM suggestions)
	if (options.extraFrontmatter) {
		Object.assign(attributes, options.extraFrontmatter);
	}

	// Template version should come from the template file itself, not config
	// If template is missing template_version, warn but don't inject
	const content = serializeFrontmatter(attributes, body);

	// Create directory structure and write file
	ensureDirSync(path.dirname(target.absolute));
	writeTextFileSync(target.absolute, content);

	return { filePath: target.relative, content };
}

/**
 * Injects content into multiple sections of a note.
 *
 * For each heading → content pair, appends the content under that heading.
 * Skips sections with empty content or missing headings, collecting errors
 * for reporting.
 *
 * @param config - Para-obsidian configuration
 * @param filePath - Path to the file (relative to vault)
 * @param sections - Mapping of heading names to content to inject
 * @returns Result with lists of injected and skipped sections
 *
 * @example
 * ```typescript
 * const result = injectSections(config, 'Projects/My Project.md', {
 *   'Why This Matters': 'This project addresses...',
 *   'Success Criteria': '- [ ] Feature complete\n- [ ] Tests pass',
 *   'Next Actions': '- [ ] Design mockups'
 * });
 * // result.injected: ['Why This Matters', 'Success Criteria', 'Next Actions']
 * // result.skipped: []
 * ```
 */
export function injectSections(
	config: ParaObsidianConfig,
	filePath: string,
	sections: Record<string, string>,
): InjectSectionsResult {
	const injected: string[] = [];
	const skipped: Array<{ heading: string; reason: string }> = [];

	for (const [heading, content] of Object.entries(sections)) {
		// Skip empty content
		if (!content.trim()) {
			skipped.push({ heading, reason: "Empty content" });
			continue;
		}

		try {
			insertIntoNote(config, {
				file: filePath,
				heading,
				content,
				mode: "append",
			});
			injected.push(heading);
		} catch (error) {
			skipped.push({
				heading,
				reason: getErrorMessage(error),
			});
		}
	}

	return { injected, skipped };
}

/**
 * Replaces content in multiple sections of a note.
 *
 * Unlike injectSections which appends content, this function
 * completely replaces the content under each heading.
 *
 * @param config - Para-obsidian configuration
 * @param filePath - Path to the file (relative to vault)
 * @param sections - Mapping of heading names to content to replace with
 * @param options - Options for replacement behavior
 * @returns Result with lists of replaced and skipped sections
 *
 * @example
 * ```typescript
 * const result = replaceSections(config, 'Projects/My Project.md', {
 *   'Why This Matters': 'This project addresses...',
 *   'Success Criteria': '- [ ] Feature complete',
 * });
 * ```
 */
export function replaceSections(
	config: ParaObsidianConfig,
	filePath: string,
	sections: Record<string, string>,
	options?: { preserveComments?: boolean },
): InjectSectionsResult {
	const injected: string[] = [];
	const skipped: Array<{ heading: string; reason: string }> = [];

	for (const [heading, content] of Object.entries(sections)) {
		// Skip null/empty content
		if (content === null || !content.trim()) {
			skipped.push({ heading, reason: "Empty content" });
			continue;
		}

		try {
			replaceSectionContent(config, {
				file: filePath,
				heading,
				content,
				preserveComments: options?.preserveComments,
			});
			injected.push(heading);
		} catch (error) {
			skipped.push({
				heading,
				reason: getErrorMessage(error),
			});
		}
	}

	return { injected, skipped };
}

// Re-export for convenience
export { replaceH1Title } from "./insert";
