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
 * Detects the title-related prompt key in a template.
 *
 * Templates use varying prompt keys for the title field:
 * - `"Title"` (generic)
 * - `"Project title"` (project template)
 * - `"Resource title"` (resource template)
 * - etc.
 *
 * This function scans frontmatter for prompts containing "title"
 * (case-insensitive) and returns the exact key for arg substitution.
 *
 * @param template - Template info with content to analyze
 * @returns The detected title prompt key, or "Title" as fallback
 *
 * @example
 * ```typescript
 * // Template with: title: "<% tp.system.prompt("Resource title") %>"
 * detectTitlePromptKey(template); // "Resource title"
 *
 * // Template with: title: "<% tp.system.prompt("Title") %>"
 * detectTitlePromptKey(template); // "Title"
 *
 * // Template without title prompt
 * detectTitlePromptKey(template); // "Title" (fallback)
 * ```
 */
export function detectTitlePromptKey(template: TemplateInfo): string {
	const frontmatterMatch = template.content.match(/^---\n([\s\S]*?)\n---/);
	const frontmatter = frontmatterMatch?.[1] ?? "";

	// Find prompt key containing "title" (case-insensitive)
	const titlePromptRegex = /<%\s*tp\.system\.prompt\("([^"]*title[^"]*)"\)/i;
	const match = frontmatter.match(titlePromptRegex);

	return match?.[1] ?? "Title";
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

	// Find all tp.system.prompt("...") fields (both single and two-arg forms)
	// Single: <% tp.system.prompt("key") %>
	// Double: <% tp.system.prompt("key", "default") %>
	const promptRegex =
		/<%\s*tp\.system\.prompt\("([^"]+)"(?:\s*,\s*"[^"]*")?\)\s*%>/g;

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

/**
 * Extracts markdown heading names from a template's body.
 *
 * Scans the body section (after frontmatter) for level-2 headings (## ...)
 * and returns their text content. Used to tell the LLM what sections
 * exist in the target template during note conversion.
 *
 * @param template - Template info with content to analyze
 * @returns Array of section heading names (without ## prefix)
 *
 * @example
 * ```typescript
 * const template = getTemplate(config, 'booking');
 * const sections = getTemplateSections(template);
 * // ["Booking Details", "Cost & Payment", "Contact Information", "Important Notes"]
 * ```
 */
export function getTemplateSections(template: TemplateInfo): string[] {
	// Extract body section (after frontmatter)
	const frontmatterMatch = template.content.match(/^---\n([\s\S]*?)\n---/);
	const body = frontmatterMatch
		? template.content.slice(frontmatterMatch[0].length)
		: template.content;

	// Find all level-2 headings (## Heading)
	const headingRegex = /^##\s+(.+)$/gm;
	const sections: string[] = [];

	for (const match of body.matchAll(headingRegex)) {
		const heading = match[1]?.trim();
		if (heading) {
			// Strip any Templater prompts from heading text
			// e.g., "## <% tp.system.prompt("Title") %>" → skip or extract
			const cleanHeading = heading.replace(/<%\s*tp\.[^%]+%>/g, "").trim();
			if (cleanHeading) {
				sections.push(cleanHeading);
			}
		}
	}

	return sections;
}

/**
 * Extract all headings from a markdown document.
 *
 * Returns heading text and level for intelligent section mapping.
 * Used to analyze source documents for AI-powered note conversion.
 *
 * @param content - Raw markdown content
 * @returns Array of headings with text, level (1-6), and line number
 *
 * @example
 * ```typescript
 * const headings = extractSourceHeadings(`
 * # Main Title
 * Some content
 * ## Overview
 * More content
 * ## Requirements
 * `);
 * // Returns:
 * // [
 * //   { text: "Main Title", level: 1, startLine: 1 },
 * //   { text: "Overview", level: 2, startLine: 3 },
 * //   { text: "Requirements", level: 2, startLine: 5 }
 * // ]
 * ```
 */
