/**
 * Bookmark Classifier
 *
 * Detects and extracts data from web bookmarks captured via Obsidian Web Clipper.
 * Classifies bookmarks into PARA categories based on URL patterns and content.
 *
 * Content-Only Matching Strategy:
 * - Loader combines filename (0.6 weight) + content (0.4 weight) scores
 * - Bookmarks have no filename patterns (Web Clipper generates generic names)
 * - Max combined score = content * 0.4 = 0.4 (when content score is 1.0)
 * - Threshold set to 0.3 to enable proper Web Clipper bookmark detection
 * - All three content markers must match for successful classification
 *
 * @module classifiers/definitions/bookmark
 */

import type { InboxConverter } from "../types";

/**
 * Bookmark classifier for web bookmarks captured via Obsidian Web Clipper
 *
 * @remarks
 * This classifier uses content-only matching with a threshold of 0.3.
 * Web Clipper bookmarks are detected by matching frontmatter patterns:
 * type:bookmark, url:https?://, and clipped:YYYY-MM-DD format.
 * See comprehensive test suite in bookmark.test.ts for details.
 */
export const bookmarkClassifier: InboxConverter = {
	schemaVersion: 1,
	id: "bookmark",
	displayName: "Bookmark",
	enabled: true,
	priority: 70,

	heuristics: {
		filenamePatterns: [],
		contentMarkers: [
			{ pattern: "type:\\s*bookmark", weight: 1.0 },
			{ pattern: "url:\\s*https?://", weight: 0.9 },
			{ pattern: "clipped:\\s*\\d{4}-\\d{2}-\\d{2}", weight: 0.8 },
		],
		threshold: 0.3, // Optimized for content-only matching (no filename patterns)
	},

	fields: [
		{
			name: "title",
			type: "string",
			description: "Bookmark title or page title",
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
			description: "Date bookmark was captured (YYYY-MM-DD format)",
			requirement: "required",
		},
		{
			name: "para",
			type: "string",
			description: "PARA classification (Projects/Areas/Resources/Archives)",
			requirement: "required",
			allowedValues: ["Projects", "Areas", "Resources", "Archives"],
		},
		{
			name: "category",
			type: "string",
			description: "Category or topic (wikilink format)",
			requirement: "optional",
		},
		{
			name: "author",
			type: "string",
			description: "Author or creator (wikilink format)",
			requirement: "optional",
		},
		{
			name: "published",
			type: "date",
			description: "Original publication date (YYYY-MM-DD format)",
			requirement: "optional",
		},
		{
			name: "tags",
			type: "string",
			description: "Topic tags (comma-separated or array format)",
			requirement: "optional",
		},
		{
			name: "notes",
			type: "string",
			description: "Additional notes or highlights",
			requirement: "optional",
		},
		{
			name: "template_version",
			type: "number",
			description: "Template version for migration tracking (defaults to 1)",
			requirement: "optional",
		},
	],

	extraction: {
		promptHint: `Classify this bookmark into PARA categories:

- Projects: Time-bound work
  - GitHub/GitLab repos with active issues/PRs
  - Project management tools
  - Recent (<30 days) work-related bookmarks

- Areas: Ongoing responsibilities
  - Banking/finance portals (netbank, paypal, stripe)
  - Health dashboards (strava, myfitnesspal)
  - Home management (homeassistant, recipes)
  - Account settings pages

- Resources: Reference material (DEFAULT)
  - Documentation (/docs/, /api/, /reference/)
  - Tutorials, guides, articles
  - Stack Overflow, MDN, dev.to
  - Learning resources

- Archives: Stale content
  - Created >180 days ago
  - Deprecated/archived URLs
  - Legacy documentation

Extract URL, title, clipped date, and determine PARA category with reasoning.`,
		keyFields: ["title", "url", "clipped", "para"],
	},

	template: {
		name: "bookmark",
		fieldMappings: {
			title: "Bookmark title or page title",
			url: "Original webpage URL",
			clipped: "Date bookmark was captured (YYYY-MM-DD)",
			para: "PARA classification (Projects/Areas/Resources/Archives)",
			category: "Category or topic (optional)",
			author: "Author or creator (optional)",
			published: "Original publication date (YYYY-MM-DD)",
			tags: "Topic tags (optional)",
			notes: "Additional notes (optional)",
			template_version: "Template version (defaults to 1)",
		},
	},

	scoring: {
		heuristicWeight: 0.3,
		llmWeight: 0.7,
		highThreshold: 0.85,
		mediumThreshold: 0.6,
	},
};
