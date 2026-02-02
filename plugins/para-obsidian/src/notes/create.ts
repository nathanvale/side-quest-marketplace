/**
 * Note creation from templates.
 *
 * This module handles creating new notes from templates, supporting both:
 * - **Native placeholders** (preferred): `{{field}}`, `{{date:format}}`
 * - **Templater syntax** (deprecated): `<% tp.system.prompt() %>`
 *
 * Features:
 * - Title Case filename generation
 * - Template argument substitution
 * - Automatic template_version injection
 * - Title field injection
 * - Content injection into template sections
 * - Unique filename generation on collision (Obsidian-style: "Title 1.md")
 * - Emoji prefix support via frontmatter
 *
 * @module create
 */
import path from "node:path";
import { ensureDirSync, writeTextFileSync } from "@side-quest/core/fs";
import { getErrorMessage } from "@side-quest/core/utils";
import type { ParaObsidianConfig } from "../config/index";
import {
	filterFieldsForWrite,
	parseFrontmatter,
	serializeFrontmatter,
} from "../frontmatter/index";
import { generateUniqueNotePath } from "../inbox/core/engine-utils";
import { resolveVaultPath } from "../shared/fs";
import { templatesLogger as logger } from "../shared/logger";
import { generateTemplate } from "../templates/generator";
import type { TemplateInfo } from "../templates/index";
import {
	applyDateSubstitutions,
	detectTitlePromptKey,
	getTemplate,
} from "../templates/index";
import {
	applyNativePlaceholders,
	hasNativePlaceholders,
	hasTemplaterSyntax,
} from "../templates/placeholder";
import { buildTemplateConfig } from "../templates/services/field-bridge";
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
 * Applies args directly to frontmatter fields, overriding existing values.
 *
 * For each arg key-value pair:
 * 1. If the field exists, replace its value (except protected fields)
 * 2. If the field doesn't exist, add it as a new field
 *
 * **Protected fields** that are never overridden:
 * - `created` - Creation timestamp should be immutable
 * - `type` - Note type is determined by template
 * - `template_version` - Template version is determined by template
 *
 * **Null placeholder handling**: After applying args, any remaining null
 * placeholders are converted to empty strings. This preserves template
 * field structure (e.g., `project:` stays as `project: ""` instead of
 * being filtered out by serializeFrontmatter).
 *
 * **Wikilink handling**: If an arg value contains wikilinks (e.g., `[[Travel]]`),
 * it's wrapped in quotes for valid YAML.
 *
 * @param attributes - Parsed frontmatter attributes object
 * @param args - Key-value pairs to apply
 * @returns Updated attributes with args applied
 *
 * @example
 * ```typescript
 * const attrs = {
 *   title: "Old Title",
 *   resource_type: "reference",  // From template default
 *   type: "resource",
 *   created: "2025-01-01"
 * };
 * const result = applyArgsToFrontmatter(attrs, {
 *   title: "New Title",
 *   resource_type: "meeting",  // Overrides template default
 *   type: "task",              // Protected - NOT overridden
 *   created: "2025-12-31",     // Protected - NOT overridden
 *   newField: "value"          // Added
 * });
 * // {
 * //   title: "New Title",
 * //   resource_type: "meeting",    // Overridden
 * //   type: "resource",             // Protected (unchanged)
 * //   created: "2025-01-01",        // Protected (unchanged)
 * //   newField: "value"             // Added
 * // }
 * ```
 */
/**
 * Attempts to parse a string as JSON array.
 * Returns the parsed array if valid, otherwise returns undefined.
 */
function tryParseJsonArray(value: string): unknown[] | undefined {
	if (!value.startsWith("[") || !value.endsWith("]")) {
		return undefined;
	}
	try {
		const parsed = JSON.parse(value);
		if (Array.isArray(parsed)) {
			return parsed;
		}
	} catch {
		// Not valid JSON
	}
	return undefined;
}

/**
 * Splits a comma-separated string of wikilinks into an array.
 *
 * Handles values like `"[[🌱 Home Server]], [[🤖 AI Practice]]"` which
 * contain wikilink syntax that conflicts with JSON array detection
 * (the `[[` prefix looks nothing like `[` for JSON purposes).
 *
 * Only splits when the value contains at least one wikilink with a comma separator.
 * Single wikilinks like `"[[🌱 Home Server]]"` are wrapped in an array.
 */
function tryParseCommaSeparatedWikilinks(value: string): string[] | undefined {
	// Must contain at least one wikilink
	if (!value.includes("[[")) {
		return undefined;
	}
	const items = value
		.split(/,\s*/)
		.map((s) => s.trim())
		.filter(Boolean);
	if (items.length === 0) {
		return undefined;
	}
	// Every item must be a wikilink
	if (!items.every((item) => item.startsWith("[[") && item.endsWith("]]"))) {
		return undefined;
	}
	return items;
}

