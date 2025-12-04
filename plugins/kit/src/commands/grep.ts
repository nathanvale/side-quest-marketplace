/**
 * Grep command - Fast text search across repository files
 *
 * Wraps executeKitGrep to provide direct CLI and MCP access to Kit's grep functionality.
 * Supports both literal patterns and regex with configurable filtering options.
 */

import { color, OutputFormat } from "../formatters/output";
import { executeKitGrep } from "../kit-wrapper";
import type { GrepOptions, GrepResult } from "../types";

/**
 * Format grep result as markdown
 *
 * Groups matches by file with colorized output.
 *
 * @param result - Grep result to format
 * @returns Formatted markdown string
 */
function formatMarkdown(result: GrepResult): string {
	const { pattern, matches, count } = result;

	if (count === 0) {
		return color("yellow", `\n⚠️  No matches found for pattern: ${pattern}\n`);
	}

	let output = color("cyan", `\n🔍 Found ${count} match(es) for: `);
	output += color("blue", pattern);
	output += "\n\n";

	// Group by file
	const byFile = new Map<string, typeof matches>();
	for (const match of matches) {
		if (!byFile.has(match.file)) {
			byFile.set(match.file, []);
		}
		byFile.get(match.file)?.push(match);
	}

	// Output each file
	for (const [file, fileMatches] of byFile.entries()) {
		output += color("dim", `${file}:\n`);
		for (const match of fileMatches) {
			output += `  ${color("dim", `L${match.line}:`)} ${match.content.trim()}\n`;
		}
		output += "\n";
	}

	return output;
}

/**
 * Format grep result as JSON
 *
 * @param result - Grep result to format
 * @returns JSON string
 */
function formatJSON(result: GrepResult): string {
	return JSON.stringify(result, null, 2);
}

/**
 * Execute grep command
 *
 * Searches for text/regex patterns across repository files using Kit CLI.
 * Supports file filtering, case sensitivity, and result limits.
 *
 * @param pattern - Search pattern (text or regex)
 * @param format - Output format (markdown or JSON)
 * @param options - Grep options (path, include, exclude, etc.)
 */
export async function executeGrep(
	pattern: string,
	format: OutputFormat,
	options: Partial<GrepOptions> = {},
): Promise<void> {
	try {
		// Execute kit grep
		const grepResult = executeKitGrep({
			pattern,
			...options,
		});

		// Handle errors
		if ("error" in grepResult) {
			if (format === OutputFormat.JSON) {
				console.error(
					JSON.stringify(
						{
							error: grepResult.error,
							pattern,
							isError: true,
						},
						null,
						2,
					),
				);
			} else {
				console.error(color("red", `\n❌ Error: ${grepResult.error}\n`));
			}
			process.exit(1);
		}

		// Output results
		if (format === OutputFormat.JSON) {
			console.log(formatJSON(grepResult));
		} else {
			console.log(formatMarkdown(grepResult));
		}
	} catch (error) {
		if (format === OutputFormat.JSON) {
			console.error(
				JSON.stringify(
					{
						error: error instanceof Error ? error.message : "Unknown error",
						pattern,
						isError: true,
					},
					null,
					2,
				),
			);
		} else {
			console.error(
				color("red", "\n❌ Error:"),
				error instanceof Error ? error.message : error,
				"\n",
			);
		}
		process.exit(1);
	}
}
