/**
 * Shared test helpers for inbox engine tests
 *
 * Provides utilities for:
 * - Git repository initialization for tests
 * - Test engine creation with mocked LLM client
 * - Vault structure creation
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnAndCollect } from "@sidequest/core/spawn";
import type { InboxEngineConfig } from "../../types";
import { createInboxEngine } from "../engine";
import { createTestLLMClient } from "../llm/client";

// Test git configuration constants
// These values are used for local test repositories only, not production
const TEST_GIT_USER = {
	NAME: "Test User", // Dummy name for test git commits
	EMAIL: "test@example.com", // Dummy email for test git commits
} as const;

const TEST_GIT_COMMIT = {
	INITIAL_MESSAGE: "Initial commit", // Standard first commit message
	GITKEEP_FILENAME: ".gitkeep", // Empty file to enable initial commit
} as const;

/**
 * Initialize a git repository with a clean working tree.
 *
 * Required for tests that call execute() which checks git status.
 * Creates an initial commit to establish a clean baseline.
 *
 * @param dir - Directory path to initialize git repository in
 */
export async function initGitRepo(dir: string): Promise<void> {
	await spawnAndCollect(["git", "init"], { cwd: dir });
	await spawnAndCollect(["git", "config", "user.name", TEST_GIT_USER.NAME], {
		cwd: dir,
	});
	await spawnAndCollect(["git", "config", "user.email", TEST_GIT_USER.EMAIL], {
		cwd: dir,
	});
	// Create initial commit to establish clean state
	writeFileSync(join(dir, TEST_GIT_COMMIT.GITKEEP_FILENAME), "", "utf-8");
	await spawnAndCollect(["git", "add", "."], { cwd: dir });
	await spawnAndCollect(
		["git", "commit", "-m", TEST_GIT_COMMIT.INITIAL_MESSAGE],
		{ cwd: dir },
	);
}

/**
 * Create test engine with injected test LLM client for fast testing.
 *
 * This avoids calling real LLM APIs during tests by injecting
 * a mock client that returns predictable responses.
 *
 * @param config - Engine configuration (without llmClient)
 * @returns Configured InboxEngine instance with test LLM client
 */
export function createTestEngine(config: Omit<InboxEngineConfig, "llmClient">) {
	return createInboxEngine({
		...config,
		llmClient: createTestLLMClient(),
	});
}

// PARA vault folder structure constants
// Following the PARA method (Projects, Areas, Resources, Archives)
// Numeric prefixes ensure consistent ordering in file explorers
const PARA_FOLDERS = {
	INBOX: "00 Inbox", // Unsorted incoming items
	PROJECTS: "01 Projects", // Active projects with deadlines
	AREAS: "02 Areas", // Ongoing responsibilities
	RESOURCES: "03 Resources", // Reference materials
	ARCHIVES: "04 Archives", // Inactive items
	TEMPLATES: "Templates", // Note templates (Templater)
	ATTACHMENTS: "Attachments", // File attachments and media
} as const;

/**
 * Create full PARA vault structure with all standard folders.
 *
 * Used for tests that need complete vault setup with:
 * - Inbox folder
 * - PARA folders (Projects, Areas, Resources, Archives)
 * - Templates folder
 * - Attachments folder
 *
 * @param vaultPath - Path to vault directory
 */
export function createVaultStructure(vaultPath: string): void {
	// Create all PARA folders with recursive option to ensure parent directories exist
	for (const folder of Object.values(PARA_FOLDERS)) {
		mkdirSync(join(vaultPath, folder), { recursive: true });
	}
}
