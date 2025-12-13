/**
 * Vault indexing for fast metadata queries.
 *
 * This module builds and manages a lightweight index of the vault's
 * Markdown files, caching:
 * - Frontmatter attributes
 * - Tags
 * - Heading structure
 *
 * The index enables fast queries without parsing every file,
 * useful for tag searches, frontmatter filtering, and heading lookups.
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
import { getErrorMessage } from "@sidequest/core/utils";

import type { ParaObsidianConfig } from "./config/index";
import { parseFrontmatter } from "./frontmatter/index";
import { resolveVaultPath } from "./fs";
import { getManagedFolders } from "./git/index";

/**
 * Indexed metadata for a single Markdown file.
 */
export interface IndexEntry {
	/** Vault-relative path to the file. */
	readonly file: string;
	/** Tags extracted from frontmatter. */
	readonly tags: string[];
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
 * - Tags from frontmatter
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

	// Build index entries for each file
	const entries: IndexEntry[] = [];
	for (const rel of uniqueFiles) {
		const full = path.join(config.vault, rel);
		const content = readTextFileSync(full);
		const { attributes } = parseFrontmatter(content);
		const tags = Array.isArray(attributes.tags)
			? (attributes.tags as string[])
			: [];
		const headings = collectHeadings(content);
		entries.push({
			file: path.relative(config.vault, full),
			tags,
			frontmatter: attributes,
			headings,
		});
	}

	return {
		generatedAt: new Date().toISOString(),
		entries,
	};
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
}

/**
 * Lists suggested tags from config.
 *
 * Returns the curated list of tags from the para-obsidian config.
 * This is the authoritative list that users manage in their config file.
 *
 * @param config - Para-obsidian configuration
 * @returns Array of suggested tag names (sorted)
 *
 * @example
 * ```typescript
 * const tags = listTags(config);
 * console.log(`Available tags: ${tags.join(', ')}`);
 * ```
 */
export function listTags(config: ParaObsidianConfig): string[] {
	return config.suggestedTags ? [...config.suggestedTags].sort() : [];
}

/**
 * Scans vault for all tags actually used in frontmatter.
 *
 * Returns tags found in notes across the vault.
 * Uses the vault index if available, otherwise scans all files.
 *
 * @param config - Para-obsidian configuration
 * @returns Array of unique tag names (sorted)
 *
 * @example
 * ```typescript
 * const tags = scanTags(config);
 * console.log(`Found ${tags.length} tags in use: ${tags.join(', ')}`);
 * ```
 */
export function scanTags(config: ParaObsidianConfig): string[] {
	const tagSet = new Set<string>();

	// Try to use existing index first
	const index = loadIndex(config);
	if (index) {
		for (const entry of index.entries) {
			for (const tag of entry.tags) {
				tagSet.add(tag);
			}
		}
		return Array.from(tagSet).sort();
	}

	// Fallback: scan all markdown files
	const vaultRoot = config.vault;
	const markdownFiles = globFilesSync("**/*.md", {
		cwd: vaultRoot,
		absolute: false,
	});

	for (const file of markdownFiles) {
		const fullPath = path.join(vaultRoot, file);
		try {
			const content = fs.readFileSync(fullPath, "utf8");
			const { attributes } = parseFrontmatter(content);
			const tags = attributes.tags;
			if (Array.isArray(tags)) {
				for (const tag of tags) {
					if (typeof tag === "string") {
						tagSet.add(tag);
					}
				}
			}
		} catch (error) {
			// Skip files that can't be read (e.g., permission issues)
			console.warn(
				`scanTags: failed to read ${file}: ${getErrorMessage(error)}`,
			);
		}
	}

	return Array.from(tagSet).sort();
}
