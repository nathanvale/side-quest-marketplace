/**
 * CLI utility functions.
 *
 * Shared helpers used across multiple CLI command handlers.
 * Extracted from the monolithic cli.ts for reuse.
 *
 * @module cli/utils
 */

import {
	normalizeFlags as coreNormalizeFlags,
	normalizeFlagValue as coreNormalizeFlagValue,
	parseArgOverrides as coreParseArgOverrides,
	parseDirs as coreParseDirs,
	parseCommaSeparatedList,
} from "@sidequest/core/cli";
import {
	matchesDir as coreMatchesDir,
	normalizePathFragment as coreNormalizePathFragment,
} from "@sidequest/core/fs";
import { discoverAttachments } from "../attachments/index";
import type { ParaObsidianConfig } from "../config/index";
import type { NormalizedFlags, RawFlags } from "./types";

/**
 * Normalize a flag value to single value (string or boolean).
 * If array, returns the first element. Otherwise returns as-is.
 * @deprecated Use normalizeFlagValue from @sidequest/core/cli instead
 */
export function normalizeFlagValue(
	value: string | boolean | (string | boolean)[] | undefined,
): string | boolean | undefined {
	return coreNormalizeFlagValue(value);
}

/**
 * Normalize flags record by converting all array values to their first element.
 * Used for functions that don't expect array flag values.
 * @deprecated Use normalizeFlags from @sidequest/core/cli instead
 */
export function normalizeFlags(
	flags: Record<string, string | boolean | (string | boolean)[]>,
): NormalizedFlags {
	return coreNormalizeFlags(flags);
}

/**
 * Parse --attachments flag into array of paths.
 * Accepts both RawFlags (may have arrays) and NormalizedFlags.
 */
export function parseAttachments(flags: RawFlags | NormalizedFlags): string[] {
	const raw = flags.attachments;
	// Handle array case (take first element)
	const value = Array.isArray(raw) ? raw[0] : raw;
	return parseCommaSeparatedList(value);
}

/**
 * Parse --unset flag into array of field names.
 */
export function parseUnset(input: string | boolean | undefined): string[] {
	return parseCommaSeparatedList(input);
}

/**
 * Parse frontmatter filter flags into a key-value map.
 * Supports both --frontmatter key=val and --frontmatter.key val formats.
 */
export function parseFrontmatterFilters(
	flags: NormalizedFlags,
	additional: ReadonlyArray<string> = [],
): Record<string, string> {
	const filters: Record<string, string> = {};
	const collect = (input: string) => {
		const [rawKey, ...rest] = input.split("=");
		if (!rawKey || rest.length === 0) return;
		const key = rawKey.replace(/^frontmatter[._]/, "").trim();
		const value = rest.join("=").trim();
		if (!key || !value) return;
		filters[key] = value;
	};

	if (typeof flags.frontmatter === "string") {
		for (const part of flags.frontmatter.split(",")) {
			if (part.trim().length > 0) collect(part);
		}
	}

	for (const [k, v] of Object.entries(flags)) {
		if (k.startsWith("frontmatter.") && typeof v === "string") {
			collect(`${k.replace("frontmatter.", "")}=${v}`);
		}
	}

	for (const part of additional) collect(part);
	return filters;
}

/**
 * Parse --dir flag into array of directory paths.
 * @deprecated Use parseDirs from @sidequest/core/cli instead
 */
export function parseDirs(
	value: string | boolean | undefined,
	defaults?: ReadonlyArray<string>,
): ReadonlyArray<string> | undefined {
	return coreParseDirs(value, defaults);
}

/**
 * Parse --statuses flag into array of status values.
 */
export function parseStatuses(
	value: string | boolean | undefined,
	defaults: ReadonlyArray<string>,
): ReadonlyArray<string> {
	if (typeof value !== "string") return defaults;
	const parts = value
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	return parts.length > 0 ? parts : defaults;
}

/**
 * Normalize a path fragment for comparison (forward slashes, no trailing slash).
 * @deprecated Use normalizePathFragment from @sidequest/core/fs instead
 */
export function normalizePathFragment(input: string): string {
	return coreNormalizePathFragment(input);
}

/**
 * Check if a file path matches any of the given directories.
 * @deprecated Use matchesDir from @sidequest/core/fs instead
 */
export function matchesDir(
	file: string,
	dirs?: ReadonlyArray<string>,
): boolean {
	return coreMatchesDir(file, dirs);
}

/**
 * Parse --arg flags into key=value overrides.
 *
 * Handles both single string and array of strings from CLI parsing.
 * Supports values with embedded '=' signs (e.g., --arg "url=https://example.com/path?a=b")
 *
 * @param argFlags - Raw --arg flag value(s) from parseArgs
 * @returns Record mapping arg keys to their values
 * @deprecated Use parseArgOverrides from @sidequest/core/cli instead
 *
 * @example
 * ```typescript
 * parseArgOverrides("priority=high")
 * // Returns: { priority: "high" }
 *
 * parseArgOverrides(["priority=high", "area=[[Work]]"])
 * // Returns: { priority: "high", area: "[[Work]]" }
 * ```
 */
export function parseArgOverrides(
	argFlags: string | boolean | (string | boolean)[] | undefined,
): Record<string, string> {
	return coreParseArgOverrides(argFlags);
}

/**
 * Get attachments to include - use explicit list if provided, otherwise auto-discover
 */
export function withAutoDiscoveredAttachments(
	config: ParaObsidianConfig,
	note: string,
	explicit: ReadonlyArray<string>,
): ReadonlyArray<string> {
	if (explicit.length > 0) return explicit;
	return discoverAttachments(config.vault, note);
}
