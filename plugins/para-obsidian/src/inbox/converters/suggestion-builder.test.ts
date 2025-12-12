/**
 * Suggestion Builder Tests
 *
 * Tests for the buildSuggestion() decision tree logic.
 *
 * @module converters/suggestion-builder.test
 */

import { describe, expect, test } from "bun:test";
import type { DocumentTypeResult } from "../llm-detection";
import {
	buildSuggestion,
	type HeuristicResult,
	type SuggestionInput,
} from "./suggestion-builder";

// =============================================================================
// Test Helpers
// =============================================================================

/** Create a base input for testing */
function createInput(
	overrides: Partial<SuggestionInput> = {},
): SuggestionInput {
	return {
		filename: "test-document.pdf",
		inboxFolder: "00 Inbox",
		heuristicResult: { detected: false, confidence: 0 },
		llmResult: null,
		...overrides,
	};
}

/** Create an LLM result for testing */
function createLLMResult(
	overrides: Partial<DocumentTypeResult> = {},
): DocumentTypeResult {
	return {
		documentType: "invoice",
		confidence: 0.85,
		...overrides,
	};
}

/** Create a heuristic result for testing */
function createHeuristicResult(
	overrides: Partial<HeuristicResult> = {},
): HeuristicResult {
	return {
		detected: true,
		suggestedType: "invoice",
		confidence: 0.7,
		...overrides,
	};
}

// =============================================================================
// Tests
// =============================================================================

