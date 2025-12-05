/**
 * PROJECT_INDEX.json based tools for token-efficient codebase queries
 *
 * These tools read from a pre-built index instead of scanning files,
 * providing significant token savings for LLM workflows.
 */

import {
	findSymbol,
	findSymbolFuzzy,
	getComplexityHotspots,
	getFileSymbols,
	getSymbolTypeDistribution,
	loadProjectIndex,
} from "./utils/index-parser";

// ============================================================================
// Types
// ============================================================================

export interface IndexFindResult {
	query: string;
	matchType: "exact" | "fuzzy";
	count: number;
	results: Array<{
		file: string;
		name: string;
		type: string;
		line: number;
		code: string;
		score?: number;
	}>;
}

export interface IndexStatsResult {
	files: number;
	totalSymbols: number;
	distribution: Record<string, number>;
	hotspots: Array<{ directory: string; symbolCount: number }>;
}

export interface IndexOverviewResult {
	file: string;
	symbolCount: number;
	symbols: Array<{
		name: string;
		type: string;
		line: number;
	}>;
}

export interface IndexError {
	error: string;
	isError: true;
}

// ============================================================================
// Find Tool - Symbol lookup from index
// ============================================================================

/**
 * Find symbol definitions from PROJECT_INDEX.json
 *
 * @param symbolName - Symbol name to search for
 * @param indexPath - Optional path to index file or directory
 * @returns Symbol search results
 */
export async function executeIndexFind(
	symbolName: string,
	indexPath?: string,
): Promise<IndexFindResult | IndexError> {
	try {
		const index = await loadProjectIndex(indexPath);

		// Try exact match first
		let results = findSymbol(index, symbolName);
		let matchType: "exact" | "fuzzy" = "exact";

		// Fall back to fuzzy search if no exact match
		if (results.length === 0) {
			const fuzzyResults = findSymbolFuzzy(index, symbolName);
			matchType = "fuzzy";
			results = fuzzyResults.map(({ file, symbol }) => ({ file, symbol }));

			return {
				query: symbolName,
				matchType,
				count: fuzzyResults.length,
				results: fuzzyResults.map(({ file, symbol, score }) => ({
					file,
					name: symbol.name,
					type: symbol.type,
					line: symbol.start_line,
					code: symbol.code,
					score,
				})),
			};
		}

		return {
			query: symbolName,
			matchType,
			count: results.length,
			results: results.map(({ file, symbol }) => ({
				file,
				name: symbol.name,
				type: symbol.type,
				line: symbol.start_line,
				code: symbol.code,
			})),
		};
	} catch (error) {
		return {
			error: error instanceof Error ? error.message : "Unknown error",
			isError: true,
		};
	}
}

// ============================================================================
// Stats Tool - Codebase metrics from index
// ============================================================================

/**
 * Get codebase statistics from PROJECT_INDEX.json
 *
 * @param indexPath - Optional path to index file or directory
 * @param topN - Number of top hotspots to return
 * @returns Codebase statistics
 */
export async function executeIndexStats(
	indexPath?: string,
	topN = 5,
): Promise<IndexStatsResult | IndexError> {
	try {
		const index = await loadProjectIndex(indexPath);

		const distribution = getSymbolTypeDistribution(index);
		const hotspots = getComplexityHotspots(index, topN);

		const totalSymbols = Object.values(distribution).reduce(
			(sum, count) => sum + count,
			0,
		);

		return {
			files: Object.keys(index.symbols).length,
			totalSymbols,
			distribution,
			hotspots,
		};
	} catch (error) {
		return {
			error: error instanceof Error ? error.message : "Unknown error",
			isError: true,
		};
	}
}

// ============================================================================
// Overview Tool - File symbols from index
// ============================================================================

/**
 * Get all symbols in a file from PROJECT_INDEX.json
 *
 * @param filePath - File path to get symbols for
 * @param indexPath - Optional path to index file or directory
 * @returns File symbols
 */
export async function executeIndexOverview(
	filePath: string,
	indexPath?: string,
): Promise<IndexOverviewResult | IndexError> {
	try {
		const index = await loadProjectIndex(indexPath);
		const symbols = getFileSymbols(index, filePath);

		return {
			file: filePath,
			symbolCount: symbols.length,
			symbols: symbols.map((s) => ({
				name: s.name,
				type: s.type,
				line: s.start_line,
			})),
		};
	} catch (error) {
		return {
			error: error instanceof Error ? error.message : "Unknown error",
			isError: true,
		};
	}
}

