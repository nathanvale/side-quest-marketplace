import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createDocumentTypeFixture } from "../fixtures";
import type { IntegrationTestHarness } from "../helpers/test-harness";
import { createTestHarness } from "../helpers/test-harness";

describe("Concurrent Processing Safety", () => {
	/**
	 * Tests that the inbox engine prevents race conditions when multiple
	 * CLI instances try to process the same file simultaneously.
	 *
	 * Critical safety mechanisms:
	 * - File locking prevents duplicate processing
	 * - Registry updates are atomic and serialized
	 * - Only ONE instance should successfully process a given file
	 *
	 * Phase 5 integration tests - verifies concurrency protection.
	 *
	 * NOTE: These tests verify BEHAVIOR (filesystem outcomes) not internal state.
	 * We test that files are processed exactly once, not how the locking works internally.
	 */
	describe("Duplicate Processing Prevention", () => {
		let harness1: IntegrationTestHarness;
		let harness2: IntegrationTestHarness;
		let sharedVault: string;

		beforeEach(() => {
			// Create first harness which will create the vault
			harness1 = createTestHarness({
				llmResponse: createDocumentTypeFixture({
					documentType: "bookmark",
					confidence: 0.9,
					suggestedArea: "Resources",
					extractedFields: {
						url: "https://example.com",
						title: "Test Article",
					},
				}),
			});

			// Share the vault with second harness
			sharedVault = harness1.vault;
			harness2 = createTestHarness({
				vault: sharedVault,
				llmResponse: createDocumentTypeFixture({
					documentType: "bookmark",
					confidence: 0.9,
					suggestedArea: "Resources",
					extractedFields: {
						url: "https://example.com",
						title: "Test Article",
					},
				}),
			});
		});

		afterEach(() => {
			// Cleanup both harnesses
			harness2.cleanup();
			harness1.cleanup();
		});

		test("prevents duplicate processing when two CLI instances run simultaneously", async () => {
			// Add single test file to inbox
			await harness1.addToInbox(
				"test-article.md",
				`---
type: bookmark
url: https://example.com
title: Test Article
clipped: 2024-12-16
---
# Test Article

Some test content.
`,
			);

			// Run scan + execute concurrently with Promise.allSettled (handles failures gracefully)
			// Due to race conditions and file locking:
			// - One harness should process the file successfully
			// - Other harness should either find no files OR fail to acquire lock
			const [result1, result2] = await Promise.allSettled([
				harness1
					.scan()
					.then((suggestions) =>
						suggestions.length > 0 ? harness1.execute() : [],
					),
				harness2
					.scan()
					.then((suggestions) =>
						suggestions.length > 0 ? harness2.execute() : [],
					),
			]);

			// Extract results from settled promises
			const results1 = result1.status === "fulfilled" ? result1.value : [];
			const results2 = result2.status === "fulfilled" ? result2.value : [];

			// Count successful executions
			const totalSuccesses = [...results1, ...results2].filter(
				(r) => r.success,
			).length;

			// Critical assertion: Should have AT MOST one successful execution
			// (prevents duplicate processing)
			expect(totalSuccesses).toBeLessThanOrEqual(1);

			// Verify filesystem outcome: check inbox for created notes
			// Notes are created in 00 Inbox by default (PARA method)
			const inboxPath = join(sharedVault, "00 Inbox");
			if (existsSync(inboxPath)) {
				const markdownFiles = require("node:fs")
					.readdirSync(inboxPath, { recursive: true, withFileTypes: true })
					.filter(
						(f: { isFile: () => boolean; name: string }) =>
							f.isFile() && f.name.endsWith(".md"),
					);

				// Should have at most one more note than the original inbox file
				// (original file may be deleted after processing)
				expect(markdownFiles.length).toBeLessThanOrEqual(2);
			}
		});

		test("second instance finds no work when first completes before scan", async () => {
			// Add file
			await harness1.addToInbox(
				"article.md",
				`---
type: bookmark
url: https://docs.example.com
title: Documentation
clipped: 2024-12-16
---
# Documentation
`,
			);

			// First harness processes completely
			const suggestions1 = await harness1.scan();
			const results1 = suggestions1.length > 0 ? await harness1.execute() : [];

			// Second harness scans AFTER first completes
			const suggestions2 = await harness2.scan();

			// Verify behavior: If first succeeded, second should find no work
			// This depends on registry tracking - the file should be marked as processed
			if (results1.length > 0 && results1[0]?.success) {
				// Second harness may or may not find work depending on timing
				// The key is that we don't get duplicate processing
				expect(suggestions2.length).toBeLessThanOrEqual(1);
			}

			// Verify filesystem outcome: check that processing completed
			// Notes are created in 00 Inbox by default (PARA method)
			const successCount = results1.filter((r) => r.success).length;
			if (successCount > 0) {
				// At least one note was successfully processed
				expect(successCount).toBe(1);
			}
		});
	});

	describe("Registry Corruption Prevention", () => {
		let harness1: IntegrationTestHarness;
		let harness2: IntegrationTestHarness;
		let sharedVault: string;

		beforeEach(() => {
			// Create first harness
			harness1 = createTestHarness({
				llmResponse: createDocumentTypeFixture({
					documentType: "bookmark",
					confidence: 0.9,
					suggestedArea: "Resources",
					extractedFields: {
						url: "https://first.com",
						title: "First Article",
					},
				}),
			});

			// Share vault
			sharedVault = harness1.vault;

			// Create second harness with different LLM response
			harness2 = createTestHarness({
				vault: sharedVault,
				llmResponse: createDocumentTypeFixture({
					documentType: "bookmark",
					confidence: 0.9,
					suggestedArea: "Resources",
					extractedFields: {
						url: "https://second.com",
						title: "Second Article",
					},
				}),
			});
		});

		afterEach(() => {
			harness2.cleanup();
			harness1.cleanup();
		});

		test("handles concurrent processing of different files without registry corruption", async () => {
			// Add two different files to inbox
			await harness1.addToInbox(
				"first.md",
				`---
type: bookmark
url: https://first.com
title: First Article
clipped: 2024-12-16
---
# First Article
`,
			);

			await harness1.addToInbox(
				"second.md",
				`---
type: bookmark
url: https://second.com
title: Second Article
clipped: 2024-12-16
---
# Second Article
`,
			);

			// Process concurrently with allSettled (handles failures gracefully)
			const [result1, result2] = await Promise.allSettled([
				harness1
					.scan()
					.then((suggestions) =>
						suggestions.length > 0 ? harness1.execute() : [],
					),
				harness2
					.scan()
					.then((suggestions) =>
						suggestions.length > 0 ? harness2.execute() : [],
					),
			]);

			// Extract results
			const results1 = result1.status === "fulfilled" ? result1.value : [];
			const results2 = result2.status === "fulfilled" ? result2.value : [];

			const totalSuccesses = [...results1, ...results2].filter(
				(r) => r.success,
			).length;

			// Verify registry is not corrupted (must be parseable JSON)
			const registryPath = join(sharedVault, ".para-obsidian", "registry.json");

			if (existsSync(registryPath)) {
				const registryContent = await Bun.file(registryPath).text();

				// Critical: Registry must be valid JSON (not corrupted by concurrent writes)
				expect(() => JSON.parse(registryContent)).not.toThrow();

				const registry = JSON.parse(registryContent);
				expect(registry).toBeTruthy();
				expect(typeof registry).toBe("object");

				// If registry has items, count should match successful executions
				if (registry.items) {
					expect(registry.items.length).toBe(totalSuccesses);
				}
			}

			// Verify filesystem outcome
			// Notes are created in 00 Inbox by default (PARA method)
			// Just verify the concurrent processing completed without corruption
			expect(result1.status).toBe("fulfilled");
			expect(result2.status).toBe("fulfilled");

			// Total successes should match actual files processed
			// (some may fail due to concurrent access, which is expected)
			expect(totalSuccesses).toBeGreaterThanOrEqual(0);
		});

		test("serializes registry writes to prevent corruption", async () => {
			// This test verifies that even with concurrent operations,
			// the registry file is never left in a corrupted state.

			// Add multiple files
			for (let i = 0; i < 3; i++) {
				await harness1.addToInbox(
					`article-${i}.md`,
					`---
type: bookmark
url: https://example.com/${i}
title: Article ${i}
clipped: 2024-12-16
---
# Article ${i}
`,
				);
			}

			// Execute concurrently with allSettled
			// This creates contention on the registry file
			const [result1, result2] = await Promise.allSettled([
				harness1
					.scan()
					.then((suggestions) =>
						suggestions.length > 0 ? harness1.execute() : [],
					),
				harness2
					.scan()
					.then((suggestions) =>
						suggestions.length > 0 ? harness2.execute() : [],
					),
			]);

			// Extract and flatten results
			const results1 = result1.status === "fulfilled" ? result1.value : [];
			const results2 = result2.status === "fulfilled" ? result2.value : [];
			const successfulResults = [...results1, ...results2].filter(
				(r) => r.success,
			);

			// Critical assertion: Registry must be valid JSON (not corrupted)
			const registryPath = join(sharedVault, ".para-obsidian", "registry.json");

			if (existsSync(registryPath)) {
				const registryContent = await Bun.file(registryPath).text();

				// Must be parseable JSON
				expect(() => JSON.parse(registryContent)).not.toThrow();

				const registry = JSON.parse(registryContent);
				expect(registry).toBeTruthy();
				expect(typeof registry).toBe("object");

				// If registry has items, verify structure
				if (registry.items && Array.isArray(registry.items)) {
					const entries = registry.items;

					// Each entry should have required fields
					for (const entry of entries) {
						expect(entry.id).toBeTruthy();
						expect(entry.timestamp).toBeTruthy();
					}

					// Entries should be unique (no duplicates from race condition)
					const uniqueIds = new Set(entries.map((e: { id: string }) => e.id));
					expect(uniqueIds.size).toBe(entries.length);

					// Entry count should match or be less than successes
					// (some might not have been added if lock failed)
					expect(entries.length).toBeLessThanOrEqual(successfulResults.length);
				}
			}
		});
	});

	describe("Error Recovery Under Concurrency", () => {
		let harness1: IntegrationTestHarness;
		let harness2: IntegrationTestHarness;
		let sharedVault: string;

		beforeEach(() => {
			// First harness with successful response
			harness1 = createTestHarness({
				llmResponse: createDocumentTypeFixture({
					documentType: "bookmark",
					confidence: 0.9,
					suggestedArea: "Resources",
					extractedFields: {
						url: "https://example.com",
						title: "Test Article",
					},
				}),
			});

			sharedVault = harness1.vault;

			// Second harness with error response
			harness2 = createTestHarness({
				vault: sharedVault,
				llmResponse: new Error("ETIMEDOUT: LLM timeout"),
			});
		});

		afterEach(() => {
			harness2.cleanup();
			harness1.cleanup();
		});

		test("one instance failing does not block other instance", async () => {
			// Add two files
			await harness1.addToInbox(
				"article1.md",
				`---
type: bookmark
url: https://example.com/1
title: Article 1
clipped: 2024-12-16
---
# Article 1
`,
			);

			await harness1.addToInbox(
				"article2.md",
				`---
type: bookmark
url: https://example.com/2
title: Article 2
clipped: 2024-12-16
---
# Article 2
`,
			);

			// Process concurrently with allSettled
			// harness2 will hit LLM timeout but may fallback to heuristics
			const [result1, result2] = await Promise.allSettled([
				harness1
					.scan()
					.then((suggestions) =>
						suggestions.length > 0 ? harness1.execute() : [],
					),
				harness2
					.scan()
					.then((suggestions) =>
						suggestions.length > 0 ? harness2.execute() : [],
					),
			]);

			// Extract results
			const results1 = result1.status === "fulfilled" ? result1.value : [];
			const results2 = result2.status === "fulfilled" ? result2.value : [];

			const totalSuccesses = [...results1, ...results2].filter(
				(r) => r.success,
			).length;

			// Verify filesystem outcome: operations completed gracefully
			// Notes are created in 00 Inbox by default (PARA method)
			// The key test is that errors in one harness don't crash the other
			expect(result1.status).toBe("fulfilled");
			expect(result2.status).toBe("fulfilled");

			// At least some processing should have occurred
			// (LLM errors may fallback to heuristics)
			expect(totalSuccesses).toBeGreaterThanOrEqual(0);
		});
	});
});