describe("converters/suggestion-builder", () => {
	describe("buildSuggestion", () => {
		describe("LLM high confidence (≥0.7)", () => {
			test("should use LLM result with very high confidence (≥0.9) → HIGH", () => {
				const input = createInput({
					llmResult: createLLMResult({
						confidence: 0.95,
						documentType: "invoice",
					}),
				});

				const result = buildSuggestion(input);

				expect(result.confidence).toBe("high");
				expect(result.action).toBe("create-note");
				expect(result.suggestedNoteType).toBe("invoice");
			});

			test("should use LLM result with high confidence (0.7-0.9) → MEDIUM", () => {
				const input = createInput({
					llmResult: createLLMResult({
						confidence: 0.75,
						documentType: "booking",
					}),
				});

				const result = buildSuggestion(input);

				expect(result.confidence).toBe("medium");
				expect(result.action).toBe("create-note");
				expect(result.suggestedNoteType).toBe("booking");
			});

			test("should extract suggestedArea from LLM result", () => {
				const input = createInput({
					llmResult: createLLMResult({
						confidence: 0.85,
						suggestedArea: "Health",
					}),
				});

				const result = buildSuggestion(input);

				expect(result.suggestedArea).toBe("Health");
			});

			test("should extract suggestedProject from LLM result", () => {
				const input = createInput({
					llmResult: createLLMResult({
						confidence: 0.85,
						suggestedProject: "2024 Tax Return",
					}),
				});

				const result = buildSuggestion(input);

				expect(result.suggestedProject).toBe("2024 Tax Return");
			});

			test("should extract extractedFields from LLM result", () => {
				const input = createInput({
					llmResult: createLLMResult({
						confidence: 0.85,
						extractedFields: {
							amount: "$150.00",
							provider: "Dr Smith",
							date: "2024-01-15",
						},
					}),
				});

				const result = buildSuggestion(input);

				expect(result.extractedFields).toEqual({
					amount: "$150.00",
					provider: "Dr Smith",
					date: "2024-01-15",
				});
			});

			test("should use LLM reasoning if provided", () => {
				const input = createInput({
					llmResult: createLLMResult({
						confidence: 0.85,
						reasoning: "Document contains invoice header and ABN",
					}),
				});

				const result = buildSuggestion(input);

				expect(result.reason).toBe("Document contains invoice header and ABN");
			});

			test("should generate default reason if no reasoning provided", () => {
				const input = createInput({
					llmResult: createLLMResult({
						confidence: 0.85,
						documentType: "receipt",
						reasoning: undefined,
					}),
				});

				const result = buildSuggestion(input);

				expect(result.reason).toContain("LLM detected receipt");
				expect(result.reason).toContain("85%");
			});

			test("should use suggestedFilenameDescription as suggestedAttachmentName", () => {
				const input = createInput({
					llmResult: createLLMResult({
						confidence: 0.85,
						suggestedFilenameDescription: "dr-smith-invoice-jan-2024",
					}),
				});

				const result = buildSuggestion(input);

				expect(result.suggestedAttachmentName).toBe(
					"dr-smith-invoice-jan-2024",
				);
			});
		});

		describe("LLM + heuristic agreement boost", () => {
			test("should boost to HIGH when heuristics agree with LLM", () => {
				const input = createInput({
					heuristicResult: createHeuristicResult({
						detected: true,
						suggestedType: "invoice",
						confidence: 0.6,
					}),
					llmResult: createLLMResult({
						confidence: 0.75, // Would normally be MEDIUM
						documentType: "invoice",
					}),
				});

				const result = buildSuggestion(input);

				expect(result.confidence).toBe("high");
				expect(result.reason).toBe("Heuristics and LLM agree: invoice");
			});

			test("should NOT boost when heuristics disagree with LLM", () => {
				const input = createInput({
					heuristicResult: createHeuristicResult({
						detected: true,
						suggestedType: "booking", // Different from LLM
						confidence: 0.8,
					}),
					llmResult: createLLMResult({
						confidence: 0.75,
						documentType: "invoice",
					}),
				});

				const result = buildSuggestion(input);

				expect(result.confidence).toBe("medium"); // No boost
				expect(result.suggestedNoteType).toBe("invoice"); // Uses LLM
			});

			test("should NOT boost when heuristics not detected", () => {
				const input = createInput({
					heuristicResult: createHeuristicResult({
						detected: false,
						confidence: 0,
					}),
					llmResult: createLLMResult({
						confidence: 0.75,
						documentType: "invoice",
					}),
				});

				const result = buildSuggestion(input);

				expect(result.confidence).toBe("medium"); // No boost
			});
		});

		describe("heuristic-only detection (no LLM or LLM <0.7)", () => {
			test("should use heuristic result when detected with high confidence (≥0.8) → MEDIUM", () => {
				const input = createInput({
					heuristicResult: createHeuristicResult({
						detected: true,
						suggestedType: "booking",
						confidence: 0.85,
					}),
					llmResult: null,
				});

				const result = buildSuggestion(input);

				expect(result.confidence).toBe("medium");
				expect(result.action).toBe("create-note");
				expect(result.suggestedNoteType).toBe("booking");
				expect(result.reason).toContain("Heuristic detection: booking");
				expect(result.reason).toContain("85%");
			});

			test("should use heuristic result when detected with medium confidence (0.5-0.8) → LOW", () => {
				const input = createInput({
					heuristicResult: createHeuristicResult({
						detected: true,
						suggestedType: "receipt",
						confidence: 0.6,
					}),
					llmResult: null,
				});

				const result = buildSuggestion(input);

				expect(result.confidence).toBe("low");
				expect(result.action).toBe("create-note");
				expect(result.suggestedNoteType).toBe("receipt");
			});

			test("should prefer LLM over heuristics when LLM confidence ≥0.7", () => {
				const input = createInput({
					heuristicResult: createHeuristicResult({
						detected: true,
						suggestedType: "booking",
						confidence: 0.9,
					}),
					llmResult: createLLMResult({
						confidence: 0.7,
						documentType: "invoice",
					}),
				});

				const result = buildSuggestion(input);

				// LLM takes precedence even with lower confidence than heuristics
				expect(result.suggestedNoteType).toBe("invoice");
			});

			test("should use heuristics when LLM confidence <0.7", () => {
				const input = createInput({
					heuristicResult: createHeuristicResult({
						detected: true,
						suggestedType: "booking",
						confidence: 0.7,
					}),
					llmResult: createLLMResult({
						confidence: 0.6, // Below threshold
						documentType: "invoice",
					}),
				});

				const result = buildSuggestion(input);

				// Heuristics take over because LLM is below threshold
				expect(result.suggestedNoteType).toBe("booking");
				expect(result.confidence).toBe("low"); // 0.7 < 0.8, so low
			});
		});

		describe("low confidence LLM (no heuristics)", () => {
			test("should use LLM result with LOW confidence for non-generic types", () => {
				const input = createInput({
					heuristicResult: createHeuristicResult({
						detected: false,
						confidence: 0,
					}),
					llmResult: createLLMResult({
						confidence: 0.5,
						documentType: "session",
					}),
				});

				const result = buildSuggestion(input);

				expect(result.confidence).toBe("low");
				expect(result.action).toBe("create-note");
				expect(result.suggestedNoteType).toBe("session");
				expect(result.reason).toContain("Low confidence LLM detection");
			});

			test("should SKIP generic document type", () => {
				const input = createInput({
					heuristicResult: createHeuristicResult({
						detected: false,
						confidence: 0,
					}),
					llmResult: createLLMResult({
						confidence: 0.4,
						documentType: "generic",
					}),
				});

				const result = buildSuggestion(input);

				expect(result.confidence).toBe("low");
				expect(result.action).toBe("skip");
				expect(result.suggestedNoteType).toBe("generic");
			});
		});

		describe("no detection", () => {
			test("should SKIP when no LLM and no heuristics", () => {
				const input = createInput({
					heuristicResult: createHeuristicResult({
						detected: false,
						confidence: 0,
					}),
					llmResult: null,
				});

				const result = buildSuggestion(input);

				expect(result.confidence).toBe("low");
				expect(result.action).toBe("skip");
				expect(result.suggestedNoteType).toBeUndefined();
				expect(result.reason).toBe("Unable to determine document type");
			});

			test("should SKIP when heuristics detected but below threshold (≤0.5)", () => {
				const input = createInput({
					heuristicResult: createHeuristicResult({
						detected: true,
						suggestedType: "invoice",
						confidence: 0.4, // Below 0.5 threshold
					}),
					llmResult: null,
				});

				const result = buildSuggestion(input);

				expect(result.confidence).toBe("low");
				expect(result.action).toBe("skip");
				expect(result.reason).toBe("Unable to determine document type");
			});
		});

		describe("output fields", () => {
			test("should generate unique id for each suggestion", () => {
				const input = createInput();

				const result1 = buildSuggestion(input);
				const result2 = buildSuggestion(input);

				expect(result1.id).toBeDefined();
				expect(result2.id).toBeDefined();
				expect(result1.id).not.toBe(result2.id);
			});

			test("should set source as inboxFolder/filename", () => {
				const input = createInput({
					filename: "my-invoice.pdf",
					inboxFolder: "00 Inbox",
				});

				const result = buildSuggestion(input);

				expect(result.source).toBe("00 Inbox/my-invoice.pdf");
			});

			test("should default processor to attachments", () => {
				const input = createInput();

				const result = buildSuggestion(input);

				expect(result.processor).toBe("attachments");
			});

			test("should use provided processor", () => {
				const input = createInput({
					processor: "notes",
				});

				const result = buildSuggestion(input);

				expect(result.processor).toBe("notes");
			});

			test("should generate suggestedTitle from filename", () => {
				const input = createInput({
					filename: "2024-01-15-invoice.pdf",
					llmResult: createLLMResult({ confidence: 0.85 }),
				});

				const result = buildSuggestion(input);

				expect(result.suggestedTitle).toBeDefined();
			});
		});

		describe("edge cases", () => {
			test("should handle null suggestedArea in LLM result", () => {
				const input = createInput({
					llmResult: createLLMResult({
						confidence: 0.85,
						suggestedArea: null,
					}),
				});

				const result = buildSuggestion(input);

				expect(result.suggestedArea).toBeUndefined();
			});

			test("should handle null suggestedProject in LLM result", () => {
				const input = createInput({
					llmResult: createLLMResult({
						confidence: 0.85,
						suggestedProject: null,
					}),
				});

				const result = buildSuggestion(input);

				expect(result.suggestedProject).toBeUndefined();
			});

			test("should handle null extractedFields in LLM result", () => {
				const input = createInput({
					llmResult: createLLMResult({
						confidence: 0.85,
						extractedFields: null,
					}),
				});

				const result = buildSuggestion(input);

				expect(result.extractedFields).toBeUndefined();
			});

			test("should handle confidence exactly at 0.7 threshold", () => {
				const input = createInput({
					llmResult: createLLMResult({
						confidence: 0.7, // Exactly at threshold
						documentType: "invoice",
					}),
				});

				const result = buildSuggestion(input);

				// 0.7 should trigger LLM path (>= 0.7)
				expect(result.confidence).toBe("medium");
				expect(result.suggestedNoteType).toBe("invoice");
			});

			test("should handle confidence exactly at 0.9 threshold", () => {
				const input = createInput({
					llmResult: createLLMResult({
						confidence: 0.9, // Exactly at threshold
						documentType: "invoice",
					}),
				});

				const result = buildSuggestion(input);

				// 0.9 should be HIGH (>= 0.9)
				expect(result.confidence).toBe("high");
			});

			test("should handle heuristic confidence exactly at 0.5 threshold", () => {
				const input = createInput({
					heuristicResult: createHeuristicResult({
						detected: true,
						suggestedType: "invoice",
						confidence: 0.5, // Exactly at threshold - should NOT trigger
					}),
					llmResult: null,
				});

				const result = buildSuggestion(input);

				// 0.5 should NOT trigger heuristic path (needs > 0.5)
				expect(result.action).toBe("skip");
			});

			test("should handle heuristic confidence at 0.51 (just above threshold)", () => {
				const input = createInput({
					heuristicResult: createHeuristicResult({
						detected: true,
						suggestedType: "invoice",
						confidence: 0.51,
					}),
					llmResult: null,
				});

				const result = buildSuggestion(input);

				// 0.51 should trigger heuristic path
				expect(result.action).toBe("create-note");
				expect(result.suggestedNoteType).toBe("invoice");
			});
		});
	});
});
