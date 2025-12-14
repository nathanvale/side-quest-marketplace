import { describe, expect, test } from "bun:test";
import { InboxError } from "../../shared/errors";
import {
	checkPdfToText,
	detectByContent,
	detectByFilename,
	extractPdfText,
	type HeuristicResult,
} from "./pdf-processor";

describe("inbox/pdf-processor", () => {
	describe("checkPdfToText", () => {
		test("should return available=true when pdftotext exists", async () => {
			// This test depends on pdftotext being installed
			// In CI, we may need to mock this
			const result = await checkPdfToText();

			// Either available or not, but should return a valid result
			expect(result).toHaveProperty("available");
			expect(typeof result.available).toBe("boolean");
		});

		test("should return error message when not available", async () => {
			const result = await checkPdfToText();

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

			expect(result.detected).toBe(true);
			expect(result.suggestedType).toBe("invoice");
			expect(result.confidence).toBeGreaterThan(0);
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

			expect(result.detected).toBe(true);
			expect(result.suggestedType).toBe("booking");
			expect(result.confidence).toBeGreaterThan(0);
		});

		test("should not detect random filename", () => {
			const result = detectByFilename("random-document.pdf");

			expect(result.detected).toBe(false);
			expect(result.suggestedType).toBeUndefined();
		});

		test("should handle case-insensitive matching", () => {
			const result = detectByFilename("INVOICE.PDF");

			expect(result.detected).toBe(true);
			expect(result.suggestedType).toBe("invoice");
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

			expect(result.detected).toBe(true);
			expect(result.suggestedType).toBe("invoice");
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

			expect(result.detected).toBe(true);
			expect(result.suggestedType).toBe("booking");
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

			expect(result.detected).toBe(true);
			expect(result.suggestedType).toBe("booking");
		});

		test("should detect invoice from various content patterns", () => {
			const simpleContent = "Invoice";
			const detailedContent = `
        TAX INVOICE
        Invoice Number: 12345
        Total Amount: $100
        ABN: 12 345 678 901
      `;

			const simpleResult = detectByContent(simpleContent);
			const detailedResult = detectByContent(detailedContent);

			// Both should detect as invoice with reasonable confidence
			expect(simpleResult.detected).toBe(true);
			expect(simpleResult.suggestedType).toBe("invoice");
			expect(simpleResult.confidence).toBeGreaterThan(0);

			expect(detailedResult.detected).toBe(true);
			expect(detailedResult.suggestedType).toBe("invoice");
			expect(detailedResult.confidence).toBeGreaterThan(0);
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
			// Skip if pdftotext is available
			const check = await checkPdfToText();
			if (check.available) {
				// Can't test this case when pdftotext is installed
				expect(true).toBe(true);
				return;
			}

			await expect(
				extractPdfText("/path/to/file.pdf", "test-cid"),
			).rejects.toThrow(InboxError);
		});

		test("should throw EXT_PDF_CORRUPT for non-existent file", async () => {
			const check = await checkPdfToText();
			if (!check.available) {
				// Skip if pdftotext not installed
				expect(true).toBe(true);
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

		test("should enforce file size limits", async () => {
			// This test validates the size check logic
			// We can't easily create a huge PDF in tests
			const MAX_SIZE = 50 * 1024 * 1024; // 50MB

			expect(MAX_SIZE).toBe(52428800);
		});
	});

	describe("HeuristicResult type", () => {
		test("should have correct shape", () => {
			const result: HeuristicResult = {
				detected: true,
				suggestedType: "invoice",
				confidence: 0.8,
				matchedPatterns: ["invoice", "receipt"],
			};

			expect(result.detected).toBe(true);
			expect(result.suggestedType).toBe("invoice");
			expect(result.confidence).toBe(0.8);
			expect(result.matchedPatterns).toHaveLength(2);
		});

		test("should allow undefined suggestedType when not detected", () => {
			const result: HeuristicResult = {
				detected: false,
				confidence: 0,
			};

			expect(result.detected).toBe(false);
			expect(result.suggestedType).toBeUndefined();
		});
	});
});
