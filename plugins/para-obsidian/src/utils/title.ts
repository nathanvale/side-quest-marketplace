/**
 * Title utilities for note creation.
 *
 * Shared functions for applying title prefixes and other
 * title-related transformations.
 *
 * @module utils/title
 */

import { applyTitlePrefix as applyTitlePrefixCore } from "@sidequest/core/obsidian";
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
	// Merge config prefixes with defaults (filter out undefined values)
	const prefixMap = Object.fromEntries(
		Object.entries({
			...DEFAULT_TITLE_PREFIXES,
			...(config.titlePrefixes ?? {}),
		}).filter(([, value]) => value !== undefined),
	) as Record<string, string>;

	// Use core utility with para-obsidian-specific configuration
	// Only "resource" template uses source_format emoji mapping
	return applyTitlePrefixCore(
		title,
		template,
		prefixMap,
		frontmatter,
		SOURCE_FORMAT_EMOJIS,
		"source_format",
		["resource"],
	);
}
