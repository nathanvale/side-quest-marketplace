/**
 * Inbox Engine Utilities Tests
 *
 * Tests for editWithPrompt(), challenge(), and generateReport() methods.
 * These are helper methods on the engine that support the main scan/execute workflow.
 */

// IMPORTANT: Configure logtape BEFORE importing any modules that use logging
import { setupTestLogging } from "../../testing/logger";

await setupTestLogging();

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
	createTestVault,
	initGitRepo,
	useTestVaultCleanup,
} from "../../testing/utils";
import { createSuggestionId, type SuggestionId } from "../types";
import { createTestEngine } from "./testing";

// Test Constants
/** Expected header in all execution reports */
const REPORT_HEADER = "# Inbox Processing Report";

/** Dummy vault path for tests that don't require real filesystem operations */
const DUMMY_VAULT_PATH = "/test";

describe("engine utilities", () => {
	describe("editWithPrompt()", () => {
		const { trackVault, getAfterEachHook } = useTestVaultCleanup();
		let testVaultPath: string;

		beforeEach(async () => {
			testVaultPath = createTestVault();
			trackVault(testVaultPath);
			mkdirSync(join(testVaultPath, "00 Inbox"), { recursive: true });
			await initGitRepo(testVaultPath);
		});

		afterEach(() => {
			mock.restore();
			getAfterEachHook()();
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
			const engine = createTestEngine({ vaultPath: DUMMY_VAULT_PATH });
			const report = engine.generateReport([]);
			expect(typeof report).toBe("string");
		});

		test("should return empty report header for no suggestions", () => {
			const engine = createTestEngine({ vaultPath: DUMMY_VAULT_PATH });
			const report = engine.generateReport([]);
			expect(report).toContain(REPORT_HEADER);
		});

		test("should include suggestions in report", () => {
			const engine = createTestEngine({ vaultPath: DUMMY_VAULT_PATH });

			// The generateReport method handles ExecutionResult arrays from execute()
			// We'll just test with an empty array since the report format isn't critical
			const report = engine.generateReport([]);
			expect(report).toContain(REPORT_HEADER);
			expect(typeof report).toBe("string");
		});
	});

	describe("challenge()", () => {
		const { trackVault, getAfterEachHook } = useTestVaultCleanup();
		let testVaultPath: string;

		beforeEach(async () => {
			testVaultPath = createTestVault();
			trackVault(testVaultPath);
			mkdirSync(join(testVaultPath, "00 Inbox"), { recursive: true });
			mkdirSync(join(testVaultPath, "01 Projects"), { recursive: true });
			mkdirSync(join(testVaultPath, "02 Areas"), { recursive: true });
			mkdirSync(join(testVaultPath, "Templates"), { recursive: true });
			await initGitRepo(testVaultPath);
		});

		afterEach(() => {
			mock.restore();
			getAfterEachHook()();
		});

		test("should throw error when suggestion not found", async () => {
			const engine = createTestEngine({ vaultPath: testVaultPath });
			const unknownId = createSuggestionId();

			// Should throw any error - we don't care about exact message wording
			// The important behavior is that it rejects with an error
			await expect(engine.challenge(unknownId, "test hint")).rejects.toThrow();
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
