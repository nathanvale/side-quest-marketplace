/**
 * Path validation utilities for MCP tools.
 *
 * Why: MCP tools accept file paths and patterns from potentially untrusted input
 * (Claude's tool calls). Without validation, attackers could use path traversal
 * (e.g., "../../etc/passwd") to access or modify files outside the repository.
 *
 * Defense strategy:
 * 1. Resolve paths to absolute form
 * 2. Verify resolved path is within git repository
 * 3. Reject patterns containing shell metacharacters
 */

import { resolve } from "node:path";

/**
 * Check if a file is within the git repository
 */
async function isFileInRepo(filePath: string): Promise<boolean> {
	try {
		// Use git ls-files to check if file is tracked
		// This also verifies we're in a git repo
		const proc = Bun.spawnSync([
			"git",
			"ls-files",
			"--cached",
			"--others",
			"--exclude-standard",
			filePath,
		]);
		return proc.success;
	} catch {
		return false;
	}
}

/**
 * Shell metacharacters that could be dangerous in command arguments.
 * While we use array-based spawn (not shell string), rejecting these
 * provides defense-in-depth against potential future changes.
 */
const SHELL_METACHARACTERS = /[;&|<>`$\\]/;

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
 * Validate that a test pattern doesn't contain dangerous characters.
 *
 * Why: Test patterns are passed to `bun test <pattern>`. While we use array-based
 * spawn (not shell string concatenation), rejecting shell metacharacters provides
 * defense-in-depth. Patterns with path components are also validated.
 *
 * @param pattern - Test pattern provided by MCP tool caller
 * @throws Error if pattern contains dangerous characters
 *
 * @example
 * ```ts
 * // Safe patterns
 * validatePattern("auth");           // OK - simple string
 * validatePattern("login.test.ts");  // OK - filename
 *
 * // Unsafe patterns
 * validatePattern("; rm -rf /");     // Error - shell metacharacters
 * validatePattern("$(cat /etc/passwd)"); // Error - command substitution
 * ```
 */
export function validatePattern(pattern: string): void {
	if (SHELL_METACHARACTERS.test(pattern)) {
		throw new Error(
			`Invalid pattern: contains shell metacharacters: ${pattern}`,
		);
	}
}

/**
 * Validate a path parameter for MCP tools, with default handling.
 *
 * Why: Most lint/format tools accept an optional path parameter that defaults
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
