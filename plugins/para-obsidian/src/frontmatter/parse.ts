/**
 * Frontmatter parsing and serialization utilities.
 *
 * Re-exports generic frontmatter utilities from @sidequest/core/obsidian.
 * Provides a thin wrapper to maintain para-obsidian's API while using
 * the shared implementation.
 *
 * @module frontmatter/parse
 */

import {
	parseFrontmatter as coreParseFrontmatter,
	serializeFrontmatter as coreSerializeFrontmatter,
} from "@sidequest/marketplace-core/obsidian";

import type { FrontmatterParseResult } from "./types";

/**
 * Parse YAML frontmatter from Markdown content.
 * Returns empty attributes if no frontmatter is present.
 *
 * This is a re-export of the core implementation from @sidequest/core/obsidian.
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
	return coreParseFrontmatter(content);
}

/**
 * Serializes frontmatter attributes and body back to Markdown format.
 *
 * Creates a properly formatted Markdown document with YAML frontmatter
 * delimited by `---` markers.
 *
 * This is a re-export of the core implementation from @sidequest/core/obsidian.
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
	return coreSerializeFrontmatter(attributes, body);
}
