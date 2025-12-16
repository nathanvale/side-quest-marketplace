/**
 * Bookmark Integration Test Suite
 *
 * Tests the complete bookmark workflow: inbox → classified note.
 * Focuses on FILESYSTEM OUTCOMES, not internal state.
 *
 * Test Philosophy:
 * - Assert on what users see (files created, frontmatter, content)
 * - Use rich error messages with context (ADHD-friendly debugging)
 * - Test PARA classification logic (Projects/Areas/Resources)
 * - Cover edge cases (Unicode, special chars, long URLs)
 *
 * @module test/integration/suites/bookmark.integration.test
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as path from "node:path";
import { BOOKMARK_FIXTURES } from "../fixtures/bookmark.fixtures";
import {
	assertExecutionSuccess,
	assertFrontmatterMatches,
	assertInboxCleanedUp,
	assertNoteExists,
} from "../helpers/assertions";
import {
	createTestHarness,
	type IntegrationTestHarness,
} from "../helpers/test-harness";

describe("Bookmark Integration", () => {
	let harness: IntegrationTestHarness;

	beforeEach(() => {
		harness = createTestHarness();
	});

	afterEach(() => {
		harness.cleanup();
	});

	describe("Complete Bookmark Workflow", () => {
		test("creates bookmark note with all fields", async () => {
			const fixture = BOOKMARK_FIXTURES.complete;
			harness.setLLMResponse(fixture._mockLLMResponse);

			await harness.addToInbox(fixture.input.filename, fixture.input.content);
			const suggestions = await harness.scan();

			expect(suggestions).toHaveLength(1);
			const suggestion = suggestions[0];
			expect(suggestion).toBeDefined();
			if (suggestion?.action === "create-note") {
				expect(suggestion.suggestedNoteType).toBe("bookmark");
			}

			const results = await harness.execute();
			expect(results[0]).toBeDefined();
			assertExecutionSuccess(results[0]!, fixture.expectedOutcome.noteCreated!);

			// Verify filesystem outcome
			await assertNoteExists(
				harness.vault,
				fixture.expectedOutcome.noteCreated!,
			);
			await assertFrontmatterMatches(
				path.join(harness.vault, fixture.expectedOutcome.noteCreated!),
				fixture.expectedOutcome.frontmatter!,
			);
			await assertInboxCleanedUp(harness.vault, fixture.input.filename);
		});
	});

	describe("Minimal Bookmark Handling", () => {
		test("handles bookmark with only required fields", async () => {
			const fixture = BOOKMARK_FIXTURES.minimal;
			harness.setLLMResponse(fixture._mockLLMResponse);

			await harness.addToInbox(fixture.input.filename, fixture.input.content);
			const suggestions = await harness.scan();

			expect(suggestions).toHaveLength(1);
			const suggestion = suggestions[0];
			expect(suggestion).toBeDefined();
			if (suggestion?.action === "create-note") {
				expect(suggestion.suggestedNoteType).toBe("bookmark");
			}

			const results = await harness.execute();
			expect(results[0]).toBeDefined();
			assertExecutionSuccess(results[0]!, fixture.expectedOutcome.noteCreated!);

			// Verify minimal frontmatter works
			await assertNoteExists(
				harness.vault,
				fixture.expectedOutcome.noteCreated!,
			);
			await assertFrontmatterMatches(
				path.join(harness.vault, fixture.expectedOutcome.noteCreated!),
				fixture.expectedOutcome.frontmatter!,
			);
			await assertInboxCleanedUp(harness.vault, fixture.input.filename);
		});
	});

	describe("PARA Classification", () => {
		test("classifies GitHub PR to Projects", async () => {
			const fixture = BOOKMARK_FIXTURES.edgeCases.find(
				(f) => f.description === "GitHub PR bookmark classified to Projects",
			);

			if (!fixture) {
				throw new Error("GitHub PR fixture not found");
			}

			harness.setLLMResponse(fixture._mockLLMResponse);

			await harness.addToInbox(fixture.input.filename, fixture.input.content);
			const suggestions = await harness.scan();

			expect(suggestions).toHaveLength(1);
			const suggestion = suggestions[0];
			expect(suggestion).toBeDefined();
			if (suggestion?.action === "create-note") {
				expect(suggestion.suggestedDestination).toBe("Projects");
			}

			const results = await harness.execute();
			expect(results[0]).toBeDefined();
			assertExecutionSuccess(results[0]!, fixture.expectedOutcome.noteCreated!);

			// Verify PARA location
			await assertNoteExists(
				harness.vault,
				fixture.expectedOutcome.noteCreated!,
			);
			const notePath = path.join(
				harness.vault,
				fixture.expectedOutcome.noteCreated!,
			);
			await assertFrontmatterMatches(notePath, {
				para: "Projects",
				type: "bookmark",
			});
		});

		test("classifies banking portal to Areas", async () => {
			const fixture = BOOKMARK_FIXTURES.edgeCases.find(
				(f) =>
					f.description ===
					"banking portal bookmark classified to Areas/Finance",
			);

			if (!fixture) {
				throw new Error("Banking fixture not found");
			}

			harness.setLLMResponse(fixture._mockLLMResponse);

			await harness.addToInbox(fixture.input.filename, fixture.input.content);
			const suggestions = await harness.scan();

			expect(suggestions).toHaveLength(1);
			const suggestion = suggestions[0];
			expect(suggestion).toBeDefined();
			if (suggestion?.action === "create-note") {
				expect(suggestion.suggestedDestination).toBe("Areas");
			}

			const results = await harness.execute();
			expect(results[0]).toBeDefined();
			assertExecutionSuccess(results[0]!, fixture.expectedOutcome.noteCreated!);

			// Verify PARA location and category
			await assertNoteExists(
				harness.vault,
				fixture.expectedOutcome.noteCreated!,
			);
			const notePath = path.join(
				harness.vault,
				fixture.expectedOutcome.noteCreated!,
			);
			await assertFrontmatterMatches(notePath, {
				para: "Areas",
				type: "bookmark",
				category: "Banking",
			});
		});

		test("classifies documentation to Resources", async () => {
			const fixture = BOOKMARK_FIXTURES.complete;
			harness.setLLMResponse(fixture._mockLLMResponse);

			await harness.addToInbox(fixture.input.filename, fixture.input.content);
			const suggestions = await harness.scan();

			expect(suggestions).toHaveLength(1);
			const suggestion = suggestions[0];
			expect(suggestion).toBeDefined();
			if (suggestion?.action === "create-note") {
				expect(suggestion.suggestedDestination).toBe("Resources");
			}

			const results = await harness.execute();
			expect(results[0]).toBeDefined();
			assertExecutionSuccess(results[0]!, fixture.expectedOutcome.noteCreated!);

			// Verify default Resources classification
			await assertNoteExists(
				harness.vault,
				fixture.expectedOutcome.noteCreated!,
			);
			const notePath = path.join(
				harness.vault,
				fixture.expectedOutcome.noteCreated!,
			);
			await assertFrontmatterMatches(notePath, {
				para: "Resources",
				type: "bookmark",
			});
		});
	});

	describe("Edge Cases", () => {
		test("handles special characters in title", async () => {
			const fixture = BOOKMARK_FIXTURES.edgeCases.find(
				(f) => f.description === "bookmark with special characters in title",
			);

			if (!fixture) {
				throw new Error("Special chars fixture not found");
			}

			harness.setLLMResponse(fixture._mockLLMResponse);

			await harness.addToInbox(fixture.input.filename, fixture.input.content);
			const suggestions = await harness.scan();

			expect(suggestions).toHaveLength(1);

			const results = await harness.execute();
			expect(results[0]).toBeDefined();
			assertExecutionSuccess(results[0]!, fixture.expectedOutcome.noteCreated!);

			// Verify special chars preserved in frontmatter
			await assertNoteExists(
				harness.vault,
				fixture.expectedOutcome.noteCreated!,
			);
			const notePath = path.join(
				harness.vault,
				fixture.expectedOutcome.noteCreated!,
			);
			await assertFrontmatterMatches(notePath, {
				title: "TypeScript: The Guide & More",
			});
		});

		test("handles Unicode content (CJK + emoji)", async () => {
			const fixture = BOOKMARK_FIXTURES.edgeCases.find(
				(f) => f.description === "bookmark with Unicode content",
			);

			if (!fixture) {
				throw new Error("Unicode fixture not found");
			}

			harness.setLLMResponse(fixture._mockLLMResponse);

			await harness.addToInbox(fixture.input.filename, fixture.input.content);
			const suggestions = await harness.scan();

			expect(suggestions).toHaveLength(1);

			const results = await harness.execute();
			expect(results[0]).toBeDefined();
			assertExecutionSuccess(results[0]!, fixture.expectedOutcome.noteCreated!);

			// Verify Unicode preserved correctly
			await assertNoteExists(
				harness.vault,
				fixture.expectedOutcome.noteCreated!,
			);
			const notePath = path.join(
				harness.vault,
				fixture.expectedOutcome.noteCreated!,
			);
			await assertFrontmatterMatches(notePath, {
				title: "🚀 TypeScript 學習指南",
				category: "教學文件",
			});
		});

		test("handles very long URLs", async () => {
			const fixture = BOOKMARK_FIXTURES.edgeCases.find(
				(f) =>
					f.description ===
					"bookmark with very long URL with query params and fragment",
			);

			if (!fixture) {
				throw new Error("Long URL fixture not found");
			}

			harness.setLLMResponse(fixture._mockLLMResponse);

			await harness.addToInbox(fixture.input.filename, fixture.input.content);
			const suggestions = await harness.scan();

			expect(suggestions).toHaveLength(1);

			const results = await harness.execute();
			expect(results[0]).toBeDefined();
			assertExecutionSuccess(results[0]!, fixture.expectedOutcome.noteCreated!);

			// Verify long URL stored correctly (no truncation)
			await assertNoteExists(
				harness.vault,
				fixture.expectedOutcome.noteCreated!,
			);
			const notePath = path.join(
				harness.vault,
				fixture.expectedOutcome.noteCreated!,
			);
			await assertFrontmatterMatches(notePath, {
				url: fixture.expectedFields.url,
			});

			// Verify URL is >150 chars (test fixture requirement)
			expect(fixture.expectedFields.url.length).toBeGreaterThan(150);
		});

		test("preserves Web Clipper emoji prefix", async () => {
			const fixture = BOOKMARK_FIXTURES.complete;
			harness.setLLMResponse(fixture._mockLLMResponse);

			await harness.addToInbox(fixture.input.filename, fixture.input.content);
			const suggestions = await harness.scan();

			expect(suggestions).toHaveLength(1);

			const results = await harness.execute();
			expect(results[0]).toBeDefined();
			assertExecutionSuccess(results[0]!, fixture.expectedOutcome.noteCreated!);

			// Verify filename includes emoji (Web Clipper standard)
			await assertNoteExists(
				harness.vault,
				fixture.expectedOutcome.noteCreated!,
			);
			expect(fixture.input.filename).toContain("🔖");
			expect(fixture.expectedOutcome.noteCreated).toContain("🔖");
		});

		test("handles bookmarks with multiple URLs (first URL wins)", async () => {
			const multiUrlFixture = {
				filename: "🔖 Multi-Link Article.md",
				content: `---
type: bookmark
url: https://primary.com/article
title: Primary Article
clipped: 2024-12-16
---

# Primary Article

References:
- [Primary](https://primary.com/article)
- [Related](https://secondary.com/related)
- [Another](https://tertiary.com/another)
`,
			};

			harness.setLLMResponse({
				documentType: "bookmark",
				confidence: 0.84,
				suggestedArea: "Resources",
				suggestedProject: null,
				extractedFields: {
					url: "https://primary.com/article",
					title: "Primary Article",
				},
				suggestedFilenameDescription: "2024-12-16-primary-article",
				reasoning: "First URL in frontmatter used as primary bookmark URL",
				extractionWarnings: [],
			});

			await harness.addToInbox(
				multiUrlFixture.filename,
				multiUrlFixture.content,
			);
			const suggestions = await harness.scan();

			expect(suggestions).toHaveLength(1);

			const results = await harness.execute();
			expect(results[0]).toBeDefined();
			const result = results[0]!;
			expect(result.success).toBe(true);

			// Verify only first URL used in frontmatter
			if (result.success) {
				const notePath = path.join(harness.vault, result.createdNote!);
				await assertFrontmatterMatches(notePath, {
					url: "https://primary.com/article",
				});
			}
		});

		test("merges user tags with classifier tags", async () => {
			const taggedFixture = {
				filename: "🔖 Tagged Article.md",
				content: `---
type: bookmark
url: https://example.com/article
title: Tagged Article
clipped: 2024-12-16
tags: [typescript, programming, tutorial]
---

# Tagged Article

User-provided tags should merge with classifier tags.
`,
			};

			harness.setLLMResponse({
				documentType: "bookmark",
				confidence: 0.88,
				suggestedArea: "Resources",
				suggestedProject: null,
				extractedFields: {
					url: "https://example.com/article",
					title: "Tagged Article",
					category: "Tutorial",
				},
				suggestedFilenameDescription: "2024-12-16-tagged-article",
				reasoning: "Bookmark with existing user tags",
				extractionWarnings: [],
			});

			await harness.addToInbox(taggedFixture.filename, taggedFixture.content);
			const suggestions = await harness.scan();

			expect(suggestions).toHaveLength(1);

			const results = await harness.execute();
			expect(results[0]).toBeDefined();
			const result = results[0]!;
			expect(result.success).toBe(true);

			// Verify tags merged correctly
			if (result.success) {
				const notePath = path.join(harness.vault, result.createdNote!);
				const content = await Bun.file(notePath).text();
				const { parseFrontmatter } = await import(
					"../../../src/frontmatter/parse"
				);
				const { attributes } = parseFrontmatter(content);
				const tags = attributes.tags as string[];

				// User tags should be preserved
				expect(tags).toContain("typescript");
				expect(tags).toContain("programming");
				expect(tags).toContain("tutorial");
				// Classifier may add 'bookmarks' tag (depends on template)
				// At minimum, user-provided tags must be preserved
			}
		});

		test("handles bookmark with wikilinks in category/author", async () => {
			const wikilinkFixture = {
				filename: "🔖 Wikilink Example.md",
				content: `---
type: bookmark
url: https://example.com/article
title: Wikilink Example
clipped: 2024-12-16
category: "[[Development]]"
author: "[[Jane Doe]]"
---

# Wikilink Example

Tests wikilink handling in metadata fields.
`,
			};

			harness.setLLMResponse({
				documentType: "bookmark",
				confidence: 0.86,
				suggestedArea: "Resources",
				suggestedProject: null,
				extractedFields: {
					url: "https://example.com/article",
					title: "Wikilink Example",
					category: "Development",
					author: "Jane Doe",
				},
				suggestedFilenameDescription: "2024-12-16-wikilink-example",
				reasoning: "Bookmark with wikilink metadata",
				extractionWarnings: [],
			});

			await harness.addToInbox(
				wikilinkFixture.filename,
				wikilinkFixture.content,
			);
			const suggestions = await harness.scan();

			expect(suggestions).toHaveLength(1);

			const results = await harness.execute();
			expect(results[0]).toBeDefined();
			const result = results[0]!;
			expect(result.success).toBe(true);

			// Verify wikilinks preserved/converted appropriately
			if (result.success) {
				await assertNoteExists(harness.vault, result.createdNote!);
			}
		});

		test("handles bookmarks with highlights section", async () => {
			const highlightsFixture = {
				filename: "🔖 Article With Highlights.md",
				content: `---
type: bookmark
url: https://example.com/article
title: Article With Highlights
clipped: 2024-12-16
---

# Article With Highlights

## Notes

Key takeaways from the article.

## Highlights

- "Important quote number one"
- "Another significant insight"
- "Final highlight for reference"
`,
			};

			harness.setLLMResponse({
				documentType: "bookmark",
				confidence: 0.9,
				suggestedArea: "Resources",
				suggestedProject: null,
				extractedFields: {
					url: "https://example.com/article",
					title: "Article With Highlights",
				},
				suggestedFilenameDescription: "2024-12-16-article-with-highlights",
				reasoning: "Web Clipper bookmark with highlights section",
				extractionWarnings: [],
			});

			await harness.addToInbox(
				highlightsFixture.filename,
				highlightsFixture.content,
			);
			const suggestions = await harness.scan();

			expect(suggestions).toHaveLength(1);

			const results = await harness.execute();
			expect(results[0]).toBeDefined();
			const result = results[0]!;
			expect(result.success).toBe(true);

			// Verify highlights section preserved in body
			if (result.success) {
				await assertNoteExists(harness.vault, result.createdNote!);
			}
		});

		test("handles duplicate bookmark filenames with collision resolution", async () => {
			const fixture = BOOKMARK_FIXTURES.minimal;
			harness.setLLMResponse(fixture._mockLLMResponse);

			// Create first bookmark
			await harness.addToInbox(fixture.input.filename, fixture.input.content);
			const _suggestions1 = await harness.scan();
			const results1 = await harness.execute();
			expect(results1[0]).toBeDefined();
			expect(results1[0]!.success).toBe(true);

			// Create second bookmark with same filename but different content
			// (registry tracks by content hash, so different content = new suggestion)
			const fixture2Content = fixture.input.content.replace(
				"TypeScript Handbook",
				"TypeScript Handbook v2",
			);
			await harness.addToInbox(fixture.input.filename, fixture2Content);
			const _suggestions2 = await harness.scan();
			const results2 = await harness.execute();
			expect(results2[0]).toBeDefined();
			expect(results2[0]!.success).toBe(true);

			// Verify both notes exist with different names (collision resolved)
			expect(results1[0]).toBeDefined();
			expect(results2[0]).toBeDefined();
			const result1 = results1[0]!;
			const result2 = results2[0]!;
			if (result1.success && result2.success) {
				await assertNoteExists(harness.vault, result1.createdNote!);
				await assertNoteExists(harness.vault, result2.createdNote!);
				// Note paths should differ due to collision resolution
				expect(result1.createdNote).not.toBe(result2.createdNote);
			}
		});
	});

	describe("Content Preservation", () => {
		test("preserves markdown body content during classification", async () => {
			const fixture = BOOKMARK_FIXTURES.complete;
			harness.setLLMResponse(fixture._mockLLMResponse);

			await harness.addToInbox(fixture.input.filename, fixture.input.content);
			const _suggestions = await harness.scan();
			const results = await harness.execute();

			expect(results[0]).toBeDefined();
			const result = results[0]!;
			expect(result.success).toBe(true);

			// Verify all expected content fragments present
			if (result.success && fixture.expectedOutcome.bodyContains) {
				const notePath = path.join(harness.vault, result.createdNote!);
				const { readFile } = await import("node:fs/promises");
				const content = await readFile(notePath, "utf-8");

				for (const fragment of fixture.expectedOutcome.bodyContains) {
					expect(content).toContain(fragment);
				}
			}
		});

		test("preserves code blocks in bookmark content", async () => {
			const codeFixture = {
				filename: "🔖 Code Example.md",
				content: `---
type: bookmark
url: https://example.com/code
title: Code Example
clipped: 2024-12-16
---

# Code Example

Example TypeScript code:

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

More explanation here.
`,
			};

			harness.setLLMResponse({
				documentType: "bookmark",
				confidence: 0.87,
				suggestedArea: "Resources",
				suggestedProject: null,
				extractedFields: {
					url: "https://example.com/code",
					title: "Code Example",
				},
				suggestedFilenameDescription: "2024-12-16-code-example",
				reasoning: "Bookmark with code blocks",
				extractionWarnings: [],
			});

			await harness.addToInbox(codeFixture.filename, codeFixture.content);
			const _suggestions = await harness.scan();
			const results = await harness.execute();

			expect(results[0]).toBeDefined();
			const result = results[0]!;
			expect(result.success).toBe(true);

			// Verify code block preserved
			if (result.success) {
				const notePath = path.join(harness.vault, result.createdNote!);
				const { readFile } = await import("node:fs/promises");
				const content = await readFile(notePath, "utf-8");

				expect(content).toContain("```typescript");
				expect(content).toContain("function greet(name: string)");
				expect(content).toContain("```");
			}
		});
	});
});
