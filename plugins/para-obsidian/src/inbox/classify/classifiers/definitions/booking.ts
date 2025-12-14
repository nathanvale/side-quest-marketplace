/**
 * Booking Classifier
 *
 * Detects and extracts data from travel bookings, accommodation reservations,
 * flight itineraries, and dining reservations.
 *
 * @module classifiers/definitions/booking
 */

import type { InboxConverter } from "../types";

/**
 * Booking classifier for travel, accommodation, dining reservations
 */
export const bookingClassifier: InboxConverter = {
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
