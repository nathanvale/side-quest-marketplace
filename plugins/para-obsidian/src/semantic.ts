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
import { checkKit, ensureKitML } from "./kit-check";

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
	interactive?: boolean,
) => Promise<ReadonlyArray<SemanticHit>>;

/**
 * Default semantic search runner using Kit CLI.
 *
 * Executes `kit semantic` with JSON output and parses results.
 * Requires Kit to be installed with ML dependencies.
 *
 * @param config - Para-obsidian configuration
 * @param options - Search options
 * @param interactive - Whether to prompt for installation if ML missing (default: true)
 * @returns Array of semantic hits
 * @throws Error if Kit is not installed or search fails
 */
async function runKitSemantic(
	config: ParaObsidianConfig,
	options: SemanticSearchOptions,
	interactive = true,
): Promise<ReadonlyArray<SemanticHit>> {
	// Check if Kit with ML is available, offer to install if needed
	const kitCheck = await checkKit();

	if (!kitCheck.installed || !kitCheck.hasML) {
		const hasKit = await ensureKitML(interactive);
		if (!hasKit) {
			throw new Error(
				kitCheck.error ??
					"Kit with ML dependencies is required for semantic search",
			);
		}
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
		"--limit",
		(options.limit ?? 10).toString(),
		"--json",
	];

	const { stdout, exitCode, stderr } = await spawnAndCollect(args, {
		env: { ...process.env },
	});

	if (exitCode !== 0) {
		throw new Error(
			stderr.trim().length > 0
				? `kit semantic failed: ${stderr.trim()}`
				: "kit semantic failed (is kit installed?)",
		);
	}

	try {
		const parsed = JSON.parse(stdout) as { results?: Array<SemanticHit> };
		return parsed.results ?? [];
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
 * searches and deduplicates results.
 *
 * If Kit ML dependencies are not installed, offers to install them
 * automatically in interactive mode.
 *
 * @param config - Para-obsidian configuration
 * @param options - Search options (query, dir, limit)
 * @param interactive - Whether to prompt for Kit ML installation (default: true)
 * @param runner - Custom search runner (defaults to Kit CLI)
 * @returns Array of semantic hits sorted by score
 * @throws Error if query is empty or search fails
 *
 * @example
 * ```typescript
 * const hits = await semanticSearch(config, {
 *   query: 'project planning strategies',
 *   dir: 'Projects',
 *   limit: 20
 * });
 * for (const hit of hits) {
 *   console.log(`${hit.file} (score: ${hit.score})`);
 * }
 * ```
 */
export async function semanticSearch(
	config: ParaObsidianConfig,
	options: SemanticSearchOptions,
	interactive = true,
	runner: SemanticRunner = runKitSemantic,
): Promise<ReadonlyArray<SemanticHit>> {
	if (!options.query || options.query.trim().length === 0) {
		throw new Error("query is required for semantic search");
	}

	// Determine directories to search
	const dirInput =
		options.dir ??
		(config.defaultSearchDirs && config.defaultSearchDirs.length > 0
			? config.defaultSearchDirs
			: undefined);
	const dirs = dirInput
		? Array.isArray(dirInput)
			? dirInput
			: [dirInput]
		: [undefined];

	// Run search in each directory
	const hits: SemanticHit[] = [];
	for (const dir of dirs) {
		const chunk = await runner(config, { ...options, dir }, interactive);
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
