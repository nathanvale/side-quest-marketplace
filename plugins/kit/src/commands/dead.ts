/**
 * Dead command - Find unused exports (dead code detection)
 *
 * Uses kit usages to find all symbols and identifies exports that have
 * no call sites (only definitions, no references).
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	ensureCommandAvailable,
	spawnWithTimeout,
} from "@sidequest/core/spawn";
import { color, OutputFormat } from "../formatters/output";
import {
	getExportedSymbols,
	type Symbol as IndexSymbol,
	loadProjectIndex,
} from "../utils/index-parser";

/**
 * Kit usages result structure
 */
interface KitUsage {
	file: string;
	type: string;
	name: string;
	line: number | null;
	context: string | null;
}

/**
 * Dead code detection result
 */
interface DeadCodeResult {
	file: string;
	symbol: IndexSymbol;
	type: string;
}

/**
 * Find symbol usages using kit CLI
 *
 * @param symbolName - Symbol name to search for
 * @param repoPath - Repository path
 * @returns Array of usages or null if error
 */
async function findUsages(
	symbolName: string,
	repoPath: string,
): Promise<KitUsage[] | null> {
	let tempDir: string | null = null;

	try {
		// Create temp file for output
		tempDir = mkdtempSync(join(tmpdir(), "kit-dead-"));
		const outputFile = join(tempDir, "usages.json");
		const kitCmd = ensureCommandAvailable("kit");

		const result = await spawnWithTimeout(
			[kitCmd, "usages", repoPath, symbolName, "-o", outputFile],
			30_000,
			{ cwd: repoPath },
		);

		if (result.timedOut || result.exitCode !== 0) {
			return null;
		}

		// Read the output file
		const file = Bun.file(outputFile);
		const text = await file.text();
		const usages = JSON.parse(text) as KitUsage[];

		return usages;
	} catch {
		return null;
	} finally {
		// Clean up temp directory
		if (tempDir) {
			try {
				rmSync(tempDir, { recursive: true, force: true });
			} catch {
				// Ignore cleanup errors
			}
		}
	}
}

/**
 * Format dead code results as markdown
 *
 * @param results - Dead code detection results
 * @param searchPath - Path that was searched
 * @returns Formatted markdown string
 */
function formatMarkdown(results: DeadCodeResult[], searchPath: string): string {
	if (results.length === 0) {
		return color(
			"green",
			`\n✓ No dead code found in: ${searchPath}\n\nAll exported symbols appear to be used.\n`,
		);
	}

	let output = color(
		"yellow",
		`\n⚠️  Found ${results.length} potentially unused export(s)\n\n`,
	);
	output += color("dim", `Search path: ${searchPath}\n\n`);

	// Group by file
	const byFile = new Map<string, DeadCodeResult[]>();
	for (const result of results) {
		if (!byFile.has(result.file)) {
			byFile.set(result.file, []);
		}
		byFile.get(result.file)?.push(result);
	}

	// Output each file
	for (const [file, deadSymbols] of byFile.entries()) {
		output += color("cyan", `${file}:\n`);
		for (const { symbol, type } of deadSymbols) {
			output += `  ${color("dim", "•")} ${color("red", type.padEnd(10))} ${color("blue", symbol.name)} ${color("dim", `(line ${symbol.start_line})`)}\n`;
		}
		output += "\n";
	}

	output += color(
		"dim",
		"Note: These symbols have no detected usages. They may be:\n",
	);
	output += color("dim", "  • Actually unused (safe to remove)\n");
	output += color("dim", "  • Used dynamically (string references)\n");
	output += color("dim", "  • Exported for external consumers\n");
	output += color("dim", "  • Part of public API\n\n");

	return output;
}

/**
 * Format dead code results as JSON
 *
 * @param results - Dead code detection results
 * @param searchPath - Path that was searched
 * @returns JSON string
 */
function formatJSON(results: DeadCodeResult[], searchPath: string): string {
	return JSON.stringify(
		{
			searchPath,
			count: results.length,
			deadCode: results.map(({ file, symbol, type }) => ({
				file,
				name: symbol.name,
				type,
				line: symbol.start_line,
				code: symbol.code,
			})),
		},
		null,
		2,
	);
}

/**
 * Execute dead code detection
 *
 * Finds exported symbols that have no usages (potential dead code).
 *
 * @param path - Optional path to scope search (default: current directory)
 * @param format - Output format (markdown or JSON)
 */
export async function executeDead(
	path: string | undefined,
	format: OutputFormat,
): Promise<void> {
	try {
		const searchPath = path || ".";

		// Load project index to get all exported symbols
		const index = await loadProjectIndex();
		const exportedSymbols = getExportedSymbols(index);

		// Filter by path if specified
		const filteredSymbols = path
			? exportedSymbols.filter(({ file }) => file.startsWith(searchPath))
			: exportedSymbols;

		if (filteredSymbols.length === 0) {
			if (format === OutputFormat.JSON) {
				console.log(
					JSON.stringify(
						{
							searchPath,
							count: 0,
							deadCode: [],
							message: "No exported symbols found in specified path",
						},
						null,
						2,
					),
				);
			} else {
				console.log(
					color("yellow", `\n⚠️  No exported symbols found in: ${searchPath}\n`),
				);
			}
			return;
		}

		// Find usages for each symbol
		const deadCode: DeadCodeResult[] = [];

		for (const { file, symbol } of filteredSymbols) {
			const usages = await findUsages(symbol.name, ".");

			// If no usages found or only 1 usage (the definition itself), mark as dead
			if (!usages || usages.length <= 1) {
				deadCode.push({ file, symbol, type: symbol.type });
			}
		}

		// Output results
		if (format === OutputFormat.JSON) {
			console.log(formatJSON(deadCode, searchPath));
		} else {
			console.log(formatMarkdown(deadCode, searchPath));
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
