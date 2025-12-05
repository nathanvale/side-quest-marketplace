/**
 * Text search utilities for the vault.
 *
 * This module provides ripgrep-based text search with support for:
 * - Literal and regex patterns
 * - Frontmatter and tag filtering
 * - Multi-directory scoping
 * - Result limiting
 *
 * Requires ripgrep (rg) to be installed and available in PATH.
 *
 * @module search
 */
import path from "node:path";
import { readTextFile } from "@sidequest/core/fs";
import { ensureCommandAvailable, spawnAndCollect } from "@sidequest/core/spawn";
import { parse } from "yaml";

import type { ParaObsidianConfig } from "./config";
import { resolveVaultPath } from "./fs";

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
	/** Filter results to notes containing this tag. */
	readonly tag?: string;
	/** Filter results by frontmatter field values. */
	readonly frontmatter?: Record<string, string>;
	/** Maximum number of results to return. */
	readonly maxResults?: number;
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
	/** Filter to notes containing this tag. */
	readonly tag?: string;
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
		seen.add(resolved);
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
	return hits;
}

/**
 * Filters files by frontmatter field values and/or tags.
 *
 * Scans Markdown files in the specified directories and returns
 * those whose frontmatter matches all provided criteria.
 *
 * @param config - Para-obsidian configuration
 * @param options - Filter options (dir, tag, frontmatter key=value)
 * @returns Vault-relative paths to matching files
 *
 * @example
 * ```typescript
 * const files = filterByFrontmatter(config, {
 *   dir: 'Projects',
 *   tag: 'active',
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
	const tagFilter = options.tag;
	// Return early if no filters specified
	if (Object.keys(filters).length === 0 && !tagFilter) return [];

	const matches: string[] = [];
	const dirs = resolveDirs(config.vault, options.dir, config.defaultSearchDirs);

	/** Recursively walks markdown files under a directory using Bun.Glob. */
	async function walkMarkdownFiles(dir: string): Promise<string[]> {
		const glob = new Bun.Glob("**/*.md");
		const files: string[] = [];
		for await (const match of glob.scan({ cwd: dir })) {
			files.push(path.join(dir, match));
		}
		return files;
	}

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

		// Check tag filter
		if (tagFilter) {
			const tags = yaml.tags;
			if (!Array.isArray(tags) || !tags.includes(tagFilter)) return false;
		}
		return true;
	}

	// Scan all directories and collect matching files
	for (const dir of dirs) {
		for (const file of await walkMarkdownFiles(dir)) {
			if (await hasFrontmatter(file)) {
				matches.push(path.relative(config.vault, file));
			}
		}
	}
	return matches;
}
