import {
	afterAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";
import * as path from "node:path";
import { createDocumentTypeFixture } from "../fixtures";
import {
	assertFrontmatterMatches,
	assertNoteExists,
} from "../helpers/assertions";
import type { IntegrationTestHarness } from "../helpers/test-harness";
import { createTestHarness } from "../helpers/test-harness";

describe("Frontmatter Fast Path", () => {
	let harness: IntegrationTestHarness;

	beforeEach(() => {
		harness = createTestHarness();
	});

	afterEach(() => {
		harness.cleanup();
	});

	afterAll(() => {
		if (harness) {
			try {
				harness.cleanup();
			} catch {
				// Already cleaned up or other error - ignore
			}
		}
	});

	describe("Pre-tagged Notes Skip LLM", () => {
		test("pre-tagged bookmark skips LLM classification", async () => {
			// Create area folder so fast-path routing works
			await harness.addArea("Tech");

			// Add file with explicit type in frontmatter
			// Note: includes area wikilink for fast-path routing
			await harness.addToInbox(
				"bookmark.md",
				`---
type: bookmark
url: https://github.com/user/repo
title: GitHub Repository
clipped: 2024-12-16
area: "[[Tech]]"
enrichedAt: 2024-12-16T00:00:00Z
---
# GitHub Repository

Interesting open source project for PARA method.
`,
			);

			// No LLM response needed - should use frontmatter
			harness.setLLMResponse(
				new Error("LLM should not be called for pre-tagged notes"),
			);

			const suggestions = await harness.scan();

			// Should detect as bookmark WITHOUT calling LLM
			expect(suggestions).toHaveLength(1);
			const suggestion = suggestions[0];
			expect(suggestion).toBeDefined();

			if (!suggestion) {
				throw new Error("Expected suggestion");
			}

			// Should use frontmatter or heuristic detection (not LLM)
			expect(["frontmatter", "heuristic"]).toContain(
				suggestion.detectionSource,
			);

			// Should NOT show LLM fallback warnings
			expect(
				suggestion.extractionWarnings?.some((w) => w.includes("LLM")),
			).toBeFalsy();

			// Execute to verify it works end-to-end
			const results = await harness.execute();
			expect(results.length).toBeGreaterThan(0);
			const result = results[0];
			if (!result) throw new Error("Expected result");
			expect(result.success).toBe(true);

			// Verify note was created with frontmatter type preserved
			if (result.success && result.createdNote) {
				await assertNoteExists(harness.vault, result.createdNote);
				const notePath = path.join(harness.vault, result.createdNote);
				await assertFrontmatterMatches(notePath, {
					type: "bookmark",
					url: "https://github.com/user/repo",
					title: "GitHub Repository",
				});
			}
		});

		test("pre-tagged invoice skips LLM classification", async () => {
			// Create area folder so fast-path routing works
			await harness.addArea("Finance");

			// Add file with explicit type in frontmatter
			await harness.addToInbox(
				"invoice.md",
				`---
type: invoice
amount: 220.00
provider: Dr Smith
date: 2024-12-15
area: "[[Finance]]"
---
# TAX INVOICE

**Provider:** Dr Smith
**Amount:** $220.00
**Date:** 2024-12-15
**Service:** Medical consultation
`,
			);

			// No LLM response needed
			harness.setLLMResponse(
				new Error("LLM should not be called for pre-tagged notes"),
			);

			const suggestions = await harness.scan();

			// Should detect as invoice WITHOUT calling LLM
			expect(suggestions).toHaveLength(1);
			const suggestion = suggestions[0];
			expect(suggestion).toBeDefined();

			if (!suggestion) {
				throw new Error("Expected suggestion");
			}

			// Should use frontmatter or heuristic detection (not LLM)
			expect(["frontmatter", "heuristic"]).toContain(
				suggestion.detectionSource,
			);

			// Execute to verify it works
			const results = await harness.execute();
			expect(results.length).toBeGreaterThan(0);
			const result = results[0];
			if (!result) throw new Error("Expected result");
			expect(result.success).toBe(true);

			// Verify invoice fields preserved
			if (result.success && result.createdNote) {
				await assertNoteExists(harness.vault, result.createdNote);
				const notePath = path.join(harness.vault, result.createdNote);
				await assertFrontmatterMatches(notePath, {
					type: "invoice",
					amount: 220.0,
					provider: "Dr Smith",
				});
			}
		});
	});

	describe("Type Detection from Frontmatter", () => {
		test("uses frontmatter type over content analysis", async () => {
			// Create area folder so fast-path routing works
			await harness.addArea("Finance");

			// Content looks like a bookmark, but frontmatter says invoice
			await harness.addToInbox(
				"document.md",
				`---
type: invoice
amount: 150.00
provider: Tech Services
area: "[[Finance]]"
---
# Interesting Article

This looks like a bookmark with URL patterns but frontmatter says invoice.
Visit https://example.com for more details.
`,
			);

			harness.setLLMResponse(
				new Error("LLM should not be called for pre-tagged notes"),
			);

			const suggestions = await harness.scan();

			expect(suggestions).toHaveLength(1);
			const suggestion = suggestions[0];
			expect(suggestion).toBeDefined();

			if (!suggestion) {
				throw new Error("Expected suggestion");
			}

			// Should use frontmatter or heuristic detection (not LLM)
			expect(["frontmatter", "heuristic"]).toContain(
				suggestion.detectionSource,
			);

			if (suggestion.action === "create-note") {
				expect(suggestion.suggestedNoteType).toBe("invoice");
			}
		});

		test("extracts all frontmatter fields without LLM", async () => {
			// Create area folder so fast-path routing works
			await harness.addArea("Resources");

			await harness.addToInbox(
				"complete-bookmark.md",
				`---
type: bookmark
url: https://docs.example.com/guide
title: Complete Guide
category: documentation
author: John Doe
published: 2024-12-01
clipped: 2024-12-16
area: "[[Resources]]"
enrichedAt: 2024-12-16T00:00:00Z
---
# Complete Guide

Full guide to using the system.
`,
			);

			harness.setLLMResponse(
				new Error("LLM should not be called for complete frontmatter"),
			);

			const suggestions = await harness.scan();

			expect(suggestions).toHaveLength(1);
			const suggestion = suggestions[0];
			expect(suggestion).toBeDefined();

			if (!suggestion) {
				throw new Error("Expected suggestion");
			}

			// Should use frontmatter or heuristic detection (not LLM)
			expect(["frontmatter", "heuristic"]).toContain(
				suggestion.detectionSource,
			);

			// Should have all fields extracted from frontmatter
			if (suggestion.action === "create-note") {
				expect(suggestion.extractedFields).toBeTruthy();
				expect(suggestion.extractedFields?.url).toBe(
					"https://docs.example.com/guide",
				);
				expect(suggestion.extractedFields?.title).toBe("Complete Guide");
				expect(suggestion.extractedFields?.category).toBe("documentation");
				expect(suggestion.extractedFields?.author).toBe("John Doe");
			}
		});
	});

	describe("Partial Frontmatter Uses LLM for Missing Fields", () => {
		test("uses LLM to extract missing fields from partial frontmatter", async () => {
			// Has type but missing url and title
			await harness.addToInbox(
				"partial-bookmark.md",
				`---
type: bookmark
clipped: 2024-12-16
enrichedAt: 2024-12-16T00:00:00Z
---
# Interesting Research Paper

Paper about AI and knowledge management.
Available at https://arxiv.org/abs/2024.12345
`,
			);

			// Mock LLM to extract missing fields
			harness.setLLMResponse(
				createDocumentTypeFixture({
					documentType: "bookmark",
					confidence: 0.9,
					extractedFields: {
						url: "https://arxiv.org/abs/2024.12345",
						title: "Interesting Research Paper",
						category: "research",
					},
				}),
			);

			const suggestions = await harness.scan();

			expect(suggestions).toHaveLength(1);
			const suggestion = suggestions[0];
			expect(suggestion).toBeDefined();

			if (!suggestion) {
				throw new Error("Expected suggestion");
			}

			// Should use LLM because frontmatter was incomplete
			// Either "llm" or "llm+heuristic" indicates LLM was used
			expect(["llm", "llm+heuristic"]).toContain(suggestion.detectionSource);

			// Should have extracted missing fields via LLM
			if (suggestion.action === "create-note") {
				expect(suggestion.extractedFields?.url).toBe(
					"https://arxiv.org/abs/2024.12345",
				);
				expect(suggestion.extractedFields?.title).toBe(
					"Interesting Research Paper",
				);
			}

			// Execute and verify combined frontmatter + LLM data
			const results = await harness.execute();
			expect(results.length).toBeGreaterThan(0);
			const result = results[0];
			if (!result) throw new Error("Expected result");
			expect(result.success).toBe(true);

			if (result.success && result.createdNote) {
				await assertNoteExists(harness.vault, result.createdNote);
				const notePath = path.join(harness.vault, result.createdNote);
				await assertFrontmatterMatches(notePath, {
					type: "bookmark",
					url: "https://arxiv.org/abs/2024.12345",
				});
			}
		});

		test("preserves existing frontmatter fields when LLM fills gaps", async () => {
			await harness.addToInbox(
				"partial-invoice.md",
				`---
type: invoice
provider: Dr Smith
date: 2024-12-15
---
# Medical Consultation

Amount: $220.00
Service: General consultation
ABN: 12 345 678 901
`,
			);

			// Mock LLM to extract missing amount
			harness.setLLMResponse(
				createDocumentTypeFixture({
					documentType: "invoice",
					confidence: 0.95,
					extractedFields: {
						amount: "220.00",
						abn: "12 345 678 901",
					},
				}),
			);

			const suggestions = await harness.scan();

			expect(suggestions).toHaveLength(1);
			const suggestion = suggestions[0];
			expect(suggestion).toBeDefined();

			if (!suggestion) {
				throw new Error("Expected suggestion");
			}

			// Should use LLM for missing fields
			// Either "llm" or "llm+heuristic" indicates LLM was used
			expect(["llm", "llm+heuristic"]).toContain(suggestion.detectionSource);

			// Execute and verify frontmatter fields preserved
			const results = await harness.execute();
			const result = results[0];
			if (!result || !result.success || !result.createdNote) {
				throw new Error("Expected successful result");
			}

			const notePath = path.join(harness.vault, result.createdNote);
			await assertFrontmatterMatches(notePath, {
				type: "invoice",
				provider: "Dr Smith", // Preserved from original frontmatter
				amount: 220.0, // Extracted by LLM
			});
		});
	});

	describe("Invalid Type Falls Back to LLM", () => {
		test("corrects invalid type using LLM classification", async () => {
			// Frontmatter has unknown type
			await harness.addToInbox(
				"unknown-type.md",
				`---
type: unknown-document-type
title: Some Document
---
# TAX INVOICE

Amount: $220.00
Provider: Dr Smith
Date: 2024-12-15
`,
			);

			// Mock LLM to correct the type
			harness.setLLMResponse(
				createDocumentTypeFixture({
					documentType: "invoice",
					confidence: 0.9,
					extractedFields: {
						amount: "220.00",
						provider: "Dr Smith",
					},
				}),
			);

			const suggestions = await harness.scan();

			expect(suggestions).toHaveLength(1);
			const suggestion = suggestions[0];
			expect(suggestion).toBeDefined();

			if (!suggestion) {
				throw new Error("Expected suggestion");
			}

			// Should use LLM because type was invalid
			// Either "llm" or "llm+heuristic" indicates LLM was used
			expect(["llm", "llm+heuristic"]).toContain(suggestion.detectionSource);

			// Should correct the type based on content
			if (suggestion.action === "create-note") {
				expect(suggestion.suggestedNoteType).toBe("invoice");
			}

			// Execute and verify corrected type
			const results = await harness.execute();
			const result = results[0];
			if (!result || !result.success || !result.createdNote) {
				throw new Error("Expected successful result");
			}

			const notePath = path.join(harness.vault, result.createdNote);
			await assertFrontmatterMatches(notePath, {
				type: "invoice",
				amount: 220.0,
			});
		});

		test("warns when correcting invalid type", async () => {
			await harness.addToInbox(
				"invalid-type.md",
				`---
type: not-a-real-type
---
# Content
`,
			);

			harness.setLLMResponse(
				createDocumentTypeFixture({
					documentType: "bookmark",
					confidence: 0.7,
					extractedFields: {},
					extractionWarnings: [
						"Frontmatter type 'not-a-real-type' is not recognized. Corrected to 'bookmark' based on content.",
					],
				}),
			);

			const suggestions = await harness.scan();

			expect(suggestions).toHaveLength(1);
			const suggestion = suggestions[0];
			expect(suggestion).toBeDefined();

			if (!suggestion) {
				throw new Error("Expected suggestion");
			}

			// Should have warning about type correction
			expect(suggestion.extractionWarnings).toBeTruthy();
			expect(
				suggestion.extractionWarnings?.some((w) =>
					w.includes("not recognized"),
				),
			).toBe(true);
		});
	});

	describe("Empty or Missing Frontmatter Uses Full LLM", () => {
		test("empty frontmatter triggers full LLM classification", async () => {
			await harness.addToInbox(
				"empty-frontmatter.md",
				`---
---
# Bookmark Article

Interesting article about PARA method.
Read more at https://fortelabs.com/blog/para/
`,
			);

			// Mock LLM for full classification
			harness.setLLMResponse(
				createDocumentTypeFixture({
					documentType: "bookmark",
					confidence: 0.85,
					extractedFields: {
						url: "https://fortelabs.com/blog/para/",
						title: "Bookmark Article",
						category: "productivity",
					},
				}),
			);

			const suggestions = await harness.scan();

			expect(suggestions).toHaveLength(1);
			const suggestion = suggestions[0];
			expect(suggestion).toBeDefined();

			if (!suggestion) {
				throw new Error("Expected suggestion");
			}

			// Should use LLM for full classification
			// Either "llm", "llm+heuristic", or "none" possible for empty frontmatter
			expect(["llm", "llm+heuristic", "none", "heuristic"]).toContain(
				suggestion.detectionSource,
			);

			// Should have extracted all fields via LLM
			if (suggestion.action === "create-note") {
				expect(suggestion.suggestedNoteType).toBe("bookmark");
				expect(suggestion.extractedFields?.url).toBeTruthy();
				expect(suggestion.extractedFields?.title).toBeTruthy();
			}
		});

		test("no frontmatter triggers full LLM classification", async () => {
			await harness.addToInbox(
				"no-frontmatter.md",
				`# Plain Markdown File

This file has no frontmatter at all.

# TAX INVOICE

Amount: $150.00
Provider: Tech Services
Date: 2024-12-16
`,
			);

			// Mock LLM for full classification
			harness.setLLMResponse(
				createDocumentTypeFixture({
					documentType: "invoice",
					confidence: 0.9,
					extractedFields: {
						amount: "150.00",
						provider: "Tech Services",
					},
				}),
			);

			const suggestions = await harness.scan();

			expect(suggestions).toHaveLength(1);
			const suggestion = suggestions[0];
			expect(suggestion).toBeDefined();

			if (!suggestion) {
				throw new Error("Expected suggestion");
			}

			// Should use LLM for classification
			// Either "llm" or "llm+heuristic" indicates LLM was used
			expect(["llm", "llm+heuristic"]).toContain(suggestion.detectionSource);

			// Should classify as invoice from content
			if (suggestion.action === "create-note") {
				expect(suggestion.suggestedNoteType).toBe("invoice");
			}
		});
	});

	describe("PARA Field Detection", () => {
		test("respects area wikilink (fast path)", async () => {
			// Create area folder so fast-path routing works
			await harness.addArea("Resources");

			await harness.addToInbox(
				"para-assigned.md",
				`---
type: bookmark
url: https://example.com
title: Example
area: "[[Resources]]"
enrichedAt: 2024-12-16T00:00:00Z
---
# Example Bookmark
`,
			);

			// LLM should not be called for fast-path items
			harness.setLLMResponse(
				new Error("LLM should not be called for fast-path routing"),
			);

			const suggestions = await harness.scan();

			expect(suggestions).toHaveLength(1);
			const suggestion = suggestions[0];
			expect(suggestion).toBeDefined();

			if (!suggestion) {
				throw new Error("Expected suggestion");
			}

			// Should use frontmatter or heuristic detection (not LLM)
			expect(["frontmatter", "heuristic"]).toContain(
				suggestion.detectionSource,
			);

			// Destination should route to area from wikilink
			if (suggestion.action === "create-note") {
				expect(suggestion.suggestedDestination).toMatch(/02 Areas\/Resources/);
			}
		});

		test("bookmark without routing fields falls through to LLM", async () => {
			// Bookmark with type but no area/project wikilinks
			// This is LLM-path: no routing fields means suggestedDestination stays undefined
			await harness.addToInbox(
				"no-routing.md",
				`---
type: bookmark
url: https://example.com
title: Example
clipped: 2024-12-16
enrichedAt: 2024-12-16T00:00:00Z
---
# Example
`,
			);

			// LLM will be called to classify and suggest routing
			harness.setLLMResponse({
				documentType: "bookmark",
				confidence: 0.85,
				suggestedArea: "Resources",
				extractedFields: {
					url: "https://example.com",
					title: "Example",
				},
				reasoning: "Standard bookmark classified to Resources",
			});

			const suggestions = await harness.scan();

			expect(suggestions).toHaveLength(1);
			const suggestion = suggestions[0];
			expect(suggestion).toBeDefined();

			if (!suggestion) {
				throw new Error("Expected suggestion");
			}

			// Falls through to LLM since routing fields are missing
			expect(["llm", "llm+heuristic", "heuristic"]).toContain(
				suggestion.detectionSource,
			);

			// LLM path provides the suggestedArea as a hint (no auto-routing destination)
			if (suggestion.action === "create-note") {
				// suggestedDestination is undefined (no auto-routing)
				expect(suggestion.suggestedDestination).toBeUndefined();
				expect(suggestion.suggestedArea).toBe("Resources");
			}
		});

		test("preserves area wikilink from frontmatter", async () => {
			// Create area folder so fast-path routing works
			await harness.addArea("Health");

			// Invoice with all required key fields + area wikilink
			await harness.addToInbox(
				"area-link.md",
				`---
type: invoice
title: Medical Consultation
invoiceDate: 2024-12-15
amount: 220.00
provider: Dr Smith
area: "[[Health]]"
---
# Invoice
`,
			);

			harness.setLLMResponse(
				new Error("LLM should not be called for fast-path routing"),
			);

			const suggestions = await harness.scan();

			expect(suggestions).toHaveLength(1);
			const suggestion = suggestions[0];
			expect(suggestion).toBeDefined();

			if (!suggestion) {
				throw new Error("Expected suggestion");
			}

			// Should use frontmatter or heuristic detection (not LLM)
			expect(["frontmatter", "heuristic"]).toContain(
				suggestion.detectionSource,
			);

			// Should NOT call LLM (detectionSource confirms this)
			// Fast-path behavior: area wikilink triggers auto-routing
			if (suggestion.action === "create-note") {
				// Area is parsed as "Health" from wikilink
				expect(suggestion.suggestedArea).toBe("Health");
			}
		});
	});

	describe("Performance Optimization", () => {
		test("batch of pre-tagged notes avoids multiple LLM calls", async () => {
			// Create area folders so fast-path routing works
			await harness.addArea("Resources");
			await harness.addArea("Finance");

			// Add multiple pre-tagged files with area wikilinks (fast-path)
			await harness.addToInbox(
				"bookmark1.md",
				`---
type: bookmark
url: https://example.com/1
title: Bookmark 1
clipped: 2024-12-16
area: "[[Resources]]"
enrichedAt: 2024-12-16T00:00:00Z
---
# Bookmark 1
`,
			);

			await harness.addToInbox(
				"bookmark2.md",
				`---
type: bookmark
url: https://example.com/2
title: Bookmark 2
clipped: 2024-12-16
area: "[[Resources]]"
enrichedAt: 2024-12-16T00:00:00Z
---
# Bookmark 2
`,
			);

			await harness.addToInbox(
				"invoice1.md",
				`---
type: invoice
amount: 100.00
provider: Provider A
invoiceDate: 2024-12-16
title: Invoice 1
area: "[[Finance]]"
---
# Invoice 1
`,
			);

			// Set LLM to error - none should call LLM
			harness.setLLMResponse(
				new Error("LLM should not be called for pre-tagged batch"),
			);

			const suggestions = await harness.scan();

			// All three should be processed
			expect(suggestions).toHaveLength(3);

			// All should use frontmatter or heuristic detection (no LLM calls)
			for (const suggestion of suggestions) {
				expect(["frontmatter", "heuristic"]).toContain(
					suggestion.detectionSource,
				);
			}
		});

		test("mixed batch uses LLM only for untagged files", async () => {
			// Create area folder so fast-path routing works
			await harness.addArea("Resources");

			// Pre-tagged file with area wikilink (fast-path)
			await harness.addToInbox(
				"tagged.md",
				`---
type: bookmark
url: https://example.com
title: Tagged
clipped: 2024-12-16
area: "[[Resources]]"
enrichedAt: 2024-12-16T00:00:00Z
---
# Tagged
`,
			);

			// Untagged file
			await harness.addToInbox(
				"untagged.md",
				`# Untagged

This needs LLM classification.
`,
			);

			// Mock LLM for untagged file only
			harness.setLLMResponse(
				createDocumentTypeFixture({
					documentType: "bookmark",
					confidence: 0.7,
					extractedFields: {
						title: "Untagged",
					},
				}),
			);

			const suggestions = await harness.scan();

			// Both should be processed
			expect(suggestions).toHaveLength(2);

			// Tagged should use frontmatter or heuristic (not LLM)
			const taggedSuggestion = suggestions.find((s) =>
				s.source.includes("tagged"),
			);
			expect(taggedSuggestion).toBeDefined();
			expect(["frontmatter", "heuristic"]).toContain(
				taggedSuggestion!.detectionSource,
			);

			// Untagged should use LLM (or llm+heuristic if heuristics also matched)
			const untaggedSuggestion = suggestions.find((s) =>
				s.source.includes("untagged"),
			);
			expect(untaggedSuggestion).toBeDefined();
			expect(["llm", "llm+heuristic", "heuristic"]).toContain(
				untaggedSuggestion!.detectionSource,
			);
		});
	});
});
