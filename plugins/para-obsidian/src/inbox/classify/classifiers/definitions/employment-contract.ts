/**
 * Employment Contract Classifier
 *
 * Detects and extracts data from employment contracts, contractor agreements,
 * service agreements, and other legal contracts.
 *
 * @module classifiers/definitions/employment-contract
 */

import type { InboxConverter } from "../types";

/**
 * Employment contract classifier for employment and service agreements
 */
export const employmentContractClassifier: InboxConverter = {
	schemaVersion: 1,
	id: "employment-contract",
	displayName: "Employment Contract",
	enabled: true,
	priority: 125, // High priority - contracts are important legal documents
	sourceOfTruth: "binary", // Type B: PDF is source of truth, keep as attachment

	heuristics: {
		filenamePatterns: [
			// Strong contract signals
			{ pattern: "contract", weight: 1.0 },
			{ pattern: "agreement", weight: 1.0 },
			{ pattern: "contractor", weight: 0.9 },
			{ pattern: "employment", weight: 0.8 },
			{ pattern: "service[- ]?agreement", weight: 0.9 },
			{ pattern: "terms[- ]?of[- ]?engagement", weight: 0.9 },
			{ pattern: "sow", weight: 0.7 }, // Statement of Work
			{ pattern: "msa", weight: 0.7 }, // Master Service Agreement
			{ pattern: "nda", weight: 0.8 }, // Non-Disclosure Agreement
		],
		contentMarkers: [
			// Contract structure markers
			{ pattern: "this agreement", weight: 0.9 },
			{ pattern: "the parties agree", weight: 0.9 },
			{ pattern: "terms and conditions", weight: 0.8 },
			{ pattern: "effective date", weight: 0.8 },
			{ pattern: "commencement date", weight: 0.8 },
			{ pattern: "termination", weight: 0.7 },
			{ pattern: "confidentiality", weight: 0.6 },
			{ pattern: "intellectual property", weight: 0.6 },
			{ pattern: "governing law", weight: 0.7 },
			{ pattern: "jurisdiction", weight: 0.6 },
			{ pattern: "indemnification", weight: 0.7 },
			{ pattern: "liability", weight: 0.5 },
			{ pattern: "warranty", weight: 0.5 },
			{ pattern: "schedule", weight: 0.4 },
			{ pattern: "executed", weight: 0.6 },
			{ pattern: "witness", weight: 0.5 },
			{ pattern: "daily rate", weight: 0.8 },
			{ pattern: "hourly rate", weight: 0.8 },
			{ pattern: "remuneration", weight: 0.7 },
			{ pattern: "abn", weight: 0.5 },
			{ pattern: "incorporated", weight: 0.6 },
		],
		threshold: 0.5,
	},

	fields: [
		{
			name: "title",
			type: "string",
			description: "Contract title (e.g., 'Contractor Agreement - Bunnings')",
			requirement: "required",
		},
		{
			name: "employer",
			type: "string",
			description: "Company/employer name",
			requirement: "required",
		},
		{
			name: "contractor",
			type: "string",
			description: "Contractor/employee name",
			requirement: "optional",
		},
		{
			name: "role",
			type: "string",
			description: "Position or role title",
			requirement: "optional",
		},
		{
			name: "start_date",
			type: "date",
			description: "Contract start date (YYYY-MM-DD)",
			requirement: "required",
		},
		{
			name: "end_date",
			type: "date",
			description: "Contract end date (YYYY-MM-DD)",
			requirement: "optional",
		},
		{
			name: "rate",
			type: "string",
			description: "Daily/hourly rate or salary",
			requirement: "optional",
		},
		{
			name: "area",
			type: "string",
			description: "PARA area (typically Career or Finances)",
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
		promptHint: `This is a CONTRACT or AGREEMENT document (employment, contractor, service agreement).

Extract:
- title: Descriptive title like "Contractor Agreement - [Company]" or "[Role] Contract - [Company]"
- employer: The company or organisation name (e.g., "Bunnings Group Limited")
- contractor: Your name or company name if this is a contractor agreement
- role: The position or role (e.g., "Senior Software Engineer", "Consultant")
- start_date: Contract start/commencement date (YYYY-MM-DD format)
- end_date: Contract end date if specified (YYYY-MM-DD format)
- rate: Daily rate, hourly rate, or salary if mentioned (e.g., "$1000/day", "$150,000 p.a.")

This is a Type B document - the PDF is the source of truth and will be kept as an attachment.
The note will reference the contract but not contain the full text.`,
		keyFields: ["employer", "start_date", "end_date"],
	},

	template: {
		name: "employment-contract",
		fieldMappings: {
			title: "Contract title",
			employer: "Company/employer name",
			contractor: "Contractor/employee name",
			role: "Position or role",
			start_date: "Start date (YYYY-MM-DD)",
			end_date: "End date (YYYY-MM-DD)",
			rate: "Rate or salary",
			area: "Area (leave empty if using project)",
			project: "Project (leave empty if using area)",
		},
	},

	scoring: {
		heuristicWeight: 0.5, // Filename signals are strong for contracts
		llmWeight: 0.5,
		highThreshold: 0.8,
		mediumThreshold: 0.55,
	},
};
