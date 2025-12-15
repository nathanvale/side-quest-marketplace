/**
 * Research Classifier
 *
 * Detects and processes research notes - documents for project-specific decisions
 * including trip planning, architecture decision records (ADRs), and tech choices.
 * These notes compare alternatives and document rationale.
 *
 * @module classifiers/definitions/research
 */

import type { InboxConverter } from "../types";

/**
 * Research classifier for decision-making notes with alternatives comparison
 */
export const researchClassifier: InboxConverter = {
	schemaVersion: 1,
	id: "research",
	displayName: "Research",
	enabled: true,
	priority: 85, // Below booking (90) to avoid conflicting with actual bookings

	heuristics: {
		filenamePatterns: [
			{ pattern: "research", weight: 1.0 },
			{ pattern: "📊", weight: 1.0 }, // Research emoji in filename
			{ pattern: "decision", weight: 0.9 },
			{ pattern: "comparison", weight: 0.9 },
			{ pattern: "options", weight: 0.8 },
			{ pattern: "alternatives", weight: 0.8 },
			{ pattern: "adr", weight: 0.9 }, // Architecture Decision Record
			{ pattern: "choice", weight: 0.7 },
			{ pattern: "evaluation", weight: 0.8 },
		],
		contentMarkers: [
			// Template structure markers (high weight)
			{ pattern: "type: research", weight: 1.0 }, // Frontmatter type field
			{ pattern: "status: researching", weight: 0.95 },
			{ pattern: "status: decided", weight: 0.95 },
			{ pattern: "status: superseded", weight: 0.95 },
			{ pattern: "## Considered Alternatives", weight: 1.0 },
			{ pattern: "## Decision", weight: 0.9 },
			{ pattern: "## Consequences", weight: 0.9 },
			{ pattern: "## Overview", weight: 0.7 },
			// Decision markers
			{ pattern: "Chosen:", weight: 0.9 },
			{ pattern: "Rationale:", weight: 0.9 },
			{ pattern: "Option 1:", weight: 0.8 },
			{ pattern: "Option 2:", weight: 0.8 },
			{ pattern: "### Option", weight: 0.85 },
			// Pros/cons structure (escaped markdown bold)
			{ pattern: "\\*\\*Pros:\\*\\*", weight: 0.85 },
			{ pattern: "\\*\\*Cons:\\*\\*", weight: 0.85 },
			{ pattern: "pros and cons", weight: 0.8 },
			{ pattern: "Trade-offs", weight: 0.8 },
			// Scoring matrix patterns (escaped pipe for regex)
			{ pattern: "⭐⭐⭐", weight: 0.85 }, // Star ratings
			{ pattern: "\\| Criteria \\|", weight: 0.8 }, // Scoring table header
			// General research terms
			{ pattern: "alternatives", weight: 0.7 },
			{ pattern: "comparison", weight: 0.7 },
			{ pattern: "evaluation", weight: 0.7 },
			{ pattern: "## Sources", weight: 0.6 },
		],
		threshold: 0.3,
	},

	fields: [
		{
			name: "title",
			type: "string",
			description: "Research title (e.g., 'Restaurant Choice for Anniversary')",
			requirement: "required",
		},
		{
			name: "project",
			type: "string",
			description: "Related project this research supports",
			requirement: "required",
		},
		{
			name: "status",
			type: "string",
			description: "Research status (researching/decided/superseded)",
			requirement: "optional",
			allowedValues: ["researching", "decided", "superseded"],
			validationPattern: "^(researching|decided|superseded)$",
		},
		{
			name: "date",
			type: "date",
			description: "Research date in YYYY-MM-DD format",
			requirement: "optional",
		},
		{
			name: "chosenOption",
			type: "string",
			description: "The decided option (if status is 'decided')",
			requirement: "conditional",
			conditionalOn: "status",
			conditionalDescription: "Required when status is 'decided'",
		},
	],

	extraction: {
		promptHint:
			"This is a research note for decision-making. It compares alternatives (with pros/cons or scoring matrix) and documents the chosen option with rationale. Extract the title, related project, and status. Status must be 'researching', 'decided', or 'superseded'.",
		keyFields: ["title", "project", "status"],
	},

	template: {
		name: "research",
		fieldMappings: {
			title:
				"Research title (e.g., 'Restaurant Choice for Anniversary' or 'Auth Strategy Decision')",
			project: "Project name",
			status: "Status (researching/decided/superseded)",
			date: "Research date (YYYY-MM-DD)",
			chosenOption: "Chosen option (if decided)",
		},
	},

	scoring: {
		heuristicWeight: 0.3,
		llmWeight: 0.7,
		highThreshold: 0.85,
		mediumThreshold: 0.6,
	},
};
