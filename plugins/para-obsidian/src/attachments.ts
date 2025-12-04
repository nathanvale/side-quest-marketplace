/**
 * Attachment discovery utilities.
 *
 * This module helps discover attachments (images, files) associated
 * with a note. It searches common Obsidian attachment patterns:
 * - Sibling folders: assets/, attachments/
 * - Note-specific folders: "Note Name Assets/", "Note Name Attachments/"
 * - Same-directory files sharing the note's stem
 *
 * @module attachments
 */
import fs from "node:fs";
import path from "node:path";

import { resolveVaultPath } from "./fs";

/**
 * Safely lists directory contents, returning empty array if path doesn't exist.
 */
function listDirSafe(dir: string): string[] {
	if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return [];
	return fs.readdirSync(dir);
}

/**
 * Discovers attachments associated with a note.
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
 *
 * @example
 * ```typescript
 * const attachments = discoverAttachments(vault, 'Projects/My Project.md');
 * // Might return: ['Projects/assets/image.png', 'Projects/My Project - diagram.svg']
 * ```
 */
export function discoverAttachments(
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
			if (fs.statSync(full).isFile()) {
				const rel = path.relative(vault, full);
				if (!rel.endsWith(".md")) found.push(rel);
			}
		}
	}

	// Find same-directory files sharing the note's stem (non-Markdown)
	for (const entry of listDirSafe(dir)) {
		const full = path.join(dir, entry);
		if (fs.statSync(full).isFile()) {
			if (entry.startsWith(stem) && !entry.endsWith(".md")) {
				const rel = path.relative(vault, full);
				found.push(rel);
			}
		}
	}

	// Deduplicate and return
	return Array.from(new Set(found));
}
