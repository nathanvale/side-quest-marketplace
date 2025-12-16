/**
 * Fixture Schema Validation Integration Tests
 *
 * Validates that all test fixtures conform to the actual DocumentTypeResult API schema.
 * Ensures fixtures remain realistic and match production responses from the LLM classifier.
 *
 * @module test/integration/suites/fixture-validation
 */

import { describe, expect, test } from "bun:test";
import { BOOKMARK_FIXTURES } from "../fixtures/bookmark.fixtures";
import { ALL_EDGE_CASE_FIXTURES } from "../fixtures/edge-cases.fixtures";
import { INVOICE_FIXTURES } from "../fixtures/invoice.fixtures";

// =============================================================================
// Test 1: All bookmark fixtures have complete DocumentTypeResult structure
// =============================================================================

describe("Fixture Schema Validation → Bookmark Fixtures", () => {
	const allBookmarkFixtures = [
		BOOKMARK_FIXTURES.complete,
		BOOKMARK_FIXTURES.minimal,
		...BOOKMARK_FIXTURES.edgeCases,
	];

	test("all bookmark fixtures have valid DocumentTypeResult structure", () => {
		for (const fixture of allBookmarkFixtures) {
			const llmResponse = fixture._mockLLMResponse;

			// Required fields
			expect(llmResponse.documentType).toBeDefined();
			expect(typeof llmResponse.documentType).toBe("string");
			expect(llmResponse.documentType.length).toBeGreaterThan(0);

			expect(llmResponse.confidence).toBeDefined();
			expect(typeof llmResponse.confidence).toBe("number");
			expect(llmResponse.confidence).toBeGreaterThanOrEqual(0);
			expect(llmResponse.confidence).toBeLessThanOrEqual(1);

			// Optional fields (check type if defined)
			if (llmResponse.reasoning !== undefined) {
				expect(typeof llmResponse.reasoning).toBe("string");
				expect(llmResponse.reasoning.length).toBeGreaterThan(0);
			}

			if (llmResponse.suggestedArea !== undefined) {
				expect(
					llmResponse.suggestedArea === null ||
						typeof llmResponse.suggestedArea === "string",
				).toBe(true);
			}

			if (llmResponse.suggestedProject !== undefined) {
				expect(
					llmResponse.suggestedProject === null ||
						typeof llmResponse.suggestedProject === "string",
				).toBe(true);
			}

			if (llmResponse.extractedFields !== undefined) {
				expect(
					llmResponse.extractedFields === null ||
						typeof llmResponse.extractedFields === "object",
				).toBe(true);
				if (llmResponse.extractedFields) {
					expect(Array.isArray(llmResponse.extractedFields)).toBe(false);
				}
			}

			if (llmResponse.suggestedFilenameDescription !== undefined) {
				expect(
					llmResponse.suggestedFilenameDescription === null ||
						typeof llmResponse.suggestedFilenameDescription === "string",
				).toBe(true);
			}

			if (llmResponse.extractionWarnings !== undefined) {
				expect(Array.isArray(llmResponse.extractionWarnings)).toBe(true);
				for (const warning of llmResponse.extractionWarnings || []) {
					expect(typeof warning).toBe("string");
				}
			}
		}
	});

	test("all bookmark fixtures have reasonable confidence values", () => {
		for (const fixture of allBookmarkFixtures) {
			const confidence = fixture._mockLLMResponse.confidence;

			// Confidence should be realistic (not 0.0 or 1.0 exactly in most cases)
			// Production LLMs rarely give perfect 1.0 or complete 0.0
			expect(confidence).toBeGreaterThan(0.3);
			expect(confidence).toBeLessThan(1.0);

			// Fixture description context
			const desc = fixture.description;

			// High confidence fixtures (complete, standard cases)
			if (
				desc.includes("complete") ||
				desc.includes("minimal") ||
				desc.includes("GitHub PR") ||
				desc.includes("banking")
			) {
				expect(confidence).toBeGreaterThanOrEqual(0.85);
			}

			// Medium-low confidence fixtures (edge cases, ambiguous)
			if (desc.includes("ambiguous") || desc.includes("unclear")) {
				expect(confidence).toBeLessThan(0.75);
			}
		}
	});

	test("all bookmark fixtures with reasoning have meaningful content", () => {
		for (const fixture of allBookmarkFixtures) {
			const reasoning = fixture._mockLLMResponse.reasoning;

			if (reasoning !== undefined && reasoning !== null) {
				expect(reasoning.length).toBeGreaterThan(20);
				// Should contain at least one space (not just a single word)
				expect(reasoning).toMatch(/\s/);
			}
		}
	});

	test("all bookmark fixtures have extractedFields for bookmark type", () => {
		for (const fixture of allBookmarkFixtures) {
			const fields = fixture._mockLLMResponse.extractedFields;
			const desc = fixture.description;

			// Skip malformed fixtures that are expected to fail
			if (
				desc.includes("missing") ||
				desc.includes("corrupted") ||
				desc.includes("invalid")
			) {
				continue;
			}

			expect(fields).toBeDefined();
			if (fields) {
				// Bookmark fixtures should have url and title at minimum
				expect(fields).toHaveProperty("url");
				expect(fields).toHaveProperty("title");
				expect(typeof fields.url).toBe("string");
				expect(typeof fields.title).toBe("string");
			}
		}
	});
});

