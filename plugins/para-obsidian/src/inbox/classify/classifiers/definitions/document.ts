/**
 * Generic Document Classifier (Type B Fallback)
 *
 * Catches any DOCX or PDF files that don't match specific classifiers.
 * Uses binary source of truth - attachment stays as source, note is metadata.
 *
 * @module classifiers/definitions/document
 */

import type { InboxConverter } from "../types";

/**
 * Generic document classifier - fallback for unclassified DOCX/PDF files
 *
 * @remarks
 * This is a Type B classifier (binary source of truth):
 * - Original DOCX/PDF remains the source of truth
 * - Note contains only metadata + attachment reference
 * - Edit the original file directly, not the note
 * - Very low priority (10) to act as fallback only
 * - Minimal fields (title, area, project)
 */
export const documentClassifier: InboxConverter = {
	schemaVersion: 1,
	id: "generic",
	displayName: "Generic Document",
	enabled: true,
	priority: 10, // Very low - fallback only after specific classifiers
	sourceOfTruth: "binary", // Type B: attachment is source of truth

	heuristics: {
		filenamePatterns: [
			// Match any DOCX or PDF file - low weight so specific classifiers win
			// (invoice has "receipt" at 0.9, booking has "itinerary" at 0.9, etc.)
			{ pattern: "\\.docx$", weight: 0.1 },
			{ pattern: "\\.pdf$", weight: 0.1 },
		],
		contentMarkers: [],
		threshold: 0.1, // Always match DOCX/PDF files as fallback
	},

	fields: [
		{
			name: "title",
			type: "string",
			description: "Document title",
			requirement: "required",
		},
		{
			name: "area",
			type: "string",
			description: "PARA area",
			requirement: "optional",
		},
		{
			name: "project",
			type: "string",
			description: "Related project",
			requirement: "optional",
		},
	],

	extraction: {
		promptHint: `This is a document that couldn't be classified as a specific type.
Extract a descriptive title from the content.

The original file will remain as the source of truth.
Edit the original file directly when making changes.`,
		keyFields: ["title"],
	},

	template: {
		name: "document", // Uses document.md template
		fieldMappings: {
			title: "Document title",
			area: "Area",
			project: "Project",
		},
	},

	scoring: {
		heuristicWeight: 0.3,
		llmWeight: 0.7,
		highThreshold: 0.8,
		mediumThreshold: 0.5,
	},
};
