/**
 * Test utilities for para-obsidian plugin tests
 *
 * Provides vault-specific test fixtures and helpers that wrap
 * the core testing utilities with para-obsidian conventions.
 *
 * @example
 * ```ts
 * import { createTestVault, writeVaultFile, setupTestVault } from "./testing/utils";
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
 * Removes the directory and cleans up PARA_VAULT environment variable.
 *
 * @param vault - Vault directory to remove
 */
export function cleanupTestVault(vault: string): void {
	cleanupTestDir(vault);
	// Clean up environment variable to prevent pollution between tests
	if (process.env.PARA_VAULT === vault) {
		delete process.env.PARA_VAULT;
	}
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

/**
 * Higher-order function that creates a vault, runs a test, and cleans up.
 *
 * Automatically manages PARA_VAULT environment variable and cleanup.
 * Simplifies test setup by eliminating boilerplate vault creation/cleanup.
 *
 * @param fn - Test function to run with vault and config
 * @returns Promise that resolves with test function's return value
 *
 * @example
 * ```ts
 * await withTempVault(async (vault, config) => {
 *   writeVaultFile(vault, "00 Inbox/test.md", "content");
 *   const result = await someOperation(config);
 *   expect(result).toBe("expected");
 * });
 * ```
 */
export async function withTempVault<T>(
	fn: (
		vault: string,
		config: import("../config/index").ParaObsidianConfig,
	) => T | Promise<T>,
): Promise<T> {
	const vault = createTestVault();
	const originalEnv = process.env.PARA_VAULT;
	process.env.PARA_VAULT = vault;

	try {
		const { loadConfig } = await import("../config/index");
		const config = loadConfig();
		return await fn(vault, config);
	} finally {
		// Restore environment
		if (originalEnv !== undefined) {
			process.env.PARA_VAULT = originalEnv;
		} else {
			delete process.env.PARA_VAULT;
		}
		cleanupTestVault(vault);
	}
}

/**
 * Create a test execution context for inbox operations.
 *
 * Factory that provides sensible defaults for ExecutionContext,
 * reducing boilerplate in executor tests.
 *
 * @param vault - Absolute path to vault directory
 * @param options - Optional overrides for context properties
 * @returns ExecutionContext with defaults and overrides merged
 *
 * @example
 * ```ts
 * const vault = createTestVault();
 * const registry = createRegistry(vault);
 * await registry.load();
 *
 * const context = createTestContext(vault, { registry });
 * const result = await executeSuggestion(suggestion, context);
 * ```
 */
export function createTestContext(
	vault: string,
	options?: Partial<import("../inbox/execute/types").ExecutionContext>,
): import("../inbox/execute/types").ExecutionContext {
	// Import createRegistry inline to avoid circular dependency
	const { createRegistry } = require("../inbox/registry/processed-registry");

	// Create default registry if not provided
	const defaultRegistry = createRegistry(vault);

	return {
		vaultPath: vault,
		inboxFolder: "00 Inbox",
		attachmentsFolder: "Attachments",
		templatesFolder: "Templates",
		registry: defaultRegistry,
		cid: `test-cid-${Date.now()}`,
		sessionCid: `test-session-${Date.now()}`,
		...options,
	};
}

/**
 * Hook for managing vault cleanup in describe blocks.
 *
 * Tracks vaults created during tests and provides afterEach hook
 * for automatic cleanup. Useful when tests create multiple vaults
 * or need manual vault tracking.
 *
 * @returns Object with trackVault and getAfterEachHook functions
 *
 * @example
 * ```ts
 * describe("My tests", () => {
 *   const { trackVault, getAfterEachHook } = useTestVaultCleanup();
 *   afterEach(getAfterEachHook());
 *
 *   test("creates vault", () => {
 *     const vault = createTestVault();
 *     trackVault(vault);
 *     // ... test code ...
 *   });
 * });
 * ```
 */
export function useTestVaultCleanup() {
	const vaults: string[] = [];
	const originalEnv = process.env.PARA_VAULT;

	return {
		/**
		 * Track a vault for automatic cleanup
		 * @param vault - Vault path to track
		 */
		trackVault: (vault: string) => {
			vaults.push(vault);
		},

		/**
		 * Get afterEach hook function for cleanup
		 * @returns Function to use as afterEach hook
		 */
		getAfterEachHook: () => {
			return () => {
				// Clean up all tracked vaults
				for (const vault of vaults) {
					cleanupTestVault(vault);
				}
				vaults.length = 0;

				// Restore original environment
				if (originalEnv !== undefined) {
					process.env.PARA_VAULT = originalEnv;
				} else {
					delete process.env.PARA_VAULT;
				}
			};
		},
	};
}

/**
 * Create a test suggestion with sensible defaults.
 *
 * Factory for CreateNoteSuggestion that reduces boilerplate in tests.
 * All fields can be overridden via the overrides parameter.
 *
 * @param overrides - Partial suggestion to override defaults
 * @returns Complete CreateNoteSuggestion with defaults and overrides
 *
 * @example
 * ```ts
 * const suggestion = createTestSuggestion({
 *   suggestedTitle: "My Document",
 *   suggestedNoteType: "project"
 * });
 * ```
 */
export function createTestSuggestion(
	overrides?: Partial<import("../inbox/types").CreateNoteSuggestion>,
): import("../inbox/types").CreateNoteSuggestion {
	const { createSuggestionId } = require("../inbox/types");

	return {
		id: createSuggestionId(),
		action: "create-note",
		source: "00 Inbox/test-document.pdf",
		processor: "attachments",
		confidence: "high",
		reason: "Test document",
		suggestedTitle: "Test Document",
		suggestedNoteType: "resource",
		detectionSource: "heuristic",
		...overrides,
	};
}

/**
 * Create a test template with sensible defaults.
 *
 * Factory for TemplateInfo that reduces boilerplate in template tests.
 *
 * @param content - Template content (frontmatter + body)
 * @param overrides - Optional overrides for name, path, or version
 * @returns Complete TemplateInfo object
 *
 * @example
 * ```ts
 * const template = createTestTemplate(`---
 * title: "<% tp.system.prompt("Title") %>"
 * ---
 * ## Section One
 * `);
 * ```
 */
export function createTestTemplate(
	content: string,
	overrides?: {
		name?: string;
		path?: string;
		version?: number;
	},
): import("../templates/index").TemplateInfo {
	return {
		name: overrides?.name ?? "test",
		path: overrides?.path ?? "/test.md",
		version: overrides?.version ?? 1,
		content,
	};
}

/**
 * Setup a test vault with classifier-specific directory structure.
 *
 * Creates the standard directories needed for classifier tests:
 * - .plugin-workspace/classifiers/definitions/
 * - Templates/
 *
 * @returns Object with vault path and key directory paths
 *
 * @example
 * ```ts
 * const { vault, classifiersDir, templatesDir, registryPath } = createClassifierTestVault();
 * // Directories are already created with .gitkeep files
 * ```
 */
export function createClassifierTestVault() {
	const vault = createTestVault();
	const { join } = require("node:path");

	const classifiersDir = join(
		vault,
		".plugin-workspace",
		"classifiers",
		"definitions",
	);
	const templatesDir = join(vault, "Templates");
	const registryPath = join(classifiersDir, "index.ts");

	// Create directory structure
	writeVaultFile(
		vault,
		".plugin-workspace/classifiers/definitions/.gitkeep",
		"",
	);
	writeVaultFile(vault, "Templates/.gitkeep", "");

	return {
		vault,
		classifiersDir,
		templatesDir,
		registryPath,
	};
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
