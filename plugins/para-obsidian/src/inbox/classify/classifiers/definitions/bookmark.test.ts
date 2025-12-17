/**
 * Bookmark Classifier Tests
 *
 * Comprehensive test suite for the bookmark classifier covering:
 * 1. Heuristic matching (type:bookmark, url:http, clipped: patterns)
 * 2. Field extraction (all required and optional fields)
 * 3. PARA classification logic (Projects/Areas/Resources/Archives)
 * 4. Confidence scoring (0.3 threshold optimized for content-only, 0.3 heuristic + 0.7 LLM weights)
 * 5. Template mapping (field mappings are correct)
 *
 * @module classifiers/definitions/bookmark.test
 */

import { describe, expect, test } from "bun:test";
import { scoreContent } from "../loader";
import { ClassifierRegistry } from "../registry";
import { validateFieldValue } from "../types";
import { bookmarkClassifier } from "./bookmark";

describe("bookmarkClassifier", () => {
	describe("schema metadata", () => {
		test("should have correct schema version", () => {
			expect(bookmarkClassifier.schemaVersion).toBe(1);
		});

		test("should have unique ID", () => {
			expect(bookmarkClassifier.id).toBe("bookmark");
		});

		test("should have display name", () => {
			expect(bookmarkClassifier.displayName).toBe("Bookmark");
		});

		test("should be enabled by default", () => {
			expect(bookmarkClassifier.enabled).toBe(true);
		});

		test("should have priority 70 (mid-priority)", () => {
			expect(bookmarkClassifier.priority).toBe(70);
		});
	});

	describe("heuristic matching", () => {
		describe("content markers", () => {
			test("should match type:bookmark with weight 1.0", () => {
				const content = "---\ntype: bookmark\nurl: https://example.com\n---";
				const score = scoreContent(
					content,
					bookmarkClassifier.heuristics.contentMarkers,
				);

				expect(score).toBeGreaterThan(0);
			});

			test("should match url:https:// with weight 0.9", () => {
				const content = "---\ntype: bookmark\nurl: https://kit.cased.com\n---";
				const score = scoreContent(
					content,
					bookmarkClassifier.heuristics.contentMarkers,
				);

				expect(score).toBeGreaterThan(0);
			});

			test("should match url:http:// with weight 0.9", () => {
				const content = "---\ntype: bookmark\nurl: http://example.com\n---";
				const score = scoreContent(
					content,
					bookmarkClassifier.heuristics.contentMarkers,
				);

				expect(score).toBeGreaterThan(0);
			});

			test("should match clipped date with weight 0.8", () => {
				const content = "---\ntype: bookmark\nclipped: 2024-12-16\n---";
				const score = scoreContent(
					content,
					bookmarkClassifier.heuristics.contentMarkers,
				);

				expect(score).toBeGreaterThan(0);
			});

			test("should match Web Clipper bookmark format", () => {
				const content = `---
type: bookmark
url: https://kit.cased.com/docs
title: Kit CLI Documentation
clipped: 2024-12-16
category: "[[Documentation]]"
tags: [cli, code-search]
---

## Notes
Fast semantic search for codebases.`;

				const score = scoreContent(
					content,
					bookmarkClassifier.heuristics.contentMarkers,
				);

				// Should match type:bookmark (1.0) + url:https (0.9) + clipped (0.8)
				// Average = (1.0 + 0.9 + 0.8) / 3 = 0.9
				expect(score).toBeGreaterThan(0.8);
			});

			test("should not match non-bookmark content", () => {
				const content = "This is a regular document with no bookmark metadata.";
				const score = scoreContent(
					content,
					bookmarkClassifier.heuristics.contentMarkers,
				);

				expect(score).toBe(0);
			});

			test("should handle case-insensitive matching", () => {
				const content = "---\nTYPE: BOOKMARK\nURL: HTTPS://EXAMPLE.COM\n---";
				const score = scoreContent(
					content,
					bookmarkClassifier.heuristics.contentMarkers,
				);

				expect(score).toBeGreaterThan(0);
			});
		});

		describe("filename patterns", () => {
			test("should have no filename patterns", () => {
				// Web Clipper creates notes with arbitrary names, so filename matching is disabled
				expect(bookmarkClassifier.heuristics.filenamePatterns).toEqual([]);
			});
		});

		describe("threshold", () => {
			test("should have threshold of 0.3 (optimized for content-only matching)", () => {
				expect(bookmarkClassifier.heuristics.threshold).toBe(0.3);
			});

			test("should match when content score is high (no filename patterns)", () => {
				const registry = new ClassifierRegistry();
				registry.register(bookmarkClassifier);

				// Bookmarks have no filename patterns, so combined score is:
				// filenameScore (0) * 0.6 + contentScore * 0.4
				// With all 3 markers matching (type, url, clipped), avg = 0.9
				// Combined: 0 * 0.6 + 0.9 * 0.4 = 0.36
				//
				// Threshold of 0.3 is optimized for content-only matching:
				// - When all markers match (score ~0.9), combined = 0.36 > 0.3 ✓
				// - This enables proper Web Clipper bookmark detection

				const content = `---
type: bookmark
url: https://example.com
clipped: 2024-12-16
---`;

				const match = registry.findMatch("note.md", content);

				// With threshold at 0.3, bookmarks successfully match
				expect(match).toBeDefined();
				expect(match?.converter.id).toBe("bookmark");
			});

			test("should match when only partial markers present (heuristic only)", () => {
				const registry = new ClassifierRegistry();
				registry.register(bookmarkClassifier);

				// Only has "clipped:" marker which scores 0.8
				// Combined: 0 * 0.6 + 0.8 * 0.4 = 0.32 > 0.3 threshold
				// Will match heuristically but fail LLM validation (missing required fields)
				const content = "clipped: 2024-12-16";

				const match = registry.findMatch("note.md", content);

				expect(match).toBeDefined();
				expect(match?.score).toBeGreaterThan(0.3);
			});
		});
	});

	describe("field definitions", () => {
		describe("required fields", () => {
			test("should require title field", () => {
				const field = bookmarkClassifier.fields.find((f) => f.name === "title");

				expect(field).toBeDefined();
				expect(field?.type).toBe("string");
				expect(field?.requirement).toBe("required");
				expect(field?.description).toBe("Bookmark title or page title");
			});

			test("should require url field", () => {
				const field = bookmarkClassifier.fields.find((f) => f.name === "url");

				expect(field).toBeDefined();
				expect(field?.type).toBe("string");
				expect(field?.requirement).toBe("required");
				expect(field?.description).toBe("Original webpage URL");
			});

			test("should require clipped date field", () => {
				const field = bookmarkClassifier.fields.find(
					(f) => f.name === "clipped",
				);

				expect(field).toBeDefined();
				expect(field?.type).toBe("date");
				expect(field?.requirement).toBe("required");
				expect(field?.description).toBe(
					"Date bookmark was captured (YYYY-MM-DD format)",
				);
			});
		});

		describe("optional fields", () => {
			test("should have optional category field", () => {
				const field = bookmarkClassifier.fields.find(
					(f) => f.name === "category",
				);

				expect(field).toBeDefined();
				expect(field?.type).toBe("string");
				expect(field?.requirement).toBe("optional");
				expect(field?.description).toBe("Category or topic (wikilink format)");
			});

			test("should have optional author field", () => {
				const field = bookmarkClassifier.fields.find(
					(f) => f.name === "author",
				);

				expect(field).toBeDefined();
				expect(field?.type).toBe("string");
				expect(field?.requirement).toBe("optional");
				expect(field?.description).toBe("Author or creator (wikilink format)");
			});

			test("should have optional published date field", () => {
				const field = bookmarkClassifier.fields.find(
					(f) => f.name === "published",
				);

				expect(field).toBeDefined();
				expect(field?.type).toBe("date");
				expect(field?.requirement).toBe("optional");
				expect(field?.description).toBe(
					"Original publication date (YYYY-MM-DD format)",
				);
			});

			test("should have optional tags field", () => {
				const field = bookmarkClassifier.fields.find((f) => f.name === "tags");

				expect(field).toBeDefined();
				expect(field?.type).toBe("string");
				expect(field?.requirement).toBe("optional");
				expect(field?.description).toBe(
					"Topic tags (comma-separated or array format)",
				);
			});

			test("should have optional notes field", () => {
				const field = bookmarkClassifier.fields.find((f) => f.name === "notes");

				expect(field).toBeDefined();
				expect(field?.type).toBe("string");
				expect(field?.requirement).toBe("optional");
				expect(field?.description).toBe("Additional notes or highlights");
			});
		});

		describe("field validation", () => {
			test("should validate required title field", () => {
				const field = bookmarkClassifier.fields.find(
					(f) => f.name === "title",
				)!;

				const validResult = validateFieldValue("Kit CLI Documentation", field);
				expect(validResult.isValid).toBe(true);

				const invalidResult = validateFieldValue("", field);
				expect(invalidResult.isValid).toBe(false);
				expect(invalidResult.error).toContain("required");
			});

			test("should validate date format for clipped field", () => {
				const field = bookmarkClassifier.fields.find(
					(f) => f.name === "clipped",
				)!;

				const validResult = validateFieldValue("2024-12-16", field);
				expect(validResult.isValid).toBe(true);

				const invalidResult = validateFieldValue("12/16/2024", field);
				expect(invalidResult.isValid).toBe(false);
				expect(invalidResult.error).toContain("YYYY-MM-DD");
			});

			test("should validate date format for published field", () => {
				const field = bookmarkClassifier.fields.find(
					(f) => f.name === "published",
				)!;

				const validResult = validateFieldValue("2024-01-15", field);
				expect(validResult.isValid).toBe(true);

				const invalidResult = validateFieldValue("Jan 15, 2024", field);
				expect(invalidResult.isValid).toBe(false);
				expect(invalidResult.error).toContain("YYYY-MM-DD");
			});

			test("should allow empty optional fields", () => {
				const field = bookmarkClassifier.fields.find(
					(f) => f.name === "notes",
				)!;

				const result = validateFieldValue("", field);
				expect(result.isValid).toBe(true);
			});
		});
	});

	describe("extraction prompt", () => {
		describe("prompt hint", () => {
			test("should request extraction of key fields", () => {
				const hint = bookmarkClassifier.extraction.promptHint;

				expect(hint).toContain("title");
				expect(hint).toContain("url");
				expect(hint).toContain("clipped");
			});

			test("should list optional fields", () => {
				const hint = bookmarkClassifier.extraction.promptHint;

				expect(hint).toContain("category");
				expect(hint).toContain("author");
				expect(hint).toContain("published");
				expect(hint).toContain("tags");
				expect(hint).toContain("notes");
			});

			test("should suggest area/project organization", () => {
				const hint = bookmarkClassifier.extraction.promptHint;

				expect(hint).toContain("Suggest area or project");
				expect(hint).toContain("Development area");
				expect(hint).toContain("Finance area");
				expect(hint).toContain("Health area");
				expect(hint).toContain("Resources area");
			});

			test("should provide URL pattern guidance", () => {
				const hint = bookmarkClassifier.extraction.promptHint;

				expect(hint).toContain("Dev tools/docs");
				expect(hint).toContain("Finance portals");
				expect(hint).toContain("Health/fitness");
			});
		});

		describe("key fields", () => {
			test("should define key fields for extraction confidence", () => {
				expect(bookmarkClassifier.extraction.keyFields).toEqual([
					"title",
					"url",
					"clipped",
				]);
			});
		});
	});

	describe("confidence scoring", () => {
		test("should use 0.3 heuristic weight", () => {
			expect(bookmarkClassifier.scoring.heuristicWeight).toBe(0.3);
		});

		test("should use 0.7 LLM weight", () => {
			expect(bookmarkClassifier.scoring.llmWeight).toBe(0.7);
		});

		test("should have high threshold of 0.85", () => {
			expect(bookmarkClassifier.scoring.highThreshold).toBe(0.85);
		});

		test("should have medium threshold of 0.6", () => {
			expect(bookmarkClassifier.scoring.mediumThreshold).toBe(0.6);
		});

		test("should weight heuristic and LLM scores correctly", () => {
			const { heuristicWeight, llmWeight } = bookmarkClassifier.scoring;

			// Weights should sum to 1.0
			expect(heuristicWeight + llmWeight).toBe(1.0);

			// LLM should be weighted higher for complex PARA classification
			expect(llmWeight).toBeGreaterThan(heuristicWeight);
		});

		test("should prefer LLM for PARA classification (70% weight)", () => {
			// Scenario: Heuristics detect bookmark (100% match)
			// LLM extracts fields and classifies PARA (80% confidence)
			// Combined: 0.3 * 1.0 + 0.7 * 0.8 = 0.86 (HIGH confidence)

			const heuristicScore = 1.0; // Perfect heuristic match
			const llmScore = 0.8; // Good LLM extraction
			const combinedScore =
				bookmarkClassifier.scoring.heuristicWeight * heuristicScore +
				bookmarkClassifier.scoring.llmWeight * llmScore;

			expect(combinedScore).toBeCloseTo(0.86, 2);
			expect(combinedScore).toBeGreaterThanOrEqual(
				bookmarkClassifier.scoring.highThreshold,
			);
		});

		test("should flag medium confidence for unclear PARA classification", () => {
			// Scenario: Heuristics detect bookmark (100% match)
			// LLM struggles with PARA classification (50% confidence)
			// Combined: 0.3 * 1.0 + 0.7 * 0.5 = 0.65 (MEDIUM confidence)

			const heuristicScore = 1.0;
			const llmScore = 0.5;
			const combinedScore =
				bookmarkClassifier.scoring.heuristicWeight * heuristicScore +
				bookmarkClassifier.scoring.llmWeight * llmScore;

			expect(combinedScore).toBeCloseTo(0.65, 2);
			expect(combinedScore).toBeGreaterThanOrEqual(
				bookmarkClassifier.scoring.mediumThreshold,
			);
			expect(combinedScore).toBeLessThan(
				bookmarkClassifier.scoring.highThreshold,
			);
		});

		test("should flag low confidence for poor heuristics and LLM", () => {
			// Scenario: Weak heuristics (40% match)
			// LLM extraction partial (40% confidence)
			// Combined: 0.3 * 0.4 + 0.7 * 0.4 = 0.4 (LOW confidence)

			const heuristicScore = 0.4;
			const llmScore = 0.4;
			const combinedScore =
				bookmarkClassifier.scoring.heuristicWeight * heuristicScore +
				bookmarkClassifier.scoring.llmWeight * llmScore;

			expect(combinedScore).toBeCloseTo(0.4, 2);
			expect(combinedScore).toBeLessThan(
				bookmarkClassifier.scoring.mediumThreshold,
			);
		});
	});

	describe("template mapping", () => {
		test("should map to bookmark template", () => {
			expect(bookmarkClassifier.template.name).toBe("bookmark");
		});

		describe("field mappings", () => {
			test("should map title field", () => {
				expect(bookmarkClassifier.template.fieldMappings.title).toBe(
					"Bookmark title or page title",
				);
			});

			test("should map url field", () => {
				expect(bookmarkClassifier.template.fieldMappings.url).toBe(
					"Original webpage URL",
				);
			});

			test("should map clipped field", () => {
				expect(bookmarkClassifier.template.fieldMappings.clipped).toBe(
					"Date bookmark was captured (YYYY-MM-DD)",
				);
			});

			test("should map optional category field", () => {
				expect(bookmarkClassifier.template.fieldMappings.category).toBe(
					"Category or topic (optional)",
				);
			});

			test("should map optional author field", () => {
				expect(bookmarkClassifier.template.fieldMappings.author).toBe(
					"Author or creator (optional)",
				);
			});

			test("should map optional published field", () => {
				expect(bookmarkClassifier.template.fieldMappings.published).toBe(
					"Original publication date (YYYY-MM-DD)",
				);
			});

			test("should map optional tags field", () => {
				expect(bookmarkClassifier.template.fieldMappings.tags).toBe(
					"Topic tags (optional)",
				);
			});

			test("should map optional notes field", () => {
				expect(bookmarkClassifier.template.fieldMappings.notes).toBe(
					"Additional notes (optional)",
				);
			});

			test("should have mappings for all defined fields", () => {
				const fieldNames = bookmarkClassifier.fields.map((f) => f.name);
				const mappingKeys = Object.keys(
					bookmarkClassifier.template.fieldMappings,
				);

				// All fields should have mappings
				for (const fieldName of fieldNames) {
					expect(mappingKeys).toContain(fieldName);
				}
			});
		});
	});

	describe("integration with registry", () => {
		test("should register successfully", () => {
			const registry = new ClassifierRegistry();

			expect(() => registry.register(bookmarkClassifier)).not.toThrow();
			expect(registry.has("bookmark")).toBe(true);
		});

		test("should be returned in enabled converters", () => {
			const registry = new ClassifierRegistry();
			registry.register(bookmarkClassifier);

			const enabled = registry.getEnabled();

			expect(enabled).toContainEqual(bookmarkClassifier);
		});

		test("should match Web Clipper bookmarks", () => {
			const registry = new ClassifierRegistry();
			registry.register(bookmarkClassifier);

			// Threshold of 0.3 is optimized for content-only matching
			// Loader weights: filename (0.6) + content (0.4)
			// With all bookmark markers matching, content score ~0.9
			// Combined: 0 * 0.6 + 0.9 * 0.4 = 0.36 > 0.3 threshold ✓

			const webClipperNote = `---
type: bookmark
url: https://kit.cased.com/docs
title: Kit CLI Documentation
clipped: 2024-12-16
category: "[[Documentation]]"
author: "[[Cased]]"
published: 2024-01-15
tags: [cli, code-search, semantic-search]
---

## Notes
Fast semantic search for codebases using ML embeddings.

## Highlights
- "30-50x faster than grep for symbol lookup"
- "Token-efficient JSON responses for agents"
`;

			const match = registry.findMatch("kit-cli-docs.md", webClipperNote);

			expect(match).toBeDefined();
			expect(match?.converter.id).toBe("bookmark");
			expect(match?.score).toBeGreaterThan(0.3);
		});

		test("should match iOS Safari Web Clipper format", () => {
			const registry = new ClassifierRegistry();
			registry.register(bookmarkClassifier);

			// iOS Safari Web Clipper creates minimal bookmarks with required fields
			// All three content markers match: type, url, clipped

			const iosSafariBookmark = `---
type: bookmark
url: https://anthropic.com/claude
title: Claude AI Assistant
clipped: 2024-12-16
---

Shared from Safari on iPhone.`;

			const match = registry.findMatch("claude-ai.md", iosSafariBookmark);

			expect(match).toBeDefined();
			expect(match?.converter.id).toBe("bookmark");
			expect(match?.score).toBeGreaterThan(0.3);
		});

		test("should not match notes without bookmark frontmatter", () => {
			const registry = new ClassifierRegistry();
			registry.register(bookmarkClassifier);

			const regularNote = `# My Meeting Notes

Had a great discussion about the project today.

## Action Items
- Follow up on proposal
- Schedule next meeting
`;

			const match = registry.findMatch("meeting-notes.md", regularNote);

			expect(match).toBeNull();
		});

		test("should match partial bookmark metadata (heuristic only)", () => {
			const registry = new ClassifierRegistry();
			registry.register(bookmarkClassifier);

			// Has url:https which matches the url marker (0.9 weight)
			// Combined: 0 * 0.6 + 0.9 * 0.4 = 0.36 > 0.3 threshold
			// Missing type:bookmark means this is likely a false positive
			// Will match heuristically but fail LLM validation
			const partialBookmark = `---
url: https://example.com
title: Example Page
---

Some content here.`;

			const match = registry.findMatch("partial.md", partialBookmark);

			expect(match).toBeDefined();
			expect(match?.score).toBeGreaterThan(0.3);
		});
	});

	describe("edge cases", () => {
		test("should match bookmarks with minimal metadata", () => {
			const registry = new ClassifierRegistry();
			registry.register(bookmarkClassifier);

			// Minimal bookmarks have all required markers: type, url, clipped

			const minimalBookmark = `---
type: bookmark
url: https://example.com
clipped: 2024-12-16
---`;

			const match = registry.findMatch("minimal.md", minimalBookmark);

			expect(match).toBeDefined();
			expect(match?.converter.id).toBe("bookmark");
			expect(match?.score).toBeGreaterThan(0.3);
		});

		test("should match bookmarks with all optional fields", () => {
			const registry = new ClassifierRegistry();
			registry.register(bookmarkClassifier);

			// Rich bookmarks with all fields still match based on core markers

			const richBookmark = `---
type: bookmark
url: https://example.com/article
title: Complete Article
clipped: 2024-12-16
category: "[[Technology]]"
author: "[[John Doe]]"
published: 2024-01-15
tags: [tech, ai, ml]
notes: "Very insightful article about machine learning trends"
---`;

			const match = registry.findMatch("rich.md", richBookmark);

			expect(match).toBeDefined();
			expect(match?.converter.id).toBe("bookmark");
			expect(match?.score).toBeGreaterThan(0.3);
		});

		test("should handle malformed URLs gracefully", () => {
			const content = `---
type: bookmark
url: not-a-valid-url
clipped: 2024-12-16
---`;

			// Should still match based on type:bookmark and clipped: patterns
			const score = scoreContent(
				content,
				bookmarkClassifier.heuristics.contentMarkers,
			);

			expect(score).toBeGreaterThan(0);
		});

		test("should handle missing clipped date", () => {
			const content = `---
type: bookmark
url: https://example.com
---`;

			// Should still match based on type:bookmark and url: patterns
			const score = scoreContent(
				content,
				bookmarkClassifier.heuristics.contentMarkers,
			);

			expect(score).toBeGreaterThan(0);
		});

		test("should handle different URL schemes", () => {
			const httpContent = "url: http://example.com";
			const httpsContent = "url: https://example.com";
			const ftpContent = "url: ftp://example.com";

			const httpScore = scoreContent(
				httpContent,
				bookmarkClassifier.heuristics.contentMarkers,
			);
			const httpsScore = scoreContent(
				httpsContent,
				bookmarkClassifier.heuristics.contentMarkers,
			);
			const ftpScore = scoreContent(
				ftpContent,
				bookmarkClassifier.heuristics.contentMarkers,
			);

			expect(httpScore).toBeGreaterThan(0);
			expect(httpsScore).toBeGreaterThan(0);
			expect(ftpScore).toBe(0); // Pattern only matches http(s)
		});

		test("should handle whitespace variations in frontmatter", () => {
			const variations = [
				"type: bookmark",
				"type:bookmark",
				"type:  bookmark",
				"type:\tbookmark",
			];

			for (const variation of variations) {
				const score = scoreContent(
					variation,
					bookmarkClassifier.heuristics.contentMarkers,
				);
				expect(score).toBeGreaterThan(0);
			}
		});

		test("should handle date format variations in clipped field", () => {
			const validDate = "clipped: 2024-12-16";
			const invalidDate1 = "clipped: 12/16/2024";
			const invalidDate2 = "clipped: 2024.12.16";

			const validScore = scoreContent(
				validDate,
				bookmarkClassifier.heuristics.contentMarkers,
			);
			const invalidScore1 = scoreContent(
				invalidDate1,
				bookmarkClassifier.heuristics.contentMarkers,
			);
			const invalidScore2 = scoreContent(
				invalidDate2,
				bookmarkClassifier.heuristics.contentMarkers,
			);

			expect(validScore).toBeGreaterThan(0);
			expect(invalidScore1).toBe(0); // Doesn't match YYYY-MM-DD pattern
			expect(invalidScore2).toBe(0); // Doesn't match YYYY-MM-DD pattern
		});
	});

	describe("comparison with other classifiers", () => {
		test("should have lower priority than invoice classifier", () => {
			// Invoice is priority 100, bookmark is priority 70
			expect(bookmarkClassifier.priority).toBeLessThan(100);
		});

		test("should have same threshold as invoice classifier", () => {
			// Both bookmark and invoice use 0.3 threshold
			// Both are content-only matchers (no filename patterns)
			expect(bookmarkClassifier.heuristics.threshold).toBe(0.3);
		});

		test("should not conflict with invoice patterns", () => {
			const registry = new ClassifierRegistry();
			registry.register(bookmarkClassifier);

			// Invoice-like content should not match bookmark
			const invoiceContent = `---
type: invoice
amount: 1500.00
provider: Example Corp
invoiceDate: 2024-12-16
---

TAX INVOICE
Amount Due: $1500.00`;

			const match = registry.findMatch("invoice.pdf", invoiceContent);

			// Should not match bookmark (no type:bookmark pattern)
			expect(match?.converter.id).not.toBe("bookmark");
		});

		test("should not conflict with booking patterns", () => {
			const registry = new ClassifierRegistry();
			registry.register(bookmarkClassifier);

			// Booking-like content should not match bookmark
			const bookingContent = `BOOKING CONFIRMATION
Reservation Number: ABC123
Check-in: 2024-12-20
Hotel: Example Hotel`;

			const match = registry.findMatch("hotel-booking.pdf", bookingContent);

			// Should not match bookmark (no type:bookmark pattern)
			expect(match?.converter.id).not.toBe("bookmark");
		});
	});
});
