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
	schemaVersion: 3,
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
		],
		contentMarkers: [
			// EXCLUSIVE statement markers - these DO NOT appear in single invoices
			// These are the definitive signals that distinguish statements from invoices
			{ pattern: "account statement", weight: 1.0 }, // Header unique to statements
			{ pattern: "previous balance", weight: 1.0 }, // Only statements show running balance
			{ pattern: "statement balance", weight: 1.0 }, // Only statements have this
			{ pattern: "invoices from", weight: 1.0 }, // Date range = statement
			{ pattern: "invoices to", weight: 1.0 }, // Date range = statement
			{ pattern: "total invoiced", weight: 1.0 }, // Summary of multiple invoices

			// Strong medical indicators (also appear in invoices but help confirm medical context)
			{ pattern: "provider #", weight: 0.8 },
			{ pattern: "patient", weight: 0.7 },
			{ pattern: "practitioner", weight: 0.8 },
			{ pattern: "consultation", weight: 0.7 },
			{ pattern: "telehealth", weight: 0.7 },
			{ pattern: "appointment time", weight: 0.8 },
			{ pattern: "service:", weight: 0.6 },
			{ pattern: "item number", weight: 0.7 },

			// Australian medical billing
			{ pattern: "medicare", weight: 0.8 },
			{ pattern: "bulk bill", weight: 0.8 },
			{ pattern: "dor:", weight: 0.6 }, // Date of Referral
			{ pattern: "private health", weight: 0.6 },
			{ pattern: "health fund", weight: 0.6 },
			{ pattern: "gap payment", weight: 0.7 },
			{ pattern: "out of pocket", weight: 0.6 },

			// Financial markers
			{ pattern: "total payments", weight: 0.7 },

			// Australian business identifiers (lower weight - appear in both)
			{ pattern: "abn", weight: 0.4 },
			{ pattern: "bsb:", weight: 0.5 },
		],
		threshold: 0.3, // Same as invoice - let content scores decide
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
			description:
				"Type of medical statement (summary/detailed/single-appointment)",
			requirement: "optional",
			allowedValues: ["summary", "detailed", "single-appointment"],
			validationPattern: "^(summary|detailed|single-appointment)$",
		},
		{
			name: "providerNumber",
			type: "string",
			description:
				"Medicare provider number (format: 7 digits + letter, e.g., 0388478B)",
			requirement: "optional",
		},
		{
			name: "practitioner",
			type: "string",
			description: "Doctor/practitioner name",
			requirement: "conditional",
			conditionalOn: "totalInvoiced",
			conditionalDescription:
				"Required when there are consultation charges (totalInvoiced > 0)",
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
		// Payment details for bank transfers
		{
			name: "bsb",
			type: "string",
			description: "Bank BSB number for payment (format: XXX-XXX)",
			requirement: "optional",
		},
		{
			name: "accountNumber",
			type: "string",
			description: "Bank account number for payment",
			requirement: "optional",
		},
		// Consultation details
		{
			name: "consultationCount",
			type: "number",
			description: "Number of consultations/appointments in this statement",
			requirement: "optional",
		},
		{
			name: "consultations",
			type: "string",
			description:
				"Consultation details as markdown table with columns: Date, Service, Item Code, Amount. Each row is one appointment.",
			requirement: "optional",
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
		promptHint: `This is a medical ACCOUNT STATEMENT summarizing transactions over a period.

CRITICAL DISTINCTION - Statement vs Invoice:
- STATEMENT = Account summary showing "Previous Balance", "Statement Balance", transaction history over a period
- INVOICE = A bill for ONE specific service with "Amount Due", "Invoice #", "Pay By" date

Choose "medical-statement" if the document:
- Shows "Previous Balance" and "Statement Balance"
- Has a statement period (e.g., "Invoices from 01/09/2025 to 30/09/2025")
- Summarizes MULTIPLE past consultations/transactions
- Is an "Account Statement" (not a "Tax Invoice")
- Shows running totals: total invoiced, total payments, balance owing

Do NOT choose "medical-statement" if the document:
- Is a single Tax Invoice for one specific consultation
- Has "Invoice #" prominently displayed (that's an invoice)
- Shows "Amount Due" for THIS specific bill only (that's an invoice)
- Has no period range or previous balance (that's an invoice)

Extract: (1) Provider name, provider number (Medicare format: 7 digits + letter like 0388478B), patient details, statement period, and financial summary. (2) Payment details - look for BSB (format XXX-XXX) and account number (A/C). (3) Consultation table - extract each appointment as a markdown table row with Date, Service description, Item code (in parentheses like 306 or 91830), and Amount. Count the consultations. Set status to 'paid' if balance is 0, 'unpaid' if owing. Area should always be 'Health'. Statement type: 'summary' for period summaries, 'detailed' for itemized services, 'single-appointment' for single consultation.`,
		keyFields: [
			"provider",
			"providerNumber",
			"patient",
			"statementDate",
			"statementBalance",
			"status",
			"area",
			"statementType",
			"consultations",
		],
	},

	template: {
		name: "medical-statement",
		fieldMappings: {
			// Primary fields
			title: "Statement title",
			provider: "Medical practice name",
			providerNumber: "Provider number",
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
			// Payment details
			bsb: "BSB (XXX-XXX)",
			accountNumber: "Account number",
			// Consultation details
			consultationCount: "Number of consultations",
			consultations: "Consultation details (markdown table)",
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
