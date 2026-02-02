/**
 * PROJECT_INDEX.json parser and query utilities
 *
 * Provides TypeScript-based queries to replace jq dependencies.
 * Supports git-style directory search to find index from any subdirectory.
 */

import { dirname, join, resolve } from "node:path";
import { findUpSync, pathExistsSync } from "@side-quest/core/fs";

/**
 * Symbol definition from Kit CLI index
 */
export interface Symbol {
	name: string;
	type: "function" | "class" | "interface" | "type" | "constant" | "variable";
	start_line: number;
	end_line: number;
	code: string;
	file: string;
}

/**
 * File tree entry
 */
export interface FileTreeEntry {
	path: string;
	is_dir: boolean;
	name: string;
	size: number;
}

/**
 * PROJECT_INDEX.json structure (from Kit CLI)
 */
export interface ProjectIndex {
	file_tree: FileTreeEntry[];
	files: FileTreeEntry[];
	symbols: Record<string, Symbol[]>;
}

/**
 * Search up directory tree for PROJECT_INDEX.json (git-style)
 *
 * Note: Delegates to @sidequest/core/fs findUpSync for the file search.
 *
 * @param startDir - Directory to start searching from (default: process.cwd())
 * @returns Absolute path to PROJECT_INDEX.json
 * @throws Error if index not found
 */
export async function findProjectIndex(
	startDir: string = process.cwd(),
): Promise<string> {
	const indexPath = findUpSync("PROJECT_INDEX.json", startDir);

	if (indexPath) {
		return indexPath;
	}

	throw new Error(
		"PROJECT_INDEX.json not found in current directory or any parent directory.\n" +
			"Run: bun run src/cli.ts prime",
	);
}

/**
 * Resolve explicit path to PROJECT_INDEX.json
 *
 * Handles three cases:
 * 1. Path to PROJECT_INDEX.json file directly
 * 2. Path to directory containing PROJECT_INDEX.json
 * 3. Relative path that needs resolution
 *
 * @param explicitPath - Explicit path provided by user
 * @returns Absolute path to PROJECT_INDEX.json
 * @throws Error if index not found at specified path
 */
export function resolveExplicitIndexPath(explicitPath: string): string {
	const resolved = resolve(explicitPath);

	// Case 1: Direct path to PROJECT_INDEX.json
	if (resolved.endsWith("PROJECT_INDEX.json")) {
		if (pathExistsSync(resolved)) {
			return resolved;
		}
		throw new Error(`PROJECT_INDEX.json not found at: ${resolved}`);
	}

	// Case 2: Directory containing PROJECT_INDEX.json
	const indexInDir = join(resolved, "PROJECT_INDEX.json");
	if (pathExistsSync(indexInDir)) {
		return indexInDir;
	}

	throw new Error(
		`PROJECT_INDEX.json not found at: ${indexInDir}\n` +
			"Specify either:\n" +
			"  - Path to PROJECT_INDEX.json file\n" +
			"  - Directory containing PROJECT_INDEX.json",
	);
}

/**
 * Load and parse PROJECT_INDEX.json
 *
 * @param explicitPath - Optional explicit path to index file or directory
 * @returns Parsed project index
 * @throws Error if index not found or invalid JSON
 */
export async function loadProjectIndex(
	explicitPath?: string,
): Promise<ProjectIndex> {
	const indexPath = explicitPath
		? resolveExplicitIndexPath(explicitPath)
		: await findProjectIndex();
	const file = Bun.file(indexPath);
	return (await file.json()) as ProjectIndex;
}

/**
 * Find symbols by name across all files
 *
 * @param index - Project index
 * @param symbolName - Symbol name to search for (exact match)
 * @returns Array of matching symbols with their file paths
 */
export function findSymbol(
	index: ProjectIndex,
	symbolName: string,
): Array<{ file: string; symbol: Symbol }> {
	const results: Array<{ file: string; symbol: Symbol }> = [];

	for (const [file, symbols] of Object.entries(index.symbols)) {
		for (const symbol of symbols) {
			if (symbol.name === symbolName) {
				results.push({ file, symbol });
			}
		}
	}

	return results;
}

/**
 * Find symbols by fuzzy name matching (case-insensitive substring)
 *
 * @param index - Project index
 * @param query - Search query (substring, case-insensitive)
 * @returns Array of matching symbols with their file paths
 */
export function findSymbolFuzzy(
	index: ProjectIndex,
	query: string,
): Array<{ file: string; symbol: Symbol; score: number }> {
	const results: Array<{ file: string; symbol: Symbol; score: number }> = [];
	const lowerQuery = query.toLowerCase();

	for (const [file, symbols] of Object.entries(index.symbols)) {
		for (const symbol of symbols) {
			const lowerName = symbol.name.toLowerCase();

			// Exact match (highest score)
			if (lowerName === lowerQuery) {
				results.push({ file, symbol, score: 100 });
			}
			// Starts with (high score)
			else if (lowerName.startsWith(lowerQuery)) {
				results.push({ file, symbol, score: 75 });
			}
			// Contains (lower score)
			else if (lowerName.includes(lowerQuery)) {
				results.push({ file, symbol, score: 50 });
			}
		}
	}

	// Sort by score descending, then by name
	return results.sort((a, b) => {
		if (b.score !== a.score) return b.score - a.score;
		return a.symbol.name.localeCompare(b.symbol.name);
	});
}

