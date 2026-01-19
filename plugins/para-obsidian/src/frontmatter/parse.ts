/**
 * Frontmatter parsing and serialization utilities.
 *
 * @module frontmatter/parse
 */

import { parse, stringify } from "yaml";

import type { FrontmatterParseResult } from "./types";

/**
 * Parse YAML frontmatter from Markdown content.
 * Returns empty attributes if no frontmatter is present.
 *
 * @param content - Raw Markdown content
 * @returns Parsed frontmatter attributes and body
 * @throws Error if frontmatter is malformed YAML
 *
 * @example
 * ```typescript
 * const { attributes, body } = parseFrontmatter(`---
 * title: My Note
 * tags:
 *   - work
 * ---
 * # Content here`);
 * console.log(attributes.title); // 'My Note'
 * ```
 */
export function parseFrontmatter(content: string): FrontmatterParseResult {
	if (!content.startsWith("---")) {
		return { attributes: {}, body: content };
	}

	const end = content.indexOf("\n---", 3);
	if (end === -1) {
		return { attributes: {}, body: content };
	}

	const raw = content.slice(3, end + 1); // include leading newline
	const body = content.slice(end + 4); // skip closing newline and markers

	try {
		const attributes = parse(raw) as Record<string, unknown>;
		return { attributes, body };
	} catch (error) {
		throw new Error(
			error instanceof Error
				? `Invalid frontmatter: ${error.message}`
				: "Invalid frontmatter",
		);
	}
}

/**
 * Serializes frontmatter attributes and body back to Markdown format.
 *
 * Creates a properly formatted Markdown document with YAML frontmatter
 * delimited by `---` markers.
 *
 * **Null value handling:** Following Obsidian best practices, null values
 * are omitted from the frontmatter entirely rather than being written as
 * `field: null`. This prevents issues with Dataview queries and keeps
 * frontmatter clean.
 *
 * @param attributes - Key-value pairs to serialize as YAML
 * @param body - Markdown body content
 * @returns Complete Markdown document with frontmatter
 *
 * @example
 * ```typescript
 * const md = serializeFrontmatter({ title: 'Note', tags: ['work'] }, '# Content');
 * // '---\ntitle: Note\ntags:\n  - work\n---\n# Content'
 *
 * // Null values are omitted:
 * const md2 = serializeFrontmatter({ title: 'Note', area: null }, '# Content');
 * // '---\ntitle: Note\n---\n# Content' (area field omitted)
 * ```
 */
export function serializeFrontmatter(
	attributes: Record<string, unknown>,
	body: string,
): string {
	// Filter out null values - Obsidian best practice is to omit fields
	// rather than write `field: null` (prevents Dataview issues)
	const filteredAttributes = Object.fromEntries(
		Object.entries(attributes).filter(([, value]) => value !== null),
	);
	const yaml = stringify(filteredAttributes).trimEnd();
	return `---\n${yaml}\n---\n${body.replace(/^\n/, "")}`;
}
