/**
 * Attachment flattening utilities.
 *
 * This module provides functionality to migrate nested attachment folders
 * to a flat ADHD-friendly structure with timestamp-based IDs.
 *
 * Workflow:
 * 1. Discover nested attachments (legacy folders)
 * 2. Generate timestamp-based filenames
 * 3. Move files to flat Attachments/ folder
 * 4. Update all note references (frontmatter + body wikilinks)
 * 5. Optionally remove empty nested folders
 *
 * @module flatten
 */
import path from "node:path";
import {
	ensureDirSync,
	isDirectorySync,
	isFileSync,
	pathExistsSync,
	readDir,
	readTextFileSync,
	writeTextFileSync,
} from "@sidequest/core/fs";
import { spawnSyncCollect } from "@sidequest/core/spawn";

import { resolveVaultPath } from "./fs";

/**
 * Result of flattening operation on a single note.
 */
export interface FlattenResult {
	/** Path to the note that was processed */
	readonly notePath: string;
	/** Number of attachments moved to flat structure */
	readonly attachmentsMoved: number;
	/** New flat paths for the moved attachments */
	readonly newPaths: ReadonlyArray<string>;
	/** Whether frontmatter was updated */
	readonly frontmatterUpdated: boolean;
	/** Whether body links were updated */
	readonly bodyLinksUpdated: boolean;
}

/**
 * Options for flatten-attachments operation.
 */
export interface FlattenOptions {
	/** If true, show what would happen without making changes */
	readonly dryRun?: boolean;
	/** If true, remove empty nested folders after moving files */
	readonly removeEmptyDirs?: boolean;
	/** Custom timestamp format (default: YYYYMMDD-HHMM) */
	readonly timestampFormat?: string;
	/** Directory to scan for notes (default: entire vault) */
	readonly dir?: string;
}

/**
 * Generates a timestamp-based filename for an attachment.
 *
 * Format: YYYYMMDD-HHMM-type-description.ext
 *
 * @param originalPath - Original file path
 * @param timestamp - Optional timestamp (default: now)
 * @returns Flattened filename
 *
 * @example
 * ```typescript
 * generateFlatFilename('Travel/Tasmania_2025/Hikes/Dove_Lake/map.jpg')
 * // Returns: '20251210-1430-map-dove-lake.jpg'
 * ```
 */
export function generateFlatFilename(
	originalPath: string,
	timestamp?: Date,
): string {
	const ts = timestamp ?? new Date();
	const year = ts.getFullYear();
	const month = String(ts.getMonth() + 1).padStart(2, "0");
	const day = String(ts.getDate()).padStart(2, "0");
	const hour = String(ts.getHours()).padStart(2, "0");
	const minute = String(ts.getMinutes()).padStart(2, "0");

	const timestampPrefix = `${year}${month}${day}-${hour}${minute}`;

	// Extract meaningful parts from path
	const basename = path.basename(originalPath);
	const ext = path.extname(basename);
	const nameWithoutExt = path.basename(basename, ext);

	// Build descriptive name: timestamp-description (NO extension in middle)
	const description = nameWithoutExt
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

	const parts = [timestampPrefix, description];

	return `${parts.join("-")}${ext}`;
}

/**
 * Discovers all nested attachments in a vault folder.
 *
 * Scans for files in nested "Attachments/Organized/" structure.
 *
 * @param vault - Absolute path to vault root
 * @param searchDir - Directory to search (relative to vault)
 * @returns Array of vault-relative paths to nested attachments
 */
export function discoverNestedAttachments(
	vault: string,
	searchDir: string = "Attachments/Organized",
): ReadonlyArray<string> {
	const { absolute } = resolveVaultPath(vault, searchDir);

	if (!pathExistsSync(absolute) || !isDirectorySync(absolute)) {
		return [];
	}

	const found: string[] = [];

	function walkDir(dir: string): void {
		for (const entry of readDir(dir)) {
			const fullPath = path.join(dir, entry);
			if (isDirectorySync(fullPath)) {
				walkDir(fullPath);
			} else if (isFileSync(fullPath) && !entry.endsWith(".md")) {
				const rel = path.relative(vault, fullPath);
				found.push(rel);
			}
		}
	}

	walkDir(absolute);
	return found;
}

/**
 * Flattens all attachments in a vault.
 *
 * Process:
 * 1. Discovers nested attachments
 * 2. Generates timestamp-based filenames
 * 3. Moves files to flat Attachments/ folder
 * 4. Updates all note references
 *
 * @param vault - Absolute path to vault root
 * @param options - Flatten options
 * @returns Summary of flattening operation
 */
