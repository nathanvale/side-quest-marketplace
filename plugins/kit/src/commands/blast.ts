/**
 * Blast command - Blast radius analysis
 *
 * Analyzes what code would be affected by changes to a specific file or symbol.
 * Uses kit grep and kit usages to trace multi-level dependencies.
 */

import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { color, OutputFormat } from "../formatters/output";
import { loadProjectIndex } from "../utils/index-parser";

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
 * Blast radius entry representing an affected file
 */
interface BlastEntry {
	file: string;
	line: number;
	reason: string;
	level: number; // 0 = target, 1 = direct dependency, 2+ = transitive
}

/**
 * Parse target argument into file/line or symbol name
 *
 * @param target - Target in format "file:line" or "symbolName"
 * @returns Parsed target information
 */
function parseTarget(target: string): {
	type: "location" | "symbol";
	file?: string;
	line?: number;
	symbol?: string;
} {
	// Check for file:line pattern
	const locationMatch = target.match(/^(.+):(\d+)$/);
	if (locationMatch?.[1] && locationMatch[2]) {
		return {
			type: "location",
			file: locationMatch[1],
			line: Number.parseInt(locationMatch[2], 10),
		};
	}

	// Otherwise treat as symbol name
	return {
		type: "symbol",
		symbol: target,
	};
}

/**
 * Find all files that import or use the target file
 *
 * @param targetFile - File path to analyze
 * @param repoPath - Repository root path
 * @returns Array of files that depend on the target
 */
function findFileDependents(
	targetFile: string,
	repoPath: string,
): BlastEntry[] {
	const entries: BlastEntry[] = [];

	// Normalize target file path (remove leading ./)
	const normalizedTarget = targetFile.replace(/^\.\//, "");

	// Search for imports of this file using grep
	// Match patterns like: import ... from './file' or require('./file')
	const fileBasename = normalizedTarget.replace(/\.[^.]+$/, ""); // Remove extension
	const pattern = `(import|require).*['"](.*${fileBasename}.*|.*${normalizedTarget}.*)['"']`;

	const result = spawnSync(
		"kit",
		["grep", repoPath, pattern, "--max-results", "500", "--format", "json"],
		{
			encoding: "utf8",
			timeout: 30000,
			env: {
				...process.env,
				PATH: getEnhancedPath(),
			},
		},
	);

	if (result.status === 0 && result.stdout) {
		try {
			const matches = JSON.parse(result.stdout);
			for (const match of matches) {
				// Don't include the target file itself
				if (match.file !== normalizedTarget) {
					entries.push({
						file: match.file,
						line: match.line,
						reason: "imports target file",
						level: 1,
					});
				}
			}
		} catch {
			// Ignore parse errors
		}
	}

	return entries;
}

/**
 * Find all usages of a symbol across the codebase
 *
 * @param symbolName - Symbol name to search for
 * @param repoPath - Repository root path
 * @returns Array of files that use this symbol
 */
function findSymbolUsages(symbolName: string, repoPath: string): BlastEntry[] {
	const entries: BlastEntry[] = [];

	// Use kit grep to find all references to the symbol
	const result = spawnSync(
		"kit",
		["grep", repoPath, symbolName, "--max-results", "500", "--format", "json"],
		{
			encoding: "utf8",
			timeout: 30000,
			env: {
				...process.env,
				PATH: getEnhancedPath(),
			},
		},
	);

	if (result.status === 0 && result.stdout) {
		try {
			const matches = JSON.parse(result.stdout);
			for (const match of matches) {
				entries.push({
					file: match.file,
					line: match.line,
					reason: `uses ${symbolName}`,
					level: 1,
				});
			}
		} catch {
			// Ignore parse errors
		}
	}

	return entries;
}

/**
 * Format blast results as markdown table
 */
function formatMarkdown(entries: BlastEntry[], target: string): string {
	if (entries.length === 0) {
		return color("yellow", `\n⚠️  No dependencies found for: ${target}\n`);
	}

	let output = color("cyan", `\n💥 Blast Radius Analysis for: ${target}\n\n`);
	output += color("dim", `Affected files: ${entries.length}\n\n`);

	// Group by level
	const byLevel = new Map<number, BlastEntry[]>();
	for (const entry of entries) {
		if (!byLevel.has(entry.level)) {
			byLevel.set(entry.level, []);
		}
		byLevel.get(entry.level)?.push(entry);
	}

	// Output each level
	const sortedLevels = Array.from(byLevel.keys()).sort((a, b) => a - b);
	for (const level of sortedLevels) {
		const levelEntries = byLevel.get(level) || [];
		const levelName =
			level === 0
				? "Target"
				: level === 1
					? "Direct Dependencies"
					: `Level ${level} Dependencies`;

		output += color("magenta", `${levelName}:\n`);
		for (const entry of levelEntries) {
			output += `  ${color("dim", "•")} ${entry.file}${color("dim", `:${entry.line}`)} ${color("yellow", `(${entry.reason}`)}\n`;
		}
		output += "\n";
	}

	return output;
}

/**
 * Format blast results as JSON
 */
function formatJSON(entries: BlastEntry[], target: string): string {
	return JSON.stringify(
		{
			target,
			count: entries.length,
			entries: entries.map((e) => ({
				file: e.file,
				line: e.line,
				reason: e.reason,
				level: e.level,
			})),
		},
		null,
		2,
	);
}

/**
 * Execute blast radius analysis command
 *
 * @param target - Target in format "file:line" or "symbolName"
 * @param format - Output format (markdown or JSON)
 *
 * The blast command performs multi-level impact analysis:
 * 1. Parses target (file location or symbol name)
 * 2. For file locations: finds all files that import/require it
 * 3. For symbols: finds all usages across the codebase using grep
 * 4. Groups results by dependency level
 * 5. Formats output as markdown table or JSON
 */
export async function executeBlast(
	target: string,
	format: OutputFormat,
): Promise<void> {
	try {
		const parsed = parseTarget(target);
		const index = await loadProjectIndex();
		const repoPath = process.cwd();

		let entries: BlastEntry[] = [];

		if (parsed.type === "location" && parsed.file) {
			// File-based blast radius
			entries.push({
				file: parsed.file,
				line: parsed.line || 0,
				reason: "target file",
				level: 0,
			});

			// Find all files that depend on this file
			const dependents = findFileDependents(parsed.file, repoPath);
			entries = entries.concat(dependents);
		} else if (parsed.type === "symbol" && parsed.symbol) {
			// Symbol-based blast radius
			// First, find where the symbol is defined
			const symbolDefs: BlastEntry[] = [];
			for (const [file, symbols] of Object.entries(index.symbols)) {
				for (const symbol of symbols) {
					if (symbol.name === parsed.symbol) {
						symbolDefs.push({
							file,
							line: symbol.start_line,
							reason: "symbol definition",
							level: 0,
						});
					}
				}
			}

			entries = entries.concat(symbolDefs);

			// Find all usages of this symbol
			const usages = findSymbolUsages(parsed.symbol, repoPath);
			entries = entries.concat(usages);
		}

		// Output results
		if (format === OutputFormat.JSON) {
			console.log(formatJSON(entries, target));
		} else {
			console.log(formatMarkdown(entries, target));
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
