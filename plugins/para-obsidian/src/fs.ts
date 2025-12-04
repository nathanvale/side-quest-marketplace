/**
 * Filesystem utilities for safe vault operations.
 *
 * All path operations are sandboxed to the vault directory to prevent
 * accidental access to files outside the vault. Paths are resolved
 * relative to the vault root and validated before any operations.
 *
 * @module fs
 */
import fs from "node:fs";
import path from "node:path";

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
 * Checks if a path is contained within a parent directory.
 * Used to prevent path traversal outside the vault.
 */
function isSubPath(parent: string, child: string): boolean {
	const rel = path.relative(parent, child);
	// Valid subpath: non-empty, doesn't start with "..", and isn't absolute
	return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel);
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
	const absolute = path.resolve(vault, inputPath);
	// Allow exact vault root match OR valid subpath
	if (!isSubPath(vault, absolute) && path.resolve(vault) !== absolute) {
		throw new Error(`Path escapes vault: ${inputPath}`);
	}
	const relative = path.relative(vault, absolute);
	return { absolute, relative: relative || "." };
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
	if (!fs.existsSync(absolute)) {
		throw new Error(`Path does not exist: ${inputPath}`);
	}
	if (!fs.statSync(absolute).isDirectory()) {
		throw new Error(`Not a directory: ${inputPath}`);
	}
	return fs.readdirSync(absolute).sort();
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
	if (!fs.existsSync(absolute)) {
		throw new Error(`Path does not exist: ${inputPath}`);
	}
	if (!fs.statSync(absolute).isFile()) {
		throw new Error(`Not a file: ${inputPath}`);
	}
	return fs.readFileSync(absolute, "utf8");
}
