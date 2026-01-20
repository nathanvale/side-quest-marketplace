/**
 * Path validation utilities for MCP tools.
 *
 * Why: MCP tools accept file paths from potentially untrusted input
 * (Claude's tool calls). Without validation, attackers could use path traversal
 * (e.g., "../../etc/passwd") to access or modify files outside the repository.
 *
 * Defense strategy:
 * 1. Resolve paths to absolute form
 * 2. Verify resolved path is within git repository
 * 3. Reject access to files outside the project
 *
 * @module validation/paths
 */

import { resolve } from "node:path";
import { isFileInRepo } from "../git/index.js";

/**
 * Validate that a path is within the git repository.
 *
 * Why: Prevents path traversal attacks where an attacker provides paths like
 * "../../etc/passwd" or "/etc/passwd" to access files outside the project.
 *
 * Security: Uses git-based validation to ensure paths are within the repository.
 * This prevents accessing system files, user directories, or other projects.
 *
 * @param inputPath - Path provided by MCP tool caller (relative or absolute)
 * @returns Validated absolute path if within repository
 * @throws Error if path is outside repository or git repo not found
 *
 * @example
 * ```typescript
 * // Valid paths (within repo)
 * await validatePath("./src/index.ts");     // ✅ OK - relative path
 * await validatePath("/abs/path/to/repo/file.ts"); // ✅ OK - absolute path
 *
 * // Invalid paths (outside repo)
 * try {
 *   await validatePath("../../../etc/passwd");
 * } catch (error) {
 *   // ❌ Error: Path outside repository: ../../../etc/passwd
 * }
 *
 * try {
 *   await validatePath("/etc/passwd");
 * } catch (error) {
 *   // ❌ Error: Path outside repository: /etc/passwd
 * }
 * ```
 */
export async function validatePath(inputPath: string): Promise<string> {
	const resolvedPath = resolve(inputPath);
	const inRepo = await isFileInRepo(resolvedPath);

	if (!inRepo) {
		throw new Error(`Path outside repository: ${inputPath}`);
	}

	return resolvedPath;
}

/**
 * Validate a path parameter for MCP tools, with default handling.
 *
 * Why: Most MCP tools accept an optional path parameter that defaults to ".".
 * This function handles the default case and validates custom paths.
 *
 * The default path "." is always safe - it's the current working directory
 * which is guaranteed to be within the repository when the tool runs.
 *
 * @param path - Optional path from MCP tool args
 * @param defaultPath - Default path to use when path is undefined (default: ".")
 * @returns Validated path (either defaultPath or validated custom path)
 * @throws Error if custom path is outside repository
 *
 * @example
 * ```typescript
 * // Default behavior (returns ".")
 * await validatePathOrDefault(undefined);        // ✅ "."
 * await validatePathOrDefault(".");              // ✅ "."
 *
 * // Custom default
 * await validatePathOrDefault(undefined, "./src"); // ✅ "./src"
 *
 * // Valid custom paths
 * await validatePathOrDefault("./src/index.ts"); // ✅ Validated absolute path
 *
 * // Invalid custom paths
 * try {
 *   await validatePathOrDefault("../../../etc/passwd");
 * } catch (error) {
 *   // ❌ Error: Path outside repository
 * }
 * ```
 */
export async function validatePathOrDefault(
	path: string | undefined,
	defaultPath = ".",
): Promise<string> {
	// Default path is always safe - it's the current directory
	// Also treat whitespace-only strings as empty
	if (!path || path.trim() === "" || path === defaultPath) {
		return defaultPath;
	}

	return validatePath(path);
}
