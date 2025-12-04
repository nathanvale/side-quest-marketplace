/**
 * Semantic search command - Natural language code search
 *
 * Uses kit semantic search to find code by meaning rather than exact text.
 * Gracefully falls back to grep if ML dependencies unavailable.
 */

import { color, OutputFormat } from "../formatters/output";
import { executeKitSemantic } from "../kit-wrapper";
import type { SemanticMatch, SemanticOptions, SemanticResult } from "../types";

/**
 * Execute semantic search command
 *
 * Performs natural language search over codebase using vector embeddings.
 * Shows warning with install instructions if semantic unavailable.
 *
 * @param query - Natural language search query
 * @param options - Search options (path, topK, chunkBy, buildIndex)
 * @param format - Output format (markdown or JSON)
 */
export async function executeSearch(
	query: string,
	options: Omit<SemanticOptions, "query">,
	format: OutputFormat,
): Promise<void> {
	try {
		// Execute semantic search
		const result = executeKitSemantic({ query, ...options });

		// Handle errors
		if ("error" in result) {
			if (format === OutputFormat.JSON) {
				console.error(
					JSON.stringify(
						{
							error: result.error,
							query,
							isError: true,
						},
						null,
						2,
					),
				);
			} else {
				console.error(color("red", "\n❌ Error:"), result.error, "\n");

				// Show install hint if semantic unavailable
				if ("hint" in result && result.hint) {
					console.error(color("yellow", "💡 Tip:"), result.hint, "\n");
				}
			}
			process.exit(1);
		}

		// Show fallback warning if grep was used
		if (result.fallback && format === OutputFormat.MARKDOWN) {
			console.log(
				color(
					"yellow",
					"\n⚠️  Semantic search unavailable - using grep fallback\n",
				),
			);
			if (result.installHint) {
				console.log(color("dim", result.installHint), "\n");
			}
		}

		// Output results
		if (format === OutputFormat.JSON) {
			console.log(JSON.stringify(result, null, 2));
		} else {
			console.log(formatMarkdown(result));
		}
	} catch (error) {
		if (format === OutputFormat.JSON) {
			console.error(
				JSON.stringify(
					{
						error: error instanceof Error ? error.message : "Unknown error",
						query,
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

/**
 * Format semantic results as markdown
 */
function formatMarkdown(result: SemanticResult): string {
	const { query, count, matches, fallback } = result;

	if (count === 0) {
		return color("yellow", `\n⚠️  No matches found for query: "${query}"\n`);
	}

	let output = color("cyan", `\n🔍 Found ${count} semantic match(es) for: `);
	output += color("blue", `"${query}"`);
	if (fallback) {
		output += color("dim", " (grep fallback)");
	}
	output += "\n\n";

	// Group by file
	const byFile = new Map<string, SemanticMatch[]>();
	for (const match of matches) {
		if (!byFile.has(match.file)) {
			byFile.set(match.file, []);
		}
		byFile.get(match.file)?.push(match);
	}

	// Output each file's matches
	for (const [file, fileMatches] of byFile.entries()) {
		output += color("dim", `${file}:\n`);
		for (const match of fileMatches) {
			const lineInfo = match.startLine
				? `L${match.startLine}${match.endLine ? `-${match.endLine}` : ""}`
				: "";
			const scoreStr = `(${(match.score * 100).toFixed(1)}%)`;

			output += `  ${color("dim", lineInfo)} ${color("green", scoreStr)}\n`;

			// Show chunk preview (first 2 lines max)
			const lines = match.chunk.split("\n").slice(0, 2);
			for (const line of lines) {
				output += `    ${color("dim", line.trim())}\n`;
			}
			output += "\n";
		}
	}

	return output;
}