// =============================================================================
// Test 2: All invoice fixtures match production schema
// =============================================================================

describe("Fixture Schema Validation → Invoice Fixtures", () => {
	const allInvoiceFixtures = [
		INVOICE_FIXTURES.complete,
		INVOICE_FIXTURES.minimal,
		...INVOICE_FIXTURES.edgeCases,
	];

	test("all invoice fixtures have valid DocumentTypeResult structure", () => {
		for (const fixture of allInvoiceFixtures) {
			const llmResponse = fixture._mockLLMResponse;

			// Required fields
			expect(llmResponse.documentType).toBeDefined();
			expect(typeof llmResponse.documentType).toBe("string");
			expect(llmResponse.documentType).toBe("invoice"); // Invoice-specific

			expect(llmResponse.confidence).toBeDefined();
			expect(typeof llmResponse.confidence).toBe("number");
			expect(llmResponse.confidence).toBeGreaterThanOrEqual(0);
			expect(llmResponse.confidence).toBeLessThanOrEqual(1);

			// Optional fields validation
			if (llmResponse.reasoning !== undefined) {
				expect(typeof llmResponse.reasoning).toBe("string");
			}

			if (
				llmResponse.extractedFields !== undefined &&
				llmResponse.extractedFields !== null
			) {
				expect(typeof llmResponse.extractedFields).toBe("object");
			}
		}
	});

	test("all invoice fixtures have invoice-specific fields", () => {
		for (const fixture of allInvoiceFixtures) {
			const fields = fixture._mockLLMResponse.extractedFields;

			// Skip malformed fixtures
			if (
				fixture.description.includes("missing") ||
				fixture.description.includes("ambiguous")
			) {
				continue;
			}

			expect(fields).toBeDefined();
			if (fields) {
				// Invoice must have amount (number as string or number)
				expect(fields).toHaveProperty("amount");
				expect(
					typeof fields.amount === "string" ||
						typeof fields.amount === "number",
				).toBe(true);

				// Invoice must have provider
				expect(fields).toHaveProperty("provider");
				expect(typeof fields.provider).toBe("string");

				// Optional fields (check type if present)
				if (fields.invoiceNumber !== undefined) {
					expect(typeof fields.invoiceNumber).toBe("string");
				}

				if (fields.dueDate !== undefined) {
					expect(typeof fields.dueDate).toBe("string");
				}

				if (fields.currency !== undefined) {
					expect(typeof fields.currency).toBe("string");
				}

				if (fields.abn !== undefined) {
					expect(typeof fields.abn).toBe("string");
				}

				if (fields.gst !== undefined) {
					expect(
						typeof fields.gst === "string" || typeof fields.gst === "number",
					).toBe(true);
				}
			}
		}
	});

	test("invoice amount fields are in valid format", () => {
		for (const fixture of allInvoiceFixtures) {
			const fields = fixture._mockLLMResponse.extractedFields;

			// Skip malformed fixtures
			if (
				fixture.description.includes("missing") ||
				fixture.description.includes("ambiguous")
			) {
				continue;
			}

			if (fields?.amount !== undefined) {
				// Amount can be string or number
				if (typeof fields.amount === "string") {
					// Should be parseable as float
					const parsed = Number.parseFloat(fields.amount);
					expect(Number.isNaN(parsed)).toBe(false);
					expect(parsed).toBeGreaterThan(0);
				} else {
					expect(typeof fields.amount).toBe("number");
					expect(fields.amount).toBeGreaterThan(0);
				}
			}
		}
	});

	test("invoice fixtures have appropriate confidence levels", () => {
		for (const fixture of allInvoiceFixtures) {
			const confidence = fixture._mockLLMResponse.confidence;
			const desc = fixture.description;

			// Complete invoices with clear structure should have high confidence
			if (desc.includes("complete") || desc.includes("tax invoice")) {
				expect(confidence).toBeGreaterThanOrEqual(0.88);
			}

			// Minimal receipts should have medium-high confidence
			if (desc.includes("minimal receipt")) {
				expect(confidence).toBeGreaterThanOrEqual(0.7);
				expect(confidence).toBeLessThan(0.9);
			}

			// Ambiguous providers should have lower confidence
			if (desc.includes("ambiguous")) {
				expect(confidence).toBeLessThan(0.7);
			}
		}
	});
});

