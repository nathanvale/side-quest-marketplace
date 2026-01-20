/**
 * Wikilink utilities for Obsidian-style bracket syntax.
 *
 * Provides functions to strip wikilink brackets (e.g., `[[Note]]` → `Note`)
 * from strings while preserving internal structure like aliases, headings,
 * and block references.
 *
 * @module obsidian/wikilinks
 */

/**
 * Strip wikilink brackets from a value if present.
 *
 * Handles null values, empty wikilinks, and "null" string values by returning null.
 * Only strips the outer `[[` and `]]` brackets - preserves internal structure
 * like aliases (`[[Note|Alias]]`), headings (`[[Note#Section]]`), and block
 * references (`[[Note^block]]`).
 *
 * @param value - Value that may contain wikilink brackets
 * @returns Value with outer wikilink brackets removed, or null for empty/null values
 *
 * @example
 * Basic usage:
 * ```typescript
 * stripWikilinks("[[Home]]")          // "Home"
 * stripWikilinks("Home")              // "Home"
 * stripWikilinks("[[My Project]]")    // "My Project"
 * ```
 *
 * @example
 * Null handling:
 * ```typescript
 * stripWikilinks("[[]]")              // null (empty wikilink)
 * stripWikilinks(null)                // null
 * stripWikilinks(undefined)           // null
 * stripWikilinks("null")              // null
 * ```
 *
 * @example
 * Preserves internal structure:
 * ```typescript
 * stripWikilinks("[[Home|My Home]]")  // "Home|My Home"
 * stripWikilinks("[[Home#Section]]")  // "Home#Section"
 * stripWikilinks("[[Home^block]]")    // "Home^block"
 * ```
 *
 * @example
 * Whitespace handling:
 * ```typescript
 * stripWikilinks("  [[Home]]  ")      // "Home"
 * stripWikilinks("[[  Home  ]]")      // "Home"
 * stripWikilinks("   ")               // null
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
 *
 * Unlike {@link stripWikilinks}, this function never returns null - it returns
 * the original value when brackets aren't present or are malformed. Use this in
 * contexts where null is not acceptable.
 *
 * Uses a regex pattern to match complete wikilinks only (`[[...]]`). Partial
 * brackets, empty wikilinks, or malformed syntax return the original value.
 *
 * @param value - Value that may contain wikilink brackets
 * @returns Value with outer wikilink brackets removed, or original value
 *
 * @example
 * Basic usage:
 * ```typescript
 * stripWikilinksOrValue("[[Home]]")   // "Home"
 * stripWikilinksOrValue("Home")       // "Home"
 * stripWikilinksOrValue("[[My Project]]") // "My Project"
 * ```
 *
 * @example
 * Returns original for malformed brackets:
 * ```typescript
 * stripWikilinksOrValue("[[Home")     // "[[Home"
 * stripWikilinksOrValue("Home]]")     // "Home]]"
 * stripWikilinksOrValue("[[]]")       // "[[]]"
 * stripWikilinksOrValue("")           // ""
 * ```
 *
 * @example
 * Preserves internal structure:
 * ```typescript
 * stripWikilinksOrValue("[[Home|Alias]]")  // "Home|Alias"
 * stripWikilinksOrValue("[[Home#Section]]") // "Home#Section"
 * ```
 */
export function stripWikilinksOrValue(value: string): string {
	const match = value.match(/^\[\[(.+)\]\]$/);
	return match?.[1] ?? value;
}
