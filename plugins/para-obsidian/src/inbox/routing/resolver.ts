/**
 * Destination Resolver
 *
 * Resolves PARA destination paths from frontmatter area/project fields.
 *
 * @module inbox/routing/resolver
 */

import { join } from "node:path";
import { isDirectorySync } from "@side-quest/core/fs";
import { DEFAULT_PARA_FOLDERS } from "../../config/defaults";

// Well-known folder paths from DEFAULT_PARA_FOLDERS (compile-time safe constants)
const PROJECTS_FOLDER = DEFAULT_PARA_FOLDERS.projects!;
const AREAS_FOLDER = DEFAULT_PARA_FOLDERS.areas!;

/**
 * Strip wikilink brackets from a field value.
 *
 * Converts "[[Health]]" → "Health"
 *
 * @param value - Raw field value (may be wikilink or plain string)
 * @returns Cleaned value without brackets
 */
function stripWikilink(value: string): string {
	return value.replace(/^\[\[|\]\]$/g, "").trim();
}

/**
 * Result of finding a matching path.
 */
interface MatchResult {
	/** The matched name with correct casing */
	name: string;
	/** Whether the match is a folder (true) or a file (false) */
	isFolder: boolean;
}

/**
 * Result of resolving a destination.
 */
export interface ResolvedDestination {
	/** Vault-relative destination path (the folder where note will go) */
	destination: string;
	/**
	 * Colocate info when area/project is a file that needs to be moved into a new folder.
	 * If present, executor should:
	 * 1. Create the folder at `folderPath`
	 * 2. Move the area/project note from `sourceNotePath` into the folder
	 * 3. Then move the inbox note into the folder
	 */
	colocate?: {
		/** Vault-relative path to the area/project note file */
		sourceNotePath: string;
		/** Vault-relative path to the folder to create */
		folderPath: string;
	};
}

/**
 * Find matching folder or note file (case-insensitive).
 *
 * @param baseFolder - Parent folder to search in (e.g., "02 Areas")
 * @param name - Name to search for (e.g., "Health")
 * @param vaultPath - Absolute vault root path
 * @returns Match result with name and type, or null if not found
 */
function findMatchingPath(
	baseFolder: string,
	name: string,
	vaultPath: string,
): MatchResult | null {
	const basePath = join(vaultPath, baseFolder);

	if (!isDirectorySync(basePath)) {
		return null;
	}

	const { readdirSync, statSync } = require("node:fs");
	const entries = readdirSync(basePath);

	// Check for case-insensitive match (folder or .md file)
	for (const entry of entries) {
		const entryLower = entry.toLowerCase();
		const nameLower = name.toLowerCase();
		const fullPath = join(basePath, entry);

		// Match folder name
		if (entryLower === nameLower) {
			try {
				const stat = statSync(fullPath);
				return { name: entry, isFolder: stat.isDirectory() };
			} catch {
				return null;
			}
		}

		// Match note file (strip .md extension)
		if (entry.endsWith(".md")) {
			const noteNameLower = entry.slice(0, -3).toLowerCase();
			if (noteNameLower === nameLower) {
				return { name: entry.slice(0, -3), isFolder: false }; // Return without .md
			}
		}
	}

	return null;
}

/**
 * Validate that a folder name is safe and doesn't contain path traversal.
 *
 * Rejects:
 * - Path separators (/, \)
 * - Parent directory references (..)
 * - Absolute paths
 * - Control characters
 *
 * @param name - Folder name to validate
 * @returns true if safe, false otherwise
 */
function isSafeFolderName(name: string): boolean {
	// Reject empty or whitespace-only
	if (!name || name.trim().length === 0) return false;

	// Reject path separators
	if (name.includes("/") || name.includes("\\")) return false;

	// Reject parent directory references
	if (name.includes("..")) return false;

	// Reject absolute paths (Unix and Windows)
	if (name.startsWith("/") || /^[A-Za-z]:/.test(name)) return false;

	// Reject control characters (ASCII 0-31)
	// biome-ignore lint/suspicious/noControlCharactersInRegex: checking for control chars is intentional
	if (/[\x00-\x1F]/.test(name)) return false;

	return true;
}

/**
 * Resolve destination path for a note based on frontmatter.
 *
 * Priority order:
 * 1. If `project` exists → "01 Projects/{project}"
 * 2. Else if `area` exists → "02 Areas/{area}"
 *
 * When the project/area is a standalone note file (not a folder), returns
 * colocate info so the executor can:
 * 1. Create the folder
 * 2. Move the area/project note into it
 * 3. Move the inbox note alongside it
 *
 * Returns null if destination doesn't exist in vault.
 *
 * @param frontmatter - Frontmatter fields (area and/or project)
 * @param vaultPath - Absolute vault root path
 * @returns Resolved destination with optional colocate info, or null if invalid
 *
 * @example
 * ```typescript
 * // Project is a folder
 * const result = resolveDestination({ project: "[[Alpha]]" }, "/vault");
 * // Returns: { destination: "01 Projects/Alpha" }
 *
 * // Area is a folder
 * const result2 = resolveDestination({ area: "[[Health]]" }, "/vault");
 * // Returns: { destination: "02 Areas/Health" }
 *
 * // Area is a standalone note file (Career & Contracting.md)
 * const result3 = resolveDestination({ area: "[[Career & Contracting]]" }, "/vault");
 * // Returns: {
 * //   destination: "02 Areas/Career & Contracting",
 * //   colocate: {
 * //     sourceNotePath: "02 Areas/Career & Contracting.md",
 * //     folderPath: "02 Areas/Career & Contracting"
 * //   }
 * // }
 * ```
 */
export function resolveDestination(
	frontmatter: { area?: string; project?: string },
	vaultPath: string,
): ResolvedDestination | null {
	const { area, project } = frontmatter;

	// Priority 1: Project
	if (project) {
		const cleanProject = stripWikilink(project);

		// Security: Validate folder name to prevent path traversal
		if (!isSafeFolderName(cleanProject)) {
			return null;
		}

		// Case-insensitive lookup for folder or note file
		const match = findMatchingPath(PROJECTS_FOLDER, cleanProject, vaultPath);
		if (match) {
			const folderPath = join(PROJECTS_FOLDER, match.name);
			if (match.isFolder) {
				// Folder exists, route directly into it
				return { destination: folderPath };
			}
			// File-only: need to create folder and colocate
			return {
				destination: folderPath,
				colocate: {
					sourceNotePath: join(PROJECTS_FOLDER, `${match.name}.md`),
					folderPath,
				},
			};
		}
		return null;
	}

	// Priority 2: Area
	if (area) {
		const cleanArea = stripWikilink(area);

		// Security: Validate folder name to prevent path traversal
		if (!isSafeFolderName(cleanArea)) {
			return null;
		}

		// Case-insensitive lookup for folder or note file
		const match = findMatchingPath(AREAS_FOLDER, cleanArea, vaultPath);
		if (match) {
			const folderPath = join(AREAS_FOLDER, match.name);
			if (match.isFolder) {
				// Folder exists, route directly into it
				return { destination: folderPath };
			}
			// File-only: need to create folder and colocate
			return {
				destination: folderPath,
				colocate: {
					sourceNotePath: join(AREAS_FOLDER, `${match.name}.md`),
					folderPath,
				},
			};
		}
		return null;
	}

	return null;
}
