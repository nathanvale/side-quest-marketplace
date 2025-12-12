/**
 * Converters Index Tests
 *
 * Tests for the converters module public API exports.
 * Ensures all expected utilities, types, and defaults are properly exported.
 *
 * @module converters/index.test
 */

import { describe, expect, test } from "bun:test";

// =============================================================================
// Import all exports from the converters module
// =============================================================================

import {
	// Suggestion builder
	buildSuggestion,
	// Types are imported separately for type checking
	type ConverterMatch,
	// Default converters
	DEFAULT_INBOX_CONVERTERS,
	type ExtractionConfig,
	type FieldDefinition,
	// Loader utilities
	findBestConverter,
	type HeuristicConfig,
	type HeuristicPattern,
	type HeuristicResult,
	type InboxConverter,
	mapFieldsToTemplate,
	mergeConverters,
	type ScoringConfig,
	type SuggestionInput,
	scoreContent,
	scoreFilename,
	type TemplateConfig,
} from "./index";

// =============================================================================
// Tests
// =============================================================================

describe("converters/index", () => {
	describe("Default Converters Export", () => {
		test("should export DEFAULT_INBOX_CONVERTERS", () => {
			expect(DEFAULT_INBOX_CONVERTERS).toBeDefined();
			expect(Array.isArray(DEFAULT_INBOX_CONVERTERS)).toBe(true);
		});

		test("DEFAULT_INBOX_CONVERTERS should contain invoice converter", () => {
			const invoice = DEFAULT_INBOX_CONVERTERS.find((c) => c.id === "invoice");
			expect(invoice).toBeDefined();
			expect(invoice?.displayName).toBe("Invoice");
		});

		test("DEFAULT_INBOX_CONVERTERS should contain booking converter", () => {
			const booking = DEFAULT_INBOX_CONVERTERS.find((c) => c.id === "booking");
			expect(booking).toBeDefined();
			expect(booking?.displayName).toBe("Booking");
		});
	});

	describe("Loader Utilities Export", () => {
		test("should export findBestConverter function", () => {
			expect(typeof findBestConverter).toBe("function");
		});

		test("findBestConverter should be callable", () => {
			const result = findBestConverter(
				DEFAULT_INBOX_CONVERTERS,
				"test.pdf",
				"",
			);
			// Should return null or ConverterMatch
			expect(result === null || typeof result === "object").toBe(true);
		});

		test("should export mapFieldsToTemplate function", () => {
			expect(typeof mapFieldsToTemplate).toBe("function");
		});

		test("mapFieldsToTemplate should be callable", () => {
			const invoice = DEFAULT_INBOX_CONVERTERS.find((c) => c.id === "invoice");
			if (!invoice) throw new Error("Invoice converter not found");

			const result = mapFieldsToTemplate({ title: "Test" }, invoice);
			expect(typeof result).toBe("object");
		});

		test("should export mergeConverters function", () => {
			expect(typeof mergeConverters).toBe("function");
		});

		test("mergeConverters should be callable", () => {
			const result = mergeConverters(DEFAULT_INBOX_CONVERTERS, [], []);
			expect(Array.isArray(result)).toBe(true);
		});

		test("should export scoreContent function", () => {
			expect(typeof scoreContent).toBe("function");
		});

		test("scoreContent should be callable", () => {
			const result = scoreContent("test content", [
				{ pattern: "test", weight: 1.0 },
			]);
			expect(typeof result).toBe("number");
		});

		test("should export scoreFilename function", () => {
			expect(typeof scoreFilename).toBe("function");
		});

		test("scoreFilename should be callable", () => {
			const result = scoreFilename("test.pdf", [
				{ pattern: "test", weight: 1.0 },
			]);
			expect(typeof result).toBe("number");
		});
	});

	describe("Suggestion Builder Export", () => {
		test("should export buildSuggestion function", () => {
			expect(typeof buildSuggestion).toBe("function");
		});

		test("buildSuggestion should be callable", () => {
			const input: SuggestionInput = {
				filename: "test.pdf",
				inboxFolder: "00 Inbox",
				heuristicResult: { detected: false, confidence: 0 },
				llmResult: null,
			};

			const result = buildSuggestion(input);
			expect(result).toBeDefined();
			expect(result.id).toBeDefined();
			expect(result.source).toBeDefined();
			expect(result.confidence).toBeDefined();
			expect(result.action).toBeDefined();
		});
	});

	describe("Type Exports", () => {
		test("should export ConverterMatch type", () => {
			// Type-only test - verifies import doesn't fail
			const _typeCheck: ConverterMatch | null = null;
			expect(true).toBe(true);
		});

		test("should export ExtractionConfig type", () => {
			// Type-only test - verifies import doesn't fail
			const _typeCheck: ExtractionConfig | null = null;
			expect(true).toBe(true);
		});

		test("should export FieldDefinition type", () => {
			// Type-only test - verifies import doesn't fail
			const _typeCheck: FieldDefinition | null = null;
			expect(true).toBe(true);
		});

		test("should export HeuristicConfig type", () => {
			// Type-only test - verifies import doesn't fail
			const _typeCheck: HeuristicConfig | null = null;
			expect(true).toBe(true);
		});

		test("should export HeuristicPattern type", () => {
			// Type-only test - verifies import doesn't fail
			const _typeCheck: HeuristicPattern | null = null;
			expect(true).toBe(true);
		});

		test("should export HeuristicResult type", () => {
			// Type-only test - verifies import doesn't fail
			const _typeCheck: HeuristicResult | null = null;
			expect(true).toBe(true);
		});

		test("should export InboxConverter type", () => {
			// Type-only test - verifies import doesn't fail
			const _typeCheck: InboxConverter | null = null;
			expect(true).toBe(true);
		});

		test("should export ScoringConfig type", () => {
			// Type-only test - verifies import doesn't fail
			const _typeCheck: ScoringConfig | null = null;
			expect(true).toBe(true);
		});

		test("should export SuggestionInput type", () => {
			// Type-only test - verifies import doesn't fail
			const _typeCheck: SuggestionInput | null = null;
			expect(true).toBe(true);
		});

		test("should export TemplateConfig type", () => {
			// Type-only test - verifies import doesn't fail
			const _typeCheck: TemplateConfig | null = null;
			expect(true).toBe(true);
		});
	});

	describe("Integration", () => {
		test("should allow full converter workflow using exported utilities", () => {
			// 1. Find best converter
			const match = findBestConverter(
				DEFAULT_INBOX_CONVERTERS,
				"invoice-001.pdf",
				"TAX INVOICE\nAmount: $150",
			);

			expect(match).not.toBeNull();
			expect(match?.converter.id).toBe("invoice");

			// 2. Build suggestion
			const suggestion = buildSuggestion({
				filename: "invoice-001.pdf",
				inboxFolder: "00 Inbox",
				heuristicResult: {
					detected: true,
					suggestedType: "invoice",
					confidence: 0.8,
				},
				llmResult: {
					documentType: "invoice",
					confidence: 0.9,
					extractedFields: {
						title: "Medical Invoice",
						amount: "$150.00",
					},
				},
			});

			expect(suggestion.confidence).toBe("high");
			expect(suggestion.suggestedNoteType).toBe("invoice");

			// 3. Map fields to template
			if (match && suggestion.extractedFields) {
				const mapped = mapFieldsToTemplate(
					suggestion.extractedFields,
					match.converter,
				);
				expect(mapped["Invoice title"]).toBe("Medical Invoice");
				expect(mapped.Amount).toBe("$150.00");
			}
		});

		test("should allow custom converter merging workflow", () => {
			// Custom override for invoice priority
			const overrides = [
				{
					id: "invoice",
					priority: 50,
				},
			];

			const merged = mergeConverters(DEFAULT_INBOX_CONVERTERS, overrides, []);
			const invoice = merged.find((c) => c.id === "invoice");

			expect(invoice?.priority).toBe(50);
			expect(invoice?.displayName).toBe("Invoice"); // Preserved from default
		});
	});
});
