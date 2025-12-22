/**
 * Letter/Correspondence Classifier
 *
 * Detects and extracts data from letters, correspondence, and formal communications.
 * Includes follow-up letters, thank you notes, formal requests, etc.
 *
 * @module classifiers/definitions/letter
 */

import type { InboxConverter } from "../types";

/**
 * Letter classifier for correspondence and formal communications
 */
export const letterClassifier: InboxConverter = {
	schemaVersion: 1,
	id: "letter",
	displayName: "Letter/Correspondence",
	enabled: true,
	priority: 118, // Higher than CV (115) - "letter" in filename should win over CV content signals
	sourceOfTruth: "markdown", // Type A: Extract to markdown, archive DOCX

	heuristics: {
		filenamePatterns: [
			// Letter patterns - but NOT "cover letter" (that's CV territory)
			{ pattern: "follow[- ]?up[- ]?letter", weight: 1.0 },
			{ pattern: "thank[- ]?you[- ]?letter", weight: 1.0 },
			{ pattern: "\\bletter\\b(?!.*cover)", weight: 0.9 }, // "letter" but not "cover letter"
			{ pattern: "correspondence", weight: 0.9 },
			{ pattern: "formal[- ]?request", weight: 0.8 },
			{ pattern: "inquiry", weight: 0.7 },
			{ pattern: "response", weight: 0.6 },
		],
		contentMarkers: [
			// Letter salutations and closings
			{ pattern: "^dear\\s", weight: 0.8 },
			{ pattern: "\\bhi\\s+\\w+,", weight: 0.7 }, // "Hi Name,"
			{ pattern: "kind regards", weight: 0.9 },
			{ pattern: "best regards", weight: 0.9 },
			{ pattern: "yours sincerely", weight: 0.9 },
			{ pattern: "yours faithfully", weight: 0.9 },
			{ pattern: "thank you for taking the time", weight: 0.8 },
			{ pattern: "thank you again", weight: 0.7 },
			{ pattern: "i wanted to follow up", weight: 0.9 },
			{ pattern: "following up on", weight: 0.8 },
			{ pattern: "please don't hesitate to reach out", weight: 0.8 },
			{ pattern: "please feel free to contact", weight: 0.8 },
			{ pattern: "i look forward to", weight: 0.7 },
			{ pattern: "i'd love the opportunity", weight: 0.7 },
		],
		threshold: 0.4,
	},

	fields: [
		{
			name: "title",
			type: "string",
			description: "Letter title/subject",
			requirement: "required",
		},
		{
			name: "recipient",
			type: "string",
			description: "Recipient name(s)",
			requirement: "required",
		},
		{
			name: "sender",
			type: "string",
			description: "Sender name",
			requirement: "optional",
		},
		{
			name: "date_sent",
			type: "date",
			description: "Letter date in YYYY-MM-DD format",
			requirement: "required",
		},
		{
			name: "regarding",
			type: "string",
			description: "Subject or purpose of the letter",
			requirement: "optional",
		},
		{
			name: "area",
			type: "string",
			description: "PARA area (e.g., Career, Finance)",
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
		promptHint: `This is a LETTER or formal correspondence document.

IMPORTANT: This is NOT a CV/resume. A letter is a communication TO someone, not a document ABOUT yourself.

Characteristics of a letter:
- Has a salutation (Dear X, Hi X)
- Has a closing (Kind regards, Best regards, Sincerely)
- Written in first person TO a recipient
- May be a follow-up, thank you, inquiry, or formal request

Extract:
- recipient: Who the letter is addressed to
- sender: Who wrote the letter (usually at the end)
- date_sent: The date on the letter (YYYY-MM-DD format)
- regarding: What the letter is about (e.g., "Job application follow-up")

For title, use format like "Letter to [Recipient] - [Subject]" or "Follow-up Letter - [Company]"`,
		keyFields: ["recipient", "date_sent", "regarding"],
	},

	template: {
		name: "letter",
		fieldMappings: {
			title: "Letter title",
			recipient: "Recipient name(s)",
			sender: "Sender name",
			date_sent: "Letter date (YYYY-MM-DD)",
			regarding: "Subject/purpose",
			area: "Area (leave empty if using project)",
			project: "Project (leave empty if using area)",
		},
	},

	scoring: {
		heuristicWeight: 0.5, // Filename "letter" is a strong signal
		llmWeight: 0.5,
		highThreshold: 0.8,
		mediumThreshold: 0.55,
	},
};
