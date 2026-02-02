/**
 * Text search utilities for the vault.
 *
 * This module provides ripgrep-based text search with support for:
 * - Literal and regex patterns
 * - Frontmatter filtering
 * - Multi-directory scoping
 * - Result limiting
 *
 * Requires ripgrep (rg) to be installed and available in PATH.
 *
 * @module search
 */
import path from "node:path";
import { pathExistsSync, readTextFile } from "@side-quest/core/fs";
import { globFiles } from "@side-quest/core/glob";
import {
	ensureCommandAvailable,
	spawnAndCollect,
} from "@side-quest/core/spawn";
import { parse } from "yaml";

import type { ParaObsidianConfig } from "../config/index";
import { resolveVaultPath } from "../shared/fs";
import { observe } from "../shared/instrumentation.js";
import { searchLogger } from "../shared/logger.js";

/**
 * Options for text search operations.
 */
export interface SearchOptions {
	/** Search query (text or regex pattern). */
	readonly query: string;
	/** Directory or directories to search within. */
	readonly dir?: string | ReadonlyArray<string>;
	/** If true, treat query as a regular expression. */
	readonly regex?: boolean;
	/** Optional glob(s) to constrain files (passed to ripgrep). */
	readonly glob?: string | ReadonlyArray<string>;
	/** Filter results by frontmatter field values. */
	readonly frontmatter?: Record<string, string>;
	/** Maximum number of results to return. */
	readonly maxResults?: number;
	/** Lines of context to include before/after matches. */
	readonly context?: number;
	/** Pre-filtered files to allow; used to intersect text hits. */
	readonly allowedFiles?: ReadonlyArray<string>;
}

/**
 * A single search result hit.
 */
export interface SearchHit {
	/** Vault-relative path to the file. */
	readonly file: string;
	/** Line number where the match was found (1-indexed). */
	readonly line: number;
	/** The matching line content. */
	readonly snippet: string;
}

/**
 * Options for filtering files by frontmatter.
 */
export interface FrontmatterFilterOptions {
	/** Directory or directories to scan. */
	readonly dir?: string | ReadonlyArray<string>;
	/** Filter by frontmatter field values (key=value). */
	readonly frontmatter?: Record<string, string>;
}

/**
 * Normalizes directory input to an array, using defaults if empty.
 * Ensures we always have at least one directory to search.
 */
function normalizeDirs(
	dir?: string | ReadonlyArray<string>,
	defaults?: ReadonlyArray<string>,
): ReadonlyArray<string> {
	const list = dir ?? defaults ?? [];
	const dirs = Array.isArray(list) ? list : [list];
	return dirs.length > 0 ? dirs : ["."];
}

/**
 * Resolves and deduplicates directory paths within the vault.
 * Converts relative paths to absolute and removes duplicates.
 */
function resolveDirs(
	root: string,
	dir?: string | ReadonlyArray<string>,
	defaults?: ReadonlyArray<string>,
): string[] {
	const dirs = normalizeDirs(dir, defaults);
	const seen = new Set<string>();
	for (const entry of dirs) {
		const resolved = resolveVaultPath(root, entry).absolute;
		// Only include directories that exist (silently skip missing)
		if (pathExistsSync(resolved)) {
			seen.add(resolved);
		}
	}
	return Array.from(seen);
}

/**
 * Builds command-line arguments for ripgrep.
 * Configures line numbers, fixed-string vs regex mode, and directories.
 */
function buildRgArgs(
	options: SearchOptions,
	root: string,
	defaultDirs?: ReadonlyArray<string>,
): string[] {
	const args = ["rg", "--line-number", "--color", "never"];
	if (options.regex) {
		args.push(options.query);
	} else {
		args.push("--fixed-strings", options.query);
	}
	if (options.context && options.context > 0) {
		args.push("--context", options.context.toString());
	}
	const globs = options.glob
		? Array.isArray(options.glob)
			? options.glob
			: [options.glob]
		: [];
	for (const glob of globs) {
		args.push("--glob", glob);
	}
	if (options.maxResults) {
		args.push("--max-count", options.maxResults.toString());
	}
	const dirs = resolveDirs(root, options.dir, defaultDirs);
	args.push(...dirs);
	return args;
}

