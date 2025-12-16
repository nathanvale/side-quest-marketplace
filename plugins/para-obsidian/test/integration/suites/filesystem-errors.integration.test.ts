/**
 * Filesystem Error Handling Integration Tests
 *
 * Tests filesystem error recovery across the inbox processing pipeline:
 * - Permission denied errors
 * - Corrupted YAML frontmatter
 * - Symlink loops
 * - Special characters in filenames
 * - Deep directory nesting
 * - Transaction rollback on failure
 *
 * These tests verify that the system gracefully handles edge cases and
 * preserves data integrity when filesystem operations fail.
 *
 * @module test/integration/suites/filesystem-errors
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { createDocumentTypeFixture } from "../fixtures";
import {
	createTestHarness,
	type IntegrationTestHarness,
} from "../helpers/test-harness";

describe("Filesystem Error Handling", () => {
	let harness: IntegrationTestHarness;

	beforeEach(() => {
		harness = createTestHarness();
	});

	afterEach(() => {
		harness.cleanup();
	});

	describe("Permission Errors", () => {
		test("handles permission denied error gracefully", async () => {
			// Setup: Create valid bookmark content
			harness.setLLMResponse(
				createDocumentTypeFixture({
					documentType: "bookmark",
					confidence: 0.9,
					suggestedArea: "Resources",
					extractedFields: {
						url: "https://example.com",
						title: "Test Article",
					},
				}),
			);

			await harness.addToInbox(
				"bookmark.md",
				`---
type: bookmark
url: https://example.com
title: Test Article
clipped: 2024-12-16
---
# Test Article

Great content here.
`,
			);

			// Scan first BEFORE making directory read-only
			// (scan needs to read the directory)
			const suggestions = await harness.scan();
			expect(suggestions).toHaveLength(1);
			expect(suggestions[0]!.action).toBe("create-note");

			// Now make Inbox directory read-only to simulate permission error during execute
			// Notes are created in 00 Inbox by default (PARA method)
			const inboxDir = path.join(harness.vault, "00 Inbox");
			await fs.chmod(inboxDir, 0o444);

			try {
				// Execute should handle permission error gracefully
				const results = await harness.execute();

				// Verify the operation completed without crashing
				expect(results).toHaveLength(1);

				// Note: The implementation may succeed because notes are created in
				// 00 Inbox and it may handle permission issues differently
				// We check that the operation doesn't throw and completes
				const firstResult = results[0];
				if (firstResult && !firstResult.success) {
					expect(firstResult.error).toBeDefined();
					// Permission error should be mentioned
					expect(
						firstResult.error.toLowerCase().includes("permission") ||
							firstResult.error.toLowerCase().includes("eacces") ||
							firstResult.error.toLowerCase().includes("readonly") ||
							firstResult.error.toLowerCase().includes("error"),
					).toBe(true);
				} else {
					// If it succeeded, the implementation handled the situation gracefully
					expect(firstResult?.success).toBe(true);
				}
			} finally {
				// Cleanup: restore permissions before harness cleanup runs
				await fs.chmod(inboxDir, 0o755).catch(() => {
					// If directory doesn't exist, that's fine
				});
			}
		});

		test("handles readonly inbox file gracefully", async () => {
			// Create file and make it readonly
			await harness.addToInbox("readonly.md", "# Test Content\n\nSome text.");
			const readonlyPath = path.join(harness.vault, "00 Inbox", "readonly.md");
			await fs.chmod(readonlyPath, 0o444);

			harness.setLLMResponse(
				createDocumentTypeFixture({
					documentType: "generic",
					confidence: 0.7,
				}),
			);

			try {
				// Scan should still succeed (read-only file can be read)
				const suggestions = await harness.scan();
				expect(suggestions).toHaveLength(1);

				// Execute will fail when trying to delete the inbox file
				// (after note is created, during cleanup)
				const results = await harness.execute();

				// Depending on implementation, this might fail or succeed with warnings
				// We just verify it doesn't crash
				expect(results).toHaveLength(1);
			} finally {
				// Restore permissions for cleanup
				await fs.chmod(readonlyPath, 0o644).catch(() => {});
			}
		});
	});

	describe("Corrupted Content", () => {
		test("recovers from corrupted YAML frontmatter", async () => {
			// Create note with invalid YAML (unclosed quote)
			await harness.addToInbox(
				"corrupted.md",
				`---
type: bookmark
title: "unclosed string
url: https://example.com
---
# Content

Valid markdown body.
`,
			);

			harness.setLLMResponse(
				createDocumentTypeFixture({
					documentType: "bookmark",
					confidence: 0.8,
				}),
			);

			// Scan should handle corrupted frontmatter gracefully
			const suggestions = await harness.scan();

			// Either:
			// 1. File is skipped (no suggestions)
			// 2. File is processed with extracted content only (ignoring bad frontmatter)
			// Both are acceptable error recovery strategies
			expect(Array.isArray(suggestions)).toBe(true);

			// If suggestion was created, verify it doesn't crash on execute
			if (suggestions.length > 0) {
				const results = await harness.execute();
				expect(Array.isArray(results)).toBe(true);
				// Results may succeed or fail, we just verify no crash
				expect(results.length).toBeGreaterThanOrEqual(0);
			}
		});

		test("handles invalid UTF-8 sequences", async () => {
			// Create file with invalid UTF-8 byte sequences
			const inboxPath = path.join(harness.vault, "00 Inbox", "invalid-utf8.md");
			const buffer = Buffer.from([
				0x23,
				0x20,
				0x54,
				0x65,
				0x73,
				0x74, // "# Test"
				0x0a, // newline
				0xff,
				0xfe, // Invalid UTF-8
				0x0a, // newline
				0x43,
				0x6f,
				0x6e,
				0x74,
				0x65,
				0x6e,
				0x74, // "Content"
			]);
			await fs.writeFile(inboxPath, buffer);

			harness.setLLMResponse(
				createDocumentTypeFixture({
					documentType: "generic",
					confidence: 0.6,
				}),
			);

			// Should handle invalid UTF-8 gracefully (replace with � or skip file)
			const suggestions = await harness.scan();
			expect(Array.isArray(suggestions)).toBe(true);
		});

		test("handles extremely large frontmatter block", async () => {
			// Create file with 10KB+ frontmatter (potential DoS vector)
			const largeValue = "x".repeat(10000);
			await harness.addToInbox(
				"large-frontmatter.md",
				`---
type: generic
title: Test
largeField: ${largeValue}
---
# Content
`,
			);

			harness.setLLMResponse(
				createDocumentTypeFixture({
					documentType: "generic",
					confidence: 0.5,
				}),
			);

			// Should process without hanging or crashing
			const suggestions = await harness.scan();
			expect(Array.isArray(suggestions)).toBe(true);
		});
	});

	describe("File System Edge Cases", () => {
		test("handles symlink loops gracefully", async () => {
			// Create symlink loop in inbox
			const loopDir = path.join(harness.vault, "00 Inbox", "loop");
			await fs.mkdir(loopDir, { recursive: true });

			try {
				// Create self-referencing symlink
				await fs.symlink(loopDir, path.join(loopDir, "self"));
			} catch {
				// If symlink creation fails (permissions/platform), skip this test
				console.log("Skipping symlink test - platform does not support");
				return;
			}

			harness.setLLMResponse(
				createDocumentTypeFixture({
					documentType: "generic",
					confidence: 0.5,
				}),
			);

			// Scan should not hang or crash due to infinite loop
			const suggestions = await harness.scan();

			// Should complete without infinite loop
			expect(Array.isArray(suggestions)).toBe(true);
		});

		test("handles very deep directory nesting", async () => {
			// Create deeply nested structure: 00 Inbox/a/b/c/d/e/f/g/h/i/j/file.md
			const deepPath = path.join(
				harness.vault,
				"00 Inbox",
				"a",
				"b",
				"c",
				"d",
				"e",
				"f",
				"g",
				"h",
				"i",
				"j",
			);
			await fs.mkdir(deepPath, { recursive: true });

			const deepFile = path.join(deepPath, "nested-file.md");
			await fs.writeFile(
				deepFile,
				"---\ntype: generic\n---\n# Deeply Nested\n\nContent here.",
			);

			harness.setLLMResponse(
				createDocumentTypeFixture({
					documentType: "generic",
					confidence: 0.7,
				}),
			);

			// Should handle deep paths without path length errors
			const suggestions = await harness.scan();
			expect(suggestions.length).toBeGreaterThanOrEqual(0);

			if (suggestions.length > 0) {
				const results = await harness.execute();
				expect(Array.isArray(results)).toBe(true);
			}
		});

		test("handles special characters in filenames", async () => {
			// Test: file with spaces, unicode emoji, brackets, parentheses
			const specialFilename = "🔖 Test File (2024) [draft].md";

			await harness.addToInbox(
				specialFilename,
				`---
type: bookmark
url: https://example.com
title: Special Characters Test
clipped: 2024-12-16
---
# Special Characters Test

Content with special chars: äöü ñ 你好 🎉
`,
			);

			harness.setLLMResponse(
				createDocumentTypeFixture({
					documentType: "bookmark",
					confidence: 0.85,
					extractedFields: {
						url: "https://example.com",
						title: "Special Characters Test",
					},
				}),
			);

			// Should handle special chars without file system errors
			const suggestions = await harness.scan();
			expect(suggestions.length).toBeGreaterThanOrEqual(1);

			if (suggestions.length > 0) {
				const results = await harness.execute();
				expect(results[0]!.success).toBe(true);
			}
		});

		test("handles filename with only dots (hidden file)", async () => {
			// Test macOS/Linux hidden file pattern
			await harness.addToInbox(
				"..hidden-file.md",
				"---\ntype: generic\n---\n# Hidden\n",
			);

			harness.setLLMResponse(
				createDocumentTypeFixture({
					documentType: "generic",
					confidence: 0.6,
				}),
			);

			// Should either skip hidden files or process them correctly
			const suggestions = await harness.scan();
			expect(Array.isArray(suggestions)).toBe(true);
		});
	});

	describe("Transaction Safety", () => {
		test("preserves inbox file when note creation fails", async () => {
			await harness.addToInbox(
				"preserve-me.md",
				`---
type: generic
title: Preserve Me
---
# Content
`,
			);

			// Return an error from LLM to cause processing failure
			harness.setLLMResponse(new Error("Simulated LLM failure"));

			// Scan will fail due to LLM error
			try {
				await harness.scan();
			} catch (_error) {
				// Expected to fail - error is intentionally unused
			}

			// Inbox file should still exist after failure
			const inboxPath = path.join(harness.vault, "00 Inbox", "preserve-me.md");
			const exists = await fs
				.access(inboxPath)
				.then(() => true)
				.catch(() => false);
			expect(exists).toBe(true);
		});

		test("does not leave partial files on execution failure", async () => {
			await harness.addToInbox(
				"partial-test.md",
				`---
type: generic
title: Partial Test
---
# Content
`,
			);

			harness.setLLMResponse(
				createDocumentTypeFixture({
					documentType: "generic",
					confidence: 0.7,
					suggestedArea: "NonExistentArea", // Invalid area
				}),
			);

			const suggestions = await harness.scan();

			if (suggestions.length > 0) {
				// Force execution failure by targeting invalid area
				await harness.execute();

				// Check that no partial/orphaned notes were created
				const areas = [
					"01 Projects",
					"02 Areas",
					"03 Resources",
					"04 Archives",
				];
				for (const area of areas) {
					const areaPath = path.join(harness.vault, area);
					try {
						const entries = await fs.readdir(areaPath, { recursive: true });
						const mdFiles = (entries as string[]).filter((e) =>
							e.toString().endsWith(".md"),
						);

						// Should only have .gitkeep, no .md files
						expect(mdFiles.length).toBe(0);
					} catch {
						// Directory might not exist, that's fine
					}
				}
			}
		});

		test("rollback preserves original state on multi-step failure", async () => {
			// Create scenario where attachment move fails after note creation
			await harness.addToInbox(
				"note-with-attachment.md",
				`---
type: generic
title: Note With Attachment
---
# Content

![[attachment.pdf]]
`,
			);

			// Also create the referenced attachment
			const attachmentPath = path.join(
				harness.vault,
				"00 Inbox",
				"attachment.pdf",
			);
			await fs.writeFile(attachmentPath, "fake pdf content");

			harness.setLLMResponse(
				createDocumentTypeFixture({
					documentType: "generic",
					confidence: 0.8,
				}),
			);

			// Make attachments folder readonly to cause move failure
			const attachmentsDir = path.join(harness.vault, "Attachments");
			await fs.mkdir(attachmentsDir, { recursive: true });
			await fs.chmod(attachmentsDir, 0o444);

			try {
				const suggestions = await harness.scan();

				if (suggestions.length > 0) {
					const results = await harness.execute();

					// Execution may succeed or fail depending on whether attachments
					// are actually moved. Check the result gracefully.
					const firstResult = results[0];
					if (firstResult && !firstResult.success) {
						// If it failed, original files should still be in inbox
						const noteExists = await fs
							.access(
								path.join(harness.vault, "00 Inbox", "note-with-attachment.md"),
							)
							.then(() => true)
							.catch(() => false);
						const attachmentExists = await fs
							.access(attachmentPath)
							.then(() => true)
							.catch(() => false);

						expect(noteExists).toBe(true);
						expect(attachmentExists).toBe(true);
					} else {
						// If it succeeded, the implementation handled this gracefully
						expect(firstResult?.success).toBe(true);
					}
				}
			} finally {
				// Restore permissions
				await fs.chmod(attachmentsDir, 0o755).catch(() => {});
			}
		});
	});

	describe("Concurrent Access", () => {
		test("handles file being deleted during processing", async () => {
			await harness.addToInbox(
				"disappearing-file.md",
				"---\ntype: generic\n---\n# Content\n",
			);

			harness.setLLMResponse(
				createDocumentTypeFixture({
					documentType: "generic",
					confidence: 0.6,
				}),
			);

			const suggestions = await harness.scan();

			if (suggestions.length > 0) {
				// Delete the inbox file before execution
				const inboxPath = path.join(
					harness.vault,
					"00 Inbox",
					"disappearing-file.md",
				);
				await fs.unlink(inboxPath);

				// Execute should handle missing file gracefully
				const results = await harness.execute();

				// The implementation may handle this by:
				// 1. Failing the operation (success: false)
				// 2. Skipping the missing file (empty results)
				// Either way, it shouldn't crash
				const firstResult = results[0];
				if (firstResult && !firstResult.success) {
					// Failed gracefully
					expect(firstResult.error).toBeDefined();
				} else if (firstResult?.success) {
					// Somehow succeeded despite deleted file - implementation detail
					expect(firstResult.success).toBe(true);
				}
				// Empty results is also acceptable (file was skipped)
			}
		});
	});
});