// =============================================================================
// Test 3: Edge case fixtures handle special scenarios correctly
// =============================================================================

describe("Fixture Schema Validation → Edge Cases", () => {
	test("all edge case fixtures have valid structure", () => {
		for (const fixture of ALL_EDGE_CASE_FIXTURES) {
			const llmResponse = fixture._mockLLMResponse;

			// Basic structure validation
			expect(llmResponse.documentType).toBeDefined();
			expect(typeof llmResponse.documentType).toBe("string");

			expect(llmResponse.confidence).toBeDefined();
			expect(typeof llmResponse.confidence).toBe("number");
			expect(llmResponse.confidence).toBeGreaterThanOrEqual(0);
			expect(llmResponse.confidence).toBeLessThanOrEqual(1);
		}
	});

	test("duplicate fixtures have appropriate confidence", () => {
		const duplicates = ALL_EDGE_CASE_FIXTURES.filter((f) =>
			f.description.includes("duplicate"),
		);

		for (const fixture of duplicates) {
			const confidence = fixture._mockLLMResponse.confidence;

			// Duplicates should still have reasonable confidence
			// (the LLM doesn't know it's a duplicate until registry check)
			expect(confidence).toBeGreaterThan(0.5);
		}
	});

	test("unicode fixtures handle special characters in extractedFields", () => {
		const unicodeFixtures = ALL_EDGE_CASE_FIXTURES.filter(
			(f) =>
				f.description.includes("Unicode") ||
				f.description.includes("CJK") ||
				f.description.includes("RTL"),
		);

		for (const fixture of unicodeFixtures) {
			const fields = fixture._mockLLMResponse.extractedFields;

			if (fields?.title !== undefined) {
				// Title should preserve Unicode characters
				const title = fields.title as string;
				expect(title.length).toBeGreaterThan(0);

				// Should contain non-ASCII characters (Unicode beyond basic Latin)
				// biome-ignore lint/suspicious/noControlCharactersInRegex: Testing Unicode character ranges
				expect(/[^\u0000-\u007F]/.test(title)).toBe(true);
			}
		}
	});

	test("long value fixtures handle truncation gracefully", () => {
		const longFixtures = ALL_EDGE_CASE_FIXTURES.filter((f) =>
			f.description.includes("long"),
		);

		for (const fixture of longFixtures) {
			const fields = fixture._mockLLMResponse.extractedFields;

			// Fields should exist and be properly typed
			if (fields?.title !== undefined) {
				expect(typeof fields.title).toBe("string");
				// Very long titles are preserved in extractedFields
				// (truncation happens at filesystem level, not API level)
			}

			if (fields?.url !== undefined) {
				expect(typeof fields.url).toBe("string");
				// Long URLs should be preserved fully
				if (fixture.description.includes("very long URL")) {
					expect((fields.url as string).length).toBeGreaterThan(100);
				}
			}
		}
	});

	test("malformed fixtures have appropriate warnings", () => {
		const malformedFixtures = ALL_EDGE_CASE_FIXTURES.filter(
			(f) =>
				f.description.includes("missing") ||
				f.description.includes("invalid") ||
				f.description.includes("corrupted"),
		);

		for (const fixture of malformedFixtures) {
			const warnings = fixture._mockLLMResponse.extractionWarnings;

			// Malformed fixtures should either have warnings or expectedOutcome.warningMessage
			const hasWarnings =
				(warnings && warnings.length > 0) ||
				fixture.expectedOutcome.warningMessage !== undefined;

			expect(hasWarnings).toBe(true);

			// Warning content should be descriptive
			if (warnings && warnings.length > 0) {
				for (const warning of warnings) {
					expect(warning.length).toBeGreaterThan(10);
				}
			}

			if (fixture.expectedOutcome.warningMessage) {
				expect(fixture.expectedOutcome.warningMessage.length).toBeGreaterThan(
					10,
				);
			}
		}
	});

	test("malformed fixtures have null noteCreated outcome", () => {
		const malformedFixtures = ALL_EDGE_CASE_FIXTURES.filter(
			(f) =>
				f.description.includes("missing required") ||
				f.description.includes("invalid date") ||
				f.description.includes("corrupted"),
		);

		for (const fixture of malformedFixtures) {
			// Malformed content should fail to create notes
			expect(fixture.expectedOutcome.noteCreated).toBeNull();
			expect(fixture.expectedOutcome.noteLocation).toBeNull();
			expect(fixture.expectedOutcome.frontmatter).toBeNull();
		}
	});
});

