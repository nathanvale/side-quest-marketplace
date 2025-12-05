/**
 * Path validation utilities for MCP tools.
 *
 * Why: MCP tools accept file paths from potentially untrusted input
 * (Claude's tool calls). Without validation, attackers could use path traversal
 * (e.g., "../../etc/passwd") to access or check files outside the repository.
 *
 * Defense strategy:
 * 1. Resolve paths to absolute form
 * 2. Verify resolved path is within git repository
 * 3. Reject patterns containing shell metacharacters
 */

import { resolve } from "node:path";
import { isFileInRepo } from "@sidequest/core/git";

/**
 * Validate that a path is within the git repository.
 *
 * Why: Prevents path traversal attacks where an attacker provides paths like
 * "../../etc/passwd" or "/etc/passwd" to access files outside the project.
 *
 * @param inputPath - Path provided by MCP tool caller
 * @returns Validated absolute path
 * @throws Error if path is outside repository
 *
 * @example
 * ```ts
 * try {
 *   const safePath = await validatePath("../../../etc/passwd");
 * } catch (error) {
 *   // Error: Path outside repository: ../../../etc/passwd
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
 * Why: Most TypeScript check tools accept an optional path parameter that defaults
 * to ".". This function handles the default case and validates custom paths.
 *
 * @param path - Optional path from MCP tool args
 * @returns Validated path (either "." for default or validated custom path)
 * @throws Error if custom path is outside repository
 */
export async function validatePathOrDefault(
	path: string | undefined,
): Promise<string> {
	// Default path "." is always safe - it's the current directory
	if (!path || path === ".") {
		return ".";
	}

	return validatePath(path);
}
