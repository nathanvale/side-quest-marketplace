/**
 * Vault indexing for fast metadata queries.
 *
 * This module builds and manages a lightweight index of the vault's
 * Markdown files, caching:
 * - Frontmatter attributes
 * - Heading structure
 *
 * The index enables fast queries without parsing every file,
 * useful for frontmatter filtering and heading lookups.
 *
 * @module indexer
 */
import fs from "node:fs";
import path from "node:path";
import {
	pathExistsSync,
	readTextFileSync,
	writeJsonFileSync,
} from "@sidequest/core/fs";
import { globFilesSync } from "@sidequest/core/glob";

import type { ParaObsidianConfig } from "../config/index";
import { parseFrontmatter } from "../frontmatter/index";
import { getManagedFolders } from "../git/index";
import { resolveVaultPath } from "../shared/fs";
import { observeSync } from "../shared/instrumentation.js";
import { searchLogger } from "../shared/logger.js";

/**
 * Indexed metadata for a single Markdown file.
 */
export interface IndexEntry {
	/** Vault-relative path to the file. */
	readonly file: string;
	/** All frontmatter attributes. */
	readonly frontmatter: Record<string, unknown>;
	/** Heading titles extracted from the document. */
	readonly headings: string[];
}

/**
 * Complete vault index with generation timestamp.
 */
export interface VaultIndex {
	/** ISO timestamp when the index was generated. */
	readonly generatedAt: string;
	/** Indexed entries for all scanned files. */
	readonly entries: IndexEntry[];
}

/**
 * Extracts heading titles from Markdown content.
 * Matches lines starting with one or more # followed by space.
 *
 * @param content - Raw Markdown content
 * @returns Array of heading titles (without # prefix)
 */
