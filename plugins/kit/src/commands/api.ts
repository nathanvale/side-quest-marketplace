/**
 * API command - List module public API
 *
 * Extracts and displays all exported symbols from a directory,
 * providing a quick overview of the module's public interface.
 */

import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { color, OutputFormat } from "../formatters/output";

/**
 * Get enhanced PATH for kit CLI execution
 */
function getEnhancedPath(): string {
	const currentPath = process.env.PATH || "";
	const home = homedir();

	const additionalPaths = [
		join(home, ".local", "bin"),
		"/opt/homebrew/bin",
		"/usr/local/bin",
	];

	const pathsToAdd = additionalPaths.filter(
		(p) => !currentPath.split(":").includes(p),
	);

	return pathsToAdd.length > 0
		? `${pathsToAdd.join(":")}:${currentPath}`
		: currentPath;
}

/**
 * Code symbol from Kit CLI
 */
interface CodeSymbol {
	name: string;
	type: string;
	file: string;
	start_line: number;
	end_line: number;
	code: string;
}

/**
 * Extract symbols from a directory using kit symbols CLI
 *
 * @param directory - Directory path to analyze
 * @returns Array of code symbols
 */
function extractSymbols(directory: string): CodeSymbol[] {
	const result = spawnSync("kit", ["symbols", directory, "--format", "json"], {
		encoding: "utf8",
		timeout: 30000,
		env: {
			...process.env,
			PATH: getEnhancedPath(),
		},
	});

	if (result.status !== 0) {
		throw new Error(
			`Failed to extract symbols: ${result.stderr || result.stdout}`,
		);
	}

	try {
		const symbols: CodeSymbol[] = JSON.parse(result.stdout);
		return symbols;
	} catch (error) {
		throw new Error(
			`Failed to parse symbols output: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}

/**
 * Check if a symbol is likely exported
 *
 * Heuristics:
 * 1. Classes, interfaces, types starting with uppercase
 * 2. Functions that are CamelCase or exported by convention
 * 3. Constants (UPPER_CASE)
 * 4. Not internal (_prefixed or in .test/.spec files)
 *
 * @param symbol - Symbol to check
 * @returns True if symbol appears to be exported
 */
function isLikelyExported(symbol: CodeSymbol): boolean {
	// Skip test files
	if (symbol.file.includes(".test.") || symbol.file.includes(".spec.")) {
		return false;
	}

	// Skip internal symbols (prefixed with _)
	if (symbol.name.startsWith("_")) {
		return false;
	}

	const firstChar = symbol.name[0];
	if (!firstChar) return false;

	// Classes, interfaces, types (uppercase first letter)
	if (
		["class", "interface", "type"].includes(symbol.type) &&
		firstChar === firstChar.toUpperCase()
	) {
		return true;
	}

	// Constants (all uppercase with underscores)
	if (symbol.type === "constant" && symbol.name === symbol.name.toUpperCase()) {
		return true;
	}

	// Functions that are CamelCase or exported convention
	if (symbol.type === "function") {
		// Starts with uppercase (PascalCase) or is execute* pattern
		if (
			firstChar === firstChar.toUpperCase() ||
			symbol.name.startsWith("execute") ||
			symbol.name.startsWith("create") ||
			symbol.name.startsWith("get") ||
			symbol.name.startsWith("set") ||
			symbol.name.startsWith("is") ||
			symbol.name.startsWith("has")
		) {
			return true;
		}
	}

	return false;
}

/**
 * Group symbols by file
 */
function groupByFile(symbols: CodeSymbol[]): Map<string, CodeSymbol[]> {
	const byFile = new Map<string, CodeSymbol[]>();

	for (const symbol of symbols) {
		if (!byFile.has(symbol.file)) {
			byFile.set(symbol.file, []);
		}
		byFile.get(symbol.file)?.push(symbol);
	}

	return byFile;
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
 * Format API results as markdown
 */
function formatMarkdown(symbols: CodeSymbol[], directory: string): string {
	if (symbols.length === 0) {
		return color("yellow", `\n⚠️  No exported symbols found in: ${directory}\n`);
	}

	let output = color("cyan", `\n📦 Public API for: ${directory}\n\n`);
	output += color("dim", `Exported symbols: ${symbols.length}\n\n`);

	// Group by file
	const byFile = groupByFile(symbols);

	// Sort files alphabetically
	const sortedFiles = Array.from(byFile.keys()).sort();

	// Output each file
	for (const file of sortedFiles) {
		const fileSymbols = byFile.get(file) || [];
		const relativeFile = file.startsWith(directory)
			? file.slice(directory.length).replace(/^\//, "")
			: file;

		output += color("dim", `${relativeFile}:\n`);

		// Sort symbols by type, then name
		const sortedSymbols = fileSymbols.sort((a, b) => {
			if (a.type !== b.type) {
				return a.type.localeCompare(b.type);
			}
			return a.name.localeCompare(b.name);
		});

		for (const symbol of sortedSymbols) {
			const typeColor = getTypeColor(symbol.type);
			output += `  ${color("dim", "•")} ${color(typeColor, symbol.type.padEnd(10))} ${color("blue", symbol.name)}\n`;
		}
		output += "\n";
	}

	return output;
}

/**
 * Format API results as JSON
 */
function formatJSON(symbols: CodeSymbol[], directory: string): string {
	// Group by file
	const byFile = groupByFile(symbols);

	// Convert to object structure
	const fileGroups: Record<
		string,
		Array<{ name: string; type: string; line: number }>
	> = {};

	for (const [file, fileSymbols] of byFile.entries()) {
		const relativeFile = file.startsWith(directory)
			? file.slice(directory.length).replace(/^\//, "")
			: file;

		fileGroups[relativeFile] = fileSymbols.map((s) => ({
			name: s.name,
			type: s.type,
			line: s.start_line,
		}));
	}

	return JSON.stringify(
		{
			directory,
			count: symbols.length,
			files: fileGroups,
		},
		null,
		2,
	);
}

/**
 * Execute API listing command
 *
 * @param directory - Directory path to analyze
 * @param format - Output format (markdown or JSON)
 *
 * The API command extracts the public interface of a module:
 * 1. Uses kit symbols CLI to extract all symbols from directory
 * 2. Filters to likely exported symbols using heuristics:
 *    - Uppercase-first classes/types/interfaces
 *    - UPPER_CASE constants
 *    - Common function naming patterns (execute*, get*, is*, etc.)
 *    - Excludes test files and _internal symbols
 * 3. Groups results by file
 * 4. Formats as markdown table or JSON
 */
export async function executeApi(
	directory: string,
	format: OutputFormat,
): Promise<void> {
	try {
		// Extract all symbols from directory
		const allSymbols = extractSymbols(directory);

		// Filter to exported symbols only
		const exportedSymbols = allSymbols.filter(isLikelyExported);

		// Output results
		if (format === OutputFormat.JSON) {
			console.log(formatJSON(exportedSymbols, directory));
		} else {
			console.log(formatMarkdown(exportedSymbols, directory));
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
