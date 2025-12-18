/**
 * Invoice Classifier
 *
 * Detects and extracts data from invoices, receipts, bills, statements, and tax invoices.
 *
 * @module classifiers/definitions/invoice
 */

import type { InboxConverter } from "../types";

/**
 * Invoice classifier for receipts, bills, statements, tax invoices
 */
export const invoiceClassifier: InboxConverter = {
	schemaVersion: 1,
	id: "invoice",
	displayName: "Invoice",
	enabled: true,
	priority: 120, // Higher than medical-statement (110) - "invoice" in filename is strong signal

	heuristics: {
		filenamePatterns: [
			{ pattern: "invoice", weight: 1.0 },
			{ pattern: "receipt", weight: 0.9 },
			{ pattern: "statement", weight: 0.5 }, // Lower weight - "statement" is generic, let specific classifiers win
			{ pattern: "bill", weight: 0.8 },
			{ pattern: "tax", weight: 0.7 },
			{ pattern: "payment", weight: 0.6 },
			{ pattern: "remittance", weight: 0.6 },
		],
		contentMarkers: [
			{ pattern: "tax invoice", weight: 1.0 },
			// "Invoice to:" at start of line (not "Invoices to" which appears in statements)
			{ pattern: "\\binvoice to:\\s", weight: 1.0 },
			{ pattern: "invoice #", weight: 1.0 }, // Invoice number reference
			{ pattern: "invoice number", weight: 1.0 },
			{ pattern: "invoice date", weight: 0.9 }, // Invoice-specific date field
			{ pattern: "amount due", weight: 0.8 },
			{ pattern: "total amount", weight: 0.8 }, // More specific than just "total"
			{ pattern: "unit price", weight: 0.8 }, // Line item pricing = invoice
			{ pattern: "quantity", weight: 0.7 }, // Line items with quantity = invoice
			{ pattern: "total", weight: 0.5 }, // Lower weight - too generic
			{ pattern: "gst", weight: 0.6 },
			{ pattern: "abn", weight: 0.5 }, // Lower - appears in statements too
			{ pattern: "payment due", weight: 0.8 }, // More specific than just "payment"
		],
		threshold: 0.3,
	},

	fields: [
		{
			name: "title",
			type: "string",
			description: "Invoice title/description",
			requirement: "required",
		},
		{
			name: "invoiceDate",
			type: "date",
			description: "Invoice date in YYYY-MM-DD format",
			requirement: "required",
		},
		{
			name: "provider",
			type: "string",
			description: "Provider/vendor name",
			requirement: "required",
		},
		{
			name: "amount",
			type: "currency",
			description: "Invoice amount (numeric)",
			requirement: "required",
		},
		{
			name: "currency",
			type: "string",
			description: "Currency code (AUD, USD, EUR)",
			requirement: "optional",
		},
		{
			name: "status",
			type: "string",
			description: "Payment status (unpaid/paid/pending)",
			requirement: "optional",
		},
		{
			name: "dueDate",
			type: "date",
			description: "Due date in YYYY-MM-DD format",
			requirement: "optional",
		},
		{
			name: "area",
			type: "string",
			description: "PARA area (e.g., Health, Finance)",
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
		promptHint: `This is an INVOICE requesting payment for specific services rendered.

CRITICAL DISTINCTION - Invoice vs Statement:
- INVOICE = A bill for specific services with "Amount Due", "Pay By" date, "Invoice #"
- STATEMENT = An account summary showing transaction history, "Previous Balance", "Statement Balance"

Choose "invoice" if the document:
- Has an Invoice Number or Tax Invoice header
- Lists specific services/items with individual prices
- Shows "Amount Due" or "Total Payable" for THIS document
- Has a "Due Date" or "Pay By" date
- Is requesting payment for a specific transaction

Do NOT choose "invoice" if the document:
- Shows "Previous Balance" and "Statement Balance" (that's a statement)
- Lists a period range like "Invoices from X to Y" (that's a statement)
- Is summarizing multiple past transactions (that's a statement)

Extract: provider name, invoice date (YYYY-MM-DD), amount (numeric only), currency code, invoice number if present. For medical providers, still use "invoice" type if it's a bill for specific services.`,
		keyFields: ["provider", "amount", "invoiceDate"],
	},

	template: {
		name: "invoice",
		fieldMappings: {
			// Primary keys
			title: "Invoice title",
			invoiceDate: "Invoice date (YYYY-MM-DD)",
			provider: "Provider name",
			amount: "Amount",
			currency: "Currency",
			status: "Status (unpaid/paid/pending)",
			dueDate: "Due date (YYYY-MM-DD)",
			area: "Area (leave empty if using project)",
			project: "Project (leave empty if using area)",
			// Aliases (LLM sometimes uses these variants)
			date: "Invoice date (YYYY-MM-DD)",
		},
	},

	scoring: {
		heuristicWeight: 0.3,
		llmWeight: 0.7,
		highThreshold: 0.85,
		mediumThreshold: 0.6,
	},
};