function collectHeadings(content: string): string[] {
	const lines = content.split("\n");
	return lines
		.filter((line) => /^#+\s/.test(line))
		.map((line) => line.replace(/^#+\s*/, "").trim());
}

/**
 * Builds a vault index by scanning directories for Markdown files.
 *
 * For each file, extracts:
 * - Frontmatter attributes
 * - Heading structure
 *
 * @param config - Para-obsidian configuration
 * @param dir - Directory or directories to scan (defaults to vault root)
 * @returns VaultIndex with all indexed entries
 *
 * @example
 * ```typescript
 * const index = buildIndex(config, ['Projects', 'Areas']);
 * console.log(`Indexed ${index.entries.length} files`);
 * ```
 */
export function buildIndex(
	config: ParaObsidianConfig,
	dir?: string | ReadonlyArray<string>,
): VaultIndex {
	// Default to PARA-managed folders (like git), not entire vault root
	const dirs = Array.isArray(dir)
		? dir
		: dir
			? [dir]
			: Array.from(getManagedFolders(config));

	const files: string[] = [];

	// Collect all Markdown files from specified directories
	for (const entry of dirs) {
		const resolved = resolveVaultPath(config.vault, entry).absolute;
		for (const rel of globFilesSync("**/*.md", {
			cwd: resolved,
			absolute: false,
		})) {
			const relativeToVault = path.relative(
				config.vault,
				path.join(resolved, rel),
			);
			files.push(relativeToVault);
		}
	}

	// Deduplicate files (in case directories overlap)
	const uniqueFiles = Array.from(new Set(files));

	return observeSync(
		searchLogger,
		"search:buildIndex",
		() => {
			// Build index entries for each file
			const entries: IndexEntry[] = [];
			for (const rel of uniqueFiles) {
				const full = path.join(config.vault, rel);
				const content = readTextFileSync(full);
				const { attributes } = parseFrontmatter(content);
				const headings = collectHeadings(content);
				entries.push({
					file: path.relative(config.vault, full),
					frontmatter: attributes,
					headings,
				});
			}

			return {
				generatedAt: new Date().toISOString(),
				entries,
			};
		},
		{
			context: {
				vaultPath: config.vault,
				dirCount: dirs.length,
				fileCount: uniqueFiles.length,
			},
		},
	);
}

/**
 * Saves the vault index to disk.
 *
 * Writes the index as formatted JSON to the configured index path
 * or the default location (.para-obsidian-index.json in vault root).
 *
 * @param config - Para-obsidian configuration with optional indexPath
 * @param index - VaultIndex to save
 * @returns Path where the index was saved
 *
 * @example
 * ```typescript
 * const index = buildIndex(config);
 * const savedPath = saveIndex(config, index);
 * console.log(`Index saved to ${savedPath}`);
 * ```
 */
export function saveIndex(
	config: ParaObsidianConfig,
	index: VaultIndex,
): string {
	const indexPath =
		config.indexPath ?? path.join(config.vault, ".para-obsidian-index.json");
	writeJsonFileSync(indexPath, index, 2);
	return indexPath;
}

/**
 * Loads a previously saved vault index from disk.
 *
 * @param config - Para-obsidian configuration with optional indexPath
 * @returns Loaded VaultIndex, or undefined if no index file exists
 *
 * @example
 * ```typescript
 * const index = loadIndex(config);
 * if (index) {
 *   console.log(`Index has ${index.entries.length} entries, generated at ${index.generatedAt}`);
 * } else {
 *   console.log('No index found, run prime first');
 * }
 * ```
 */
export function loadIndex(config: ParaObsidianConfig): VaultIndex | undefined {
	const indexPath =
		config.indexPath ?? path.join(config.vault, ".para-obsidian-index.json");
	if (!pathExistsSync(indexPath)) return undefined;
	const raw = readTextFileSync(indexPath);
	return JSON.parse(raw) as VaultIndex;
}

/**
 * Lists all areas from the vault.
 *
 * Scans the 02_Areas directory for area notes and returns their titles.
 * Falls back to scanning frontmatter if directory doesn't exist.
 *
 * @param config - Para-obsidian configuration
 * @returns Array of area titles
 *
 * @example
 * ```typescript
 * const areas = listAreas(config);
 * console.log(`Found ${areas.length} areas: ${areas.join(', ')}`);
 * ```
 */
export function listAreas(config: ParaObsidianConfig): string[] {
	return observeSync(
		searchLogger,
		"search:listAreas",
		() => {
			const areasFolder = config.paraFolders?.areas ?? "02 Areas";
			const areasDir = resolveVaultPath(config.vault, areasFolder);
			const areas: string[] = [];

			if (!fs.existsSync(areasDir.absolute)) {
				return areas;
			}

			// Scan areas directory for .md files
			const files = fs.readdirSync(areasDir.absolute);
			for (const file of files) {
				if (file.endsWith(".md")) {
					// Use filename without extension as area title
					areas.push(file.replace(/\.md$/, ""));
				}
			}

			return areas.sort();
		},
		{ context: { vaultPath: config.vault } },
	);
}

/**
 * Lists all projects from the vault.
 *
 * Scans the 01_Projects directory for project notes and returns their titles.
 *
 * @param config - Para-obsidian configuration
 * @returns Array of project titles
 *
 * @example
 * ```typescript
 * const projects = listProjects(config);
 * console.log(`Found ${projects.length} projects: ${projects.join(', ')}`);
 * ```
 */
export function listProjects(config: ParaObsidianConfig): string[] {
	return observeSync(
		searchLogger,
		"search:listProjects",
		() => {
			const projectsFolder = config.paraFolders?.projects ?? "01 Projects";
			const projectsDir = resolveVaultPath(config.vault, projectsFolder);
			const projects: string[] = [];

			if (!fs.existsSync(projectsDir.absolute)) {
				return projects;
			}

			// Scan projects directory for .md files
			const files = fs.readdirSync(projectsDir.absolute);
			for (const file of files) {
				if (file.endsWith(".md")) {
					// Use filename without extension as project title
					projects.push(file.replace(/\.md$/, ""));
				}
			}

			return projects.sort();
		},
		{ context: { vaultPath: config.vault } },
	);
}
