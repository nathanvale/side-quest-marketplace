/**
 * Command-line argument parsing utilities
 *
 * Adapted from Firecrawl plugin's argument parsing pattern.
 * Parses arguments in the format: <command> [positional] [--flag value]
 */

/**
 * Parsed command-line arguments
 */
export interface ParsedArgs {
	/** The subcommand (e.g., "movies", "session", "pricing") */
	command: string;
	/** Positional arguments after the command */
	positional: string[];
	/** Named flags (e.g., --session-id 116001) */
	flags: Record<string, string | boolean>;
}

/**
 * Parses command-line arguments into a structured object.
 *
 * @param args - Raw arguments from process.argv.slice(2)
 * @returns Parsed arguments with command, positional args, and flags
 *
 * @example
 * ```typescript
 * parseArgs(["movies"]);
 * // { command: "movies", positional: [], flags: {} }
 *
 * parseArgs(["session", "--session-id", "116001"]);
 * // { command: "session", positional: [], flags: { "session-id": "116001" } }
 *
 * parseArgs(["pricing", "--session-id", "116001", "--verbose"]);
 * // { command: "pricing", positional: [], flags: { "session-id": "116001", "verbose": "true" } }
 * ```
 */
export function parseArgs(args: string[]): ParsedArgs {
	const command = args[0] ?? "";
	const positional: string[] = [];
	const flags: Record<string, string | boolean> = {};

	let i = 1;
	while (i < args.length) {
		const arg = args[i] as string;

		if (arg.startsWith("--")) {
			// Handle --flag, --flag value, or --flag=value
			const [rawKey, inlineValue] = arg.slice(2).split("=");
			const key = rawKey ?? "";
			const nextArg = args[i + 1];

			// Check if there's a value after the flag
			if (inlineValue !== undefined) {
				flags[key] = inlineValue;
				i++;
			} else if (nextArg && !nextArg.startsWith("--")) {
				flags[key] = nextArg;
				i += 2;
			} else {
				// Boolean flag (no value)
				flags[key] = true;
				i++;
			}
		} else {
			// Positional argument
			positional.push(arg);
			i++;
		}
	}

	return { command, positional, flags };
}
