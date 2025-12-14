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
	priority: 100,

	heuristics: {
		filenamePatterns: [
			{ pattern: "invoice", weight: 1.0 },
			{ pattern: "receipt", weight: 0.9 },
			{ pattern: "statement", weight: 0.8 },
			{ pattern: "bill", weight: 0.8 },
			{ pattern: "tax", weight: 0.7 },
			{ pattern: "payment", weight: 0.6 },
			{ pattern: "remittance", weight: 0.6 },
		],
		contentMarkers: [
			{ pattern: "tax invoice", weight: 1.0 },
			{ pattern: "invoice", weight: 0.9 },
			{ pattern: "amount due", weight: 0.8 },
			{ pattern: "total", weight: 0.6 },
			{ pattern: "gst", weight: 0.7 },
			{ pattern: "abn", weight: 0.7 },
			{ pattern: "payment", weight: 0.5 },
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
		promptHint:
			"This is an invoice, receipt, or billing document. Extract financial details.",
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
