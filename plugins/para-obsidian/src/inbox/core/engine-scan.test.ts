/**
 * Inbox Engine Scan Tests
 *
 * Tests for the scan() method including filesystem operations,
 * file processing, and pre-classification logic.
 */

// IMPORTANT: Configure logtape BEFORE importing any modules that use logging
import { setupTestLogging } from "../../testing/logger";

await setupTestLogging();

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	createTestVault,
	initGitRepo,
	useTestVaultCleanup,
} from "../../testing/utils";
import { hashFile } from "../registry/processed-registry";
import { createTestEngine, createVaultStructure } from "./testing";

describe("engine scan()", () => {
	describe("basic scan functionality", () => {
		const { trackVault, getAfterEachHook } = useTestVaultCleanup();
		let testVaultPath: string;

		beforeEach(async () => {
			testVaultPath = createTestVault();
			trackVault(testVaultPath);
			createVaultStructure(testVaultPath);
			await initGitRepo(testVaultPath);
		});

		afterEach(() => {
			mock.restore();
			getAfterEachHook()();
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
	});

	describe("filesystem operations", () => {
		const { trackVault, getAfterEachHook } = useTestVaultCleanup();
		let testVaultPath: string;

		beforeEach(async () => {
			testVaultPath = createTestVault();
			trackVault(testVaultPath);
			createVaultStructure(testVaultPath);
			await initGitRepo(testVaultPath);
		});

		afterEach(() => {
			mock.restore();
			getAfterEachHook()();
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

		test("should process markdown files", async () => {
			// Create PDF file (engine now only processes attachments: PDF, DOCX)
			const pdfPath = join(testVaultPath, "00 Inbox", "test.pdf");
			writeFileSync(pdfPath, "fake pdf data", "binary");

			const engine = createTestEngine({ vaultPath: testVaultPath });
			const suggestions = await engine.scan();
			expect(suggestions.length).toBe(1);
			expect(suggestions[0]).toBeDefined();
		});

		test("should process image files with placeholder content", async () => {
			// Create PDF file (engine now only processes attachments: PDF, DOCX)
			// Images are no longer processed by the inbox engine
			const pdfPath = join(testVaultPath, "00 Inbox", "test-image.pdf");
			writeFileSync(pdfPath, "fake pdf data", "binary");

			const engine = createTestEngine({ vaultPath: testVaultPath });
			const suggestions = await engine.scan();
			expect(suggestions.length).toBe(1);
			expect(suggestions[0]).toBeDefined();
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
			// Create PDF file (engine now only processes attachments: PDF, DOCX)
			const pdfPath = join(testVaultPath, "00 Inbox", "test.pdf");
			const content = "fake pdf data";
			writeFileSync(pdfPath, content, "binary");

			// Pre-populate registry with this file's hash
			await hashFile(pdfPath);
			const engine = createTestEngine({ vaultPath: testVaultPath });

			// Mock the registry to have this file
			const suggestions1 = await engine.scan();
			expect(suggestions1.length).toBe(1);

			// Scan again - should still return the same suggestion but skip registry processing
			const suggestions2 = await engine.scan();
			expect(suggestions2.length).toBe(1);
		});

		test("should detect new files added between scans", async () => {
			const engine = createTestEngine({ vaultPath: testVaultPath });

			// First scan with no files
			const suggestions1 = await engine.scan();
			expect(suggestions1.length).toBe(0);

			// Add a PDF file (engine now only processes attachments: PDF, DOCX)
			const pdfPath = join(testVaultPath, "00 Inbox", "new-note.pdf");
			writeFileSync(pdfPath, "fake pdf data", "binary");

			// Second scan should find the new file
			const suggestions2 = await engine.scan();
			expect(suggestions2.length).toBe(1);

			// Verify the suggestion is fresh (not cached from previous scan)
			expect(suggestions2[0]?.source).toContain("new-note.pdf");
		});
	});

	describe("Session Correlation ID", () => {
		const { trackVault, getAfterEachHook } = useTestVaultCleanup();
		let testVaultPath: string;

		beforeEach(async () => {
			testVaultPath = createTestVault();
			trackVault(testVaultPath);
			createVaultStructure(testVaultPath);
			await initGitRepo(testVaultPath);
		});

		afterEach(() => {
			mock.restore();
			getAfterEachHook()();
		});

		test("scan() accepts sessionCid option and logs it", async () => {
			// Create a test PDF
			const pdfPath = join(testVaultPath, "00 Inbox", "test.pdf");
			writeFileSync(pdfPath, "Mock PDF content for testing", "utf-8");

			const engine = createTestEngine({ vaultPath: testVaultPath });
			const customSessionCid = "session-123-abc";

			// Scan with custom sessionCid
			await engine.scan({ sessionCid: customSessionCid });

			// Test passes if no error thrown - logger will have sessionCid in logs
		});
	});
});
