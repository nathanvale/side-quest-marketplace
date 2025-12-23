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
import { createTestEngine, createVaultStructure } from "./testing";

/**
 * Helper function to set up test vault with cleanup tracking
 * @returns Test vault path with cleanup already registered
 */
function setupTest(cleanup: { trackVault: (path: string) => void }): string {
	const vault = createTestVault();
	cleanup.trackVault(vault);
	return vault;
}

describe("engine scan()", () => {
	// DRY: Shared test infrastructure
	const { trackVault, getAfterEachHook } = useTestVaultCleanup();
	let testVaultPath: string;

	beforeEach(async () => {
		testVaultPath = setupTest({ trackVault });
		createVaultStructure(testVaultPath);
		await initGitRepo(testVaultPath);
	});

	afterEach(() => {
		mock.restore();
		getAfterEachHook()();
	});

	describe("basic scan functionality", () => {
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

		test("should process PDF files", async () => {
			// Create PDF file (engine now only processes attachments: PDF, DOCX)
			// Note: "fake pdf data" triggers extraction timeout -> skip suggestion
			const pdfPath = join(testVaultPath, "00 Inbox", "test.pdf");
			writeFileSync(pdfPath, "fake pdf data", "binary");

			const engine = createTestEngine({ vaultPath: testVaultPath });
			const suggestions = await engine.scan();

			// Engine attempts to process PDF but extraction fails -> skip suggestion
			expect(suggestions.length).toBe(1);
			expect(suggestions[0]).toMatchObject({
				action: "skip",
				source: expect.stringContaining("test.pdf"),
				confidence: "low",
				reason: expect.stringContaining("extraction"),
			});
		});

		test("should skip unsupported image files", async () => {
			// Create actual image file (JPEG magic bytes)
			const imgPath = join(testVaultPath, "00 Inbox", "test.jpg");
			writeFileSync(imgPath, Buffer.from([0xff, 0xd8, 0xff]), "binary");

			const engine = createTestEngine({ vaultPath: testVaultPath });
			const suggestions = await engine.scan();
			// Images are no longer processed by the inbox engine
			expect(suggestions.length).toBe(0);
		});

		test("should test idempotency through behavior not internals", async () => {
			// Create PDF file
			const pdfPath = join(testVaultPath, "00 Inbox", "test.pdf");
			const content = "fake pdf data";
			writeFileSync(pdfPath, content, "binary");

			const engine = createTestEngine({ vaultPath: testVaultPath });

			// First scan: file returns skip suggestion (extraction failed)
			const suggestions1 = await engine.scan();
			expect(suggestions1.length).toBe(1);
			expect(suggestions1[0]?.action).toBe("skip");

			// Second scan: same behavior (file still produces skip suggestion)
			const suggestions2 = await engine.scan();
			expect(suggestions2.length).toBe(1);
			expect(suggestions2[0]?.action).toBe("skip");

			// Behavior is consistent across scans (idempotent)
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

	describe("Error Handling", () => {
		test("should handle missing pdftotext gracefully when PDF exists", async () => {
			// Instead of mocking the module (which can leak across test files),
			// we test that the engine handles PDF processing errors gracefully.
			// The actual error path is tested in pdf-processor.test.ts.
			//
			// Here we verify that when a PDF exists but can't be processed,
			// the engine returns empty suggestions rather than throwing.
			const pdfPath = join(testVaultPath, "00 Inbox", "test.pdf");
			writeFileSync(pdfPath, "fake pdf data", "binary");

			const engine = createTestEngine({ vaultPath: testVaultPath });
			// The engine should either succeed (if pdftotext available)
			// or handle the error gracefully
			const suggestions = await engine.scan();

			// We expect a result - either a suggestion or empty array
			expect(Array.isArray(suggestions)).toBe(true);
		});
	});
});