// ============================================================================
// Prime Tool - Generate/refresh index
// ============================================================================

import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import {
	ensureCommandAvailable,
	spawnWithTimeout,
} from "@sidequest/core/spawn";

export interface IndexPrimeResult {
	success: true;
	location: string;
	files: number;
	symbols: number;
	size: string;
	durationSec: number;
}

export interface IndexPrimeExistsResult {
	status: "exists";
	location: string;
	ageHours: number;
	files: number;
	symbols: number;
	size: string;
	message: string;
}

const INDEX_FILE = "PROJECT_INDEX.json";
const MAX_AGE_HOURS = 24;

/**
 * Find git repository root
 */
async function findGitRoot(): Promise<string | null> {
	const gitCmd = ensureCommandAvailable("git");
	const result = await spawnWithTimeout(
		[gitCmd, "rev-parse", "--show-toplevel"],
		10_000,
	);

	if (result.timedOut || result.exitCode !== 0) {
		return null;
	}

	if (result.stdout) {
		return result.stdout.trim();
	}

	return null;
}

/**
 * Get target directory for indexing
 * Priority: custom path > git root > CWD
 */
async function getTargetDir(customPath?: string): Promise<string> {
	if (customPath) {
		return resolve(customPath);
	}

	const gitRoot = await findGitRoot();
	if (gitRoot) {
		return gitRoot;
	}

	return process.cwd();
}

/**
 * Generate or refresh PROJECT_INDEX.json
 *
 * @param force - Force regenerate even if index is fresh
 * @param customPath - Optional custom path to index
 * @returns Prime result
 */
export async function executeIndexPrime(
	force = false,
	customPath?: string,
): Promise<IndexPrimeResult | IndexPrimeExistsResult | IndexError> {
	try {
		const targetDir = await getTargetDir(customPath);
		const kitCmd = ensureCommandAvailable("kit");
		const indexPath = join(targetDir, INDEX_FILE);

		// Check if index exists and is fresh
		if (existsSync(indexPath)) {
			const stats = statSync(indexPath);
			const ageMs = Date.now() - stats.mtimeMs;
			const ageHours = ageMs / (1000 * 60 * 60);

			if (ageHours < MAX_AGE_HOURS && !force) {
				const index = await loadProjectIndex(indexPath);
				const symbolCount = Object.values(index.symbols).reduce(
					(sum, symbols) => sum + symbols.length,
					0,
				);
				const mb = stats.size / (1024 * 1024);

				return {
					status: "exists",
					location: targetDir,
					ageHours: Number.parseFloat(ageHours.toFixed(1)),
					files: Object.keys(index.symbols).length,
					symbols: symbolCount,
					size: `${mb.toFixed(2)} MB`,
					message:
						"Index is less than 24 hours old. Use force=true to regenerate.",
				};
			}
		}

		// Generate new index
		const startTime = Date.now();
		const result = await spawnWithTimeout(
			[kitCmd, "index", targetDir, "-o", indexPath],
			60_000,
		);

		if (result.timedOut) {
			return {
				error: "kit index timed out",
				isError: true,
			};
		}

		if (result.exitCode !== 0) {
			return {
				error: `kit index failed: ${result.stderr}`,
				isError: true,
			};
		}

		const durationSec = (Date.now() - startTime) / 1000;

		// Parse generated index
		const index = await loadProjectIndex(indexPath);
		const symbolCount = Object.values(index.symbols).reduce(
			(sum, symbols) => sum + symbols.length,
			0,
		);
		const fileStats = statSync(indexPath);
		const mb = fileStats.size / (1024 * 1024);

		return {
			success: true,
			location: targetDir,
			files: Object.keys(index.symbols).length,
			symbols: symbolCount,
			size: `${mb.toFixed(2)} MB`,
			durationSec: Number.parseFloat(durationSec.toFixed(1)),
		};
	} catch (error) {
		return {
			error: error instanceof Error ? error.message : "Unknown error",
			isError: true,
		};
	}
}

// ============================================================================
// Format utilities for MCP responses
// ============================================================================

