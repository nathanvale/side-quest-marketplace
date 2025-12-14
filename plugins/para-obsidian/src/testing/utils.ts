/**
 * Test utilities for para-obsidian plugin tests
 *
 * Provides vault-specific test fixtures and helpers that wrap
 * the core testing utilities with para-obsidian conventions.
 *
 * @example
 * ```ts
 * import { createTestVault, writeVaultFile, setupTestVault } from "./test-utils";
 *
 * // Create an isolated test vault
 * const vault = createTestVault();
 *
 * // Write files to the vault
 * writeVaultFile(vault, "01_Projects/Note.md", "---\ntitle: Test\n---\n");
 *
 * // Or setup a complete vault in one call
 * const vault = setupTestVault({
 *   "01_Projects/Note.md": "---\ntitle: Test\n---\n",
 *   "Templates/project.md": "---\ntype: project\n---\n"
 * });
 * ```
 */

import {
	cleanupTestDir,
	createTempDir,
	readTestFile,
	setupTestDir,
	testFileExists,
	writeTestFile,
} from "@sidequest/core/testing";

/**
 * Create a temporary vault directory for testing
 *
 * Sets PARA_VAULT environment variable to the created directory.
 *
 * @param options - Configuration options
 * @param options.gitInit - Initialize git repository with test user config
 * @returns Absolute path to the created vault directory
 *
 * @example
 * ```ts
 * const vault = createTestVault();
 * // PARA_VAULT is now set to the vault path
 *
 * // With git initialization for tests that need commits
 * const gitVault = createTestVault({ gitInit: true });
 * ```
 */
export function createTestVault(options: { gitInit?: boolean } = {}): string {
	const vault = createTempDir("para-obsidian-");
	process.env.PARA_VAULT = vault;

	if (options.gitInit) {
		// Initialize git repo with test user config
		Bun.spawnSync(["git", "init"], {
			cwd: vault,
			stdout: "ignore",
			stderr: "ignore",
		});
		Bun.spawnSync(["git", "config", "user.email", "test@test.com"], {
			cwd: vault,
			stdout: "ignore",
			stderr: "ignore",
		});
		Bun.spawnSync(["git", "config", "user.name", "Test"], {
			cwd: vault,
			stdout: "ignore",
			stderr: "ignore",
		});
	}

	return vault;
}

/**
 * Write a file to the test vault
 *
 * @param vault - Vault directory path
 * @param relativePath - Path relative to vault (e.g., "01_Projects/Note.md")
 * @param content - File content
 *
 * @example
 * ```ts
 * writeVaultFile(vault, "01_Projects/Test.md", `---
 * title: Test Project
 * type: project
 * status: active
 * ---
 * # Test Project
 * `);
 * ```
 */
export function writeVaultFile(
	vault: string,
	relativePath: string,
	content: string,
): void {
	writeTestFile(vault, relativePath, content);
}

/**
 * Read a file from the test vault
 *
 * @param vault - Vault directory path
 * @param relativePath - Path relative to vault
 * @returns File content as string
 */
export function readVaultFile(vault: string, relativePath: string): string {
	return readTestFile(vault, relativePath);
}

/**
 * Check if a file exists in the test vault
 *
 * @param vault - Vault directory path
 * @param relativePath - Path relative to vault
 * @returns True if file exists
 */
export function vaultFileExists(vault: string, relativePath: string): boolean {
	return testFileExists(vault, relativePath);
}

/**
 * Setup a complete test vault with multiple files
 *
 * Creates a temp vault directory, sets PARA_VAULT, and populates
 * with the given files. Optionally creates a Templates directory.
 *
 * @param files - Object mapping vault-relative paths to contents
 * @param options - Setup options
 * @returns Absolute path to the created vault
 *
 * @example
 * ```ts
 * const vault = setupTestVault({
 *   "01_Projects/Test.md": `---
 * title: Test
 * type: project
 * status: active
 * template_version: 4
 * ---
 * Content`,
 *   "other.md": "See [[Test]]"
 * });
 * ```
 */
export function setupTestVault(
	files: Record<string, string>,
	options: { createTemplatesDir?: boolean } = {},
): string {
	const vault = setupTestDir("para-obsidian-", files);
	process.env.PARA_VAULT = vault;

	// Create Templates directory if requested (common fixture)
	if (options.createTemplatesDir) {
		writeTestFile(vault, "Templates/.gitkeep", "");
	}

	return vault;
}

/**
 * Clean up a test vault directory
 *
 * @param vault - Vault directory to remove
 */
export function cleanupTestVault(vault: string): void {
	cleanupTestDir(vault);
}

/**
 * Initialize a git repository in the given directory
 *
 * Creates an initial commit with a .gitignore file.
 * Use for tests that need a fully initialized git repo.
 *
 * @param dir - Directory to initialize as git repo
 */
export async function initGitRepo(dir: string): Promise<void> {
	await Bun.$`git init`.cwd(dir).quiet();
	await Bun.$`git config user.email "test@example.com"`.cwd(dir).quiet();
	await Bun.$`git config user.name "Test"`.cwd(dir).quiet();
	writeTestFile(dir, ".gitignore", "node_modules\n");
	await Bun.$`git add .`.cwd(dir).quiet();
	await Bun.$`git commit -m init`.cwd(dir).quiet();
}

// Re-export core testing utilities for convenience
export {
	cleanupTestDir,
	createTempDir,
	readTestFile,
	setupTestDir,
	testFileExists,
	writeTestFile,
} from "@sidequest/core/testing";
