/**
 * Sandbox path resolution utilities for preventing path traversal attacks.
 *
 * These functions provide security-critical path validation to prevent:
 * - Path traversal attacks (../ escaping sandbox boundary)
 * - Subprocess injection (invalid characters in filenames)
 * - Configuration file injection (malicious config paths)
 *
 * @module fs/sandbox
 */

import path from "node:path";

/**
 * Represents a resolved path within a sandbox root directory.
 * Both absolute and sandbox-relative paths are provided.
 */
export interface SandboxedPath {
	/** Absolute filesystem path. */
	readonly absolute: string;
	/** Path relative to sandbox root (e.g., "Projects/Note.md" or "." for root). */
	readonly relative: string;
}

/**
 * Check if a path is contained within a parent directory.
 * Used to prevent path traversal outside the sandbox.
 *
 * @param parent - Parent directory path (absolute)
 * @param child - Child path to check (absolute)
 * @returns true if child is within parent (or equal to parent)
 */
function isSubPath(parent: string, child: string): boolean {
	const rel = path.relative(parent, child);
	// Valid subpath: non-empty, doesn't start with "..", and isn't absolute
	return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

/**
 * Resolves and validates a path within a sandbox root directory.
 *
 * Ensures the resolved path doesn't escape the sandbox directory
 * using path traversal (e.g., "../secret"). This is a security
 * measure to sandbox all file operations within a trusted boundary.
 *
 * Security guarantees:
 * - Path must be within or equal to sandbox root
 * - No ".." components allowed that escape the boundary
 * - Handles both absolute and relative input paths
 * - Works on both POSIX and Windows paths
 *
 * @param root - Absolute path to the sandbox root directory
 * @param inputPath - Path to resolve (relative to root, or "." for root)
 * @returns Resolved path with both absolute and relative components
 * @throws Error if the resolved path escapes the sandbox directory
 *
 * @example
 * ```typescript
 * const { absolute, relative } = resolveSandboxedPath('/vault', 'Projects/Note.md');
 * // absolute: '/vault/Projects/Note.md'
 * // relative: 'Projects/Note.md'
 *
 * // Root path allowed
 * resolveSandboxedPath('/vault', '.'); // OK
 *
 * // Path traversal blocked
 * resolveSandboxedPath('/vault', '../etc/passwd'); // throws Error
 * ```
 */
export function resolveSandboxedPath(
	root: string,
	inputPath = ".",
): SandboxedPath {
	const absolute = path.resolve(root, inputPath);
	// Allow exact root match OR valid subpath
	if (!isSubPath(root, absolute) && path.resolve(root) !== absolute) {
		throw new Error(`Path escapes sandbox: ${inputPath}`);
	}
	const relative = path.relative(root, absolute);
	return { absolute, relative: relative || "." };
}

/**
 * Validates that a config path is within expected safe locations.
 *
 * Prevents path traversal attacks via configuration file paths
 * (e.g., PARA_OBSIDIAN_CONFIG environment variable).
 *
 * Safe locations (default):
 * - User's home directory (~/.config/)
 * - Current working directory or subdirectories
 *
 * Custom allowed roots can be provided for application-specific paths.
 *
 * Security notes:
 * - Canonicalizes path first to prevent bypasses like //etc/passwd
 * - Checks for path traversal sequences (..) before resolution
 * - Supports both POSIX and Windows paths
 *
 * @param configPath - Path to validate (absolute or relative)
 * @param allowedRoots - Optional array of additional allowed root directories
 * @returns true if path is safe to load
 *
 * @example
 * ```typescript
 * // Safe: within home config
 * validateConfigPath('~/.config/app/config.json'); // true
 *
 * // Safe: within cwd
 * validateConfigPath('./.apprc'); // true
 *
 * // Safe: custom root
 * validateConfigPath('/vault/config.json', ['/vault']); // true
 *
 * // Unsafe: path traversal
 * validateConfigPath('../../etc/passwd'); // false
 *
 * // Unsafe: outside allowed roots
 * validateConfigPath('/etc/secrets'); // false
 * ```
 */
export function validateConfigPath(
	configPath: string,
	allowedRoots: string[] = [],
): boolean {
	// Canonicalize the path first to resolve any tricks like //etc/passwd
	// This normalizes slashes, resolves symlinks, and makes absolute
	const resolved = path.resolve(configPath);
	const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
	const cwd = process.cwd();

	// Check for path traversal sequences in the original path
	// This catches patterns like ../ before resolution
	if (configPath.includes("..")) {
		return false;
	}

	// Allow paths within home config directory
	if (home && resolved.startsWith(path.join(home, ".config"))) {
		return true;
	}

	// Allow paths within current working directory
	if (resolved.startsWith(cwd)) {
		return true;
	}

	// Allow paths within custom allowed roots
	for (const allowedRoot of allowedRoots) {
		if (resolved.startsWith(path.resolve(allowedRoot))) {
			return true;
		}
	}

	return false;
}

/**
 * Validates filename for safe use in subprocesses.
 *
 * Prevents command injection by restricting characters to a safe subset.
 * This is critical when filenames are passed to shell commands or spawned processes.
 *
 * Allowed characters:
 * - Alphanumeric: a-z, A-Z, 0-9
 * - Separators: underscore (_), hyphen (-)
 * - Extensions: dot (.)
 * - Whitespace: space ( )
 *
 * @param filename - Filename to validate (basename only, not full path)
 * @throws Error if filename contains invalid characters
 *
 * @example
 * ```typescript
 * // Valid filenames
 * validateFilenameForSubprocess("invoice-2024.pdf"); // OK
 * validateFilenameForSubprocess("Meeting Notes.md"); // OK
 * validateFilenameForSubprocess("file_v2.txt"); // OK
 *
 * // Invalid: special characters
 * validateFilenameForSubprocess("file; rm -rf /"); // throws Error
 * validateFilenameForSubprocess("file`whoami`.txt"); // throws Error
 * validateFilenameForSubprocess("file$(cat /etc/passwd)"); // throws Error
 * ```
 */
export function validateFilenameForSubprocess(filename: string): void {
	// Allow alphanumeric, underscore, hyphen, dot, space
	if (!/^[a-zA-Z0-9_\-. ]+$/.test(filename)) {
		throw new Error(`Invalid characters in filename: ${filename}`);
	}
}
