/**
 * Find command - Locate symbol definitions by name
 *
 * Searches PROJECT_INDEX.json for symbol definitions with exact or fuzzy matching.
 * Supports dual output formats (markdown table or JSON).
 */

import { color, OutputFormat } from "../formatters/output";
import {
	findSymbol,
	findSymbolFuzzy,
	type Symbol as IndexSymbol,
	loadProjectIndex,
} from "../utils/index-parser";

/**
 * Format symbol results as markdown table
 */
function formatMarkdown(
	results: Array<{ file: string; symbol: IndexSymbol }>,
	query: string,
): string {
	if (results.length === 0) {
		return color("yellow", `\n⚠️  No symbols found matching: ${query}\n`);
	}

	let output = color("cyan", `\n📍 Found ${results.length} symbol(s)\n\n`);

	// Group by file
	const byFile = new Map<string, IndexSymbol[]>();
	for (const { file, symbol } of results) {
		if (!byFile.has(file)) {
			byFile.set(file, []);
		}
		byFile.get(file)?.push(symbol);
	}

	// Output each file
	for (const [file, symbols] of byFile.entries()) {
		output += color("dim", `${file}:\n`);
		for (const symbol of symbols) {
			const typeColor = getTypeColor(symbol.type);
			output += `  ${color("dim", "•")} ${color(typeColor, symbol.type.padEnd(10))} ${color("blue", symbol.name)} ${color("dim", `(line ${symbol.start_line}`)}\n`;
		}
		output += "\n";
	}

	return output;
}

/**
 * Get color for symbol type
 */
function getTypeColor(
	type: string,
): "blue" | "green" | "magenta" | "cyan" | "yellow" {
	switch (type) {
		case "function":
			return "blue";
		case "class":
			return "green";
		case "interface":
		case "type":
			return "magenta";
		case "constant":
			return "cyan";
		default:
			return "yellow";
	}
}

/**
 * Format symbol results as JSON
 */
function formatJSON(
	results: Array<{ file: string; symbol: IndexSymbol }>,
	query: string,
): string {
	return JSON.stringify(
		{
			query,
			count: results.length,
			results: results.map(({ file, symbol }) => ({
				file,
				name: symbol.name,
				type: symbol.type,
				line: symbol.start_line,
				code: symbol.code,
			})),
		},
		null,
		2,
	);
}

/**
 * Execute find command
 *
 * @param symbol - Symbol name to search for
 * @param format - Output format (markdown or JSON)
 */
export async function executeFind(
	symbol: string,
	format: OutputFormat,
): Promise<void> {
	try {
		const index = await loadProjectIndex();

		// Try exact match first
		let results: Array<{ file: string; symbol: IndexSymbol }> = findSymbol(
			index,
			symbol,
		);

		// If no exact match, try fuzzy search
		if (results.length === 0) {
			const fuzzyResults = findSymbolFuzzy(index, symbol);
			if (fuzzyResults.length > 0 && format === OutputFormat.MARKDOWN) {
				console.log(
					color(
						"yellow",
						`\n⚠️  No exact match for "${symbol}". Showing fuzzy matches:\n`,
					),
				);
			}
			results = fuzzyResults.map(({ file, symbol: sym }) => ({
				file,
				symbol: sym,
			}));
		}

		// Output results
		if (format === OutputFormat.JSON) {
			console.log(formatJSON(results, symbol));
		} else {
			console.log(formatMarkdown(results, symbol));
		}
	} catch (error) {
		if (format === OutputFormat.JSON) {
			console.error(
				JSON.stringify(
					{
						error: error instanceof Error ? error.message : "Unknown error",
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
			);
		}

		process.exit(1);
	}
}
