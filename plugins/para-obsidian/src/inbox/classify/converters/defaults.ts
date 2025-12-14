import type { InboxConverter } from "./types";

/**
 * Invoice converter for receipts, bills, statements, tax invoices
 */
const INVOICE_CONVERTER: InboxConverter = {
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

/**
 * Booking converter for travel, accommodation, dining reservations
 */
const BOOKING_CONVERTER: InboxConverter = {
	schemaVersion: 1,
	id: "booking",
	displayName: "Booking",
	enabled: true,
	priority: 90,

	heuristics: {
		filenamePatterns: [
			{ pattern: "booking", weight: 1.0 },
			{ pattern: "reservation", weight: 1.0 },
			{ pattern: "itinerary", weight: 0.9 },
			{ pattern: "e-?ticket", weight: 0.9 },
			{ pattern: "boarding", weight: 0.8 },
			{ pattern: "confirmation", weight: 0.7 },
			{ pattern: "hotel", weight: 0.8 },
			{ pattern: "flight", weight: 0.8 },
			{ pattern: "airbnb", weight: 0.9 },
		],
		contentMarkers: [
			{ pattern: "booking confirmation", weight: 1.0 },
			{ pattern: "reservation", weight: 0.9 },
			{ pattern: "confirmation number", weight: 0.9 },
			{ pattern: "check-in", weight: 0.8 },
			{ pattern: "check-out", weight: 0.8 },
			{ pattern: "flight", weight: 0.7 },
			{ pattern: "hotel", weight: 0.7 },
			{ pattern: "passenger", weight: 0.7 },
			{ pattern: "guest", weight: 0.6 },
		],
		threshold: 0.3,
	},

	fields: [
		{
			name: "title",
			type: "string",
			description: "Booking title/description",
			requirement: "required",
		},
		{
			name: "bookingType",
			type: "string",
			description: "Type: accommodation/flight/activity/transport/dining",
			requirement: "required",
		},
		{
			name: "project",
			type: "string",
			description: "Related project (e.g., trip name)",
			requirement: "optional",
		},
		{
			name: "date",
			type: "date",
			description: "Booking/travel date in YYYY-MM-DD format",
			requirement: "required",
		},
		{
			name: "cost",
			type: "currency",
			description: "Total cost (numeric)",
			requirement: "optional",
		},
		{
			name: "currency",
			type: "string",
			description: "Currency code (AUD, USD, EUR)",
			requirement: "optional",
		},
		{
			name: "paymentStatus",
			type: "string",
			description: "Payment status (pending/paid/refunded/cancelled)",
			requirement: "optional",
		},
	],

	extraction: {
		promptHint:
			"This is a booking, reservation, or travel document. Extract booking details.",
		keyFields: ["title", "bookingType", "date"],
	},

	template: {
		name: "booking",
		fieldMappings: {
			title: "Booking title",
			bookingType:
				"Booking type (accommodation/flight/activity/transport/dining)",
			project: "Project",
			date: "Booking date (YYYY-MM-DD)",
			cost: "Cost (numeric only, e.g., 1850.00)",
			currency: "Currency (e.g., AUD, USD, EUR)",
			paymentStatus: "Payment status (pending/paid/refunded/cancelled)",
		},
	},

	scoring: {
		heuristicWeight: 0.3,
		llmWeight: 0.7,
		highThreshold: 0.85,
		mediumThreshold: 0.6,
	},
};

/**
 * Default inbox converters shipped with para-obsidian
 */
export const DEFAULT_INBOX_CONVERTERS: readonly InboxConverter[] = [
	INVOICE_CONVERTER,
	BOOKING_CONVERTER,
] as const;
