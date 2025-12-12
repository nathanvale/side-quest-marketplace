/**
 * Wikilink utilities.
 *
 * Shared functions for handling Obsidian wikilink formatting.
 *
 * @module utils/wikilinks
 */

/**
 * Strip wikilink brackets from a value if present.
 * Handles null values, empty wikilinks, and "null" string values.
 *
 * @param value - Value that may contain wikilink brackets
 * @returns Value with outer wikilink brackets removed, or null for empty/null values
 *
 * @example
 * ```typescript
 * stripWikilinks("[[Home]]") // "Home"
 * stripWikilinks("Home") // "Home"
 * stripWikilinks("[[My Project]]") // "My Project"
 * stripWikilinks("[[]]") // null (empty wikilink)
 * stripWikilinks(null) // null
 * stripWikilinks("null") // null
 * ```
 */
export function stripWikilinks(
	value: string | null | undefined,
): string | null {
	if (value === null || value === undefined || value === "null") return null;

	let stripped = value.trim();

	// Strip outer wikilink brackets if present
	if (stripped.startsWith("[[") && stripped.endsWith("]]")) {
		stripped = stripped.slice(2, -2).trim();
	}

	// Return null for empty values
	if (stripped === "" || stripped === "null") return null;

	return stripped;
}

/**
 * Strip wikilink brackets from a value, returning the original value if no brackets.
 * For contexts where null is not acceptable.
 *
 * @param value - Value that may contain wikilink brackets
 * @returns Value with outer wikilink brackets removed, or original value
 *
 * @example
 * ```typescript
 * stripWikilinksOrValue("[[Home]]") // "Home"
 * stripWikilinksOrValue("Home") // "Home"
 * stripWikilinksOrValue("[[My Project]]") // "My Project"
 * ```
 */
export function stripWikilinksOrValue(value: string): string {
	const match = value.match(/^\[\[(.+)\]\]$/);
	return match?.[1] ?? value;
}
