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
 *
 * @module create
 */
import fs from "node:fs";
import path from "node:path";

import type { ParaObsidianConfig } from "./config";
import { parseFrontmatter, serializeFrontmatter } from "./frontmatter";
import { resolveVaultPath } from "./fs";
import { insertIntoNote, replaceSectionContent } from "./insert";
import {
	applyDateSubstitutions,
	detectTitlePromptKey,
	getTemplate,
} from "./templates";

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
 * Substitutes Templater-style prompt placeholders with provided values.
 *
 * Replaces both single-argument and two-argument Templater prompts:
 * - `<% tp.system.prompt("key") %>` - required field
 * - `<% tp.system.prompt("key", "default") %>` - optional field with default
 *
 * Also handles unmatched optional prompts by replacing them with their defaults.
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
		const doubleArg = new RegExp(
			`<% tp\\.system\\.prompt\\("${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s*,\\s*"[^"]*"\\s*\\)\\s*%>`,
			"g",
		);

		output = output.replaceAll(singleArg, value);
		output = output.replace(doubleArg, value);
	}

	// Second, replace any remaining optional prompts (with defaults) with their default values
	// Match: <% tp.system.prompt("any", "default") %>
	const optionalPromptRegex =
		/<% tp\.system\.prompt\("([^"]+)"\s*,\s*"([^"]*)"\s*\)\s*%>/g;
	output = output.replace(optionalPromptRegex, (_match, _key, defaultValue) => {
		return defaultValue;
	});

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

	// Resolve destination: explicit > config default > vault root
	const destDir =
		options.dest ?? config.defaultDestinations?.[options.template] ?? "";
	const filename = titleToFilename(options.title);
	const target = resolveVaultPath(config.vault, path.join(destDir, filename));

	if (fs.existsSync(target.absolute)) {
		throw new Error(`File already exists: ${target.relative}`);
	}

	// Apply template substitutions:
	// 1. First, replace all date patterns (tp.date.now) with actual dates
	// 2. Then, replace all prompt patterns (tp.system.prompt) with provided args
	//    - Auto-detect the title prompt key (e.g., "Title", "Project title", "Resource title")
	//    - Inject options.title using the detected key for automatic substitution
	let filled = applyDateSubstitutions(tpl.content);
	const titleKey = detectTitlePromptKey(tpl);
	const argsWithTitle = { [titleKey]: options.title, ...options.args };
	filled = applyArgsToTemplate(filled, argsWithTitle);

	const { attributes, body } = parseFrontmatter(filled);

	// Inject template_version if not present and configured
	if (
		attributes.template_version === undefined &&
		config.templateVersions?.[options.template] !== undefined
	) {
		attributes.template_version = config.templateVersions[options.template];
	}

	// Inject title if not provided by args/template substitution
	if (!attributes.title) {
		attributes.title = options.title;
	}
	const content = serializeFrontmatter(attributes, body);

	// Create directory structure and write file
	fs.mkdirSync(path.dirname(target.absolute), { recursive: true });
	fs.writeFileSync(target.absolute, content, "utf8");

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
				reason: error instanceof Error ? error.message : String(error),
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
				reason: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return { injected, skipped };
}

// Re-export for convenience
export { replaceH1Title } from "./insert";
