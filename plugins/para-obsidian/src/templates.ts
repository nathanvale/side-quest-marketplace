/**
 * Template management utilities.
 *
 * This module handles listing and retrieving note templates from
 * the configured templates directory. Templates are Markdown files
 * that can contain Templater prompts for dynamic content.
 *
 * @module templates
 */
import fs from "node:fs";
import path from "node:path";

import { addDays, format } from "date-fns";

import type { ParaObsidianConfig } from "./config";
import { DEFAULT_TEMPLATE_VERSIONS } from "./defaults";

/**
 * Information about a template file.
 */
export interface TemplateInfo {
	/** Template name (filename without .md extension). */
	readonly name: string;
	/** Absolute path to the template file. */
	readonly path: string;
	/** Configured template version number. */
	readonly version: number;
	/** Raw template content. */
	readonly content: string;
}

/**
 * Lists all available templates.
 *
 * Scans the configured templates directory for .md files and
 * returns metadata including version from config.
 *
 * @param config - Para-obsidian configuration with templatesDir
 * @returns Array of template info objects, sorted by name
 *
 * @example
 * ```typescript
 * const templates = listTemplates(config);
 * for (const tpl of templates) {
 *   console.log(`${tpl.name} (v${tpl.version})`);
 * }
 * ```
 */
export function listTemplates(config: ParaObsidianConfig): TemplateInfo[] {
	const dir = config.templatesDir;
	if (!dir || !fs.existsSync(dir)) return [];

	const entries = fs
		.readdirSync(dir)
		.filter((f) => f.endsWith(".md"))
		.sort();

	return entries.map((file) => {
		const name = file.replace(/\.md$/, "");
		const version =
			config.templateVersions?.[name] ?? DEFAULT_TEMPLATE_VERSIONS[name] ?? 1;
		const fullPath = path.join(dir, file);
		const content = fs.readFileSync(fullPath, "utf8");
		return { name, path: fullPath, version, content };
	});
}

/**
 * Gets a specific template by name.
 *
 * @param config - Para-obsidian configuration
 * @param name - Template name (without .md extension)
 * @returns Template info, or undefined if not found
 *
 * @example
 * ```typescript
 * const projectTemplate = getTemplate(config, 'project');
 * if (projectTemplate) {
 *   console.log(projectTemplate.content);
 * }
 * ```
 */
export function getTemplate(
	config: ParaObsidianConfig,
	name: string,
): TemplateInfo | undefined {
	return listTemplates(config).find((t) => t.name === name);
}

/**
 * Field information extracted from a template.
 */
export interface TemplateField {
	/** The exact key to use in args (matches Templater prompt text). */
	readonly key: string;
	/** Whether this field appears in frontmatter (vs body only). */
	readonly inFrontmatter: boolean;
	/** Whether this is a date field that auto-fills. */
	readonly isAutoDate: boolean;
}

/**
 * Extracts all Templater prompt fields from a template.
 *
 * Scans template content for `<% tp.system.prompt("...") %>` patterns
 * and `<% tp.date.now(...) %>` patterns to identify required fields.
 *
 * @param template - Template info with content to analyze
 * @returns Array of field information with exact keys to use in args
 *
 * @example
 * ```typescript
 * const template = getTemplate(config, 'project');
 * const fields = getTemplateFields(template);
 * // [
 * //   { key: "Project title", inFrontmatter: true, isAutoDate: false },
 * //   { key: "Target completion date (YYYY-MM-DD)", inFrontmatter: true, isAutoDate: false },
 * //   { key: "Area", inFrontmatter: true, isAutoDate: false }
 * // ]
 * ```
 */
export function getTemplateFields(template: TemplateInfo): TemplateField[] {
	const fields: TemplateField[] = [];
	const seen = new Set<string>();

	// Extract frontmatter section
	const frontmatterMatch = template.content.match(/^---\n([\s\S]*?)\n---/);
	const frontmatter = frontmatterMatch?.[1] ?? "";
	const body = frontmatterMatch
		? template.content.slice(frontmatterMatch[0].length)
		: template.content;

	// Find all tp.system.prompt("...") fields
	const promptRegex = /<%\s*tp\.system\.prompt\("([^"]+)"\)\s*%>/g;

	// Scan frontmatter
	for (const match of frontmatter.matchAll(promptRegex)) {
		const key = match[1];
		if (key && !seen.has(key)) {
			fields.push({ key, inFrontmatter: true, isAutoDate: false });
			seen.add(key);
		}
	}

	// Scan body for any additional prompts
	for (const match of body.matchAll(promptRegex)) {
		const key = match[1];
		if (key && !seen.has(key)) {
			fields.push({ key, inFrontmatter: false, isAutoDate: false });
			seen.add(key);
		}
	}

	// Find auto-date fields (tp.date.now)
	const dateRegex = /<%\s*tp\.date\.now\([^)]+\)\s*%>/g;
	const dateMatches = frontmatter.match(dateRegex);
	if (dateMatches && dateMatches.length > 0) {
		// Add a note about auto-filled dates
		if (!seen.has("created")) {
			fields.push({ key: "created", inFrontmatter: true, isAutoDate: true });
			seen.add("created");
		}
	}

	return fields;
}

