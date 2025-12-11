import { describe, expect, test } from "bun:test";
import { DEFAULT_INBOX_CONVERTERS } from "./defaults";
import {
	findBestConverter,
	mapFieldsToTemplate,
	mergeConverters,
	scoreContent,
	scoreFilename,
} from "./loader";
import type { InboxConverter } from "./types";

describe("scoreFilename", () => {
	test("returns 0 for no matching patterns", () => {
		const patterns = [{ pattern: "invoice", weight: 1.0 }];
		expect(scoreFilename("random-document.pdf", patterns)).toBe(0);
	});

	test("returns weight for matching pattern", () => {
		const patterns = [{ pattern: "invoice", weight: 0.9 }];
		expect(scoreFilename("invoice-001.pdf", patterns)).toBe(0.9);
	});

	test("returns highest weight when multiple patterns match", () => {
		const patterns = [
			{ pattern: "invoice", weight: 0.9 },
			{ pattern: "tax", weight: 0.7 },
		];
		expect(scoreFilename("tax-invoice-2024.pdf", patterns)).toBe(0.9);
	});

	test("is case-insensitive", () => {
		const patterns = [{ pattern: "INVOICE", weight: 1.0 }];
		expect(scoreFilename("invoice-001.pdf", patterns)).toBe(1.0);
	});

	test("handles regex patterns", () => {
		const patterns = [{ pattern: "e-?ticket", weight: 0.9 }];
		expect(scoreFilename("eticket.pdf", patterns)).toBe(0.9);
		expect(scoreFilename("e-ticket.pdf", patterns)).toBe(0.9);
	});

	test("skips invalid regex patterns", () => {
		const patterns = [
			{ pattern: "[invalid", weight: 1.0 },
			{ pattern: "valid", weight: 0.5 },
		];
		expect(scoreFilename("valid-doc.pdf", patterns)).toBe(0.5);
	});
});

describe("scoreContent", () => {
	test("returns 0 for no matching markers", () => {
		const markers = [{ pattern: "invoice", weight: 1.0 }];
		expect(scoreContent("random document content", markers)).toBe(0);
	});

	test("returns average of matched weights", () => {
		const markers = [
			{ pattern: "invoice", weight: 1.0 },
			{ pattern: "amount due", weight: 0.8 },
		];
		expect(scoreContent("This is an invoice with amount due", markers)).toBe(
			0.9,
		);
	});

	test("is case-insensitive", () => {
		const markers = [{ pattern: "TAX INVOICE", weight: 1.0 }];
		expect(scoreContent("this is a tax invoice", markers)).toBe(1.0);
	});

	test("caps score at 1.0", () => {
		const markers = [
			{ pattern: "a", weight: 0.8 },
			{ pattern: "b", weight: 0.9 },
			{ pattern: "c", weight: 0.95 },
		];
		const content = "a b c d e f";
		const score = scoreContent(content, markers);
		expect(score).toBeLessThanOrEqual(1.0);
	});
});

describe("findBestConverter", () => {
	test("returns null when no converters match", () => {
		const result = findBestConverter(
			DEFAULT_INBOX_CONVERTERS,
			"random-file.pdf",
			"some random content",
		);
		expect(result).toBeNull();
	});

	test("returns invoice converter for invoice filename", () => {
		const result = findBestConverter(
			DEFAULT_INBOX_CONVERTERS,
			"invoice-001.pdf",
			"",
		);
		expect(result).not.toBeNull();
		expect(result?.converter.id).toBe("invoice");
	});

	test("returns booking converter for booking filename", () => {
		const result = findBestConverter(
			DEFAULT_INBOX_CONVERTERS,
			"hotel-booking.pdf",
			"",
		);
		expect(result).not.toBeNull();
		expect(result?.converter.id).toBe("booking");
	});

	test("returns invoice converter for content with tax invoice", () => {
		const result = findBestConverter(
			DEFAULT_INBOX_CONVERTERS,
			"document.pdf",
			"TAX INVOICE\nAmount Due: $100\nGST: $10",
		);
		expect(result).not.toBeNull();
		expect(result?.converter.id).toBe("invoice");
	});

	test("returns booking converter for content with reservation", () => {
		const result = findBestConverter(
			DEFAULT_INBOX_CONVERTERS,
			"document.pdf",
			"Booking Confirmation\nCheck-in: 2024-01-15\nGuest: John Doe",
		);
		expect(result).not.toBeNull();
		expect(result?.converter.id).toBe("booking");
	});

	test("respects priority - invoice checked before booking", () => {
		// Invoice has priority 100, booking has 90
		// If both match, invoice should win
		const result = findBestConverter(
			DEFAULT_INBOX_CONVERTERS,
			"invoice-booking.pdf",
			"",
		);
		expect(result?.converter.id).toBe("invoice");
	});

	test("skips disabled converters", () => {
		const disabledConverters = DEFAULT_INBOX_CONVERTERS.map((c) =>
			c.id === "invoice" ? { ...c, enabled: false } : c,
		);
		const result = findBestConverter(disabledConverters, "invoice-001.pdf", "");
		expect(result).toBeNull();
	});
});

