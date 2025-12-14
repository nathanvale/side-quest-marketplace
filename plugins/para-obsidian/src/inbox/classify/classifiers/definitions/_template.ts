/**
 * [Name] Classifier
 *
 * [Description of what this classifier detects]
 *
 * @module classifiers/definitions/[name]
 */

import type { InboxConverter } from "../types";

/**
 * [Name] classifier for [description]
 *
 * To create a new classifier:
 * 1. Copy this file to `[your-type].ts`
 * 2. Update all fields below
 * 3. Export from `index.ts`
 * 4. Create matching Obsidian template in vault Templates folder
 */
export const templateClassifier: InboxConverter = {
	// Schema version - do not change unless migrating
	schemaVersion: 1,

	// Unique identifier - used in code and as template name
	id: "template",

	// Human-readable name for UI display
	displayName: "Template",

	// Set to true to activate this classifier
	enabled: false, // Disabled by default - this is a template

	// Higher priority = checked first (range: 0-100)
	priority: 50,

	// Heuristic detection patterns
	heuristics: {
		// Patterns to match in filename (regex strings)
		filenamePatterns: [
			{ pattern: "keyword1", weight: 1.0 },
			{ pattern: "keyword2", weight: 0.8 },
		],
		// Patterns to match in document content
		contentMarkers: [
			{ pattern: "content marker 1", weight: 1.0 },
			{ pattern: "content marker 2", weight: 0.8 },
		],
		// Minimum score to trigger this classifier (0.0 to 1.0)
		threshold: 0.3,
	},

	// Field definitions for LLM extraction
	fields: [
		{
			name: "title",
			type: "string",
			description: "Document title/description",
			requirement: "required",
		},
		{
			name: "date",
			type: "date",
			description: "Document date in YYYY-MM-DD format",
			requirement: "required",
		},
		// Add more fields as needed:
		// Types: "string" | "date" | "currency" | "number"
		// Requirements: "required" | "optional" | "conditional"
	],

	// LLM extraction configuration
	extraction: {
		// Hint included in LLM prompt
		promptHint: "This is a [type] document. Extract [what to extract].",
		// Fields that boost confidence when successfully extracted
		keyFields: ["title", "date"],
	},

	// Template mapping configuration
	template: {
		// Template filename (without .md extension)
		name: "template",
		// Maps LLM field names to Templater prompt text
		fieldMappings: {
			title: "Document title",
			date: "Date (YYYY-MM-DD)",
			// Add mappings for all fields
		},
	},

	// Confidence scoring thresholds
	scoring: {
		// Weight for heuristic score (0.0 to 1.0)
		heuristicWeight: 0.3,
		// Weight for LLM score (0.0 to 1.0)
		llmWeight: 0.7,
		// Score threshold for HIGH confidence
		highThreshold: 0.85,
		// Score threshold for MEDIUM confidence
		mediumThreshold: 0.6,
	},
};