// ============================================================================
// Date Substitution
// ============================================================================

/**
 * Converts a Templater/Moment.js format string to a date-fns format string.
 *
 * Templater uses Moment.js format strings. We need to convert them to date-fns.
 * This uses a regex-based approach to handle case-sensitive token matching.
 *
 * @see https://momentjs.com/docs/#/displaying/format/
 * @see https://date-fns.org/docs/format
 *
 * @param templaterFormat - Format string using Moment.js tokens (e.g., "YYYY-MM-DD")
 * @returns Equivalent date-fns format string (e.g., "yyyy-MM-dd")
 *
 * @example
 * ```typescript
 * convertTemplaterFormat("YYYY-MM-DD"); // "yyyy-MM-dd"
 * convertTemplaterFormat("dddd, MMMM D, YYYY"); // "EEEE, MMMM d, yyyy"
 * ```
 */
export function convertTemplaterFormat(templaterFormat: string): string {
	// Token replacements must be done carefully to avoid conflicts
	// Process in a specific order: longest tokens first, and group by type

	let result = templaterFormat;

	// Year tokens (case sensitive)
	result = result.replace(/YYYY/g, "yyyy");
	result = result.replace(/YY/g, "yy");

	// Day of week tokens (lowercase d) - must come before day of month
	// Process longest first
	result = result.replace(/dddd/g, "EEEE"); // Monday, Tuesday
	result = result.replace(/ddd/g, "EEE"); // Mon, Tue

	// Day of month tokens (uppercase D) - after day of week
	result = result.replace(/DD/g, "dd"); // 01-31
	result = result.replace(/Do/g, "do"); // 1st, 2nd
	result = result.replace(/D/g, "d"); // 1-31

	// Month tokens are the same in both: MMMM, MMM, MM, M

	// Hour tokens are the same: HH, H, hh, h

	// Minute tokens are the same: mm, m

	// Second tokens are the same: ss, s

	// AM/PM - Moment uses A/a, date-fns uses different
	result = result.replace(/\bA\b/g, "a"); // AM/PM
	// Note: lowercase 'a' alone is tricky as it can be part of words

	// Timezone
	result = result.replace(/ZZ/g, "xx");
	result = result.replace(/Z/g, "xxx");

	return result;
}

/**
 * Substitutes Templater date patterns with actual dates.
 *
 * Replaces all `<% tp.date.now("format", offset?) %>` patterns in the content
 * with formatted date strings. The format uses Moment.js/Templater tokens
 * which are converted to date-fns format internally.
 *
 * @param content - Template content containing Templater date patterns
 * @returns Content with all date patterns replaced with actual dates
 *
 * @example
 * ```typescript
 * // Simple date
 * applyDateSubstitutions('<% tp.date.now("YYYY-MM-DD") %>');
 * // Returns: "2025-12-06"
 *
 * // With offset (yesterday)
 * applyDateSubstitutions('<% tp.date.now("YYYY-MM-DD", -1) %>');
 * // Returns: "2025-12-05"
 *
 * // Complex format
 * applyDateSubstitutions('<% tp.date.now("dddd, MMMM D, YYYY") %>');
 * // Returns: "Friday, December 6, 2025"
 * ```
 */
export function applyDateSubstitutions(content: string): string {
	// Match: <% tp.date.now("format") %> or <% tp.date.now("format", offset) %>
	// The format is in quotes, offset is an optional integer (positive or negative)
	const dateRegex = /<%\s*tp\.date\.now\("([^"]+)"(?:,\s*(-?\d+))?\)\s*%>/g;

	return content.replace(dateRegex, (_, templaterFormat: string, offsetStr) => {
		const offset = offsetStr ? Number.parseInt(offsetStr, 10) : 0;
		const date = offset === 0 ? new Date() : addDays(new Date(), offset);
		const dateFnsFormat = convertTemplaterFormat(templaterFormat);

		try {
			return format(date, dateFnsFormat);
		} catch {
			// If format fails, return the original pattern so it's visible
			return `[Invalid date format: ${templaterFormat}]`;
		}
	});
}
