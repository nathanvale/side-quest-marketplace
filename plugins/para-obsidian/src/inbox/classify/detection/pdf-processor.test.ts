import { afterEach, describe, expect, mock, test } from "bun:test";
import { InboxError } from "../../shared/errors";
import {
	checkPdfToText,
	detectByContent,
	detectByFilename,
	extractPdfText,
	type HeuristicResult,
} from "./pdf-processor";

// Test helper for consistent assertion pattern
function assertDetection(
	result: HeuristicResult,
	expectedType: string,
	expectedConfidence?: number,
) {
	expect(result.detected).toBe(true);
	expect(result.suggestedType).toBe(expectedType);
	expect(result.confidence).toBeGreaterThan(0);
	if (expectedConfidence !== undefined) {
		expect(result.confidence).toBeGreaterThanOrEqual(expectedConfidence);
	}
}

describe("inbox/pdf-processor", () => {
	afterEach(() => {
		// Restore all mocks (including mock.module calls)
		mock.restore();
	});

	describe("checkPdfToText", () => {
		test("should return available status and error message when not available", async () => {
			const result = await checkPdfToText();

			expect(result).toHaveProperty("available");
			expect(typeof result.available).toBe("boolean");

			if (!result.available) {
				expect(result.error).toBeDefined();
				expect(result.error).toContain("poppler");
			}
		});
	});

	describe("detectByFilename", () => {
		const invoicePatterns = [
			"invoice-001.pdf",
			"Invoice_December_2024.pdf",
			"TAX_INVOICE.pdf",
			"tax-invoice-quarterly.pdf",
			"receipt-amazon.pdf",
			"Receipt from Store.pdf",
		];

		test.each(invoicePatterns)("should detect invoice from: %s", (filename) => {
			const result = detectByFilename(filename);
			assertDetection(result, "invoice");
		});

		const bookingPatterns = [
			"booking-confirmation.pdf",
			"flight-booking.pdf",
			"Booking_REF_ABC123.pdf",
			"hotel-reservation.pdf",
			"reservation-hilton.pdf",
			"itinerary-december.pdf",
			"e-ticket.pdf",
			"boarding-pass.pdf",
		];

		test.each(bookingPatterns)("should detect booking from: %s", (filename) => {
			const result = detectByFilename(filename);
			assertDetection(result, "booking");
		});

		test("should detect random filename as generic fallback", () => {
			const result = detectByFilename("random-document.pdf");
			assertDetection(result, "generic");
		});

		test("should handle case-insensitive matching", () => {
			const result = detectByFilename("INVOICE.PDF");
			assertDetection(result, "invoice");
		});

		test("should return matched patterns", () => {
			const result = detectByFilename("tax-invoice-receipt.pdf");

			expect(result.matchedPatterns).toBeDefined();
			expect(result.matchedPatterns?.length).toBeGreaterThan(0);
		});
	});

	describe("detectByContent", () => {
		test("should detect invoice from content markers", () => {
			const content = `
        TAX INVOICE
        Invoice Number: 12345
        Date: 2024-12-01
        Amount Due: $220.00
      `;

			const result = detectByContent(content);
			assertDetection(result, "invoice");
		});

		test("should detect booking from flight confirmation content", () => {
			const content = `
        Flight Confirmation
        Booking Reference: ABC123
        Passenger: John Doe
        Flight: QF401
        Departure: Melbourne
        Arrival: Sydney
      `;

			const result = detectByContent(content);
			assertDetection(result, "booking");
		});

		test("should detect booking from hotel reservation", () => {
			const content = `
        HOTEL RESERVATION
        Confirmation Number: 12345
        Guest: Jane Doe
        Check-in: 2024-12-15
        Check-out: 2024-12-20
      `;

			const result = detectByContent(content);
			assertDetection(result, "booking");
		});

		test("should detect invoice from various content patterns", () => {
			const simpleContent = "Invoice #12345";
			const detailedContent = `
        TAX INVOICE
        Invoice Number: 12345
        Total Amount: $100
        ABN: 12 345 678 901
      `;

			const simpleResult = detectByContent(simpleContent);
			const detailedResult = detectByContent(detailedContent);

			assertDetection(simpleResult, "invoice");
			assertDetection(detailedResult, "invoice");
		});

		test("should not detect from ambiguous content", () => {
			const content = "This is a random document with no clear markers.";

			const result = detectByContent(content);

			expect(result.detected).toBe(false);
		});

		test("should return matched patterns with converter info", () => {
			const content = "TAX INVOICE for services rendered. Amount Due: $500";

			const result = detectByContent(content);

			expect(result.matchedPatterns).toBeDefined();
			// matchedPatterns now contains converter ID with score, e.g. "invoice(0.90)"
			expect(result.matchedPatterns?.some((p) => p.startsWith("invoice"))).toBe(
				true,
			);
		});
	});

	describe("extractPdfText", () => {
		test("should throw DEP_PDFTOTEXT_MISSING if pdftotext not installed", async () => {
			const mockSpawn = mock(() => {
				throw new Error("Command not found");
			});

			// Mock the module (cleaned up by mock.restore() in afterEach)
			mock.module("node:child_process", () => ({
				spawn: mockSpawn,
			}));

			await expect(
				extractPdfText("/path/to/file.pdf", "test-cid"),
			).rejects.toThrow(InboxError);
		});

		test("should throw EXT_PDF_CORRUPT for non-existent file", async () => {
			const check = await checkPdfToText();
			if (!check.available) {
				// Skip if pdftotext not installed
				return;
			}

			try {
				await extractPdfText("/non/existent/file.pdf", "test-cid");
				expect(true).toBe(false); // Should not reach here
			} catch (error) {
				expect(error).toBeInstanceOf(InboxError);
				if (error instanceof InboxError) {
					expect(["EXT_PDF_CORRUPT", "EXT_PDF_EMPTY"]).toContain(error.code);
				}
			}
		});
	});
});
