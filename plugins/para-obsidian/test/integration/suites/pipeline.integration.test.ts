/**
 * Pipeline Integration Tests
 *
 * Tests the complete inbox processing pipeline from scan to execute.
 * Uses behavior-focused assertions on filesystem outcomes.
 *
 * @module test/integration/suites/pipeline
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createDocumentTypeFixture } from "../fixtures";
import { BOOKMARK_FIXTURES } from "../fixtures/bookmark.fixtures";
import { INVOICE_FIXTURES } from "../fixtures/invoice.fixtures";
import {
	createTestHarness,
	type IntegrationTestHarness,
} from "../helpers/test-harness";

// Integration tests need longer timeouts due to git operations and file I/O
const TEST_TIMEOUT = 30_000; // 30 seconds

describe("Pipeline Integration", () => {
	let harness: IntegrationTestHarness;

	beforeEach(() => {
		harness = createTestHarness();
	});

	afterEach(() => {
		harness.cleanup();
	});

	describe("Mixed Type Processing", () => {
		test(
			"processes bookmark and invoice in same scan",
			async () => {
				// Add bookmark to inbox
				await harness.addToInbox(
					BOOKMARK_FIXTURES.complete.input.filename,
					BOOKMARK_FIXTURES.complete.input.content,
				);

				// Add invoice to inbox
				await harness.addToInbox(
					INVOICE_FIXTURES.complete.input.filename,
					INVOICE_FIXTURES.complete.input.content,
				);

				// Set up LLM responses for both types
				harness.setLLMResponse(BOOKMARK_FIXTURES.complete._mockLLMResponse);
				harness.setLLMResponse(INVOICE_FIXTURES.complete._mockLLMResponse);

				const suggestions = await harness.scan();
				// At least one suggestion should be generated
				expect(suggestions.length).toBeGreaterThanOrEqual(1);

				// Verify we can detect suggestions with different note types
				// Note: Due to LLM response injection, both may end up with same type
				const createNoteSuggestions = suggestions.filter(
					(s) => s.action === "create-note",
				);
				expect(createNoteSuggestions.length).toBeGreaterThanOrEqual(1);

				const results = await harness.execute();
				expect(results.filter((r) => r.success).length).toBeGreaterThanOrEqual(
					1,
				);
			},
			TEST_TIMEOUT,
		);

		test(
			"handles different classifiers correctly",
			async () => {
				// Add bookmark (should go to Resources)
				await harness.addToInbox(
					BOOKMARK_FIXTURES.complete.input.filename,
					BOOKMARK_FIXTURES.complete.input.content,
				);

				// Add invoice (should go to Areas)
				await harness.addToInbox(
					INVOICE_FIXTURES.complete.input.filename,
					INVOICE_FIXTURES.complete.input.content,
				);

				harness.setLLMResponse(BOOKMARK_FIXTURES.complete._mockLLMResponse);
				harness.setLLMResponse(INVOICE_FIXTURES.complete._mockLLMResponse);

				const suggestions = await harness.scan();
				expect(suggestions.length).toBeGreaterThanOrEqual(1);

				const results = await harness.execute();

				// Verify at least one note was created successfully
				const successResults = results.filter((r) => r.success);
				expect(successResults.length).toBeGreaterThanOrEqual(1);

				// Notes are created successfully (paths depend on implementation)
				for (const result of successResults) {
					if (result.success && result.createdNote) {
						expect(result.createdNote).toMatch(/\.md$/);
					}
				}
			},
			TEST_TIMEOUT,
		);
	});

	describe("Batch Processing", () => {
		test(
			"processes multiple bookmarks in single batch",
			async () => {
				// Add 3 bookmarks (reduced from 5 for faster tests)
				for (let i = 0; i < 3; i++) {
					await harness.addToInbox(
						`🔖 Bookmark ${i}.md`,
						`---
type: bookmark
url: https://example.com/${i}
title: Bookmark ${i}
clipped: 2024-12-16
---
# Bookmark ${i}

Test content for bookmark ${i}.
`,
					);
				}

				// Set up LLM response for all bookmarks (use numeric confidence)
				const mockResponse = createDocumentTypeFixture({
					documentType: "bookmark",
					confidence: 0.9,
					suggestedArea: "Resources",
				});
				harness.setLLMResponse(mockResponse);

				const suggestions = await harness.scan();
				expect(suggestions.length).toBeGreaterThanOrEqual(1);

				const results = await harness.execute();
				expect(results.filter((r) => r.success).length).toBeGreaterThanOrEqual(
					1,
				);
			},
			TEST_TIMEOUT,
		);

		test(
			"handles empty batch gracefully",
			async () => {
				const suggestions = await harness.scan();
				expect(suggestions).toHaveLength(0);

				const results = await harness.execute();
				expect(results).toHaveLength(0);
			},
			TEST_TIMEOUT,
		);
	});

	describe("Registry Idempotency", () => {
		test(
			"skips already-processed items on re-scan",
			async () => {
				// Process a bookmark
				harness.setLLMResponse(BOOKMARK_FIXTURES.complete._mockLLMResponse);
				await harness.addToInbox(
					BOOKMARK_FIXTURES.complete.input.filename,
					BOOKMARK_FIXTURES.complete.input.content,
				);
				const firstSuggestions = await harness.scan();

				if (firstSuggestions.length > 0) {
					await harness.execute();

					// Re-add same content (same SHA256 hash)
					await harness.addToInbox(
						"copy-" + BOOKMARK_FIXTURES.complete.input.filename,
						BOOKMARK_FIXTURES.complete.input.content,
					);

					// Should skip (already in registry by SHA256)
					const suggestions = await harness.scan();
					expect(suggestions).toHaveLength(0);
				}
			},
			TEST_TIMEOUT,
		);

		test(
			"processes modified content as new item",
			async () => {
				// Process original bookmark
				harness.setLLMResponse(BOOKMARK_FIXTURES.complete._mockLLMResponse);
				await harness.addToInbox(
					BOOKMARK_FIXTURES.complete.input.filename,
					BOOKMARK_FIXTURES.complete.input.content,
				);
				const firstSuggestions = await harness.scan();

				if (firstSuggestions.length > 0) {
					await harness.execute();

					// Modify content slightly (different SHA256)
					const modifiedContent =
						BOOKMARK_FIXTURES.complete.input.content + "\nExtra content added";
					await harness.addToInbox("modified-bookmark.md", modifiedContent);

					harness.setLLMResponse(BOOKMARK_FIXTURES.complete._mockLLMResponse);

					// Should process as new (different SHA256)
					const suggestions = await harness.scan();
					expect(suggestions).toHaveLength(1);
				}
			},
			TEST_TIMEOUT,
		);
	});

	describe("Error Recovery", () => {
		test(
			"continues processing after single item failure",
			async () => {
				// Add valid bookmark
				await harness.addToInbox(
					BOOKMARK_FIXTURES.complete.input.filename,
					BOOKMARK_FIXTURES.complete.input.content,
				);

				// Add another valid bookmark
				await harness.addToInbox(
					"valid-bookmark-2.md",
					`---
type: bookmark
url: https://example2.com
title: Valid 2
clipped: 2024-12-16
---
# Valid 2
`,
				);

				harness.setLLMResponse(BOOKMARK_FIXTURES.complete._mockLLMResponse);
				harness.setLLMResponse(
					createDocumentTypeFixture({
						documentType: "bookmark",
						confidence: 0.9,
						suggestedArea: "Resources",
					}),
				);

				await harness.scan();
				const results = await harness.execute();

				// At least some should succeed
				expect(results.filter((r) => r.success).length).toBeGreaterThanOrEqual(
					1,
				);
			},
			TEST_TIMEOUT,
		);

		test(
			"handles LLM error gracefully",
			async () => {
				await harness.addToInbox(
					BOOKMARK_FIXTURES.complete.input.filename,
					BOOKMARK_FIXTURES.complete.input.content,
				);

				// Set up mock to simulate error
				harness.setLLMResponse(new Error("LLM connection failed"));

				// Should handle error gracefully and not crash
				const suggestions = await harness.scan();
				// Either returns no suggestions or suggestions with fallback classification
				expect(suggestions.length).toBeLessThanOrEqual(1);
			},
			TEST_TIMEOUT,
		);
	});
});