export async function flattenAttachments(
	vault: string,
	options: FlattenOptions = {},
): Promise<{
	readonly attachmentsMoved: number;
	readonly notesUpdated: number;
	readonly emptyDirsRemoved: number;
}> {
	const { dryRun = false, removeEmptyDirs = false } = options;

	// Step 1: Discover nested attachments
	const nestedFiles = discoverNestedAttachments(vault);

	if (nestedFiles.length === 0) {
		return { attachmentsMoved: 0, notesUpdated: 0, emptyDirsRemoved: 0 };
	}

	// Step 2: Generate new flat paths and move files
	const moveMap = new Map<string, string>(); // old path → new path

	for (const oldPath of nestedFiles) {
		const flatFilename = generateFlatFilename(oldPath);
		const newPath = `Attachments/${flatFilename}`;

		moveMap.set(oldPath, newPath);

		if (!dryRun) {
			const oldAbsolute = path.join(vault, oldPath);
			const newAbsolute = path.join(vault, newPath);

			// Ensure target directory exists
			const newDir = path.dirname(newAbsolute);
			if (!pathExistsSync(newDir)) {
				ensureDirSync(newDir);
			}

			// Move file
			const mv = spawnSyncCollect(["mv", oldAbsolute, newAbsolute]);
			if (mv.exitCode !== 0) {
				throw new Error(`Failed to move ${oldAbsolute}: ${mv.stderr}`);
			}
		}
	}

	// Step 3: Update all notes that reference these attachments
	const notesUpdated = await updateNoteReferences(vault, moveMap, dryRun);

	// Step 4: Remove empty directories
	let emptyDirsRemoved = 0;
	if (removeEmptyDirs && !dryRun) {
		emptyDirsRemoved = removeEmptyDirectories(vault, "Attachments/Organized");
	}

	return {
		attachmentsMoved: nestedFiles.length,
		notesUpdated,
		emptyDirsRemoved,
	};
}

/**
 * Updates all note references after flattening attachments.
 *
 * Scans vault for notes containing old attachment paths and updates them
 * to new flat paths in both frontmatter and body.
 *
 * @param vault - Absolute path to vault root
 * @param moveMap - Map of old paths to new paths
 * @param dryRun - If true, don't write changes
 * @returns Number of notes updated
 */
async function updateNoteReferences(
	vault: string,
	moveMap: Map<string, string>,
	dryRun: boolean,
): Promise<number> {
	let notesUpdated = 0;

	// Build regex patterns for each old path
	const patterns = Array.from(moveMap.entries()).map(([oldPath, newPath]) => ({
		oldPath,
		newPath,
		// Match wikilinks, markdown links, and relative paths
		regex: new RegExp(
			`(\\[\\[|\\]\\(|["'])(${escapeRegex(oldPath)})(?=\\]\\]|\\)|["'])`,
			"g",
		),
	}));

	// Scan all markdown files in vault
	function walkVault(dir: string): void {
		for (const entry of readDir(dir)) {
			const fullPath = path.join(dir, entry);
			if (isDirectorySync(fullPath)) {
				walkVault(fullPath);
			} else if (isFileSync(fullPath) && entry.endsWith(".md")) {
				const updated = updateNoteFile(fullPath, patterns, dryRun);
				if (updated) notesUpdated++;
			}
		}
	}

	walkVault(vault);
	return notesUpdated;
}

/**
 * Updates a single note file with new attachment paths.
 *
 * @param notePath - Absolute path to note file
 * @param patterns - Array of path replacement patterns
 * @param dryRun - If true, don't write changes
 * @returns True if note was updated
 */
function updateNoteFile(
	notePath: string,
	patterns: Array<{
		oldPath: string;
		newPath: string;
		regex: RegExp;
	}>,
	dryRun: boolean,
): boolean {
	const content = readTextFileSync(notePath);
	let updated = content;

	for (const { regex, newPath } of patterns) {
		updated = updated.replace(regex, `$1${newPath}`);
	}

	if (updated !== content) {
		if (!dryRun) {
			writeTextFileSync(notePath, updated);
		}
		return true;
	}

	return false;
}

/**
 * Removes empty directories recursively.
 *
 * @param vault - Absolute path to vault root
 * @param startDir - Directory to start scanning (relative to vault)
 * @returns Number of directories removed
 */
function removeEmptyDirectories(vault: string, startDir: string): number {
	const { absolute } = resolveVaultPath(vault, startDir);
	let removed = 0;

	function removeEmptyDirsRecursive(dir: string): boolean {
		if (!pathExistsSync(dir)) return false;

		const entries = readDir(dir);
		let isEmpty = true;

		for (const entry of entries) {
			const fullPath = path.join(dir, entry);
			if (isDirectorySync(fullPath)) {
				const wasRemoved = removeEmptyDirsRecursive(fullPath);
				if (!wasRemoved) isEmpty = false;
			} else {
				isEmpty = false;
			}
		}

		if (isEmpty && dir !== absolute) {
			spawnSyncCollect(["rmdir", dir]);
			removed++;
			return true;
		}

		return false;
	}

	removeEmptyDirsRecursive(absolute);
	return removed;
}

/**
 * Escapes special regex characters in a string.
 *
 * @param str - String to escape
 * @returns Escaped string safe for use in RegExp
 */
function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