/**
 * Searches for text in vault files using ripgrep.
 *
 * Performs fast text search with support for literal strings or
 * regular expressions. Returns matching lines with file paths
 * and line numbers.
 *
 * @param config - Para-obsidian configuration
 * @param options - Search options (query, dir, regex, maxResults)
 * @returns Array of search hits with file, line number, and snippet
 *
 * @example
 * ```typescript
 * const hits = await searchText(config, {
 *   query: 'TODO',
 *   dir: 'Projects',
 *   maxResults: 50
 * });
 * // [{ file: 'Projects/Note.md', line: 15, snippet: '- [ ] TODO: Fix bug' }]
 * ```
 */
export async function searchText(
	config: ParaObsidianConfig,
	options: SearchOptions,
): Promise<SearchHit[]> {
	return observe(
		searchLogger,
		"search:searchText",
		async () => {
			const args = buildRgArgs(options, config.vault, config.defaultSearchDirs);
			const [cmd, ...cmdArgs] = args;
			const command = ensureCommandAvailable(cmd ?? "rg");
			const result = await spawnAndCollect([command, ...cmdArgs], {
				cwd: config.vault,
			});

			// No matches returns empty array
			if (result.exitCode !== 0 && result.stdout.trim().length === 0) {
				return [];
			}

			// Parse ripgrep output (file:line:snippet format)
			const hits: SearchHit[] = [];
			for (const line of result.stdout.trim().split("\n")) {
				if (!line) continue;
				const [file, lineNo, ...rest] = line.split(":");
				if (!file || !lineNo) continue;
				const snippet = rest.join(":");
				const relative = path.relative(config.vault, file);
				hits.push({
					file: relative,
					line: Number.parseInt(lineNo, 10),
					snippet,
				});
			}

			// If frontmatter filters are present, intersect hits with matches
			const allowed =
				options.allowedFiles ??
				(options.frontmatter
					? await filterByFrontmatter(config, {
							dir: options.dir,
							frontmatter: options.frontmatter,
						})
					: undefined);
			if (!allowed || allowed.length === 0) return hits;
			const allowedSet = new Set(allowed);
			return hits.filter((hit) => allowedSet.has(hit.file));
		},
		{
			context: {
				query: options.query,
				regex: options.regex ?? false,
				hasFrontmatterFilter: !!options.frontmatter,
			},
		},
	);
}

/**
 * Filters files by frontmatter field values.
 *
 * Scans Markdown files in the specified directories and returns
 * those whose frontmatter matches all provided criteria.
 *
 * @param config - Para-obsidian configuration
 * @param options - Filter options (dir, frontmatter key=value)
 * @returns Vault-relative paths to matching files
 *
 * @example
 * ```typescript
 * const files = filterByFrontmatter(config, {
 *   dir: 'Projects',
 *   frontmatter: { status: 'in-progress' }
 * });
 * // ['Projects/Feature A.md', 'Projects/Feature B.md']
 * ```
 */
export async function filterByFrontmatter(
	config: ParaObsidianConfig,
	options: FrontmatterFilterOptions,
): Promise<string[]> {
	const filters = options.frontmatter ?? {};
	// Return early if no filters specified
	if (Object.keys(filters).length === 0) return [];

	return observe(
		searchLogger,
		"search:filterByFrontmatter",
		async () => {
			const matches: string[] = [];
			const dirs = resolveDirs(
				config.vault,
				options.dir,
				config.defaultSearchDirs,
			);

			/** Checks if a file's frontmatter matches all filters. */
			async function hasFrontmatter(filePath: string): Promise<boolean> {
				const content = await readTextFile(filePath);
				if (!content.startsWith("---")) return false;
				const end = content.indexOf("\n---", 3);
				if (end === -1) return false;
				const raw = content.slice(3, end + 1);
				const yaml = parse(raw) as Record<string, unknown>;

				// Check all frontmatter key=value filters
				for (const [k, v] of Object.entries(filters)) {
					if (yaml[k] !== v) return false;
				}

				return true;
			}

			// Scan all directories and collect matching files
			for (const dir of dirs) {
				for (const file of await globFiles("**/*.md", { cwd: dir })) {
					if (await hasFrontmatter(file)) {
						matches.push(path.relative(config.vault, file));
					}
				}
			}
			return matches;
		},
		{
			context: {
				filterCount: Object.keys(filters).length,
				dirCount: resolveDirs(
					config.vault,
					options.dir,
					config.defaultSearchDirs,
				).length,
			},
		},
	);
}
