/**
 * Filesystem utilities for safe vault operations.
 *
 * All path operations are sandboxed to the vault directory to prevent
 * accidental access to files outside the vault. Paths are resolved
 * relative to the vault root and validated before any operations.
 *
 * @module fs
 */
import path from "node:path";
import {
	type FileVisitor as CoreFileVisitor,
	type WalkDirectoryOptions as CoreWalkDirectoryOptions,
	// Re-export walkDirectory from core
	walkDirectory as coreWalkDirectory,
	isDirectorySync,
	isFileSync,
	pathExistsSync,
	readDir,
	readTextFileSync,
	// Import sandbox utilities from core
	resolveSandboxedPath,
} from "@side-quest/core/fs";

/**
 * Represents a resolved path within the vault.
 * Both absolute and vault-relative paths are provided.
 */
export interface VaultPath {
	/** Absolute filesystem path. */
	readonly absolute: string;
	/** Path relative to the vault root (e.g., "Projects/My Note.md"). */
	readonly relative: string;
}

/**
 * Resolves and validates a path within the vault.
 *
 * Ensures the resolved path doesn't escape the vault directory
 * using path traversal (e.g., "../secret"). This is a security
 * measure to sandbox all file operations within the vault.
 *
 * @param vault - Absolute path to the vault root
 * @param inputPath - Path to resolve (relative to vault, or "." for vault root)
 * @returns Resolved path with both absolute and relative components
 * @throws Error if the resolved path escapes the vault directory
 *
 * @example
 * ```typescript
 * const { absolute, relative } = resolveVaultPath('/vault', 'Projects/Note.md');
 * // absolute: '/vault/Projects/Note.md'
 * // relative: 'Projects/Note.md'
 * ```
 */
export function resolveVaultPath(vault: string, inputPath = "."): VaultPath {
	// Use core's resolveSandboxedPath for security-critical validation
	return resolveSandboxedPath(vault, inputPath);
}

/**
 * Lists contents of a directory within the vault.
 *
 * @param vault - Absolute path to the vault root
 * @param inputPath - Directory path relative to vault (defaults to vault root)
 * @returns Sorted array of filenames/directory names
 * @throws Error if path escapes vault, doesn't exist, or isn't a directory
 *
 * @example
 * ```typescript
 * const entries = listDir('/vault', 'Projects');
 * // ['Active', 'Archived', 'My Project.md', ...]
 * ```
 */
export function listDir(vault: string, inputPath = "."): Array<string> {
	const { absolute } = resolveVaultPath(vault, inputPath);
	if (!pathExistsSync(absolute)) {
		throw new Error(`Path does not exist: ${inputPath}`);
	}
	if (!isDirectorySync(absolute)) {
		throw new Error(`Not a directory: ${inputPath}`);
	}
	return readDir(absolute).slice().sort();
}

/**
 * Reads the contents of a file within the vault.
 *
 * @param vault - Absolute path to the vault root
 * @param inputPath - File path relative to vault
 * @returns File contents as UTF-8 string
 * @throws Error if path escapes vault, doesn't exist, or isn't a file
 *
 * @example
 * ```typescript
 * const content = readFile('/vault', 'Projects/My Note.md');
 * // '---\ntitle: My Note\n---\n# Content...'
 * ```
 */
export function readFile(vault: string, inputPath: string): string {
	const { absolute } = resolveVaultPath(vault, inputPath);
	if (!pathExistsSync(absolute)) {
		throw new Error(`Path does not exist: ${inputPath}`);
	}
	if (!isFileSync(absolute)) {
		throw new Error(`Not a file: ${inputPath}`);
	}
	return readTextFileSync(absolute);
}

/**
 * Options for directory walking.
 * Re-exported from core with vault-specific documentation.
 */
export type WalkDirectoryOptions = CoreWalkDirectoryOptions;

/**
 * Callback function for file visitor.
 * @param fullPath - Absolute path to the file
 * @param relativePath - Path relative to the root directory
 * @param entry - Filename (basename)
 *
 * Note: Para-obsidian's FileVisitor has a 3rd `entry` parameter for backwards compatibility.
 * Core's FileVisitor only has 2 parameters (fullPath, relativePath).
 */
export type FileVisitor = (
	fullPath: string,
	relativePath: string,
	entry: string,
) => void;

/**
 * Recursively walks a directory tree and calls a visitor function for each file.
 *
 * This is a wrapper around core's walkDirectory that provides backwards compatibility
 * with para-obsidian's 3-argument FileVisitor signature.
 *
 * @param rootDir - Absolute path to the root directory to walk
 * @param onFile - Callback function called for each file found
 * @param options - Walk options (skipDirs, skipHidden)
 *
 * @example
 * ```typescript
 * const files: string[] = [];
 * walkDirectory('/vault', (fullPath, relativePath, entry) => {
 *   if (entry.endsWith('.md')) {
 *     files.push(relativePath);
 *   }
 * }, { skipDirs: ['Attachments'] });
 * ```
 */
export function walkDirectory(
	rootDir: string,
	onFile: FileVisitor,
	options: WalkDirectoryOptions = {},
): void {
	// Wrap to add the 3rd `entry` parameter that para-obsidian expects
	const coreVisitor: CoreFileVisitor = (fullPath, relativePath) => {
		const entry = path.basename(fullPath);
		onFile(fullPath, relativePath, entry);
	};

	coreWalkDirectory(rootDir, coreVisitor, options);
}
