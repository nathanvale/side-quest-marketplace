/**
 * Clipping Classifier
 *
 * Detects and converts web clippings from Obsidian Web Clipper into bookmark format.
 * Clippings are raw captures with minimal metadata that need enrichment via Firecrawl.
 *
 * Conversion Strategy:
 * - Detects type:clipping frontmatter
 * - Flags for conversion to bookmark format
 * - Triggers Firecrawl enrichment for URL summary
 * - LLM suggests PARA destination based on URL patterns and content
 *
 * @module classifiers/definitions/clipping
 */

import type { InboxConverter } from "../types";

/**
 * Clipping classifier for web clippings captured via Obsidian Web Clipper
 *
 * @remarks
 * This classifier detects raw web clippings that need conversion to bookmark format.
 * Priority 75 is higher than bookmark (70) to catch clippings first.
 * After detection, clippings are converted to bookmarks with Firecrawl enrichment.
 */
export const clippingClassifier: InboxConverter = {
	schemaVersion: 1,
	id: "clipping",
	displayName: "Web Clipping",
	enabled: true,
	priority: 75, // Higher than bookmark (70) to catch clippings first

	heuristics: {
		filenamePatterns: [],
		contentMarkers: [
			{ pattern: "type:\\s*clipping\\b", weight: 1.0 },
			{ pattern: "url:\\s*https?://", weight: 0.9 },
			{ pattern: "clipped:\\s*\\d{4}-\\d{2}-\\d{2}", weight: 0.8 },
		],
		threshold: 0.3, // Optimized for content-only matching (no filename patterns)
	},

	fields: [
		{
			name: "title",
			type: "string",
			description: "Page title from web clipper",
			requirement: "required",
		},
		{
			name: "url",
			type: "string",
			description: "Original webpage URL",
			requirement: "required",
		},
		{
			name: "clipped",
			type: "date",
			description: "Date clipping was captured (YYYY-MM-DD format)",
			requirement: "required",
		},
	],

	extraction: {
		promptHint: `This is a web clipping that needs conversion to bookmark format.

Key fields to extract:
- title: Page title
- url: Full webpage URL
- clipped: Date captured (YYYY-MM-DD)

After extraction, this clipping will be:
1. Converted to bookmark format (type: bookmark)
2. Enriched via Firecrawl (fetch URL summary)
3. Classified into PARA destination

Suggest area or project based on URL patterns:
- Dev tools/docs → Development area
- Finance portals → Finance area
- Health/fitness → Health area
- Active projects → Specific project name
- General reference → Resources area`,
		keyFields: ["title", "url", "clipped"],
	},

	template: {
		name: "bookmark",
		fieldMappings: {
			title: "Bookmark title or page title",
			url: "Original webpage URL",
			clipped: "Date bookmark was captured (YYYY-MM-DD)",
		},
	},

	scoring: {
		heuristicWeight: 0.3,
		llmWeight: 0.7,
		highThreshold: 0.85,
		mediumThreshold: 0.6,
	},
};
