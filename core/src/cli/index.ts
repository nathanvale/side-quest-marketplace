/**
 * Lightweight CLI argument parsing and utilities.
 *
 * Standard utilities for building Bun CLI tools with consistent patterns:
 * - Three-format flag parsing (--flag value, --flag=value, --flag)
 * - Key=value pair parsing
 * - Type coercion for JSON output
 *
 * Used across marketplace CLI plugins to ensure consistency.
 */

/**
 * Parse command-line arguments into structured format.
 *
 * Handles three flag formats:
 * - `--key value` (spaced syntax)
 * - `--key=value` (equals syntax)
 * - `--key` (boolean flag)
 *
 * Duplicate flags are stored as arrays:
 * - `--arg foo --arg bar` → flags.arg = ["foo", "bar"]
 * - `--arg foo` → flags.arg = "foo"
 * - `--force --force` → flags.force = [true, true]
 *
 * Returns command, subcommand, positional args, and flags.
 *
 * @example
 * parseArgs(["config", "--format", "json"])
 * // → { command: "config", positional: [], flags: { format: "json" } }
 *
 * @example
 * parseArgs(["create", "--arg", "a=1", "--arg", "b=2"])
 * // → { command: "create", positional: [], flags: { arg: ["a=1", "b=2"] } }
 *
 * @example
 * parseArgs(["frontmatter", "migrate", "file.md", "--force", "2"])
 * // → { command: "frontmatter", subcommand: "migrate", positional: ["file.md"], flags: { force: "2" } }
 */
export function parseArgs(argv: string[]): {
	command: string;
	subcommand?: string;
	positional: string[];
	flags: Record<string, string | boolean | (string | boolean)[]>;
} {
	const positional: string[] = [];
	const flags: Record<string, string | boolean | (string | boolean)[]> = {};

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (!arg) continue;
		if (arg.startsWith("--")) {
			const [keyRaw, value] = arg.split("=");
			const key = keyRaw?.slice(2);
			if (!key) continue;
			const next = argv[i + 1];

			const setValue = (newValue: string | boolean) => {
				const existing = flags[key];
				if (existing === undefined) {
					flags[key] = newValue;
				} else if (Array.isArray(existing)) {
					existing.push(newValue);
				} else {
					flags[key] = [existing, newValue];
				}
			};

			if (value !== undefined) {
				setValue(value);
			} else if (next && !next.startsWith("--")) {
				setValue(next);
				i++;
			} else {
				setValue(true);
			}
		} else {
			positional.push(arg);
		}
	}

	const [command, subcommand, ...rest] = positional;
	return { command: command ?? "", subcommand, positional: rest, flags };
}

/**
 * Parse key=value pairs from array of strings.
 *
 * Splits on first "=" and supports values containing "=".
 * Trims keys and values, skips empty entries.
 *
 * @example
 * parseKeyValuePairs(["title=My Project", "status=active"])
 * // → { title: "My Project", status: "active" }
 *
 * @example
 * parseKeyValuePairs(["expression=a=b+c"])
 * // → { expression: "a=b+c" }
 */
export function parseKeyValuePairs(
	inputs: ReadonlyArray<string>,
): Record<string, string> {
	const entries: Record<string, string> = {};
	for (const input of inputs) {
		const [rawKey, ...rest] = input.split("=");
		if (!rawKey || rest.length === 0) continue;
		const key = rawKey.trim();
		const value = rest.join("=").trim();
		if (!key || !value) continue;
		entries[key] = value;
	}
	return entries;
}

/**
 * Coerce string values to appropriate types for JSON output.
 *
 * Converts:
 * - "true"/"false" → boolean
 * - "-?\\d+(\\.\\d+)?" → number
 * - "[...]"/"{...}"/'"..."' → JSON parsed (or fallback)
 * - "a,b,c" → array
 * - Otherwise → string
 *
 * @example
 * coerceValue("true") // → true
 * coerceValue("123") // → 123
 * coerceValue("[1,2,3]") // → [1, 2, 3]
 * coerceValue("a,b,c") // → ["a", "b", "c"]
 * coerceValue("hello") // → "hello"
 */
export function coerceValue(raw: string): unknown {
	const trimmed = raw.trim();
	if (trimmed.length === 0) return trimmed;
	if (trimmed === "true") return true;
	if (trimmed === "false") return false;
	if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
	if (
		(trimmed.startsWith("[") && trimmed.endsWith("]")) ||
		(trimmed.startsWith("{") && trimmed.endsWith("}")) ||
		(trimmed.startsWith('"') && trimmed.endsWith('"'))
	) {
		try {
			return JSON.parse(trimmed);
		} catch {
			// fall through to comma/identity parsing
		}
	}
	if (trimmed.includes(",")) {
		const segments = trimmed
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
		// Prose detection: if segments average more than 2 words, this is a
		// sentence with commas rather than a tag/value list — return as string.
		const avgWordCount =
			segments.reduce((sum, s) => sum + s.split(/\s+/).length, 0) /
			segments.length;
		if (avgWordCount > 2) {
			return trimmed;
		}
		return segments;
	}
	return trimmed;
}

