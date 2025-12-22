/**
 * CV/Resume Classifier
 *
 * Detects and extracts data from CVs, resumes, and professional profiles.
 *
 * @module classifiers/definitions/cv
 */

import type { InboxConverter } from "../types";

/**
 * CV classifier for resumes, CVs, and professional profiles
 */
export const cvClassifier: InboxConverter = {
	schemaVersion: 1,
	id: "cv",
	displayName: "CV/Resume",
	enabled: true,
	priority: 115, // High priority - CV in filename is a strong signal
	sourceOfTruth: "markdown", // Type A: Extract to markdown, archive DOCX

	heuristics: {
		filenamePatterns: [
			// Strong CV signals - match word boundaries OR separators (hyphen, underscore, dot)
			// \b doesn't treat - as boundary, so we use explicit patterns
			// Include \. to match before file extensions (e.g., "test-cv.docx")
			{ pattern: "(?:^|[\\s_-])cv(?:$|[\\s_.-])", weight: 1.0 },
			{ pattern: "(?:^|[\\s_-])resume(?:$|[\\s_.-])", weight: 1.0 },
			{ pattern: "curriculum[- ]?vitae", weight: 1.0 },
			// "cover letter" only - not just "letter" alone
			{ pattern: "cover[- ]letter", weight: 0.8 },
		],
		contentMarkers: [
			// CV structure markers
			{ pattern: "curriculum vitae", weight: 1.0 },
			{ pattern: "\\bresume\\b", weight: 0.9 },
			{ pattern: "work experience", weight: 0.9 },
			{ pattern: "professional experience", weight: 0.9 },
			{ pattern: "employment history", weight: 0.9 },
			{ pattern: "career summary", weight: 0.8 },
			{ pattern: "key highlights", weight: 0.7 },
			{ pattern: "qualifications", weight: 0.7 },
			{ pattern: "references available", weight: 0.8 },
			{ pattern: "key achievements", weight: 0.7 },
			// Lower weight for generic terms that appear in many docs
			{ pattern: "skills", weight: 0.4 },
			{ pattern: "education", weight: 0.4 },
			{ pattern: "linkedin", weight: 0.3 },
			{ pattern: "github", weight: 0.3 },
		],
		threshold: 0.5, // Higher threshold - need stronger signals
	},

	fields: [
		{
			name: "title",
			type: "string",
			description: "Document title (e.g., 'Nathan Vale CV 2025')",
			requirement: "required",
		},
		{
			name: "version",
			type: "string",
			description: "CV version identifier (e.g., '2025-v1')",
			requirement: "optional",
		},
		{
			name: "regarding",
			type: "string",
			description: "Target roles or purpose (e.g., 'Senior Engineer roles')",
			requirement: "optional",
		},
		{
			name: "area",
			type: "string",
			description: "PARA area (e.g., Career)",
			requirement: "optional",
		},
		{
			name: "project",
			type: "string",
			description: "Related project (e.g., job search project)",
			requirement: "optional",
		},
	],

	extraction: {
		promptHint: `This is a CV, resume, or cover letter document.

Extract:
- title: A descriptive title like "[Name] CV [Year]" or "[Name] Cover Letter - [Company]"
- version: Version identifier if apparent (e.g., "2025-v1")
- regarding: Target roles or purpose (e.g., "Senior Engineer roles", "Bunnings application")

The document content will be extracted as markdown and embedded directly in the note.
The original DOCX will be archived. Edit the markdown note directly, export to DOCX via pandoc when needed.`,
		keyFields: ["title", "regarding"],
	},

	template: {
		name: "cv",
		fieldMappings: {
			title: "Document title",
			version: "Version (e.g., 2025-v1)",
			regarding: "Target roles or purpose",
			area: "Area (leave empty if using project)",
			project: "Project (leave empty if using area)",
		},
	},

	scoring: {
		heuristicWeight: 0.4, // Filename is a strong signal for CVs
		llmWeight: 0.6,
		highThreshold: 0.85,
		mediumThreshold: 0.6,
	},
};
