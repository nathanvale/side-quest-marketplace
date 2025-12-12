/**
 * CLI utility functions.
 *
 * Shared helpers used across multiple CLI command handlers.
 * Extracted from the monolithic cli.ts for reuse.
 *
 * @module cli/utils
 */

import type { NormalizedFlags } from "./types";

/**
 * Normalize a flag value to single value (string or boolean).
 * If array, returns the first element. Otherwise returns as-is.
 */
export function normalizeFlagValue(
	value: string | boolean | (string | boolean)[] | undefined,
): string | boolean | undefined {
	if (Array.isArray(value)) {
		return value[0];
	}
	return value;
}

/**
 * Normalize flags record by converting all array values to their first element.
 * Used for functions that don't expect array flag values.
 */
export function normalizeFlags(
	flags: Record<string, string | boolean | (string | boolean)[]>,
): NormalizedFlags {
	const normalized: NormalizedFlags = {};
	for (const [key, value] of Object.entries(flags)) {
		const norm = normalizeFlagValue(value);
		if (norm !== undefined) {
			normalized[key] = norm;
		}
	}
	return normalized;
}

/**
 * Parse --attachments flag into array of paths.
 */
export function parseAttachments(flags: NormalizedFlags): string[] {
	const raw = flags.attachments;
	if (typeof raw !== "string") return [];
	return raw
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}

/**
 * Parse --unset flag into array of field names.
 */
export function parseUnset(input: string | boolean | undefined): string[] {
	if (typeof input !== "string") return [];
	return input
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
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
 */
export function parseDirs(
	value: string | boolean | undefined,
	defaults?: ReadonlyArray<string>,
): ReadonlyArray<string> | undefined {
	if (typeof value !== "string") return defaults;
	return value
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
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
 */
export function normalizePathFragment(input: string): string {
	return input.replace(/\\/g, "/").replace(/\/+$/, "");
}

/**
 * Check if a file path matches any of the given directories.
 */
export function matchesDir(
	file: string,
	dirs?: ReadonlyArray<string>,
): boolean {
	if (!dirs || dirs.length === 0) return true;
	const normalizedFile = normalizePathFragment(file);
	return dirs.some((dir) => {
		const normalizedDir = normalizePathFragment(dir);
		return (
			normalizedFile === normalizedDir ||
			normalizedFile.startsWith(`${normalizedDir}/`)
		);
	});
}

/**
 * Parse --arg flags into key=value overrides.
 *
 * Handles both single string and array of strings from CLI parsing.
 * Supports values with embedded '=' signs (e.g., --arg "url=https://example.com/path?a=b")
 *
 * @param argFlags - Raw --arg flag value(s) from parseArgs
 * @returns Record mapping arg keys to their values
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
	const overrides: Record<string, string> = {};

	// Normalize to array of strings only
	let stringFlags: string[];
	if (typeof argFlags === "string") {
		stringFlags = [argFlags];
	} else if (Array.isArray(argFlags)) {
		stringFlags = argFlags.filter((v): v is string => typeof v === "string");
	} else {
		stringFlags = [];
	}

	for (const arg of stringFlags) {
		const [key, ...valueParts] = arg.split("=");
		if (key && valueParts.length > 0) {
			overrides[key] = valueParts.join("=");
		}
	}
	return overrides;
}
