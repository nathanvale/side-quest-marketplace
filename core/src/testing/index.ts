/**
 * Testing utilities for SideQuest marketplace plugins
 *
 * Provides common test fixtures and helpers for plugin testing:
 * - Temporary directory creation
 * - Test file writing
 * - Fixture setup helpers
 *
 * @example
 * ```ts
 * import { createTempDir, writeTestFile, setupTestDir } from "@sidequest/core/testing";
 *
 * // Create isolated temp directory
 * const tempDir = createTempDir("my-test-");
 *
 * // Write test files
 * writeTestFile(tempDir, "config.json", '{"key": "value"}');
 *
 * // Setup directory with multiple files
 * const dir = setupTestDir("test-", {
 *   "src/index.ts": "export const foo = 1;",
 *   "package.json": '{"name": "test"}'
 * });
 * ```
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Create a temporary directory with a given prefix
 *
 * Uses the system temp directory and creates a unique subdirectory.
 * Useful for isolating test fixtures.
 *
 * @param prefix - Prefix for the temp directory name (default: "test-")
 * @returns Absolute path to the created temp directory
 *
 * @example
 * ```ts
 * const tempDir = createTempDir("my-plugin-");
 * // "/tmp/my-plugin-abc123"
 * ```
 */
export function createTempDir(prefix = "test-"): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/**
 * Write a test file to a directory, creating parent directories as needed
 *
 * @param dir - Base directory (absolute path)
 * @param relativePath - Path relative to dir (can include subdirectories)
 * @param content - File content to write
 *
 * @example
 * ```ts
 * writeTestFile("/tmp/test", "src/utils/index.ts", "export const x = 1;");
 * // Creates /tmp/test/src/utils/index.ts
 * ```
 */
export function writeTestFile(
	dir: string,
	relativePath: string,
	content: string,
): void {
	const fullPath = path.join(dir, relativePath);
	fs.mkdirSync(path.dirname(fullPath), { recursive: true });
	fs.writeFileSync(fullPath, content, "utf8");
}

/**
 * Read a test file from a directory
 *
 * @param dir - Base directory (absolute path)
 * @param relativePath - Path relative to dir
 * @returns File content as string
 *
 * @example
 * ```ts
 * const content = readTestFile("/tmp/test", "config.json");
 * ```
 */
export function readTestFile(dir: string, relativePath: string): string {
	return fs.readFileSync(path.join(dir, relativePath), "utf8");
}

/**
 * Check if a test file exists
 *
 * @param dir - Base directory (absolute path)
 * @param relativePath - Path relative to dir
 * @returns True if file exists
 */
export function testFileExists(dir: string, relativePath: string): boolean {
	return fs.existsSync(path.join(dir, relativePath));
}

/**
 * Setup a test directory with multiple files
 *
 * Creates a temp directory and populates it with the given files.
 * Useful for setting up complex test fixtures in one call.
 *
 * @param prefix - Prefix for the temp directory name
 * @param files - Object mapping relative paths to file contents
 * @returns Absolute path to the created temp directory
 *
 * @example
 * ```ts
 * const dir = setupTestDir("vault-", {
 *   "01_Projects/Note.md": "---\ntitle: Test\n---\nContent",
 *   "config.json": '{"vault": "."}',
 *   ".gitignore": "node_modules/"
 * });
 * ```
 */
export function setupTestDir(
	prefix: string,
	files: Record<string, string>,
): string {
	const dir = createTempDir(prefix);
	for (const [relativePath, content] of Object.entries(files)) {
		writeTestFile(dir, relativePath, content);
	}
	return dir;
}

/**
 * Remove a test directory and all its contents
 *
 * @param dir - Directory to remove (absolute path)
 */
export function cleanupTestDir(dir: string): void {
	fs.rmSync(dir, { recursive: true, force: true });
}
