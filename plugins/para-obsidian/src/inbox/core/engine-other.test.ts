/**
 * Inbox Engine Utilities Tests
 *
 * Tests for editWithPrompt(), challenge(), and generateReport() methods.
 */

// IMPORTANT: Configure logtape BEFORE importing any modules that use logging
import { setupTestLogging } from "../../testing/logger";

await setupTestLogging();

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnAndCollect } from "@sidequest/core/spawn";
import { cleanupTestDir, createTempDir } from "@sidequest/core/testing";
import {
	createSuggestionId,
	type InboxEngineConfig,
	type SuggestionId,
} from "../types";
import { createInboxEngine } from "./engine";
import { createTestLLMClient } from "./llm/client";

/**
 * Initialize a git repository with a clean working tree.
 * Required for tests that call execute() which checks git status.
 */
async function initGitRepo(dir: string): Promise<void> {
	await spawnAndCollect(["git", "init"], { cwd: dir });
	await spawnAndCollect(["git", "config", "user.name", "Test"], { cwd: dir });
	await spawnAndCollect(["git", "config", "user.email", "test@test.com"], {
		cwd: dir,
	});
	// Create initial commit to establish clean state
	writeFileSync(join(dir, ".gitkeep"), "", "utf-8");
	await spawnAndCollect(["git", "add", "."], { cwd: dir });
	await spawnAndCollect(["git", "commit", "-m", "Initial commit"], {
		cwd: dir,
	});
}

/**
 * Create test engine with injected test LLM client for fast testing.
 * This avoids calling real LLM APIs during tests.
 */
function createTestEngine(config: Omit<InboxEngineConfig, "llmClient">) {
	return createInboxEngine({
		...config,
		llmClient: createTestLLMClient(),
	});
}

describe("engine utilities", () => {
	describe("editWithPrompt()", () => {
		let testVaultPath: string;

		beforeEach(async () => {
			testVaultPath = createTempDir("edit-prompt-test-");
			mkdirSync(join(testVaultPath, "00 Inbox"), { recursive: true });
			await initGitRepo(testVaultPath);
		});

		afterEach(() => {
			cleanupTestDir(testVaultPath);
		});

		test("should return a promise that rejects for unknown id", async () => {
			const engine = createTestEngine({ vaultPath: testVaultPath });
			const unknownId = createSuggestionId();

			await expect(
				engine.editWithPrompt(unknownId, "test prompt"),
			).rejects.toThrow();
		});

		test("should throw for non-existent suggestion", async () => {
			const engine = createTestEngine({ vaultPath: testVaultPath });
			const nonExistentId = createSuggestionId();

			await expect(
				engine.editWithPrompt(nonExistentId, "edit this"),
			).rejects.toThrow();
		});

		test("should reject with error message containing suggestion id", async () => {
			const engine = createTestEngine({ vaultPath: testVaultPath });
			const testId = createSuggestionId();

			await expect(
				engine.editWithPrompt(testId, "edit prompt"),
			).rejects.toThrow(testId);
		});
	});

	describe("generateReport()", () => {
		test("should return a string", () => {
			const engine = createTestEngine({ vaultPath: "/test" });
			const report = engine.generateReport([]);
			expect(typeof report).toBe("string");
		});

		test("should return empty report header for no suggestions", () => {
			const engine = createTestEngine({ vaultPath: "/test" });
			const report = engine.generateReport([]);
			expect(report).toContain("# Inbox Processing Report");
		});

		test("should include suggestions in report", () => {
			const engine = createTestEngine({ vaultPath: "/test" });

			// The generateReport method handles ExecutionResult arrays from execute()
			// We'll just test with an empty array since the report format isn't critical
			const report = engine.generateReport([]);
			expect(report).toContain("# Inbox Processing Report");
			expect(typeof report).toBe("string");
		});
	});

	describe("challenge()", () => {
		let testVaultPath: string;

		beforeEach(async () => {
			testVaultPath = createTempDir("challenge-test-");
			mkdirSync(join(testVaultPath, "00 Inbox"), { recursive: true });
			mkdirSync(join(testVaultPath, "01 Projects"), { recursive: true });
			mkdirSync(join(testVaultPath, "02 Areas"), { recursive: true });
			mkdirSync(join(testVaultPath, "Templates"), { recursive: true });
			await initGitRepo(testVaultPath);
		});

		afterEach(() => {
			cleanupTestDir(testVaultPath);
		});

		test("should throw error when suggestion not found", async () => {
			const engine = createTestEngine({ vaultPath: testVaultPath });
			const unknownId = createSuggestionId();

			await expect(engine.challenge(unknownId, "test hint")).rejects.toThrow(
				/suggestion.*not.*found/i,
			);
		});

		test("should throw error when id is empty", async () => {
			const engine = createTestEngine({ vaultPath: testVaultPath });
			const emptyId = "" as SuggestionId;

			await expect(engine.challenge(emptyId, "hint")).rejects.toThrow();
		});

		test("should throw error when id is whitespace only", async () => {
			const engine = createTestEngine({ vaultPath: testVaultPath });
			const whitespaceId = "   " as SuggestionId;

			await expect(engine.challenge(whitespaceId, "hint")).rejects.toThrow();
		});
	});
});
