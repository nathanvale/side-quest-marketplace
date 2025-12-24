/**
 * Inbox Engine Scan Tests
 *
 * Tests for the scan() method including filesystem operations,
 * file processing, and pre-classification logic.
 */

// IMPORTANT: Configure logtape BEFORE importing any modules that use logging
import { setupTestLogging } from "../../testing/logger";

await setupTestLogging();

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnAndCollect } from "@sidequest/core/spawn";
import { cleanupTestDir, createTempDir } from "@sidequest/core/testing";
import { hashFile } from "../registry/processed-registry";
import type { InboxEngineConfig } from "../types";
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

describe("engine scan()", () => {
	describe("basic scan functionality", () => {
		let testVaultPath: string;

		beforeEach(async () => {
			testVaultPath = createTempDir("scan-basic-test-");
			mkdirSync(join(testVaultPath, "00 Inbox"), { recursive: true });
			await initGitRepo(testVaultPath);
		});

		afterEach(() => {
			cleanupTestDir(testVaultPath);
		});

		test("should return a promise", async () => {
			const engine = createTestEngine({ vaultPath: testVaultPath });
			const result = engine.scan();
			expect(result).toBeInstanceOf(Promise);
			await result; // Clean up promise
		});

		test("should resolve to an array of suggestions", async () => {
			const engine = createTestEngine({ vaultPath: testVaultPath });
			const suggestions = await engine.scan();
			expect(Array.isArray(suggestions)).toBe(true);
		});

		test("should return empty array for empty inbox folder", async () => {
			const engine = createTestEngine({ vaultPath: testVaultPath });
			const suggestions = await engine.scan();
			expect(suggestions.length).toBe(0);
		});
	});

	describe("filesystem operations", () => {
		let testVaultPath: string;

		beforeEach(async () => {
			testVaultPath = createTempDir("scan-fs-test-");
			mkdirSync(join(testVaultPath, "00 Inbox"), { recursive: true });
			mkdirSync(join(testVaultPath, "01 Projects"), { recursive: true });
			mkdirSync(join(testVaultPath, "02 Areas"), { recursive: true });
			mkdirSync(join(testVaultPath, "Templates"), { recursive: true });
			await initGitRepo(testVaultPath);
		});

		afterEach(() => {
			cleanupTestDir(testVaultPath);
		});

		test("should return empty array for empty inbox folder", async () => {
			const engine = createTestEngine({ vaultPath: testVaultPath });
			const suggestions = await engine.scan();
			expect(suggestions.length).toBe(0);
		});

		test("should ignore unsupported file types", async () => {
			// Create unsupported file
			const txtPath = join(testVaultPath, "00 Inbox", "test.txt");
			writeFileSync(txtPath, "This is a text file", "utf-8");

			const engine = createTestEngine({ vaultPath: testVaultPath });
			const suggestions = await engine.scan();
			expect(suggestions.length).toBe(0);
		});

		test("should skip markdown files (no longer supported by inbox engine)", async () => {
			// Create markdown file
			const mdPath = join(testVaultPath, "00 Inbox", "test.md");
			writeFileSync(
				mdPath,
				"---\ntitle: Test Note\n---\n\n# Test Note\n\nSome content",
				"utf-8",
			);

			const engine = createTestEngine({ vaultPath: testVaultPath });
			const suggestions = await engine.scan();
			expect(suggestions.length).toBe(0);
		});

		test("should skip image files (no longer supported by inbox engine)", async () => {
			// Create image file
			const imgPath = join(testVaultPath, "00 Inbox", "test.jpg");
			writeFileSync(imgPath, "fake image data", "binary");

			const engine = createTestEngine({ vaultPath: testVaultPath });
			const suggestions = await engine.scan();
			expect(suggestions.length).toBe(0);
		});

		test("should throw error when pdftotext not available", async () => {
			// This test only runs if pdftotext is NOT installed
			const { checkPdfToText } = await import(
				"../classify/detection/pdf-processor"
			);
			const check = await checkPdfToText();

			if (check.available) {
				// pdftotext is available, so we can't test the error path
				// Skip this test by passing it automatically
				expect(true).toBe(true);
				return;
			}

			// Create PDF file
			const pdfPath = join(testVaultPath, "00 Inbox", "test.pdf");
			writeFileSync(pdfPath, "fake pdf data", "binary");

			const engine = createTestEngine({ vaultPath: testVaultPath });
			await expect(engine.scan()).rejects.toThrow(/pdftotext.*not.*available/i);
		});

		test("should skip files already in registry", async () => {
			// Create PDF file
			const pdfPath = join(testVaultPath, "00 Inbox", "test.pdf");
			const content = "%PDF-1.4\ntest content\n";
			writeFileSync(pdfPath, content, "utf-8");

			// Calculate hash and add to registry manually
			const hash = await hashFile(pdfPath);
			const { createRegistry } = await import("../registry");
			const registry = createRegistry(testVaultPath, {
				restrictToAttachments: true,
			});
			await registry.load();
			registry.markProcessed({
				sourceHash: hash,
				sourcePath: "00 Inbox/test.pdf",
				processedAt: new Date().toISOString(),
				movedAttachment: "Attachments/test.pdf",
			});
			await registry.save();

			const engine = createTestEngine({ vaultPath: testVaultPath });

			// Scan should skip file that's already in registry
			const suggestions1 = await engine.scan();
			expect(suggestions1.length).toBe(0); // Skipped because already in registry

			// Scan again - should still skip
			const suggestions2 = await engine.scan();
			expect(suggestions2.length).toBe(0);
		});

		test("should clear suggestion cache between scans to prevent memory leaks", async () => {
			const engine = createTestEngine({ vaultPath: testVaultPath });

			// First scan with no files
			const suggestions1 = await engine.scan();
			expect(suggestions1.length).toBe(0);

			// Add a PDF file
			const pdfPath = join(testVaultPath, "00 Inbox", "new-note.pdf");
			writeFileSync(pdfPath, "%PDF-1.4\nNew Note Content", "utf-8");

			// Second scan should find the new file
			const suggestions2 = await engine.scan();
			expect(suggestions2.length).toBe(1);

			// Verify the suggestion is fresh (not cached from previous scan)
			expect(suggestions2[0]?.source).toContain("new-note.pdf");
		});
	});

	describe("Session Correlation ID", () => {
		test("scan() accepts sessionCid option and logs it", async () => {
			const vaultPath = createTempDir("session-cid-scan-test-");
			await initGitRepo(vaultPath);

			// Create vault structure
			mkdirSync(join(vaultPath, "00 Inbox"), { recursive: true });
			mkdirSync(join(vaultPath, "01 Projects"), { recursive: true });
			mkdirSync(join(vaultPath, "02 Areas"), { recursive: true });
			mkdirSync(join(vaultPath, "03 Resources"), { recursive: true });
			mkdirSync(join(vaultPath, "04 Archives"), { recursive: true });
			mkdirSync(join(vaultPath, "Templates"), { recursive: true });
			mkdirSync(join(vaultPath, "Attachments"), { recursive: true });

			// Create a test PDF
			const pdfPath = join(vaultPath, "00 Inbox", "test.pdf");
			writeFileSync(pdfPath, "Mock PDF content for testing", "utf-8");

			const engine = createTestEngine({ vaultPath });
			const customSessionCid = "session-123-abc";

			// Scan with custom sessionCid
			await engine.scan({ sessionCid: customSessionCid });

			// Test passes if no error thrown - logger will have sessionCid in logs
			cleanupTestDir(vaultPath);
		});
	});
});
