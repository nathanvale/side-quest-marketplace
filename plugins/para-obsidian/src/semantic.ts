/**
 * Semantic search using Kit ML capabilities.
 *
 * This module provides ML-powered semantic search across vault content.
 * It uses the Kit CLI's semantic search functionality which requires
 * the `cased-kit[ml]` package to be installed.
 *
 * Semantic search finds content based on meaning rather than exact text
 * matching, making it useful for finding related concepts even when
 * different terminology is used.
 *
 * @module semantic
 */
import { spawnAndCollect } from "../../../core/src/spawn/index.js";
import type { ParaObsidianConfig } from "./config";
import { resolveVaultPath } from "./fs";
import { checkKit, getKitMLErrorMessage } from "./kit-check";

/**
 * A single semantic search result.
 */
export interface SemanticHit {
	/** Vault-relative path to the matching file. */
	readonly file: string;
	/** Relevance score (higher is more relevant). */
	readonly score: number;
	/** Line number where match was found (if available). */
	readonly line?: number;
	/** Matching text snippet (if available). */
	readonly snippet?: string;
	/** Directory that contained this result (for multi-dir searches). */
	readonly dir?: string;
}

/**
 * Options for semantic search.
 */
export interface SemanticSearchOptions {
	/** Natural language query to search for. */
	readonly query: string;
	/** Directory or directories to search within. */
	readonly dir?: string | ReadonlyArray<string>;
	/** PARA folder shortcuts to search (e.g., "projects", "areas"). */
	readonly para?: string | ReadonlyArray<string>;
	/** Maximum number of results to return (default: 10). */
	readonly limit?: number;
}

/**
 * Type for the semantic search runner function.
 * Allows injection of custom runners for testing.
 */
export type SemanticRunner = (
	config: ParaObsidianConfig,
	options: SemanticSearchOptions,
) => Promise<ReadonlyArray<SemanticHit>>;

/**
 * Resolves PARA folder shortcuts to actual vault directories.
 *
 * Converts shortcut names like "projects" to actual folder paths
 * like "01 Projects" using the config's paraFolders mapping.
 *
 * @param config - Para-obsidian configuration with folder mappings
 * @param paraShortcuts - Array of PARA shortcuts (e.g., ["projects", "areas"])
 * @returns Array of resolved folder paths
 *
 * @example
 * ```typescript
 * const folders = resolvePARAFolders(config, ["projects", "areas"]);
 * // Returns: ["01 Projects", "02 Areas"]
 * ```
 */
export function resolvePARAFolders(
	config: ParaObsidianConfig,
	paraShortcuts: ReadonlyArray<string>,
): ReadonlyArray<string> {
	const mapping = config.paraFolders ?? {};
	const resolved: string[] = [];

	for (const shortcut of paraShortcuts) {
		const folder = mapping[shortcut.toLowerCase()];
		if (folder) {
			resolved.push(folder);
		} else {
			// If not a known shortcut, use as-is (might be a direct path)
			resolved.push(shortcut);
		}
	}

	return resolved;
}

/**
 * Default semantic search runner using Kit CLI.
 *
 * Executes `kit semantic` with JSON output and parses results.
 * Requires Kit to be installed with ML dependencies.
 *
 * Uses `--chunk-by lines` for markdown-optimized search results.
 *
 * @param config - Para-obsidian configuration
 * @param options - Search options
 * @returns Array of semantic hits
 * @throws Error if Kit is not installed or search fails
 */
