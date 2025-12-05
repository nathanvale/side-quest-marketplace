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
 * Returns command, subcommand, positional args, and flags.
 *
 * @example
 * parseArgs(["config", "--format", "json"])
 * // → { command: "config", positional: [], flags: { format: "json" } }
 *
 * @example
 * parseArgs(["frontmatter", "migrate", "file.md", "--force", "2"])
 * // → { command: "frontmatter", subcommand: "migrate", positional: ["file.md"], flags: { force: "2" } }
 */
export function parseArgs(argv: string[]): {
	command: string;
	subcommand?: string;
	positional: string[];
	flags: Record<string, string | boolean>;
} {
	const positional: string[] = [];
	const flags: Record<string, string | boolean> = {};

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (!arg) continue;
		if (arg.startsWith("--")) {
			const [keyRaw, value] = arg.split("=");
			const key = keyRaw?.slice(2);
			if (!key) continue;
			const next = argv[i + 1];
			if (value !== undefined) {
				flags[key] = value;
			} else if (next && !next.startsWith("--")) {
				flags[key] = next;
				i++;
			} else {
				flags[key] = true;
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