import type { ResponseFormat } from "./types.js";

/**
 * Format index find results
 */
export function formatIndexFindResults(
	result: IndexFindResult | IndexError,
	format: ResponseFormat,
): string {
	if ("isError" in result) {
		return format === "json"
			? JSON.stringify(result, null, 2)
			: `**Error:** ${result.error}`;
	}

	if (format === "json") {
		return JSON.stringify(result, null, 2);
	}

	if (result.count === 0) {
		return `No symbols found matching: ${result.query}`;
	}

	let output = `Found ${result.count} ${result.matchType} match(es) for "${result.query}":\n\n`;

	for (const r of result.results) {
		output += `- **${r.name}** (${r.type}) in \`${r.file}:${r.line}\``;
		if (r.score !== undefined) {
			output += ` [score: ${r.score}]`;
		}
		output += "\n";
	}

	return output;
}

/**
 * Format index stats results
 */
export function formatIndexStatsResults(
	result: IndexStatsResult | IndexError,
	format: ResponseFormat,
): string {
	if ("isError" in result) {
		return format === "json"
			? JSON.stringify(result, null, 2)
			: `**Error:** ${result.error}`;
	}

	if (format === "json") {
		return JSON.stringify(result, null, 2);
	}

	let output = `## Codebase Statistics\n\n`;
	output += `- **Files:** ${result.files}\n`;
	output += `- **Total Symbols:** ${result.totalSymbols}\n\n`;

	output += `### Symbol Distribution\n`;
	for (const [type, count] of Object.entries(result.distribution)) {
		if (count > 0) {
			output += `- ${type}: ${count}\n`;
		}
	}

	output += `\n### Complexity Hotspots\n`;
	for (const { directory, symbolCount } of result.hotspots) {
		output += `- \`${directory}\`: ${symbolCount} symbols\n`;
	}

	return output;
}

/**
 * Format index overview results
 */
export function formatIndexOverviewResults(
	result: IndexOverviewResult | IndexError,
	format: ResponseFormat,
): string {
	if ("isError" in result) {
		return format === "json"
			? JSON.stringify(result, null, 2)
			: `**Error:** ${result.error}`;
	}

	if (format === "json") {
		return JSON.stringify(result, null, 2);
	}

	if (result.symbolCount === 0) {
		return `No symbols found in: ${result.file}`;
	}

	let output = `## ${result.file}\n\n`;
	output += `**${result.symbolCount} symbol(s)**\n\n`;

	// Group by type
	const byType: Record<string, typeof result.symbols> = {};
	for (const sym of result.symbols) {
		if (!byType[sym.type]) {
			byType[sym.type] = [];
		}
		byType[sym.type]!.push(sym);
	}

	for (const [type, symbols] of Object.entries(byType)) {
		output += `### ${type}s\n`;
		for (const sym of symbols) {
			output += `- \`${sym.name}\` (line ${sym.line})\n`;
		}
		output += "\n";
	}

	return output;
}

/**
 * Format index prime results
 */
export function formatIndexPrimeResults(
	result: IndexPrimeResult | IndexPrimeExistsResult | IndexError,
	format: ResponseFormat,
): string {
	if ("isError" in result) {
		return format === "json"
			? JSON.stringify(result, null, 2)
			: `**Error:** ${result.error}`;
	}

	if (format === "json") {
		return JSON.stringify(result, null, 2);
	}

	if ("status" in result && result.status === "exists") {
		return (
			`## Index Already Exists\n\n` +
			`- **Location:** ${result.location}\n` +
			`- **Age:** ${result.ageHours} hours\n` +
			`- **Files:** ${result.files}\n` +
			`- **Symbols:** ${result.symbols}\n` +
			`- **Size:** ${result.size}\n\n` +
			`> ${result.message}`
		);
	}

	// TypeScript narrowing: at this point result is IndexPrimeResult
	const primeResult = result as IndexPrimeResult;
	return (
		`## Index Generated Successfully\n\n` +
		`- **Location:** ${primeResult.location}\n` +
		`- **Files:** ${primeResult.files}\n` +
		`- **Symbols:** ${primeResult.symbols}\n` +
		`- **Size:** ${primeResult.size}\n` +
		`- **Duration:** ${primeResult.durationSec}s`
	);
}
