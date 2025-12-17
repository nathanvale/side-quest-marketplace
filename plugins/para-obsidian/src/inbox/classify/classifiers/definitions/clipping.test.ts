/**
 * Clipping Classifier Tests
 *
 * Comprehensive test suite for the clipping classifier covering:
 * 1. Heuristic matching (type:clipping, url:http, clipped: patterns)
 * 2. Field extraction (required fields only)
 * 3. Priority (higher than bookmark to catch clippings first)
 * 4. Conversion metadata (targetType: bookmark, requiresEnrichment: true)
 * 5. Template mapping (bookmark template for converted notes)
 *
 * @module classifiers/definitions/clipping.test
 */

import { describe, expect, test } from "bun:test";
import { scoreContent } from "../loader";
import { ClassifierRegistry } from "../registry";
import { validateFieldValue } from "../types";
import { bookmarkClassifier } from "./bookmark";
import { clippingClassifier } from "./clipping";

describe("clippingClassifier", () => {
	describe("schema metadata", () => {
		test("should have correct schema version", () => {
			expect(clippingClassifier.schemaVersion).toBe(1);
		});

		test("should have unique ID", () => {
			expect(clippingClassifier.id).toBe("clipping");
		});

		test("should have display name", () => {
			expect(clippingClassifier.displayName).toBe("Web Clipping");
		});

		test("should be enabled by default", () => {
			expect(clippingClassifier.enabled).toBe(true);
		});

		test("should have priority 75 (higher than bookmark)", () => {
			expect(clippingClassifier.priority).toBe(75);
			expect(clippingClassifier.priority).toBeGreaterThan(
				bookmarkClassifier.priority,
			);
		});
	});

	describe("heuristic matching", () => {
		describe("content markers", () => {
			test("should match type:clipping with weight 1.0", () => {
				const content = "---\ntype: clipping\nurl: https://example.com\n---";
				const score = scoreContent(
					content,
					clippingClassifier.heuristics.contentMarkers,
				);

				expect(score).toBeGreaterThan(0);
			});

			test("should match url:https:// with weight 0.9", () => {
				const content = "---\ntype: clipping\nurl: https://example.com\n---";
				const score = scoreContent(
					content,
					clippingClassifier.heuristics.contentMarkers,
				);

				expect(score).toBeGreaterThan(0);
			});

			test("should match url:http:// with weight 0.9", () => {
				const content = "---\ntype: clipping\nurl: http://example.com\n---";
				const score = scoreContent(
					content,
					clippingClassifier.heuristics.contentMarkers,
				);

				expect(score).toBeGreaterThan(0);
			});

			test("should match clipped date with weight 0.8", () => {
				const content = "---\ntype: clipping\nclipped: 2024-12-17\n---";
				const score = scoreContent(
					content,
					clippingClassifier.heuristics.contentMarkers,
				);

				expect(score).toBeGreaterThan(0);
			});

			test("should match Web Clipper clipping format", () => {
				const content = `---
type: clipping
url: https://anthropic.com/claude
title: Claude AI Assistant
clipped: 2024-12-17
---

Raw web page content captured by Web Clipper.`;

				const score = scoreContent(
					content,
					clippingClassifier.heuristics.contentMarkers,
				);

				// Should match type:clipping (1.0) + url:https (0.9) + clipped (0.8)
				// Average = (1.0 + 0.9 + 0.8) / 3 = 0.9
				expect(score).toBeGreaterThan(0.8);
			});

			test("should not match non-clipping content", () => {
				const content = "This is a regular document with no clipping metadata.";
				const score = scoreContent(
					content,
					clippingClassifier.heuristics.contentMarkers,
				);

				expect(score).toBe(0);
			});

			test("should handle case-insensitive matching", () => {
				const content = "---\nTYPE: CLIPPING\nURL: HTTPS://EXAMPLE.COM\n---";
				const score = scoreContent(
					content,
					clippingClassifier.heuristics.contentMarkers,
				);

				expect(score).toBeGreaterThan(0);
			});
		});

		describe("filename patterns", () => {
			test("should have no filename patterns", () => {
				// Web Clipper creates notes with arbitrary names, so filename matching is disabled
				expect(clippingClassifier.heuristics.filenamePatterns).toEqual([]);
			});
		});

		describe("threshold", () => {
			test("should have threshold of 0.3 (optimized for content-only matching)", () => {
				expect(clippingClassifier.heuristics.threshold).toBe(0.3);
			});

			test("should match when content score is high (no filename patterns)", () => {
				const registry = new ClassifierRegistry();
				registry.register(clippingClassifier);

				// Clippings have no filename patterns, so combined score is:
				// filenameScore (0) * 0.6 + contentScore * 0.4
				// With all 3 markers matching (type, url, clipped), avg = 0.9
				// Combined: 0 * 0.6 + 0.9 * 0.4 = 0.36
				//
				// Threshold of 0.3 is optimized for content-only matching:
				// - When all markers match (score ~0.9), combined = 0.36 > 0.3 ✓

				const content = `---
type: clipping
url: https://example.com
clipped: 2024-12-17
---`;

				const match = registry.findMatch("note.md", content);

				// With threshold at 0.3, clippings successfully match
				expect(match).toBeDefined();
				expect(match?.converter.id).toBe("clipping");
			});
		});

		describe("priority over bookmark classifier", () => {
			test("should match clippings before bookmarks (higher priority)", () => {
				const registry = new ClassifierRegistry();
				registry.register(bookmarkClassifier); // Priority 70
				registry.register(clippingClassifier); // Priority 75

				// This content matches both classifiers (type: clipping vs type: bookmark)
				// Higher priority wins
				const content = `---
type: clipping
url: https://example.com
clipped: 2024-12-17
---`;

				const match = registry.findMatch("note.md", content);

				expect(match).toBeDefined();
				expect(match?.converter.id).toBe("clipping");
			});

			test("should heuristically match bookmarks (shared url/clipped fields)", () => {
				const registry = new ClassifierRegistry();
				registry.register(clippingClassifier);

				// Bookmark content will match heuristically due to shared fields (url, clipped)
				// This is expected - LLM will determine final type from frontmatter
				const content = `---
type: bookmark
url: https://example.com
clipped: 2024-12-17
---`;

				const match = registry.findMatch("note.md", content);

				// Will match because url: and clipped: patterns are shared
				// Score: (0.9 + 0.8) / 2 = 0.85, combined: 0.85 * 0.4 = 0.34 > 0.3
				expect(match).toBeDefined();
				expect(match?.converter.id).toBe("clipping");
			});
		});
	});

	describe("field definitions", () => {
		describe("required fields", () => {
			test("should require title field", () => {
				const field = clippingClassifier.fields.find((f) => f.name === "title");

				expect(field).toBeDefined();
				expect(field?.type).toBe("string");
				expect(field?.requirement).toBe("required");
				expect(field?.description).toBe("Page title from web clipper");
			});

			test("should require url field", () => {
				const field = clippingClassifier.fields.find((f) => f.name === "url");

				expect(field).toBeDefined();
				expect(field?.type).toBe("string");
				expect(field?.requirement).toBe("required");
				expect(field?.description).toBe("Original webpage URL");
			});

			test("should require clipped date field", () => {
				const field = clippingClassifier.fields.find(
					(f) => f.name === "clipped",
				);

				expect(field).toBeDefined();
				expect(field?.type).toBe("date");
				expect(field?.requirement).toBe("required");
				expect(field?.description).toBe(
					"Date clipping was captured (YYYY-MM-DD format)",
				);
			});
		});

		describe("field count", () => {
			test("should have exactly 3 required fields (title, url, clipped)", () => {
				expect(clippingClassifier.fields).toHaveLength(3);

				const requiredFields = clippingClassifier.fields.filter(
					(f) => f.requirement === "required",
				);
				expect(requiredFields).toHaveLength(3);
			});

			test("should have no optional fields", () => {
				const optionalFields = clippingClassifier.fields.filter(
					(f) => f.requirement === "optional",
				);
				expect(optionalFields).toHaveLength(0);
			});
		});

		describe("field validation", () => {
			test("should validate required title field", () => {
				const field = clippingClassifier.fields.find(
					(f) => f.name === "title",
				)!;

				const validResult = validateFieldValue("Claude AI Assistant", field);
				expect(validResult.isValid).toBe(true);

				const invalidResult = validateFieldValue("", field);
				expect(invalidResult.isValid).toBe(false);
				expect(invalidResult.error).toContain("required");
			});

			test("should validate required url field", () => {
				const field = clippingClassifier.fields.find((f) => f.name === "url")!;

				const validResult = validateFieldValue(
					"https://anthropic.com/claude",
					field,
				);
				expect(validResult.isValid).toBe(true);

				const invalidResult = validateFieldValue("", field);
				expect(invalidResult.isValid).toBe(false);
				expect(invalidResult.error).toContain("required");
			});

			test("should validate date format for clipped field", () => {
				const field = clippingClassifier.fields.find(
					(f) => f.name === "clipped",
				)!;

				const validResult = validateFieldValue("2024-12-17", field);
				expect(validResult.isValid).toBe(true);

				const invalidResult = validateFieldValue("12/17/2024", field);
				expect(invalidResult.isValid).toBe(false);
				expect(invalidResult.error).toContain("YYYY-MM-DD");
			});
		});
	});

	describe("extraction prompt", () => {
		describe("prompt hint", () => {
			test("should mention conversion to bookmark format", () => {
				const hint = clippingClassifier.extraction.promptHint;

				expect(hint).toContain("web clipping");
				expect(hint).toContain("conversion to bookmark");
				expect(hint).toContain("type: bookmark");
			});

			test("should request extraction of key fields", () => {
				const hint = clippingClassifier.extraction.promptHint;

				expect(hint).toContain("title");
				expect(hint).toContain("url");
				expect(hint).toContain("clipped");
			});

			test("should describe enrichment workflow", () => {
				const hint = clippingClassifier.extraction.promptHint;

				expect(hint).toContain("Firecrawl");
				expect(hint).toContain("PARA destination");
			});

			test("should suggest area/project organization", () => {
				const hint = clippingClassifier.extraction.promptHint;

				expect(hint).toContain("Suggest area or project");
				expect(hint).toContain("Development area");
				expect(hint).toContain("Finance area");
				expect(hint).toContain("Health area");
				expect(hint).toContain("Resources area");
			});

			test("should provide URL pattern guidance", () => {
				const hint = clippingClassifier.extraction.promptHint;

				expect(hint).toContain("Dev tools/docs");
				expect(hint).toContain("Finance portals");
				expect(hint).toContain("Health/fitness");
			});
		});

		describe("key fields", () => {
			test("should define key fields for extraction confidence", () => {
				expect(clippingClassifier.extraction.keyFields).toEqual([
					"title",
					"url",
					"clipped",
				]);
			});
		});
	});

	describe("template mapping", () => {
		test("should map to bookmark template (conversion target)", () => {
			expect(clippingClassifier.template.name).toBe("bookmark");
		});

		describe("field mappings", () => {
			test("should map title field", () => {
				expect(clippingClassifier.template.fieldMappings.title).toBe(
					"Bookmark title or page title",
				);
			});

			test("should map url field", () => {
				expect(clippingClassifier.template.fieldMappings.url).toBe(
					"Original webpage URL",
				);
			});

			test("should map clipped field", () => {
				expect(clippingClassifier.template.fieldMappings.clipped).toBe(
					"Date bookmark was captured (YYYY-MM-DD)",
				);
			});

			test("should have mappings for all defined fields", () => {
				const fieldNames = clippingClassifier.fields.map((f) => f.name);
				const mappingKeys = Object.keys(
					clippingClassifier.template.fieldMappings,
				);

				// All fields should have mappings
				for (const fieldName of fieldNames) {
					expect(mappingKeys).toContain(fieldName);
				}
			});
		});
	});

	describe("confidence scoring", () => {
		test("should use 0.3 heuristic weight", () => {
			expect(clippingClassifier.scoring.heuristicWeight).toBe(0.3);
		});

		test("should use 0.7 LLM weight", () => {
			expect(clippingClassifier.scoring.llmWeight).toBe(0.7);
		});

		test("should have high threshold of 0.85", () => {
			expect(clippingClassifier.scoring.highThreshold).toBe(0.85);
		});

		test("should have medium threshold of 0.6", () => {
			expect(clippingClassifier.scoring.mediumThreshold).toBe(0.6);
		});

		test("should weight heuristic and LLM scores correctly", () => {
			const { heuristicWeight, llmWeight } = clippingClassifier.scoring;

			// Weights should sum to 1.0
			expect(heuristicWeight + llmWeight).toBe(1.0);

			// LLM should be weighted higher for PARA classification
			expect(llmWeight).toBeGreaterThan(heuristicWeight);
		});

		test("should prefer LLM for PARA classification (70% weight)", () => {
			// Scenario: Heuristics detect clipping (100% match)
			// LLM extracts fields and suggests PARA (80% confidence)
			// Combined: 0.3 * 1.0 + 0.7 * 0.8 = 0.86 (HIGH confidence)

			const heuristicScore = 1.0; // Perfect heuristic match
			const llmScore = 0.8; // Good LLM extraction
			const combinedScore =
				clippingClassifier.scoring.heuristicWeight * heuristicScore +
				clippingClassifier.scoring.llmWeight * llmScore;

			expect(combinedScore).toBeCloseTo(0.86, 2);
			expect(combinedScore).toBeGreaterThanOrEqual(
				clippingClassifier.scoring.highThreshold,
			);
		});

		test("should flag medium confidence for unclear PARA classification", () => {
			// Scenario: Heuristics detect clipping (100% match)
			// LLM struggles with PARA classification (50% confidence)
			// Combined: 0.3 * 1.0 + 0.7 * 0.5 = 0.65 (MEDIUM confidence)

			const heuristicScore = 1.0;
			const llmScore = 0.5;
			const combinedScore =
				clippingClassifier.scoring.heuristicWeight * heuristicScore +
				clippingClassifier.scoring.llmWeight * llmScore;

			expect(combinedScore).toBeCloseTo(0.65, 2);
			expect(combinedScore).toBeGreaterThanOrEqual(
				clippingClassifier.scoring.mediumThreshold,
			);
			expect(combinedScore).toBeLessThan(
				clippingClassifier.scoring.highThreshold,
			);
		});
	});

	describe("integration with registry", () => {
		test("should register successfully", () => {
			const registry = new ClassifierRegistry();

			expect(() => registry.register(clippingClassifier)).not.toThrow();
			expect(registry.has("clipping")).toBe(true);
		});

		test("should be returned in enabled converters", () => {
			const registry = new ClassifierRegistry();
			registry.register(clippingClassifier);

			const enabled = registry.getEnabled();

			expect(enabled).toContainEqual(clippingClassifier);
		});

		test("should match Web Clipper clippings", () => {
			const registry = new ClassifierRegistry();
			registry.register(clippingClassifier);

			const webClipperNote = `---
type: clipping
url: https://anthropic.com/claude
title: Claude AI Assistant
clipped: 2024-12-17
---

Raw content captured from web page.

Claude is an AI assistant created by Anthropic.`;

			const match = registry.findMatch("claude-ai.md", webClipperNote);

			expect(match).toBeDefined();
			expect(match?.converter.id).toBe("clipping");
			expect(match?.score).toBeGreaterThan(0.3);
		});

		test("should not match notes without clipping frontmatter", () => {
			const registry = new ClassifierRegistry();
			registry.register(clippingClassifier);

			const regularNote = `# My Meeting Notes

Had a great discussion about the project today.

## Action Items
- Follow up on proposal
- Schedule next meeting
`;

			const match = registry.findMatch("meeting-notes.md", regularNote);

			expect(match).toBeNull();
		});

		test("should heuristically match bookmarks (shared url/clipped fields)", () => {
			const registry = new ClassifierRegistry();
			registry.register(clippingClassifier);

			const bookmarkNote = `---
type: bookmark
url: https://example.com
title: Example Page
clipped: 2024-12-17
category: "[[Documentation]]"
---

Bookmark content with category and notes.`;

			const match = registry.findMatch("bookmark.md", bookmarkNote);

			// Will match heuristically because url: and clipped: patterns are shared
			// LLM will determine final type from frontmatter during classification
			expect(match).toBeDefined();
			expect(match?.converter.id).toBe("clipping");
		});
	});

	describe("edge cases", () => {
		test("should match clippings with minimal metadata", () => {
			const registry = new ClassifierRegistry();
			registry.register(clippingClassifier);

			const minimalClipping = `---
type: clipping
url: https://example.com
clipped: 2024-12-17
---`;

			const match = registry.findMatch("minimal.md", minimalClipping);

			expect(match).toBeDefined();
			expect(match?.converter.id).toBe("clipping");
			expect(match?.score).toBeGreaterThan(0.3);
		});

		test("should handle malformed URLs gracefully", () => {
			const content = `---
type: clipping
url: not-a-valid-url
clipped: 2024-12-17
---`;

			// Should still match based on type:clipping and clipped: patterns
			const score = scoreContent(
				content,
				clippingClassifier.heuristics.contentMarkers,
			);

			expect(score).toBeGreaterThan(0);
		});

		test("should handle missing clipped date", () => {
			const content = `---
type: clipping
url: https://example.com
---`;

			// Should still match based on type:clipping and url: patterns
			const score = scoreContent(
				content,
				clippingClassifier.heuristics.contentMarkers,
			);

			expect(score).toBeGreaterThan(0);
		});

		test("should handle different URL schemes", () => {
			const httpContent = "url: http://example.com";
			const httpsContent = "url: https://example.com";
			const ftpContent = "url: ftp://example.com";

			const httpScore = scoreContent(
				httpContent,
				clippingClassifier.heuristics.contentMarkers,
			);
			const httpsScore = scoreContent(
				httpsContent,
				clippingClassifier.heuristics.contentMarkers,
			);
			const ftpScore = scoreContent(
				ftpContent,
				clippingClassifier.heuristics.contentMarkers,
			);

			expect(httpScore).toBeGreaterThan(0);
			expect(httpsScore).toBeGreaterThan(0);
			expect(ftpScore).toBe(0); // Pattern only matches http(s)
		});

		test("should handle whitespace variations in frontmatter", () => {
			const variations = [
				"type: clipping",
				"type:clipping",
				"type:  clipping",
				"type:\tclipping",
			];

			for (const variation of variations) {
				const score = scoreContent(
					variation,
					clippingClassifier.heuristics.contentMarkers,
				);
				expect(score).toBeGreaterThan(0);
			}
		});

		test("should handle date format variations in clipped field", () => {
			const validDate = "clipped: 2024-12-17";
			const invalidDate1 = "clipped: 12/17/2024";
			const invalidDate2 = "clipped: 2024.12.17";

			const validScore = scoreContent(
				validDate,
				clippingClassifier.heuristics.contentMarkers,
			);
			const invalidScore1 = scoreContent(
				invalidDate1,
				clippingClassifier.heuristics.contentMarkers,
			);
			const invalidScore2 = scoreContent(
				invalidDate2,
				clippingClassifier.heuristics.contentMarkers,
			);

			expect(validScore).toBeGreaterThan(0);
			expect(invalidScore1).toBe(0); // Doesn't match YYYY-MM-DD pattern
			expect(invalidScore2).toBe(0); // Doesn't match YYYY-MM-DD pattern
		});
	});

	describe("comparison with bookmark classifier", () => {
		test("should have higher priority than bookmark classifier", () => {
			// Clipping is priority 75, bookmark is priority 70
			expect(clippingClassifier.priority).toBeGreaterThan(
				bookmarkClassifier.priority,
			);
		});

		test("should have same threshold as bookmark classifier", () => {
			// Both clipping and bookmark use 0.3 threshold
			// Both are content-only matchers (no filename patterns)
			expect(clippingClassifier.heuristics.threshold).toBe(
				bookmarkClassifier.heuristics.threshold,
			);
		});

		test("should have same scoring weights as bookmark classifier", () => {
			// Both should weight LLM higher for PARA classification
			expect(clippingClassifier.scoring).toEqual(bookmarkClassifier.scoring);
		});

		test("should map to same template as bookmark (conversion target)", () => {
			expect(clippingClassifier.template.name).toBe(
				bookmarkClassifier.template.name,
			);
		});

		test("should be checked before bookmark due to higher priority", () => {
			const registry = new ClassifierRegistry();
			registry.register(bookmarkClassifier); // Priority 70
			registry.register(clippingClassifier); // Priority 75

			const enabled = registry.getEnabled();

			// Clipping should come before bookmark in priority order
			const clippingIndex = enabled.findIndex((c) => c.id === "clipping");
			const bookmarkIndex = enabled.findIndex((c) => c.id === "bookmark");

			expect(clippingIndex).toBeLessThan(bookmarkIndex);
		});
	});
});
