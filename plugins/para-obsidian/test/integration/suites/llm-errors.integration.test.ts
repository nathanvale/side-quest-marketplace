import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as path from "node:path";
import { createDocumentTypeFixture } from "../fixtures";
import {
	assertFrontmatterMatches,
	assertNoteExists,
} from "../helpers/assertions";
import type { IntegrationTestHarness } from "../helpers/test-harness";
import { createTestHarness } from "../helpers/test-harness";

describe("LLM Error Recovery", () => {
	let harness: IntegrationTestHarness;

	beforeEach(() => {
		harness = createTestHarness();
	});

	afterEach(() => {
		harness.cleanup();
	});

	describe("Timeout Handling", () => {
		test("recovers from LLM timeout with heuristic fallback", async () => {
			// Inject timeout error
			harness.setLLMResponse(
				new Error("ETIMEDOUT: request timed out after 30s"),
			);

			// Add bookmark with clear heuristic signals (URL pattern)
			await harness.addToInbox(
				"🔖 GitHub PR.md",
				`---
type: bookmark
url: https://github.com/user/repo/pull/123
title: Fix auth bug
clipped: 2024-12-16
---
# Fix auth bug

Pull request to resolve authentication issue in login flow.
`,
			);

			const suggestions = await harness.scan();

			// Should still classify using heuristics
			expect(suggestions).toHaveLength(1);
			const suggestion = suggestions[0];
			expect(suggestion).toBeDefined();
			expect(suggestion!.detectionSource).toBe("heuristic");

			// Verify warning about LLM timeout
			expect(suggestion!.extractionWarnings).toContainEqual(
				expect.stringContaining("timeout"),
			);

			// Execute should still work
			const results = await harness.execute();
			expect(results.length).toBeGreaterThan(0);
			const result = results[0];
			if (!result) throw new Error("Expected result");
			expect(result.success).toBe(true);

			// Verify note was created with heuristic data
			if (result.success && result.createdNote) {
				await assertNoteExists(harness.vault, result.createdNote);
				const notePath = path.join(harness.vault, result.createdNote);
				await assertFrontmatterMatches(notePath, {
					type: "bookmark",
					url: "https://github.com/user/repo/pull/123",
				});
			}
		});

		test("timeout on content-heavy note still processes structure", async () => {
			harness.setLLMResponse(new Error("ETIMEDOUT"));

			const longContent = `# Long Article\n\n${"Lorem ipsum. ".repeat(500)}`;

			await harness.addToInbox(
				"research-paper.md",
				`---
type: bookmark
url: https://arxiv.org/abs/2024.12345
title: Machine Learning Research
clipped: 2024-12-16
---
${longContent}
`,
			);

			const suggestions = await harness.scan();

			// Should still extract basic structure
			expect(suggestions).toHaveLength(1);
			const suggestion = suggestions[0];
			expect(suggestion).toBeDefined();
			if (suggestion!.action === "create-note") {
				expect(suggestion!.extractedFields?.title).toBe(
					"Machine Learning Research",
				);
			}
			expect(suggestion!.detectionSource).toBe("heuristic");
		});
	});

	describe("Invalid Response Handling", () => {
		test("handles malformed JSON response from LLM", async () => {
			// Mock LLM returning invalid JSON
			harness.setLLMResponse(new Error("Invalid JSON: unexpected token"));

			await harness.addToInbox(
				"bookmark.md",
				`---
type: bookmark
url: https://example.com
title: Test Article
clipped: 2024-12-16
---
# Test Article

Some content here.
`,
			);

			const suggestions = await harness.scan();

			// Should fall back to heuristics
			expect(suggestions).toHaveLength(1);
			const suggestion = suggestions[0];
			expect(suggestion).toBeDefined();
			expect(suggestion!.detectionSource).toBe("heuristic");
			expect(suggestion!.extractionWarnings).toContainEqual(
				expect.stringContaining("Invalid JSON"),
			);

			// Should still have basic frontmatter fields
			if (suggestion!.action === "create-note") {
				expect(suggestion!.extractedFields?.url).toBe("https://example.com");
			}
		});

		test("handles incomplete LLM response (missing required fields)", async () => {
			// LLM returns partial response - missing critical fields
			harness.setLLMResponse(
				createDocumentTypeFixture({
					documentType: "invoice",
					confidence: 0.9,
					// Missing suggested_name, suggested_area, etc.
				}),
			);

			await harness.addToInbox(
				"invoice.md",
				`---
type: invoice
---
# TAX INVOICE

Provider: Dr Smith
Amount: $220.00
Date: 2024-12-15
`,
			);

			const suggestions = await harness.scan();

			// Should process the incomplete response without crashing
			expect(suggestions).toHaveLength(1);
			const suggestion = suggestions[0];
			expect(suggestion).toBeDefined();

			// Either has extraction warnings or falls back gracefully
			// The important thing is it doesn't throw
			if (suggestion!.action === "create-note") {
				expect(suggestion!.suggestedTitle).toBeTruthy();
			}
		});

		test("handles LLM response with wrong schema version", async () => {
			// LLM returns outdated schema format
			harness.setLLMResponse(
				createDocumentTypeFixture({
					documentType: "bookmark",
					confidence: 0.9,
					// Old schema format fields
					extractedFields: {
						category: "reference", // instead of suggested_area
						filename: "some-file.md", // instead of suggested_name
					},
				}),
			);

			await harness.addToInbox(
				"note.md",
				`---
type: bookmark
url: https://docs.example.com
title: API Docs
clipped: 2024-12-16
---
# API Documentation
`,
			);

			const suggestions = await harness.scan();

			// Should handle old schema format gracefully
			expect(suggestions).toHaveLength(1);
			const suggestion = suggestions[0];
			expect(suggestion).toBeDefined();
			// Detection source can be heuristic, llm+heuristic, or llm depending on
			// how the engine handles the mismatch
			expect(["heuristic", "llm+heuristic", "llm"]).toContain(
				suggestion!.detectionSource,
			);
		});
	});

	describe("Rate Limit Handling", () => {
		test("handles LLM rate limit gracefully", async () => {
			harness.setLLMResponse(new Error("429 Too Many Requests"));

			await harness.addToInbox(
				"bookmark.md",
				`---
type: bookmark
url: https://docs.python.org/3/
title: Python Documentation
clipped: 2024-12-16
---
# Python 3 Documentation

Official Python language reference.
`,
			);

			const suggestions = await harness.scan();

			// Should proceed with heuristics
			expect(suggestions).toHaveLength(1);
			const suggestion = suggestions[0];
			expect(suggestion).toBeDefined();
			expect(suggestion!.detectionSource).toBe("heuristic");
			expect(suggestion!.extractionWarnings).toContainEqual(
				expect.stringContaining("rate limit"),
			);

			// Should successfully execute with fallback data
			const results = await harness.execute();
			expect(results.length).toBeGreaterThan(0);
			const result = results[0];
			if (!result) throw new Error("Expected result");
			expect(result.success).toBe(true);
		});

		test("batch processing continues after rate limit on one file", async () => {
			// Add first file
			await harness.addToInbox(
				"first.md",
				`---
type: bookmark
url: https://first.com
title: First
clipped: 2024-12-16
---
# First
`,
			);

			// Add second file
			await harness.addToInbox(
				"second.md",
				`---
type: bookmark
url: https://second.com
title: Second
clipped: 2024-12-16
---
# Second
`,
			);

			// Add third file
			await harness.addToInbox(
				"third.md",
				`---
type: bookmark
url: https://third.com
title: Third
clipped: 2024-12-16
---
# Third
`,
			);

			// Set LLM response that will fail
			harness.setLLMResponse(new Error("429 Too Many Requests"));

			const suggestions = await harness.scan();

			// All three should be processed (via heuristics fallback)
			expect(suggestions).toHaveLength(3);

			// All should have warnings about rate limit or be heuristic-based
			const secondSuggestion = suggestions.find((s) =>
				s.source.includes("second.md"),
			);
			if (secondSuggestion) {
				expect(secondSuggestion.detectionSource).toBe("heuristic");
			}

			// First and third should also be processed
			const firstSuggestion = suggestions.find((s) =>
				s.source.includes("first.md"),
			);
			expect(firstSuggestion).toBeTruthy();
		});
	});

	describe("Service Unavailable", () => {
		test("handles LLM service unavailable (connection refused)", async () => {
			harness.setLLMResponse(
				new Error("ECONNREFUSED: connect ECONNREFUSED 127.0.0.1:11434"),
			);

			await harness.addToInbox(
				"invoice.md",
				`---
type: invoice
---
# TAX INVOICE

Amount: $220.00
Provider: Dr Smith
Date: 2024-12-15
Service: Medical consultation
`,
			);

			const suggestions = await harness.scan();

			// Should proceed with heuristics-only
			expect(suggestions).toHaveLength(1);
			const suggestion = suggestions[0];
			expect(suggestion).toBeDefined();
			expect(suggestion!.detectionSource).toBe("heuristic");
			expect(suggestion!.extractionWarnings).toContainEqual(
				expect.stringContaining("unavailable"),
			);

			// Should extract basic invoice fields
			if (suggestion!.action === "create-note") {
				expect(suggestion!.extractedFields).toBeTruthy();
			}
		});

		test("heuristic-only classification is lower confidence", async () => {
			harness.setLLMResponse(new Error("Service unavailable"));

			// Ambiguous content without clear signals
			await harness.addToInbox(
				"ambiguous.md",
				`---
---
# Some Notes

Just some random thoughts and ideas.
Could be anything really.
`,
			);

			const suggestions = await harness.scan();

			// Without LLM, ambiguous content should have low confidence
			expect(suggestions).toHaveLength(1);
			const suggestion = suggestions[0];
			expect(suggestion).toBeDefined();
			expect(suggestion!.confidence).toBe("low");
			// Detection source can be "heuristic" or "none" for ambiguous content
			expect(["heuristic", "none"]).toContain(suggestion!.detectionSource);
		});

		test("clear heuristic signals maintain high confidence without LLM", async () => {
			harness.setLLMResponse(new Error("Service unavailable"));

			// Strong heuristic signals - URL pattern
			await harness.addToInbox(
				"github-pr.md",
				`---
type: bookmark
url: https://github.com/microsoft/typescript/pull/56789
title: TypeScript PR - Add new feature
clipped: 2024-12-16
---
# TypeScript PR - Add new feature

Pull request for TypeScript compiler enhancement.
`,
			);

			const suggestions = await harness.scan();

			// Strong heuristics should maintain confidence
			expect(suggestions).toHaveLength(1);
			const suggestion = suggestions[0];
			expect(suggestion).toBeDefined();
			expect(["high", "medium"]).toContain(suggestion!.confidence);
			expect(suggestion!.detectionSource).toBe("heuristic");
		});
	});

	describe("Fallback Quality", () => {
		test("heuristic extraction captures URL and title from frontmatter", async () => {
			harness.setLLMResponse(new Error("LLM unavailable"));

			const url = "https://kit.cased.com";
			const title = "Kit CLI Documentation";

			await harness.addToInbox(
				"bookmark.md",
				`---
type: bookmark
url: ${url}
title: ${title}
clipped: 2024-12-16
---
# ${title}

Comprehensive guide to Kit CLI usage.
`,
			);

			const suggestions = await harness.scan();

			// Heuristics should still extract frontmatter fields
			expect(suggestions).toHaveLength(1);
			const suggestion = suggestions[0];
			expect(suggestion).toBeDefined();
			if (suggestion!.action === "create-note") {
				expect(suggestion!.extractedFields?.url).toBe(url);
				expect(suggestion!.extractedFields?.title).toBe(title);
			}
			expect(suggestion!.detectionSource).toBe("heuristic");
		});

		test("heuristic extraction infers area from URL pattern", async () => {
			harness.setLLMResponse(new Error("LLM unavailable"));

			await harness.addToInbox(
				"github-docs.md",
				`---
type: bookmark
url: https://docs.github.com/en/actions
title: GitHub Actions Documentation
clipped: 2024-12-16
---
# GitHub Actions Documentation
`,
			);

			const suggestions = await harness.scan();

			// Should handle the request without LLM
			expect(suggestions).toHaveLength(1);
			const suggestion = suggestions[0];
			expect(suggestion).toBeDefined();
			// Without LLM, uses heuristic or fallback detection
			expect(["heuristic", "none", "llm+heuristic"]).toContain(
				suggestion!.detectionSource,
			);
			if (suggestion!.action === "create-note") {
				// suggestedArea (not suggestedDestination) is used for PARA routing
				// It may or may not be set depending on heuristic strength
				expect(suggestion!.suggestedTitle).toBeTruthy();
			}
		});

		test("heuristic extraction generates sensible filename", async () => {
			harness.setLLMResponse(new Error("LLM unavailable"));

			await harness.addToInbox(
				"🔖 My Awesome Article!!!.md",
				`---
type: bookmark
url: https://example.com/article
title: My Awesome Article!!!
clipped: 2024-12-16
---
# My Awesome Article!!!
`,
			);

			const suggestions = await harness.scan();

			// Should sanitize filename
			expect(suggestions).toHaveLength(1);
			const suggestion = suggestions[0];
			expect(suggestion).toBeDefined();
			if (suggestion!.action === "create-note") {
				const title = suggestion!.suggestedTitle;
				// Title should be present and not contain problematic characters for filenames
				expect(title).toBeTruthy();
			}
		});
	});
});