// =============================================================================
// Test 4: Cross-fixture consistency checks
// =============================================================================

describe("Fixture Schema Validation → Consistency", () => {
	const allFixtures = [
		...Object.values(BOOKMARK_FIXTURES).flat(),
		...Object.values(INVOICE_FIXTURES).flat(),
		...ALL_EDGE_CASE_FIXTURES,
	];

	test("all fixtures use consistent confidence ranges", () => {
		const confidences = allFixtures.map((f) => f._mockLLMResponse.confidence);

		// Should have variety (not all the same)
		const uniqueConfidences = new Set(confidences);
		expect(uniqueConfidences.size).toBeGreaterThan(5);

		// All should be in valid range
		for (const conf of confidences) {
			expect(conf).toBeGreaterThanOrEqual(0);
			expect(conf).toBeLessThanOrEqual(1);
		}

		// Should include both high and medium confidence examples
		const hasHigh = confidences.some((c) => c >= 0.9);
		const hasMedium = confidences.some((c) => c >= 0.7 && c < 0.85);
		expect(hasHigh).toBe(true);
		expect(hasMedium).toBe(true);
	});

	test("fixtures with reasoning have substantive explanations", () => {
		const withReasoning = allFixtures.filter(
			(f) => f._mockLLMResponse.reasoning,
		);

		expect(withReasoning.length).toBeGreaterThan(10);

		for (const fixture of withReasoning) {
			const reasoning = fixture._mockLLMResponse.reasoning!;

			// Should have spaces (multi-word explanation)
			expect(reasoning).toMatch(/\s/);
			// Should be substantive (more than just a few words)
			expect(reasoning.length).toBeGreaterThan(25);
		}
	});

	test("all valid fixtures have non-empty extractedFields", () => {
		const validFixtures = allFixtures.filter(
			(f) =>
				!f.description.includes("missing") &&
				!f.description.includes("corrupted") &&
				!f.description.includes("invalid"),
		);

		for (const fixture of validFixtures) {
			const fields = fixture._mockLLMResponse.extractedFields;

			expect(fields).toBeDefined();
			if (fields) {
				const fieldKeys = Object.keys(fields);
				expect(fieldKeys.length).toBeGreaterThan(0);
			}
		}
	});

	test("fixture expectedFields match _mockLLMResponse.extractedFields structure", () => {
		for (const fixture of allFixtures) {
			const llmFields = fixture._mockLLMResponse.extractedFields;
			const expectedFields = fixture.expectedFields;

			// Skip if no extracted fields (malformed cases)
			if (!llmFields) {
				continue;
			}

			// All expectedFields keys should exist in extractedFields
			for (const key of Object.keys(expectedFields)) {
				if (expectedFields[key] !== "" && expectedFields[key] !== undefined) {
					expect(llmFields).toHaveProperty(key);
				}
			}
		}
	});
});