/**
 * Get all symbols in a file
 *
 * @param index - Project index
 * @param filePath - File path (can be relative or absolute)
 * @returns Array of symbols in the file
 */
export function getFileSymbols(
	index: ProjectIndex,
	filePath: string,
): Symbol[] {
	// Try exact match first
	if (index.symbols[filePath]) {
		return index.symbols[filePath];
	}

	// Try finding by filename (if relative path provided)
	for (const [path, symbols] of Object.entries(index.symbols)) {
		if (path.endsWith(filePath)) {
			return symbols;
		}
	}

	return [];
}

/**
 * Get all files with their symbol counts
 *
 * @param index - Project index
 * @returns Array of files with symbol counts
 */
export function getFileStats(
	index: ProjectIndex,
): Array<{ file: string; symbolCount: number }> {
	const stats: Array<{ file: string; symbolCount: number }> = [];

	for (const [file, symbols] of Object.entries(index.symbols)) {
		stats.push({ file, symbolCount: symbols.length });
	}

	// Sort by symbol count descending
	return stats.sort((a, b) => b.symbolCount - a.symbolCount);
}

/**
 * Get symbol distribution by type
 *
 * @param index - Project index
 * @returns Record of symbol types to counts
 */
export function getSymbolTypeDistribution(
	index: ProjectIndex,
): Record<string, number> {
	const distribution: Record<string, number> = {
		function: 0,
		class: 0,
		interface: 0,
		type: 0,
		constant: 0,
		variable: 0,
	};

	for (const symbols of Object.values(index.symbols)) {
		for (const symbol of symbols) {
			distribution[symbol.type] = (distribution[symbol.type] || 0) + 1;
		}
	}

	return distribution;
}

/**
 * Get all exported symbols (heuristic: uppercase or common export patterns)
 *
 * Note: Kit index doesn't have explicit "exported" flag, so we use naming conventions
 *
 * @param index - Project index
 * @returns Array of likely exported symbols
 */
export function getExportedSymbols(
	index: ProjectIndex,
): Array<{ file: string; symbol: Symbol }> {
	const exported: Array<{ file: string; symbol: Symbol }> = [];

	for (const [file, symbols] of Object.entries(index.symbols)) {
		// Skip test files
		if (file.includes(".test.") || file.includes(".spec.")) {
			continue;
		}

		for (const symbol of symbols) {
			// Heuristic: likely exported if:
			// 1. Starts with uppercase (classes, types, interfaces)
			// 2. Exported by naming convention
			const firstChar = symbol.name[0];
			if (firstChar && firstChar === firstChar.toUpperCase()) {
				exported.push({ file, symbol });
			}
		}
	}

	return exported;
}

/**
 * Group symbols by directory
 *
 * @param index - Project index
 * @returns Record of directory paths to symbol counts
 */
export function groupSymbolsByDirectory(
	index: ProjectIndex,
): Record<string, number> {
	const dirCounts: Record<string, number> = {};

	for (const [file, symbols] of Object.entries(index.symbols)) {
		const dir = dirname(file);
		dirCounts[dir] = (dirCounts[dir] || 0) + symbols.length;
	}

	return dirCounts;
}

/**
 * Get directory with most symbols (complexity hotspot)
 *
 * @param index - Project index
 * @param topN - Number of top directories to return
 * @returns Array of directories sorted by symbol count
 */
export function getComplexityHotspots(
	index: ProjectIndex,
	topN = 10,
): Array<{ directory: string; symbolCount: number }> {
	const dirCounts = groupSymbolsByDirectory(index);

	const sorted = Object.entries(dirCounts)
		.map(([directory, symbolCount]) => ({ directory, symbolCount }))
		.sort((a, b) => b.symbolCount - a.symbolCount);

	return sorted.slice(0, topN);
}

/**
 * Get all symbols of a specific type
 *
 * @param index - Project index
 * @param type - Symbol type to filter by
 * @returns Array of matching symbols with file paths
 */
export function getSymbolsByType(
	index: ProjectIndex,
	type: Symbol["type"],
): Array<{ file: string; symbol: Symbol }> {
	const results: Array<{ file: string; symbol: Symbol }> = [];

	for (const [file, symbols] of Object.entries(index.symbols)) {
		for (const symbol of symbols) {
			if (symbol.type === type) {
				results.push({ file, symbol });
			}
		}
	}

	return results;
}
