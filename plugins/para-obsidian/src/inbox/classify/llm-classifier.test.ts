import { describe, expect, test } from "bun:test";
import {
	buildInboxPrompt,
	type DocumentTypeResult,
	type FieldExtractionResult,
	parseDetectionResponse,
} from "./llm-classifier";

describe("inbox/llm-detection", () => {
	describe("buildInboxPrompt", () => {
		test("should build prompt for document type detection", () => {
			const prompt = buildInboxPrompt({
				content: "TAX INVOICE\nAmount: $220\nProvider: Dr Smith",
				filename: "invoice-001.pdf",
				vaultContext: {
					areas: ["Health", "Finance", "Work"],
					projects: ["2024 Tax Return", "Medical Expenses"],
				},
			});

			expect(prompt).toContain("TAX INVOICE");
			expect(prompt).toContain("invoice-001.pdf");
			expect(prompt).toContain("Health");
			expect(prompt).toContain("Finance");
		});

		test("should include available note types", () => {
			const prompt = buildInboxPrompt({
				content: "Some content",
				filename: "doc.pdf",
				vaultContext: { areas: [], projects: [] },
			});

			expect(prompt).toContain("invoice");
			expect(prompt).toContain("booking");
		});

		test("should include vault context for area/project suggestions", () => {
			const prompt = buildInboxPrompt({
				content: "Flight confirmation",
				filename: "booking.pdf",
				vaultContext: {
					areas: ["Travel", "Personal"],
					projects: ["2024 Sydney Trip", "Holiday Planning"],
				},
			});

			expect(prompt).toContain("Travel");
			expect(prompt).toContain("2024 Sydney Trip");
		});

		test("should handle empty vault context", () => {
			const prompt = buildInboxPrompt({
				content: "Content",
				filename: "file.pdf",
				vaultContext: { areas: [], projects: [] },
			});

			expect(prompt).toBeDefined();
			expect(typeof prompt).toBe("string");
		});
	});

	describe("parseDetectionResponse", () => {
		test("should parse valid JSON response", () => {
			const response = JSON.stringify({
				documentType: "invoice",
				confidence: 0.9,
				suggestedArea: "Health",
				suggestedProject: null,
				suggestedFilenameDescription: "dr-smith-invoice-001",
				extractedFields: {
					amount: "220.00",
					currency: "AUD",
					provider: "Dr Smith",
					date: "2024-12-01",
				},
				reasoning: "Contains TAX INVOICE header and amount fields",
			});

			const result = parseDetectionResponse(response);

			expect(result.documentType).toBe("invoice");
			expect(result.confidence).toBe(0.9);
			expect(result.suggestedArea).toBe("Health");
			expect(result.suggestedFilenameDescription).toBe("dr-smith-invoice-001");
			expect(result.extractedFields?.amount).toBe("220.00");
			expect(result.extractedFields?.currency).toBe("AUD");
		});

		test("should handle JSON wrapped in markdown code blocks", () => {
			const response = `\`\`\`json
{
  "documentType": "booking",
  "confidence": 0.85,
  "suggestedArea": "Travel",
  "extractedFields": {}
}
\`\`\``;

			const result = parseDetectionResponse(response);

			expect(result.documentType).toBe("booking");
			expect(result.confidence).toBe(0.85);
		});

		test("should throw on invalid JSON", () => {
			expect(() => parseDetectionResponse("not json")).toThrow();
		});

		test("should throw on missing required fields", () => {
			const response = JSON.stringify({
				confidence: 0.5,
				// missing documentType
			});

			expect(() => parseDetectionResponse(response)).toThrow();
		});

		test("should handle null optional fields", () => {
			const response = JSON.stringify({
				documentType: "generic",
				confidence: 0.3,
				suggestedArea: null,
				suggestedProject: null,
				extractedFields: null,
			});

			const result = parseDetectionResponse(response);

			expect(result.documentType).toBe("generic");
			expect(result.suggestedArea).toBeNull();
		});
	});

	describe("DocumentTypeResult type", () => {
		test("should have correct shape", () => {
			const result: DocumentTypeResult = {
				documentType: "invoice",
				confidence: 0.95,
				suggestedArea: "Health",
				suggestedProject: "Medical Expenses 2024",
				extractedFields: {
					amount: "$220",
					provider: "Dr Smith",
					date: "2024-12-01",
					currency: "AUD",
				},
				reasoning: "Strong invoice markers detected",
			};

			expect(result.documentType).toBe("invoice");
			expect(result.confidence).toBe(0.95);
		});

		test("should allow minimal result", () => {
			const result: DocumentTypeResult = {
				documentType: "generic",
				confidence: 0.2,
			};

			expect(result.documentType).toBe("generic");
			expect(result.suggestedArea).toBeUndefined();
		});
	});

	describe("FieldExtractionResult type", () => {
		test("should support invoice fields", () => {
			const result: FieldExtractionResult = {
				amount: "$500.00",
				currency: "AUD",
				provider: "ABC Corp",
				date: "2024-12-01",
				invoiceNumber: "INV-001",
				abn: "12 345 678 901",
			};

			expect(result.amount).toBe("$500.00");
			expect(result.abn).toBe("12 345 678 901");
		});

		test("should support booking fields", () => {
			const result: FieldExtractionResult = {
				date: "2024-12-15",
				provider: "Qantas",
				bookingReference: "ABC123",
				departure: "Melbourne",
				arrival: "Sydney",
				passenger: "John Doe",
			};

			expect(result.bookingReference).toBe("ABC123");
			expect(result.departure).toBe("Melbourne");
		});
	});

	describe("prompt instructions", () => {
		test("should request JSON response format", () => {
			const prompt = buildInboxPrompt({
				content: "Test",
				filename: "test.pdf",
				vaultContext: { areas: [], projects: [] },
			});

			expect(prompt.toLowerCase()).toContain("json");
		});

		test("should include document type options", () => {
			const prompt = buildInboxPrompt({
				content: "Test",
				filename: "test.pdf",
				vaultContext: { areas: [], projects: [] },
			});

			// Should mention available types
			expect(prompt).toMatch(/invoice|booking|receipt|generic/i);
		});

		test("should include confidence level guidance", () => {
			const prompt = buildInboxPrompt({
				content: "Test",
				filename: "test.pdf",
				vaultContext: { areas: [], projects: [] },
			});

			expect(prompt.toLowerCase()).toContain("confidence");
		});
	});
});