/**
 * Parse comma-separated directory list from CLI flag.
 *
 * Handles various input types from CLI parsing:
 * - String: "dir1,dir2,dir3" → ["dir1", "dir2", "dir3"]
 * - Boolean/undefined: Returns defaults or undefined
 *
 * Trims whitespace and filters empty strings.
 *
 * @example
 * parseDirs("Projects,Areas") // → ["Projects", "Areas"]
 * parseDirs("Projects, Areas ") // → ["Projects", "Areas"]
 * parseDirs(true, ["default"]) // → ["default"]
 * parseDirs(undefined, ["default"]) // → ["default"]
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
 * Parse --arg flags into key=value overrides.
 *
 * Handles multiple input formats from CLI parsing:
 * - String: "key=value" → { key: "value" }
 * - Array: ["a=1", "b=2"] → { a: "1", b: "2" }
 * - Mixed arrays with booleans (filters out non-strings)
 *
 * Supports values containing "=" signs (e.g., "url=https://example.com?a=b").
 * Splits on first "=" and joins remaining parts as value.
 *
 * @example
 * parseArgOverrides("priority=high") // → { priority: "high" }
 * parseArgOverrides(["area=[[Work]]", "status=active"]) // → { area: "[[Work]]", status: "active" }
 * parseArgOverrides("url=https://example.com?a=b") // → { url: "https://example.com?a=b" }
 * parseArgOverrides([true, "key=val"]) // → { key: "val" } (filters out non-strings)
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
		const [rawKey, ...valueParts] = arg.split("=");
		if (rawKey && valueParts.length > 0) {
			const key = rawKey.trim();
			const value = valueParts.join("=").trim();
			// Skip entries with empty key or value (after trimming)
			if (key && value) {
				overrides[key] = value;
			}
		}
	}
	return overrides;
}

/**
 * Normalize a flag value to single value (string or boolean).
 * If array (from duplicate flags), returns the first element.
 *
 * Handles the common case where CLI parsers represent duplicate flags
 * as arrays: `--key val1 --key val2` → `{ key: ["val1", "val2"] }`
 *
 * @param value - Raw flag value from CLI parser
 * @returns First element if array, otherwise the value as-is
 *
 * @example
 * normalizeFlagValue("test") // → "test"
 * normalizeFlagValue(true) // → true
 * normalizeFlagValue(["first", "second"]) // → "first"
 * normalizeFlagValue(undefined) // → undefined
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
 * Normalize all flags in a record by converting array values to their first element.
 *
 * Used for functions that don't expect array flag values.
 * Removes undefined values from the result.
 *
 * @param flags - Raw flags record from CLI parser
 * @returns Normalized flags with single values only
 *
 * @example
 * normalizeFlags({ single: "value", array: ["first", "second"], bool: true })
 * // → { single: "value", array: "first", bool: true }
 */
export function normalizeFlags(
	flags: Record<string, string | boolean | (string | boolean)[]>,
): Record<string, string | boolean> {
	const normalized: Record<string, string | boolean> = {};
	for (const [key, value] of Object.entries(flags)) {
		const norm = normalizeFlagValue(value);
		if (norm !== undefined) {
			normalized[key] = norm;
		}
	}
	return normalized;
}

/**
 * Parse comma-separated list from CLI flag value.
 *
 * Trims whitespace and filters empty strings.
 * Returns empty array for non-string inputs.
 *
 * @param value - CLI flag value (string, boolean, or undefined)
 * @returns Array of trimmed, non-empty strings
 *
 * @example
 * parseCommaSeparatedList("a,b,c") // → ["a", "b", "c"]
 * parseCommaSeparatedList("a, b , c") // → ["a", "b", "c"]
 * parseCommaSeparatedList("a,,b") // → ["a", "b"]
 * parseCommaSeparatedList(true) // → []
 * parseCommaSeparatedList(undefined) // → []
 */
export function parseCommaSeparatedList(
	value: string | boolean | undefined,
): string[] {
	if (typeof value !== "string") return [];
	return value
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}

/**
 * Safely retrieves a string flag value from parsed CLI flags.
 *
 * Handles flag values that may be strings, booleans, or arrays (from duplicate flags).
 * Returns the first string value found, or undefined if no string value exists.
 *
 * @param flags - Parsed CLI flags from parseArgs()
 * @param key - Flag name to retrieve
 * @returns String value if found, undefined otherwise
 *
 * @example
 * const flags = parseArgs(["--session-id", "116001"]).flags;
 * getStringFlag(flags, "session-id") // → "116001"
 *
 * @example
 * const flags = parseArgs(["--verbose"]).flags;
 * getStringFlag(flags, "verbose") // → undefined (boolean flag)
 *
 * @example
 * const flags = parseArgs(["--arg", "a", "--arg", "b"]).flags;
 * getStringFlag(flags, "arg") // → "a" (first array element)
 */
export function getStringFlag(
	flags: Record<string, string | boolean | (string | boolean)[]>,
	key: string,
): string | undefined {
	const value = flags[key];
	if (typeof value === "string") return value;
	if (Array.isArray(value)) {
		const firstString = value.find((v): v is string => typeof v === "string");
		return firstString;
	}
	return undefined;
}

/**
 * Output error message and exit with code 1.
 *
 * Formats error in JSON or markdown based on ResponseFormat.
 * JSON format includes optional details object.
 * Markdown format prints to stderr.
 *
 * This function never returns (calls process.exit(1)).
 *
 * @param format - Output format (from parseResponseFormat)
 * @param message - Error message to display
 * @param details - Optional additional error details (JSON only)
 *
 * @example
 * import { ResponseFormat } from "@sidequest/core/mcp-response";
 * outputError(ResponseFormat.JSON, "Missing required flag --session-id");
 *
 * @example
 * outputError(
 *   ResponseFormat.MARKDOWN,
 *   "Invalid ticket format",
 *   { expected: "--tickets 'ADULT:1,SENIOR:2'" }
 * );
 */
export function outputError(
	format: "json" | "markdown",
	message: string,
	details?: Record<string, unknown>,
): never {
	if (format === "json") {
		console.log(
			JSON.stringify({
				success: false,
				error: message,
				...(details ? { details } : {}),
			}),
		);
	} else {
		console.error(`Error: ${message}`);
		if (details) {
			console.error(JSON.stringify(details, null, 2));
		}
	}
	process.exit(1);
}
