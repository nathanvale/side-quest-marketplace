/**
 * Medical Statement Classifier
 *
 * Detects and extracts data from medical provider account statements.
 * Designed for Australian medical billing statements with provider numbers,
 * ABN, invoice periods, and payment summaries.
 *
 * @module classifiers/definitions/medical-statement
 */

import type { InboxConverter } from "../types";

/**
 * Medical statement classifier for healthcare provider account statements
 */
export const medicalStatementClassifier: InboxConverter = {
	schemaVersion: 1,
	id: "medical-statement",
	displayName: "Medical Statement",
	enabled: true,
	priority: 110, // Higher than invoice (100) to match medical statements first

	heuristics: {
		filenamePatterns: [
			{ pattern: "medical", weight: 1.0 },
			{ pattern: "health", weight: 0.8 },
			{ pattern: "doctor", weight: 0.9 },
			{ pattern: "dr-", weight: 0.9 },
			{ pattern: "clinic", weight: 0.8 },
			{ pattern: "patient", weight: 0.9 },
			{ pattern: "statement", weight: 0.7 },
			{ pattern: "gp", weight: 0.8 },
			{ pattern: "specialist", weight: 0.9 },
			{ pattern: "pathology", weight: 0.9 },
			{ pattern: "radiology", weight: 0.9 },
			{ pattern: "invoice", weight: 0.6 },
		],
		contentMarkers: [
			// Strong medical indicators
			{ pattern: "account statement", weight: 0.8 },
			{ pattern: "provider #", weight: 1.0 },
			{ pattern: "patient", weight: 0.9 },
			{ pattern: "practitioner", weight: 1.0 },
			{ pattern: "consultation", weight: 0.9 },
			{ pattern: "telehealth", weight: 0.9 },
			{ pattern: "appointment time", weight: 1.0 },
			{ pattern: "service:", weight: 0.8 },
			{ pattern: "item number", weight: 0.9 },

			// Australian medical billing
			{ pattern: "medicare", weight: 0.9 },
			{ pattern: "bulk bill", weight: 0.9 },
			{ pattern: "dor:", weight: 0.8 }, // Date of Referral
			{ pattern: "private health", weight: 0.8 },
			{ pattern: "health fund", weight: 0.8 },
			{ pattern: "gap payment", weight: 0.9 },
			{ pattern: "out of pocket", weight: 0.8 },

			// Financial markers
			{ pattern: "previous balance", weight: 0.7 },
			{ pattern: "statement balance", weight: 0.8 },
			{ pattern: "total invoiced", weight: 0.8 },
			{ pattern: "total payments", weight: 0.7 },
			{ pattern: "invoices from", weight: 0.9 },
			{ pattern: "invoices to", weight: 0.9 },

			// Australian business identifiers
			{ pattern: "abn", weight: 0.5 },
			{ pattern: "bsb:", weight: 0.6 },
		],
		threshold: 0.5,
	},

	fields: [
		{
			name: "title",
			type: "string",
			description:
				"Statement title (e.g., 'Medical Statement - Dr Smith Oct 2025')",
			requirement: "required",
		},
		{
			name: "statementType",
			type: "string", 
			description: "Type of medical statement (summary/detailed/single-appointment)",
			requirement: "optional",
			allowedValues: ["summary", "detailed", "single-appointment"],
			validationPattern: "^(summary|detailed|single-appointment)$",
		},
		{
			name: "provider",
			type: "string",
			description: "Medical practice/provider name",
			requirement: "required",
		},
		{
			name: "practitioner",
			type: "string",
			description: "Doctor/practitioner name",
			requirement: "conditional",
			conditionalOn: "totalInvoiced",
			conditionalDescription: "Required when there are consultation charges (totalInvoiced > 0)",
		},
		{
			name: "patient",
			type: "string",
			description: "Patient name",
			requirement: "required",
		},
		{
			name: "statementDate",
			type: "date",
			description: "Statement date in YYYY-MM-DD format",
			requirement: "required",
		},
		{
			name: "periodStart",
			type: "date",
			description: "Invoice period start date in YYYY-MM-DD format",
			requirement: "optional",
		},
		{
			name: "periodEnd",
			type: "date",
			description: "Invoice period end date in YYYY-MM-DD format",
			requirement: "optional",
		},
		{
			name: "previousBalance",
			type: "currency",
			description: "Previous balance amount (numeric)",
			requirement: "optional",
		},
		{
			name: "totalInvoiced",
			type: "currency",
			description: "Total invoiced amount (numeric)",
			requirement: "optional",
		},
		{
			name: "totalPayments",
			type: "currency",
			description: "Total payments amount (numeric)",
			requirement: "optional",
		},
		{
			name: "statementBalance",
			type: "currency",
			description: "Statement balance/amount owing (numeric)",
			requirement: "required",
		},
		{
			name: "status",
			type: "string",
			description:
				"Payment status (paid/unpaid/pending) - derive from balance: paid if 0, unpaid if owing",
			requirement: "conditional",
			conditionalOn: "statementBalance",
			conditionalDescription:
				"Set to 'paid' when statementBalance is 0, 'unpaid' when owing",
			allowedValues: ["paid", "unpaid", "pending"],
			validationPattern: "^(paid|unpaid|pending)$",
		},
		{
			name: "area",
			type: "string",
			description:
				"PARA area - should always be 'Health' for medical statements",
			requirement: "required",
		},
	],

	extraction: {
		promptHint:
			"This is a medical account statement from a healthcare provider. Extract the provider name, patient details, statement period, and financial summary. The statement balance is the amount currently owing. Set status to 'paid' if balance is 0, 'unpaid' if there is an amount owing. Area should always be 'Health'. Determine the statement type: 'summary' for period summaries, 'detailed' for itemized services, 'single-appointment' for individual consultations.",
		keyFields: [
			"provider",
			"patient",
			"statementDate",
			"statementBalance",
			"status",
			"area",
			"statementType",
		],
	},

	template: {
		name: "medical-statement",
		fieldMappings: {
			// Primary fields
			title: "Statement title",
			provider: "Medical practice name",
			practitioner: "Doctor/practitioner name",
			patient: "Patient name",
			statementDate: "Statement date (YYYY-MM-DD)",
			periodStart: "Period start (YYYY-MM-DD)",
			periodEnd: "Period end (YYYY-MM-DD)",
			previousBalance: "Previous balance",
			totalInvoiced: "Total invoiced",
			totalPayments: "Total payments",
			statementBalance: "Statement balance (amount owing)",
			status: "Status (paid/unpaid/pending)",
			area: "Area (Health)",
			// Aliases
			date: "Statement date (YYYY-MM-DD)",
			amount: "Statement balance (amount owing)",
			balance: "Statement balance (amount owing)",
		},
	},

	scoring: {
		heuristicWeight: 0.3,
		llmWeight: 0.7,
		highThreshold: 0.85,
		mediumThreshold: 0.6,
	},
};