export function extractSourceHeadings(content: string): Array<{
	text: string;
	level: number;
	startLine: number;
}> {
	if (!content.trim()) return [];

	const headings: Array<{ text: string; level: number; startLine: number }> =
		[];
	const lines = content.split("\n");
	let inCodeBlock = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// Track code block boundaries (``` or ~~~)
		if (line && /^(`{3,}|~{3,})/.test(line.trim())) {
			inCodeBlock = !inCodeBlock;
			continue;
		}

		// Skip lines inside code blocks
		if (inCodeBlock) continue;

		// Match markdown headings: # to ######
		const match = /^(#{1,6})\s+(.+)$/.exec(line ?? "");
		if (match) {
			const level = match[1]?.length ?? 0;
			const text = match[2]?.trim() ?? "";

			if (text) {
				headings.push({
					text,
					level,
					startLine: i + 1, // 1-indexed line numbers
				});
			}
		}
	}

	return headings;
}

/**
 * Suggest which source headings map to which template sections.
 * Uses heuristic matching (keyword overlap, semantic similarity).
 *
 * @param sourceHeadings - Headings extracted from source document
 * @param templateSections - Section names from the target template
 * @returns Map of template section → suggested source heading (or null if no match)
 *
 * @example
 * ```typescript
 * const mapping = suggestSectionMapping(
 *   ["Project Overview", "Technical Requirements", "Timeline"],
 *   ["Why This Matters", "Success Criteria", "Tasks"]
 * );
 * // Returns Map:
 * // "Why This Matters" → "Project Overview" (keyword: overview/matters)
 * // "Success Criteria" → "Technical Requirements" (keyword: requirements/criteria)
 * // "Tasks" → "Timeline" (keyword: timeline/tasks)
 * ```
 */
export function suggestSectionMapping(
	sourceHeadings: string[],
	templateSections: string[],
): Map<string, string | null> {
	const mapping = new Map<string, string | null>();

	// Normalize a string for matching (lowercase, remove punctuation, split into words)
	const normalize = (text: string): string[] => {
		return text
			.toLowerCase()
			.replace(/[^\w\s]/g, " ")
			.split(/\s+/)
			.filter((w) => w.length > 0);
	};

	// Semantic keyword groups (template section keywords → source heading keywords)
	const semanticGroups: Array<[string[], string[]]> = [
		// Description/Overview/About/Summary → Why/What/Description
		[
			["why", "what", "description", "summary", "matters", "purpose"],
			["overview", "about", "description", "summary", "introduction", "intro"],
		],
		// Requirements/Criteria/Goals → Success/Goals/Criteria
		[
			["success", "criteria", "goals", "objectives", "outcomes"],
			["requirements", "criteria", "goals", "objectives", "targets"],
		],
		// Tasks/Timeline/Plan/Steps → Tasks/Actions/Next Steps
		[
			["tasks", "actions", "steps", "next", "todos", "work"],
			["timeline", "plan", "tasks", "steps", "schedule", "todos"],
		],
		// Notes/Details/Information → Notes/Details/Additional
		[
			["notes", "details", "additional", "information", "misc"],
			["notes", "details", "information", "misc", "other"],
		],
	];

	// For each template section, find the best matching source heading
	for (const templateSection of templateSections) {
		const templateWords = normalize(templateSection);
		let bestMatch: string | null = null;
		let bestScore = 0;

		for (const sourceHeading of sourceHeadings) {
			const sourceWords = normalize(sourceHeading);
			let score = 0;

			// Direct keyword overlap
			for (const tw of templateWords) {
				for (const sw of sourceWords) {
					if (tw === sw) {
						score += 2; // Direct match is strong signal
					}
				}
			}

			// Semantic group matching
			for (const [templateKeywords, sourceKeywords] of semanticGroups) {
				const templateHasKeyword = templateWords.some((w) =>
					templateKeywords.includes(w),
				);
				const sourceHasKeyword = sourceWords.some((w) =>
					sourceKeywords.includes(w),
				);

				if (templateHasKeyword && sourceHasKeyword) {
					score += 1; // Semantic match is weaker signal
				}
			}

			// Update best match if this is better
			if (score > bestScore) {
				bestScore = score;
				bestMatch = sourceHeading;
			}
		}

		// Only set mapping if we have a reasonable match (score > 0)
		mapping.set(templateSection, bestScore > 0 ? bestMatch : null);
	}

	return mapping;
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
 * Both Moment.js and date-fns use square brackets for literal text, but Moment
 * uses [W] for week number while date-fns uses 'w' or 'I'. We handle this specially.
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
 * convertTemplaterFormat("YYYY-[W]ww"); // "yyyy-'W'II" (ISO week number)
 * ```
 */
export function convertTemplaterFormat(templaterFormat: string): string {
	// Token replacements must be done carefully to avoid conflicts
	// Process in a specific order: longest tokens first, and group by type

	let result = templaterFormat;

	// Week number special case: Moment's [W]WW or [W]ww → date-fns 'W'II
	// [W] is literal W, WW/ww is week number (ISO)
	result = result.replace(/\[W\]WW/g, "'W'II"); // Uppercase WW
	result = result.replace(/\[W\]ww/g, "'W'II"); // Lowercase ww
	result = result.replace(/\[W\]W/g, "'W'I"); // Uppercase W
	result = result.replace(/\[W\]w/g, "'W'I"); // Lowercase w

	// Year tokens (case sensitive)
	result = result.replace(/YYYY/g, "yyyy");
	result = result.replace(/YY/g, "yy");

	// Week tokens (must come after special week handling above)
	result = result.replace(/ww/g, "II"); // ISO week
	result = result.replace(/w/g, "I"); // ISO week

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
