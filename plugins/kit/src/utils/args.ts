/**
 * Command-line argument parsing utilities
 *
 * Adapted from cinema-bandit plugin's argument parsing pattern.
 * Parses arguments in the format: <command> [positional] [--flag value]
 */

/**
 * Parsed command-line arguments
 */
export interface ParsedArgs {
	/** The subcommand (e.g., "prime", "find", "callers") */
	command: string;
	/** Positional arguments after the command */
	positional: string[];
	/** Named flags (e.g., --format json, --force) */
	flags: Record<string, string>;
}

/**
 * Parses command-line arguments into a structured object.
 *
 * @param args - Raw arguments from process.argv.slice(2)
 * @returns Parsed arguments with command, positional args, and flags
 *
 * @example
 * ```typescript
 * parseArgs(["prime"]);
 * // { command: "prime", positional: [], flags: {} }
 *
 * parseArgs(["find", "MyFunction"]);
 * // { command: "find", positional: ["MyFunction"], flags: {} }
 *
 * parseArgs(["find", "MyFunction", "--format", "json"]);
 * // { command: "find", positional: ["MyFunction"], flags: { "format": "json" } }
 *
 * parseArgs(["prime", "--force"]);
 * // { command: "prime", positional: [], flags: { "force": "true" } }
 * ```
 */
export function parseArgs(args: string[]): ParsedArgs {
	const command = args[0] ?? "";
	const positional: string[] = [];
	const flags: Record<string, string> = {};

	let i = 1;
	while (i < args.length) {
		const arg = args[i] as string;

		if (arg.startsWith("--")) {
			// Handle --flag or --flag value
			const key = arg.slice(2);
			const nextArg = args[i + 1];

			// Check if there's a value after the flag
			if (nextArg && !nextArg.startsWith("--")) {
				flags[key] = nextArg;
				i += 2;
			} else {
				// Boolean flag (no value)
				flags[key] = "true";
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