describe("mapFieldsToTemplate", () => {
	const invoiceConverter = DEFAULT_INBOX_CONVERTERS.find(
		(c) => c.id === "invoice",
	) as InboxConverter;

	test("maps LLM fields to Templater prompts", () => {
		const extractedFields = {
			title: "Medical Invoice",
			invoiceDate: "2024-01-15",
			provider: "Dr. Smith",
			amount: "150.00",
		};
		const mapped = mapFieldsToTemplate(extractedFields, invoiceConverter);

		expect(mapped["Invoice title"]).toBe("Medical Invoice");
		expect(mapped["Invoice date (YYYY-MM-DD)"]).toBe("2024-01-15");
		expect(mapped["Provider name"]).toBe("Dr. Smith");
		expect(mapped.Amount).toBe("150.00");
	});

	test("skips undefined and null values", () => {
		const extractedFields = {
			title: "Invoice",
			invoiceDate: undefined,
			provider: null,
		};
		const mapped = mapFieldsToTemplate(
			extractedFields as Record<string, unknown>,
			invoiceConverter,
		);

		expect(mapped["Invoice title"]).toBe("Invoice");
		expect(mapped["Invoice date (YYYY-MM-DD)"]).toBeUndefined();
		expect(mapped["Provider name"]).toBeUndefined();
	});

	test("converts non-string values to strings", () => {
		const extractedFields = {
			amount: 150.5,
		};
		const mapped = mapFieldsToTemplate(extractedFields, invoiceConverter);

		expect(mapped.Amount).toBe("150.5");
	});

	test("skips empty string values", () => {
		const extractedFields = {
			title: "",
			provider: "Dr. Smith",
		};
		const mapped = mapFieldsToTemplate(extractedFields, invoiceConverter);

		expect(mapped["Invoice title"]).toBeUndefined();
		expect(mapped["Provider name"]).toBe("Dr. Smith");
	});
});

describe("mergeConverters", () => {
	test("returns defaults when no overrides", () => {
		const result = mergeConverters(DEFAULT_INBOX_CONVERTERS, [], []);
		expect(result).toHaveLength(DEFAULT_INBOX_CONVERTERS.length);
		expect(result[0]?.id).toBe("invoice");
		expect(result[1]?.id).toBe("booking");
	});

	test("merges partial overrides into defaults", () => {
		const overrides = [
			{
				id: "invoice",
				priority: 50,
			},
		];
		const result = mergeConverters(DEFAULT_INBOX_CONVERTERS, overrides, []);

		const invoice = result.find((c) => c.id === "invoice");
		expect(invoice?.priority).toBe(50);
		// Other fields should be preserved
		expect(invoice?.displayName).toBe("Invoice");
		expect(invoice?.heuristics.filenamePatterns.length).toBeGreaterThan(0);
	});

	test("disables converters in disabled list", () => {
		const result = mergeConverters(DEFAULT_INBOX_CONVERTERS, [], ["invoice"]);
		expect(result.find((c) => c.id === "invoice")).toBeUndefined();
		expect(result.find((c) => c.id === "booking")).toBeDefined();
	});

	test("merges nested template config", () => {
		const overrides = [
			{
				id: "invoice",
				template: {
					name: "custom-invoice",
				},
			},
		];
		const result = mergeConverters(
			DEFAULT_INBOX_CONVERTERS,
			overrides as Array<Partial<InboxConverter> & { id: string }>,
			[],
		);

		const invoice = result.find((c) => c.id === "invoice");
		expect(invoice?.template.name).toBe("custom-invoice");
		// Field mappings should be preserved from default
		expect(
			Object.keys(invoice?.template.fieldMappings ?? {}).length,
		).toBeGreaterThan(0);
	});

	test("adds new converter from overrides", () => {
		const newConverter: InboxConverter = {
			id: "receipt",
			displayName: "Receipt",
			enabled: true,
			priority: 80,
			heuristics: {
				filenamePatterns: [{ pattern: "receipt", weight: 1.0 }],
				contentMarkers: [],
			},
			fields: [
				{ name: "title", type: "string", description: "Title", required: true },
			],
			extraction: { promptHint: "Extract receipt", keyFields: ["title"] },
			template: { name: "receipt", fieldMappings: { title: "Receipt title" } },
			scoring: {
				heuristicWeight: 0.3,
				llmWeight: 0.7,
				highThreshold: 0.85,
				mediumThreshold: 0.6,
			},
		};
		const result = mergeConverters(
			DEFAULT_INBOX_CONVERTERS,
			[newConverter],
			[],
		);

		expect(result.find((c) => c.id === "receipt")).toBeDefined();
		expect(result).toHaveLength(DEFAULT_INBOX_CONVERTERS.length + 1);
	});
});

describe("DEFAULT_INBOX_CONVERTERS", () => {
	test("has invoice converter", () => {
		const invoice = DEFAULT_INBOX_CONVERTERS.find((c) => c.id === "invoice");
		expect(invoice).toBeDefined();
		expect(invoice?.displayName).toBe("Invoice");
		expect(invoice?.priority).toBe(100);
		expect(invoice?.enabled).toBe(true);
	});

	test("has booking converter", () => {
		const booking = DEFAULT_INBOX_CONVERTERS.find((c) => c.id === "booking");
		expect(booking).toBeDefined();
		expect(booking?.displayName).toBe("Booking");
		expect(booking?.priority).toBe(90);
		expect(booking?.enabled).toBe(true);
	});

	test("invoice has correct field mappings", () => {
		const invoice = DEFAULT_INBOX_CONVERTERS.find((c) => c.id === "invoice");
		expect(invoice?.template.fieldMappings.title).toBe("Invoice title");
		expect(invoice?.template.fieldMappings.invoiceDate).toBe(
			"Invoice date (YYYY-MM-DD)",
		);
		expect(invoice?.template.fieldMappings.provider).toBe("Provider name");
	});

	test("booking has correct field mappings", () => {
		const booking = DEFAULT_INBOX_CONVERTERS.find((c) => c.id === "booking");
		expect(booking?.template.fieldMappings.title).toBe("Booking title");
		expect(booking?.template.fieldMappings.bookingType).toBe(
			"Booking type (accommodation/flight/activity/transport/dining)",
		);
		expect(booking?.template.fieldMappings.date).toBe(
			"Booking date (YYYY-MM-DD)",
		);
	});
});
