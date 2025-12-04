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

import type { ParaObsidianConfig } from "./config";
import { parseFrontmatter } from "./frontmatter";
import { resolveVaultPath } from "./fs";

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
 * Recursively walks a directory collecting Markdown file paths.
 *
 * @param root - Absolute path to the root directory
 * @param dir - Current subdirectory relative to root
 * @param out - Array to accumulate file paths
 */
function walkMarkdownFiles(root: string, dir: string, out: string[]) {
	const current = path.join(root, dir);
	const entries = fs.readdirSync(current, { withFileTypes: true });
	for (const entry of entries) {
		if (entry.isDirectory()) {
			walkMarkdownFiles(root, path.join(dir, entry.name), out);
		} else if (entry.name.endsWith(".md")) {
			out.push(path.join(dir, entry.name));
		}
	}
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
	const dirs = Array.isArray(dir) ? dir : dir ? [dir] : ["."];
	const files: string[] = [];

	// Collect all Markdown files from specified directories
	for (const entry of dirs) {
		const resolved = resolveVaultPath(config.vault, entry).absolute;
		const local: string[] = [];
		walkMarkdownFiles(resolved, ".", local);
		for (const rel of local) {
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
		const content = fs.readFileSync(full, "utf8");
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
	fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), "utf8");
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
	if (!fs.existsSync(indexPath)) return undefined;
	const raw = fs.readFileSync(indexPath, "utf8");
	return JSON.parse(raw) as VaultIndex;
}