async function runKitSemantic(
	config: ParaObsidianConfig,
	options: SemanticSearchOptions,
): Promise<ReadonlyArray<SemanticHit>> {
	// Check if Kit with ML is available - no auto-install, just detailed error
	const kitCheck = await checkKit();

	if (!kitCheck.installed || !kitCheck.hasML) {
		throw new Error(getKitMLErrorMessage(kitCheck));
	}

	// Resolve directory to search (single dir only for Kit)
	const dir =
		typeof options.dir === "string"
			? resolveVaultPath(config.vault, options.dir)
			: undefined;

	const args = [
		"kit",
		"semantic",
		"--path",
		dir?.absolute ?? config.vault,
		"--query",
		options.query,
		"--top-k",
		(options.limit ?? 10).toString(),
		"--chunk-by",
		"lines", // Markdown-optimized: use lines instead of symbols
	];

	const { stdout, exitCode, stderr } = await spawnAndCollect(args, {
		env: { ...process.env },
	});

	if (exitCode !== 0) {
		// Check if this is a Kit ML availability error
		const output = `${stdout}\n${stderr}`.toLowerCase();
		if (
			output.includes("semantic search") &&
			(output.includes("not available") || output.includes("ml"))
		) {
			throw new Error(getKitMLErrorMessage(kitCheck));
		}

		throw new Error(
			stderr.trim().length > 0
				? `kit semantic failed: ${stderr.trim()}`
				: "kit semantic failed (is kit installed?)",
		);
	}

	try {
		// Kit semantic returns JSON array directly or wrapped in results
		const parsed = JSON.parse(stdout) as
			| Array<SemanticHit>
			| { results?: Array<SemanticHit> };
		const results = Array.isArray(parsed) ? parsed : (parsed.results ?? []);
		return results;
	} catch (error) {
		throw new Error(
			`Failed to parse kit semantic output: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	}
}

/**
 * Performs semantic search across vault content.
 *
 * Uses ML-powered search to find content related to the query
 * by meaning, not just exact text matching. Supports multi-directory
 * searches via PARA shortcuts and deduplicates results.
 *
 * If Kit ML dependencies are not installed, throws an error with
 * detailed installation instructions.
 *
 * @param config - Para-obsidian configuration
 * @param options - Search options (query, dir, para, limit)
 * @param runner - Custom search runner (defaults to Kit CLI)
 * @returns Array of semantic hits sorted by score
 * @throws Error if query is empty, Kit ML unavailable, or search fails
 *
 * @example
 * ```typescript
 * // Search all PARA folders (default)
 * const hits = await semanticSearch(config, {
 *   query: 'project planning strategies',
 * });
 *
 * // Search specific PARA folders
 * const hits = await semanticSearch(config, {
 *   query: 'trip planning',
 *   para: ['projects', 'resources'],
 * });
 *
 * // Search specific directories directly
 * const hits = await semanticSearch(config, {
 *   query: 'health goals',
 *   dir: '02 Areas',
 * });
 * ```
 */
export async function semanticSearch(
	config: ParaObsidianConfig,
	options: SemanticSearchOptions,
	runner: SemanticRunner = runKitSemantic,
): Promise<ReadonlyArray<SemanticHit>> {
	if (!options.query || options.query.trim().length === 0) {
		throw new Error("query is required for semantic search");
	}

	// Determine directories to search
	// Priority: explicit dir > para shortcuts > default PARA folders
	let dirs: ReadonlyArray<string | undefined>;

	if (options.dir) {
		// Explicit directory specified
		dirs = Array.isArray(options.dir) ? options.dir : [options.dir];
	} else if (options.para) {
		// PARA shortcuts specified
		const paraInput: ReadonlyArray<string> = Array.isArray(options.para)
			? options.para
			: (options.para as string).split(",").map((s: string) => s.trim());
		dirs = resolvePARAFolders(config, paraInput);
	} else {
		// Default: search all PARA folders
		const defaultPara = config.defaultParaSearchFolders ?? [
			"inbox",
			"projects",
			"areas",
			"resources",
			"archives",
		];
		dirs = resolvePARAFolders(config, defaultPara);
	}

	// Run search in each directory
	const hits: SemanticHit[] = [];
	for (const dir of dirs) {
		const chunk = await runner(config, { ...options, dir });
		for (const hit of chunk) {
			hits.push({ ...hit, dir: dir ?? "." });
		}
	}

	// Deduplicate by file, keeping highest score for each file
	const deduped = Array.from(
		hits.reduce((map, hit) => {
			const existing = map.get(hit.file);
			if (!existing || hit.score > existing.score) {
				map.set(hit.file, hit);
			}
			return map;
		}, new Map<string, SemanticHit>()),
	).map(([, hit]) => hit);

	const limit = options.limit ?? 10;
	return deduped.sort((a, b) => b.score - a.score).slice(0, limit);
}
