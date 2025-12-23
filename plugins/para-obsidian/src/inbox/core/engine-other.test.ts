/**
 * Inbox Engine Utilities Tests
 *
 * Tests for editWithPrompt(), challenge(), and generateReport() methods.
 * These are helper methods on the engine that support the main scan/execute workflow.
 */

// IMPORTANT: Configure logtape BEFORE importing any modules that use logging
import { setupTestLogging } from "../../testing/logger";

await setupTestLogging();

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
	createTestVault,
	initGitRepo,
	useTestVaultCleanup,
} from "../../testing/utils";
import { createSuggestionId } from "../types";
import { createTestEngine } from "./testing";

// Test Constants
/** Expected header in all execution reports */
const REPORT_HEADER = "# Inbox Processing Report";

/** Dummy vault path for tests that don't require real filesystem operations */
const DUMMY_VAULT_PATH = "/test";

/**
 * Helper function to set up a test vault and register it for cleanup.
 * Combines createTestVault() and trackVault() to reduce duplication.
 */
function setupTest(trackVault: (path: string) => void): string {
	const vault = createTestVault();
	trackVault(vault);
	return vault;
}

describe("engine utilities", () => {
	describe("editWithPrompt()", () => {
		const { trackVault, getAfterEachHook } = useTestVaultCleanup();
		let testVaultPath: string;

		beforeEach(async () => {
			testVaultPath = setupTest(trackVault);
			mkdirSync(join(testVaultPath, "00 Inbox"), { recursive: true });
			await initGitRepo(testVaultPath);
		});

		afterEach(getAfterEachHook());

		test("should reject when suggestion id does not exist", async () => {
			const engine = createTestEngine({ vaultPath: testVaultPath });
			const unknownId = createSuggestionId();

			await expect(
				engine.editWithPrompt(unknownId, "test prompt"),
			).rejects.toThrow(unknownId);
		});
	});

	describe("generateReport()", () => {
		test("should return string report with header for empty results", () => {
			const engine = createTestEngine({ vaultPath: DUMMY_VAULT_PATH });
			const report = engine.generateReport([]);
			expect(typeof report).toBe("string");
			expect(report).toContain(REPORT_HEADER);
		});
	});

	describe("challenge()", () => {
		const { trackVault, getAfterEachHook } = useTestVaultCleanup();
		let testVaultPath: string;

		beforeEach(async () => {
			testVaultPath = setupTest(trackVault);
			mkdirSync(join(testVaultPath, "00 Inbox"), { recursive: true });
			mkdirSync(join(testVaultPath, "01 Projects"), { recursive: true });
			mkdirSync(join(testVaultPath, "02 Areas"), { recursive: true });
			mkdirSync(join(testVaultPath, "Templates"), { recursive: true });
			await initGitRepo(testVaultPath);
		});

		afterEach(getAfterEachHook());

		test("should throw error when suggestion not found", async () => {
			const engine = createTestEngine({ vaultPath: testVaultPath });
			const unknownId = createSuggestionId();

			await expect(engine.challenge(unknownId, "test hint")).rejects.toThrow();
		});
	});
});