/**
 * Protected fields that should never be added/overridden by args.
 * - title: filename IS the title, no need in frontmatter
 * - created/type/template_version: managed by template system
 */
const PROTECTED_FIELDS = new Set([
	"created",
	"type",
	"template_version",
	"title",
]);

export function applyArgsToFrontmatter(
	attributes: Record<string, unknown>,
	args: Record<string, string>,
	config?: ParaObsidianConfig,
	templateName?: string,
): Record<string, unknown> {
	const result = { ...attributes };

	// Build type map from runtime config for array coercion.
	// Field filtering is handled by filterFieldsForWrite in createFromTemplate.
	let fieldTypes: Record<string, string> | undefined;
	if (config && templateName) {
		const rules = config.frontmatterRules?.[templateName];
		if (rules?.required) {
			fieldTypes = Object.fromEntries(
				Object.entries(rules.required).map(([k, v]) => [k, v.type]),
			);
		}
	}

	for (const [key, value] of Object.entries(args)) {
		// Skip protected fields - they should never be overridden by args
		if (PROTECTED_FIELDS.has(key)) {
			continue;
		}

		// Check if value is a JSON array string (e.g., '["[[Project]]"]')
		// If so, parse it to an actual array for proper YAML serialization
		const parsedArray = tryParseJsonArray(value);
		if (parsedArray !== undefined) {
			result[key] = parsedArray;
		} else if (fieldTypes?.[key] === "array") {
			// Field is declared as array type — parse comma-separated wikilinks
			// e.g., "[[🌱 Home Server]], [[🤖 AI Practice]]" → ["[[🌱 Home Server]]", "[[🤖 AI Practice]]"]
			const wikilinks = tryParseCommaSeparatedWikilinks(value);
			result[key] = wikilinks ?? [value];
		} else {
			// Override existing value or add new field
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
		// Match three forms:
		// Single: <% tp.system.prompt("key") %>
		// Double: <% tp.system.prompt("key", "default") %>
		// Four-arg with array: <% tp.system.prompt("key", "default", false, ["opt1", "opt2"]) %>
		const singleArg = `<% tp.system.prompt("${key}") %>`;
		const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const doubleArgPattern = `<% tp\\.system\\.prompt\\("${escapedKey}"\\s*,\\s*"[^"]*"\\s*\\)\\s*%>`;
		const doubleArg = new RegExp(doubleArgPattern, "g");
		const arrayOptionsPattern = `<% tp\\.system\\.prompt\\("${escapedKey}"\\s*,\\s*"[^"]*"\\s*,\\s*(?:true|false)\\s*,\\s*\\[[^\\]]*\\]\\s*\\)\\s*%>`;
		const arrayOptionsArg = new RegExp(arrayOptionsPattern, "g");

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
		output = output.replace(arrayOptionsArg, effectiveValue);
	}

	// Second, replace any remaining optional prompts (with defaults) with their default values
	// Match: <% tp.system.prompt("any", "default") %>
	const optionalPromptRegex =
		/<% tp\.system\.prompt\("([^"]+)"\s*,\s*"([^"]*)"\s*\)\s*%>/g;
	output = output.replace(optionalPromptRegex, (_match, _key, defaultValue) => {
		return defaultValue;
	});

	// Third, replace prompts with array options (4-arg form) with their default values
	// Match: <% tp.system.prompt("key", "default", false, ["option1", "option2"]) %>
	const arrayOptionsPromptRegex =
		/<% tp\.system\.prompt\("([^"]+)"\s*,\s*"([^"]*)"\s*,\s*(?:true|false)\s*,\s*\[[^\]]*\]\s*\)\s*%>/g;
	output = output.replace(
		arrayOptionsPromptRegex,
		(_match, _key, defaultValue) => {
			return defaultValue;
		},
	);

	// Fourth, replace any remaining required prompts (single-arg) with empty strings
	// This prevents YAML parse errors from unsubstituted patterns like:
	// area: "[[<% tp.system.prompt("Area") %>]]" which contains nested quotes
	// Match: <% tp.system.prompt("any") %>
	const requiredPromptRegex = /<% tp\.system\.prompt\("([^"]+)"\)\s*%>/g;
	output = output.replace(requiredPromptRegex, "");

	return output;
}

/**
 * Applies template substitutions using the appropriate syntax.
 *
 * Automatically detects whether the template uses native placeholders
 * or Templater syntax and applies the correct substitution method.
 *
 * **Native placeholders** (preferred):
 * - `{{field}}` - Required field
 * - `{{field:default}}` - Optional with default
 * - `{{date}}`, `{{date:format}}`, `{{date:format:offset}}`
 * - `{{title}}` - Note title
 *
 * **Templater syntax** (deprecated, shows warning):
 * - `<% tp.system.prompt("field") %>`
 * - `<% tp.date.now("format") %>`
 *
 * @param content - Template content
 * @param args - Arguments for substitution (field values)
 * @param options - Substitution options
 * @returns Content with placeholders replaced
 */
