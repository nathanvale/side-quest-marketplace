/**
 * Note rename with automatic link rewriting.
 *
 * This module handles renaming/moving notes while automatically
 * updating all references (wikilinks and Markdown links) across
 * the vault. Supports dry-run mode for previewing changes.
 *
 * @module links
 */
import fs from "node:fs";
import path from "node:path";

import type { ParaObsidianConfig } from "./config";
import { resolveVaultPath } from "./fs";

/**
 * Options for renaming a note with link rewriting.
 */
export interface RenameOptions {
	/** Source file path (relative to vault). */
	readonly from: string;
	/** Destination file path (relative to vault). */
	readonly to: string;
	/** If true, report changes without actually renaming or rewriting. */
	readonly dryRun?: boolean;
}

/**
 * Result of a rename operation.
 */
export interface RenameResult {
	/** Whether the file was actually moved (false in dry-run mode). */
	readonly moved: boolean;
	/** Files that had links rewritten with change counts. */
	readonly rewrites: Array<{ file: string; changes: number }>;
}

/**
 * Replaces references to a renamed note in file content.
 *
 * Handles both wikilink and Markdown link formats:
 * - `[[OldName]]` -> `[[NewName]]`
 * - `[text](OldName)` -> `[text](NewName)`
 *
 * @param content - File content to process
 * @param fromName - Original note name (without extension)
 * @param toName - New note name (without extension)
 * @returns Updated content and count of replacements made
 */
function replaceLinks(
	content: string,
	fromName: string,
	toName: string,
): { content: string; changes: number } {
	// Match wikilinks: [[OldName]]
	const wikilinkPattern = new RegExp(`\\[\\[${fromName}\\]\\]`, "g");
	// Match Markdown links: [text](OldName)
	const mdLinkPattern = new RegExp(`\\[([^\\]]+)\\]\\(${fromName}\\)`, "g");

	let changes = 0;
	let updated = content.replace(wikilinkPattern, () => {
		changes++;
		return `[[${toName}]]`;
	});

	updated = updated.replace(mdLinkPattern, (_match, text) => {
		changes++;
		return `[${text}](${toName})`;
	});

	return { content: updated, changes };
}

/**
 * Recursively lists all Markdown files in a directory.
 *
 * @param root - Directory to scan
 * @returns Array of absolute paths to .md files
 */
function listMarkdownFiles(root: string): string[] {
	const results: string[] = [];
	const entries = fs.readdirSync(root, { withFileTypes: true });
	for (const entry of entries) {
		const full = path.join(root, entry.name);
		if (entry.isDirectory()) {
			results.push(...listMarkdownFiles(full));
		} else if (entry.isFile() && entry.name.endsWith(".md")) {
			results.push(full);
		}
	}
	return results;
}

/**
 * Renames a note and rewrites all links across the vault.
 *
 * This function:
 * 1. Validates source exists and destination doesn't
 * 2. Scans all Markdown files for references to the source
 * 3. Rewrites wikilinks and Markdown links in affected files
 * 4. Moves the file to the new location
 *
 * In dry-run mode, reports what would change without modifying files.
 *
 * @param config - Para-obsidian configuration
 * @param options - Rename options (from, to, dryRun)
 * @returns Rename result with moved status and rewrite details
 * @throws Error if source doesn't exist or destination already exists
 *
 * @example
 * ```typescript
 * const result = renameWithLinkRewrite(config, {
 *   from: 'Projects/Old Name.md',
 *   to: 'Projects/New Name.md',
 *   dryRun: true
 * });
 * console.log(`Would rewrite ${result.rewrites.length} files`);
 * ```
 */
export function renameWithLinkRewrite(
	config: ParaObsidianConfig,
	options: RenameOptions,
): RenameResult {
	const from = resolveVaultPath(config.vault, options.from);
	const to = resolveVaultPath(config.vault, options.to);

	// Validate source and destination
	if (!fs.existsSync(from.absolute)) {
		throw new Error(`Source does not exist: ${options.from}`);
	}
	if (fs.existsSync(to.absolute)) {
		throw new Error(`Destination already exists: ${options.to}`);
	}

	// Extract note names for link matching (without .md extension)
	const fromName = path.basename(from.absolute, ".md");
	const toName = path.basename(to.absolute, ".md");

	// Scan vault for files with links to rewrite
	const rewrites: Array<{ file: string; changes: number }> = [];
	const files = listMarkdownFiles(config.vault);
	for (const file of files) {
		const original = fs.readFileSync(file, "utf8");
		const { content, changes } = replaceLinks(original, fromName, toName);
		if (changes > 0 && !options.dryRun) {
			fs.writeFileSync(file, content, "utf8");
		}
		if (changes > 0) {
			rewrites.push({
				file: path.relative(config.vault, file),
				changes,
			});
		}
	}

	// Move the file if not dry-run
	if (!options.dryRun) {
		fs.mkdirSync(path.dirname(to.absolute), { recursive: true });
		fs.renameSync(from.absolute, to.absolute);
	}

	return { moved: !options.dryRun, rewrites };
}
