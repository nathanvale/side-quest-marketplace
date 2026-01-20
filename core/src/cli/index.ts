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
		return trimmed
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
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