export function applyTemplateSubstitutions(
	content: string,
	args: Record<string, string>,
	options: {
		/** Note title to inject */
		title?: string;
		/** Base date for date placeholders (default: now) */
		baseDate?: Date;
		/** Remove unmatched placeholders (default: false) */
		removeUnmatched?: boolean;
		/** Template name for deprecation logging */
		templateName?: string;
	} = {},
): string {
	const {
		title,
		baseDate = new Date(),
		removeUnmatched = false,
		templateName,
	} = options;

	// Determine which syntax the template uses
	const hasNative = hasNativePlaceholders(content);
	const hasTemplater = hasTemplaterSyntax(content);

	// Both syntaxes - warn about mixed usage
	if (hasNative && hasTemplater) {
		logger.warn`templates:syntax:mixed template=${templateName ?? "unknown"} message=${"Template mixes native and Templater syntax. Please migrate fully to native {{field}} syntax."}`;
	}

	// If template uses native placeholders (preferred path)
	if (hasNative && !hasTemplater) {
		const argsWithTitle = title ? { title, ...args } : args;
		return applyNativePlaceholders(content, argsWithTitle, {
			baseDate,
			removeUnmatched,
			stripWikilinks: true,
		});
	}

	// If template uses Templater syntax (deprecated path)
	if (hasTemplater) {
		logger.warn`templates:syntax:deprecated template=${templateName ?? "unknown"} message=${"Templater syntax is deprecated. Run 'para migrate:templates' to convert to native {{field}} syntax."}`;

		// Apply Templater-style date substitutions first
		let result = applyDateSubstitutions(content, baseDate);

		// Apply Templater-style prompt substitutions
		const argsWithTitle = title ? { Title: title, ...args } : args;
		result = applyArgsToTemplate(result, argsWithTitle);

		return result;
	}

	// No placeholders detected - return as-is
	return content;
}

/**
 * Extracts emoji_prefix from template frontmatter.
 *
 * Templates can specify an `emoji_prefix` in frontmatter to automatically
 * prefix note titles. This replaces Templater's JS rename blocks.
 *
 * Handles templates with Templater syntax gracefully - if frontmatter
 * can't be parsed (due to Templater patterns), returns undefined.
 *
 * @param content - Template content with frontmatter
 * @returns Emoji prefix if found, undefined otherwise
 *
 * @example
 * ```yaml
 * ---
 * emoji_prefix: "🎯 "
 * ---
 * ```
 * Returns: "🎯 "
 */
export function extractEmojiPrefix(content: string): string | undefined {
	try {
		const { attributes } = parseFrontmatter(content);
		const prefix = attributes.emoji_prefix;

		if (typeof prefix === "string" && prefix.trim()) {
			return prefix;
		}

		return undefined;
	} catch {
		// Templater syntax in frontmatter can break YAML parsing
		// Return undefined and let the template be processed normally
		return undefined;
	}
}

/**
 * Resolves a template by name, checking vault files first then generating from defaults.
 *
 * Resolution order:
 * 1. Vault `.md` file (preserves user customizations and Templater-syntax templates)
 * 2. Generate from defaults.ts config (single source of truth) — no vault file needed
 *
 * This ensures:
 * - Existing vault templates (including Templater syntax) continue to work
 * - Skills that create notes via MCP (no vault file) get correct structure from defaults
 * - The "Template Query API" pattern works: skills call `para_template_fields` to discover
 *   fields/sections, then `para_create` — defaults provide the template content
 *
 * @param config - Para-obsidian configuration
 * @param templateName - Template name (without .md extension)
 * @returns Template info, or undefined if not found in either source
 */
export function resolveTemplate(
	config: ParaObsidianConfig,
	templateName: string,
): TemplateInfo | undefined {
	// Check vault file first (preserves user customizations)
	const vaultTemplate = getTemplate(config, templateName);
	if (vaultTemplate) return vaultTemplate;

	// Generate from defaults when no vault file exists (single source of truth)
	const templateConfig = buildTemplateConfig(templateName, config);
	if (templateConfig) {
		const content = generateTemplate(templateConfig, { syntax: "native" });
		return {
			name: templateName,
			path: `defaults:${templateName}`,
			version: templateConfig.version,
			content,
		};
	}

	return undefined;
}

