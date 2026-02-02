/**
 * Title formatting utilities for Obsidian notes.
 *
 * Provides functions to apply prefixes to note titles with configurable
 * prefix mappings and support for additional emoji formatting based on
 * content metadata.
 *
 * @module obsidian/title-formatting
 */

/**
 * Apply a template-specific title prefix if configured, avoiding duplication.
 *
 * For specific templates that use additional emoji mappings (via `emojiTemplates`), applies both:
 * - Base prefix from `prefixMap` (e.g., "📚 " for resources)
 * - Additional emoji from `emojiMap` based on frontmatter field (e.g., "🎬" for video format)
 *
 * Example use case: Resources with source_format field
 * - Resources WITH source_format: "📚🎬 Title" (base + format emoji)
 * - Resources WITHOUT source_format: "📚 Title" (just base emoji)
 *
 * @param title - The base title to potentially prefix
 * @param template - Template name to look up prefix for
 * @param prefixMap - Map of template names to prefix strings
 * @param frontmatter - Optional frontmatter to check for additional formatting
 * @param emojiMap - Optional map of frontmatter values to emoji strings
 * @param emojiField - Frontmatter field name to look up in emojiMap (defaults to "source_format")
 * @param emojiTemplates - Optional set/array of template names that use the emoji map (e.g., ["resource"])
 * @returns Title with prefix applied if needed, or original title
 *
 * @example
 * Basic usage:
 * ```typescript
 * const prefixes = { project: "🎯 ", resource: "📚 " };
 * applyTitlePrefix("My Project", "project", prefixes)
 * // "🎯 My Project"
 *
 * applyTitlePrefix("My Article", "resource", prefixes)
 * // "📚 My Article"
 * ```
 *
 * @example
 * With emoji map (resource with source_format):
 * ```typescript
 * const prefixes = { resource: "📚 " };
 * const emojis = { video: "🎬", article: "📰", podcast: "🎙️" };
 *
 * applyTitlePrefix("TypeScript Deep Dive", "resource", prefixes, { source_format: "video" }, emojis, "source_format", ["resource"])
 * // "📚🎬 TypeScript Deep Dive"
 *
 * applyTitlePrefix("My Article", "resource", prefixes, { source_format: "article" }, emojis, "source_format", ["resource"])
 * // "📚📰 My Article"
 *
 * applyTitlePrefix("Generic Resource", "resource", prefixes)
 * // "📚 Generic Resource" (no source_format)
 * ```
 *
 * @example
 * Emoji map only applies to specified templates:
 * ```typescript
 * const prefixes = { project: "🎯 ", resource: "📚 " };
 * const emojis = { video: "🎬" };
 *
 * applyTitlePrefix("My Project", "project", prefixes, { source_format: "video" }, emojis, "source_format", ["resource"])
 * // "🎯 My Project" (project not in emojiTemplates, no video emoji)
 *
 * applyTitlePrefix("My Resource", "resource", prefixes, { source_format: "video" }, emojis, "source_format", ["resource"])
 * // "📚🎬 My Resource" (resource in emojiTemplates, video emoji applied)
 * ```
 *
 * @example
 * Prefix detection (case-insensitive):
 * ```typescript
 * const prefixes = { project: "🎯 " };
 *
 * applyTitlePrefix("🎯 My Project", "project", prefixes)
 * // "🎯 My Project" (already has prefix, no duplication)
 *
 * applyTitlePrefix("🎯 my project", "project", prefixes)
 * // "🎯 my project" (case-insensitive detection)
 * ```
 *
 * @example
 * No prefix configured:
 * ```typescript
 * const prefixes = { project: "🎯 " };
 *
 * applyTitlePrefix("My Task", "task", prefixes)
 * // "My Task" (no prefix for task template)
 * ```
 */
export function applyTitlePrefix(
	title: string,
	template: string,
	prefixMap: Record<string, string>,
	frontmatter?: Record<string, unknown>,
	emojiMap?: Record<string, string>,
	emojiField = "source_format",
	emojiTemplates?: string[] | Set<string>,
): string {
	// Get prefix from map
	const basePrefix = prefixMap[template];

	if (!basePrefix) return title; // No prefix configured for this template

	// Check if title already starts with the prefix (case-insensitive)
	const titleLower = title.toLowerCase();
	const basePrefixLower = basePrefix.toLowerCase();

	if (titleLower.startsWith(basePrefixLower)) {
		return title; // Already has prefix, don't duplicate
	}

	// Check if this template should use the emoji map
	const shouldUseEmojiMap =
		emojiMap &&
		(!emojiTemplates ||
			(Array.isArray(emojiTemplates)
				? emojiTemplates.includes(template)
				: emojiTemplates.has(template)));

	// For templates with emoji map, add additional emoji if field exists in frontmatter
	let prefix = basePrefix;
	if (shouldUseEmojiMap && frontmatter?.[emojiField]) {
		const fieldValue = frontmatter[emojiField] as string;
		const additionalEmoji = emojiMap[fieldValue];
		if (additionalEmoji) {
			// Add emoji after base prefix (trim space from base first)
			prefix = `${basePrefix.trim()}${additionalEmoji} `;
		}
	}

	// Apply prefix (add space if prefix doesn't end with one)
	const separator = prefix.endsWith(" ") ? "" : " ";
	return `${prefix}${separator}${title}`;
}
