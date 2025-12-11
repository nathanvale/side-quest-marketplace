/**
 * Attachment discovery utilities.
 *
 * This module helps discover attachments (images, files) associated
 * with a note. Priority:
 * 1. Frontmatter `attachments` field (preferred, ADHD-friendly flat structure)
 * 2. Body wikilinks to [[Attachments/...]] (flat folder pattern)
 * 3. Legacy discovery: sibling folders, note-specific folders
 *
 * @module attachments
 */
import path from "node:path";
import {
	isDirectorySync,
	isFileSync,
	pathExistsSync,
	readDir,
	readTextFileSync,
} from "@sidequest/core/fs";

import { parseFrontmatter } from "./frontmatter";
import { resolveVaultPath } from "./fs";

/**
 * Safely lists directory contents, returning empty array if path doesn't exist.
 */
function listDirSafe(dir: string): string[] {
	if (!pathExistsSync(dir) || !isDirectorySync(dir)) return [];
	return readDir(dir);
}

/**
 * Extracts attachments from frontmatter `attachments` field.
 *
 * Parses wikilinks like `[[Attachments/20251210-file.pdf]]` and returns
 * vault-relative paths.
 *
 * @param vault - Absolute path to the vault root
 * @param notePath - Path to the note (relative to vault)
 * @returns Array of vault-relative paths from frontmatter
 */
export function discoverAttachmentsFromFrontmatter(
	vault: string,
	notePath: string,
): ReadonlyArray<string> {
	const { absolute } = resolveVaultPath(vault, notePath);
	const content = readTextFileSync(absolute);
	const { attributes } = parseFrontmatter(content);

	const attachments = attributes.attachments;
	if (!attachments || !Array.isArray(attachments)) return [];

	// Extract paths from wikilinks: [[Attachments/file.pdf]] → Attachments/file.pdf
	const paths: string[] = [];
	for (const link of attachments) {
		if (typeof link !== "string") continue;
		const match = link.match(/^\[\[(.+?)\]\]$/);
		if (match?.[1]) paths.push(match[1]);
	}
	return paths;
}

/**
 * Discovers attachments from body wikilinks to [[Attachments/...]].
 *
 * Scans note body (after frontmatter) for wikilinks pointing to files
 * in the Attachments/ folder.
 *
 * @param vault - Absolute path to the vault root
 * @param notePath - Path to the note (relative to vault)
 * @returns Array of vault-relative paths discovered in body
 */
export function discoverAttachmentsFromBody(
	vault: string,
	notePath: string,
): ReadonlyArray<string> {
	const { absolute } = resolveVaultPath(vault, notePath);
	const content = readTextFileSync(absolute);
	const { body } = parseFrontmatter(content);

	// Match wikilinks starting with Attachments/
	const regex = /\[\[(Attachments\/[^\]]+)\]\]/g;
	const paths: string[] = [];
	for (const match of body.matchAll(regex)) {
		const path = match[1];
		if (path !== undefined) paths.push(path);
	}
	return paths;
}

/**
 * Discovers attachments associated with a note using priority fallback:
 * 1. Frontmatter `attachments` field (preferred, ADHD-friendly flat structure)
 * 2. Body wikilinks to [[Attachments/...]] (flat folder pattern)
 * 3. Legacy discovery: sibling folders, note-specific folders
 *
 * @param vault - Absolute path to the vault root
 * @param notePath - Path to the note (relative to vault)
 * @returns Array of vault-relative paths to discovered attachments
 *
 * @example
 * ```typescript
 * // Priority 1: Frontmatter
 * // attachments: ["[[Attachments/20251210-file.pdf]]"]
 * const attachments = discoverAttachments(vault, 'Projects/My Project.md');
 * // Returns: ['Attachments/20251210-file.pdf']
 *
 * // Priority 2: Body links
 * // Body contains: See [[Attachments/20251210-photo.jpg]]
 * // Returns: ['Attachments/20251210-photo.jpg']
 *
 * // Priority 3: Legacy folders
 * // Returns: ['Projects/assets/image.png', 'Projects/My Project - diagram.svg']
 * ```
 */
export function discoverAttachments(
	vault: string,
	notePath: string,
): ReadonlyArray<string> {
	// Priority 1: Frontmatter attachments field
	const fromFrontmatter = discoverAttachmentsFromFrontmatter(vault, notePath);
	if (fromFrontmatter.length > 0) return fromFrontmatter;

	// Priority 2: Body wikilinks to Attachments/
	const fromBody = discoverAttachmentsFromBody(vault, notePath);
	if (fromBody.length > 0) return fromBody;

	// Priority 3: Legacy discovery (sibling folders, note-specific folders)
	return discoverLegacyAttachments(vault, notePath);
}

/**
 * Legacy attachment discovery using folder-based patterns.
 *
 * Searches several common patterns for finding related files:
 * 1. Sibling "assets" or "attachments" folders
 * 2. Note-specific folders like "Note Name Assets"
 * 3. Files in the same directory with matching stem prefix
 *
 * Only returns non-Markdown files to avoid including linked notes.
 *
 * @param vault - Absolute path to the vault root
 * @param notePath - Path to the note (relative to vault)
 * @returns Array of vault-relative paths to discovered attachments
 */
export function discoverLegacyAttachments(
	vault: string,
	notePath: string,
): ReadonlyArray<string> {
	const { absolute } = resolveVaultPath(vault, notePath);
	const dir = path.dirname(absolute);
	const stem = path.basename(absolute, path.extname(absolute));

	// Candidate folders to search for attachments
	const candidates = [
		path.join(dir, "assets"),
		path.join(dir, "attachments"),
		path.join(dir, `${stem} Assets`),
		path.join(dir, `${stem} Attachments`),
	];

	const found: string[] = [];

	// Search candidate folders for non-Markdown files
	for (const folder of candidates) {
		for (const entry of listDirSafe(folder)) {
			const full = path.join(folder, entry);
			if (isFileSync(full)) {
				const rel = path.relative(vault, full);
				if (!rel.endsWith(".md")) found.push(rel);
			}
		}
	}

	// Find same-directory files sharing the note's stem (non-Markdown)
	for (const entry of listDirSafe(dir)) {
		const full = path.join(dir, entry);
		if (isFileSync(full)) {
			if (entry.startsWith(stem) && !entry.endsWith(".md")) {
				const rel = path.relative(vault, full);
				found.push(rel);
			}
		}
	}

	// Deduplicate and return
	return Array.from(new Set(found));
}