/**
 * Creates a new note from a template.
 *
 * This function:
 * 1. Resolves the template (from defaults or vault file)
 * 2. Detects syntax (native placeholders or Templater)
 * 3. Applies appropriate substitutions for dates and fields
 * 4. Handles emoji_prefix from template frontmatter
 * 5. Injects template_version and title into frontmatter
 * 6. Creates the file with Title Case filename
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
	const tpl = resolveTemplate(config, options.template);
	if (!tpl) throw new Error(`Template not found: ${options.template}`);

	// Check for emoji_prefix in template frontmatter (new native approach)
	// This replaces Templater's JS rename blocks like: if (!title.startsWith("🎯")) { await tp.file.rename("🎯 " + title); }
	const templateEmojiPrefix = extractEmojiPrefix(tpl.content);

	// Apply template-specific title prefix from multiple sources (priority order):
	// 1. Template frontmatter emoji_prefix (native, preferred)
	// 2. Config titlePrefixes (existing approach)
	// Note: We pass extraFrontmatter to support source_format emoji for resources
	let displayTitle = options.title;
	if (
		templateEmojiPrefix &&
		!displayTitle.startsWith(templateEmojiPrefix.trim())
	) {
		displayTitle = `${templateEmojiPrefix}${displayTitle}`;
	} else {
		// Fall back to config-based prefix (existing behavior)
		// Pass extraFrontmatter so we can access source_format for resource emoji
		displayTitle = applyTitlePrefix(
			options.title,
			options.template,
			config,
			options.extraFrontmatter,
		);
	}

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

	// Apply template substitutions using unified function that handles both:
	// - Native placeholders: {{field}}, {{date:format}}
	// - Templater syntax (deprecated): <% tp.system.prompt() %>, <% tp.date.now() %>
	// For Templater, also detect the title prompt key for automatic injection
	const titleKey = detectTitlePromptKey(tpl);
	const argsWithTitleKey = { [titleKey]: displayTitle, ...options.args };
	const filled = applyTemplateSubstitutions(tpl.content, argsWithTitleKey, {
		title: displayTitle,
		templateName: options.template,
	});

	const { attributes: rawAttributes, body: rawBody } = parseFrontmatter(filled);

	// Apply args to frontmatter fields with null placeholders
	// This handles templates that use null instead of Templater prompts
	const argsForFrontmatter = { title: displayTitle, ...options.args };
	const attributes = applyArgsToFrontmatter(
		rawAttributes,
		argsForFrontmatter,
		config,
		options.template,
	) as Record<string, unknown>;

	// Remove emoji_prefix from output - it's a template config, not a note field
	delete attributes.emoji_prefix;

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

	// Remove title from frontmatter if present - filename IS the title
	// Templates should use `# `= this.file.name`` for the heading
	delete attributes.title;

	// Filter args-contributed fields against note type schema.
	// applyArgsToFrontmatter handles coercion; filterFieldsForWrite handles gating.
	const noteType = attributes.type as string | undefined;
	const argsFieldKeys = Object.keys(argsForFrontmatter).filter(
		(k) => k in attributes && !PROTECTED_FIELDS.has(k),
	);
	if (argsFieldKeys.length > 0) {
		const argsToFilter: Record<string, unknown> = {};
		for (const key of argsFieldKeys) {
			argsToFilter[key] = attributes[key];
		}
		const argsFilter = filterFieldsForWrite(argsToFilter, noteType, config);
		if (!argsFilter.allAccepted) {
			for (const key of Object.keys(argsToFilter)) {
				if (!(key in argsFilter.accepted)) {
					delete attributes[key];
				}
			}
			for (const s of [
				...argsFilter.skippedUnknown,
				...argsFilter.skippedInvalid,
				...argsFilter.skippedForbidden,
			]) {
				logger.warn`create:args:skipped field=${s.field} reason=${s.reason}`;
			}
		}
	}

	// Merge in extra frontmatter fields (e.g., LLM suggestions)
	// Filter against note type schema to reject unknown/invalid fields
	if (options.extraFrontmatter) {
		const filterResult = filterFieldsForWrite(
			options.extraFrontmatter,
			attributes.type as string | undefined,
			config,
		);
		Object.assign(attributes, filterResult.accepted);
		if (!filterResult.allAccepted) {
			for (const s of [
				...filterResult.skippedUnknown,
				...filterResult.skippedInvalid,
				...filterResult.skippedForbidden,
			]) {
				logger.warn`create:extraFrontmatter:skipped field=${s.field} reason=${s.reason}`;
			}
		}
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
		// Skip null/undefined or non-string content
		if (
			content === null ||
			content === undefined ||
			typeof content !== "string"
		) {
			skipped.push({ heading, reason: "Invalid content type" });
			continue;
		}
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
		// Skip null/undefined or non-string content
		if (
			content === null ||
			content === undefined ||
			typeof content !== "string"
		) {
			skipped.push({ heading, reason: "Invalid content type" });
			continue;
		}
		// Skip empty content
		if (!content.trim()) {
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
