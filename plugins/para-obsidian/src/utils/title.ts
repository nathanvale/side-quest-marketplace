/**
 * Title utilities for note creation.
 *
 * Shared functions for applying title prefixes and other
 * title-related transformations.
 *
 * @module utils/title
 */

import {
	DEFAULT_TITLE_PREFIXES,
	SOURCE_FORMAT_EMOJIS,
} from "../config/defaults";
import type { ParaObsidianConfig } from "../config/index";

/**
 * Apply template-specific title prefix if configured, avoiding duplication.
 *
 * For resources, adds a second emoji based on source_format if available:
 * - Resources WITH source_format: "📚🎬 Title" (base + format emoji)
 * - Resources WITHOUT source_format: "📚 Title" (just base emoji)
 *
 * @param title - The base title to potentially prefix
 * @param template - Template name to look up prefix for
 * @param config - Para-obsidian configuration
 * @param frontmatter - Optional frontmatter to check for source_format
 * @returns Title with prefix applied if needed, or original title
 *
 * @example
 * ```typescript
 * applyTitlePrefix("Christmas Day Hotels", "research", config)
 * // "📊 Christmas Day Hotels"
 *
 * applyTitlePrefix("TypeScript Deep Dive", "resource", config, { source_format: "video" })
 * // "📚🎬 TypeScript Deep Dive"
 *
 * applyTitlePrefix("My Article", "resource", config)
 * // "📚 My Article" (no source_format)
 *
 * applyTitlePrefix("My Task", "task", config)
 * // "My Task" (no prefix for tasks)
 * ```
 */
export function applyTitlePrefix(
	title: string,
	template: string,
	config: ParaObsidianConfig,
	frontmatter?: Record<string, unknown>,
): string {
	// Get prefix from config or defaults
	const basePrefix =
		config.titlePrefixes?.[template] ?? DEFAULT_TITLE_PREFIXES[template];

	if (!basePrefix) return title; // No prefix configured for this template

	// Check if title already starts with the prefix (case-insensitive)
	const titleLower = title.toLowerCase();
	const basePrefixLower = basePrefix.toLowerCase();

	if (titleLower.startsWith(basePrefixLower)) {
		return title; // Already has prefix, don't duplicate
	}

	// For resources, add source_format emoji if available
	let prefix = basePrefix;
	if (template === "resource" && frontmatter?.source_format) {
		const formatEmoji =
			SOURCE_FORMAT_EMOJIS[frontmatter.source_format as string];
		if (formatEmoji) {
			// Add format emoji after base emoji (trim space from base first)
			prefix = `${basePrefix.trim()}${formatEmoji} `;
		}
	}

	// Apply prefix (add space if prefix doesn't end with one)
	const separator = prefix.endsWith(" ") ? "" : " ";
	return `${prefix}${separator}${title}`;
}
