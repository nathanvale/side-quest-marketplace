/**
 * Title utilities for note creation.
 *
 * Shared functions for applying title prefixes and other
 * title-related transformations.
 *
 * @module utils/title
 */

import { DEFAULT_TITLE_PREFIXES } from "../config/defaults";
import type { ParaObsidianConfig } from "../config/index";

/**
 * Apply template-specific title prefix if configured, avoiding duplication.
 *
 * @param title - The base title to potentially prefix
 * @param template - Template name to look up prefix for
 * @param config - Para-obsidian configuration
 * @returns Title with prefix applied if needed, or original title
 *
 * @example
 * ```typescript
 * applyTitlePrefix("Christmas Day Hotels", "research", config)
 * // "Research - Christmas Day Hotels"
 *
 * applyTitlePrefix("Research - Hotels", "research", config)
 * // "Research - Hotels" (not duplicated)
 *
 * applyTitlePrefix("My Task", "task", config)
 * // "My Task" (no prefix for tasks)
 * ```
 */
export function applyTitlePrefix(
	title: string,
	template: string,
	config: ParaObsidianConfig,
): string {
	// Get prefix from config or defaults
	const prefix =
		config.titlePrefixes?.[template] ?? DEFAULT_TITLE_PREFIXES[template];

	if (!prefix) return title; // No prefix configured for this template

	// Check if title already starts with the prefix (case-insensitive)
	const titleLower = title.toLowerCase();
	const prefixLower = prefix.toLowerCase();

	if (titleLower.startsWith(prefixLower)) {
		return title; // Already has prefix, don't duplicate
	}

	// Apply prefix (add space if prefix doesn't end with one)
	const separator = prefix.endsWith(" ") ? "" : " ";
	return `${prefix}${separator}${title}`;
}
