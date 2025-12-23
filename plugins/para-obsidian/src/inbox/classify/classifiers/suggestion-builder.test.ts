/**
 * Suggestion Builder Tests - Classifier Version
 *
 * Tests for the buildSuggestion() pure function.
 * No filesystem operations needed - all tests operate on in-memory data structures.
 * All items are now created in the inbox folder - no area/project auto-routing.
 *
 * @module classifiers/suggestion-builder.test
 */

import { afterEach, describe, expect, mock, test } from "bun:test";

// Mock loadConfig BEFORE importing suggestion-builder
// The function calls loadConfig() to apply title prefixes
mock.module("../../../config/index", () => ({
	loadConfig: () => ({
		vaultPath: "/mock/vault",
		inboxFolder: "00 Inbox",
		attachmentsFolder: "Attachments",
		templatesFolder: "Templates",
		titlePrefixes: {},
	}),
}));

import type { CreateNoteSuggestion } from "../../types";
import type { DocumentTypeResult } from "../llm-classifier";
import {
	buildSuggestion,
	type HeuristicResult,
	type SuggestionInput,
} from "./suggestion-builder";

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Type guard helper - asserts result is CreateNoteSuggestion and allows testing fields
 */
function expectCreateNoteSuggestion(
	result: unknown,
	assertions: (suggestion: CreateNoteSuggestion) => void,
): void {
	expect(result).toHaveProperty("action", "create-note");
	assertions(result as CreateNoteSuggestion);
}

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

describe("classifiers/suggestion-builder", () => {
	afterEach(() => {
		mock.restore();
	});

	describe("buildSuggestion", () => {
		describe("Inbox destination (all items go to inbox)", () => {
			test("should set destination to inbox folder for LLM detection", () => {
				const input = createInput({
					llmResult: createLLMResult({
						confidence: 0.85,
						documentType: "invoice",
					}),
				});

				const result = buildSuggestion(input);

				expectCreateNoteSuggestion(result, (suggestion) => {
					expect(suggestion.suggestedDestination).toBe("00 Inbox");
				});
			});

			test("should set destination to inbox folder for heuristic detection", () => {
				const input = createInput({
					heuristicResult: createHeuristicResult({
						detected: true,
						suggestedType: "invoice",
						confidence: 0.75,
					}),
					llmResult: null,
				});

				const result = buildSuggestion(input);

				expectCreateNoteSuggestion(result, (suggestion) => {
					expect(suggestion.suggestedDestination).toBe("00 Inbox");
				});
			});

			test("should set destination to inbox folder for LLM+heuristic detection", () => {
				const input = createInput({
					heuristicResult: createHeuristicResult({
						detected: true,
						suggestedType: "invoice",
						confidence: 0.75,
					}),
					llmResult: createLLMResult({
						confidence: 0.85,
						documentType: "invoice",
					}),
				});

				const result = buildSuggestion(input);

				expect(result.confidence).toBe("high"); // Boosted by agreement
				expectCreateNoteSuggestion(result, (suggestion) => {
					expect(suggestion.suggestedDestination).toBe("00 Inbox");
				});
			});
		});

		describe("Edge cases", () => {
			test("should set destination to inbox folder for frontmatter detection", () => {
				const input = createInput({
					llmResult: createLLMResult({
						confidence: 0.85,
						documentType: "invoice",
					}),
					detectionSource: "frontmatter",
				});

				const result = buildSuggestion(input);

				expectCreateNoteSuggestion(result, (suggestion) => {
					expect(suggestion.suggestedDestination).toBe("00 Inbox");
				});
			});

			test("should handle 'none' detection source (no LLM suggestions)", () => {
				const input = createInput({
					detectionSource: "none",
				});

				const result = buildSuggestion(input);

				expect(result.action).toBe("skip");
				expect(result.confidence).toBe("low");
			});

			test("should handle skip action (no create-note fields)", () => {
				const input = createInput({
					llmResult: createLLMResult({
						confidence: 0.3, // Low confidence
						documentType: "generic",
					}),
				});

				const result = buildSuggestion(input);

				expect(result.action).toBe("skip");
				expect(result.confidence).toBe("low");
			});
		});

		describe("Field extraction", () => {
			test("should create notes in inbox folder", () => {
				const input = createInput({
					llmResult: createLLMResult({
						confidence: 0.85,
						documentType: "invoice",
					}),
				});

				const result = buildSuggestion(input);

				expectCreateNoteSuggestion(result, (suggestion) => {
					expect(suggestion.suggestedNoteType).toBe("invoice");
					expect(suggestion.suggestedDestination).toBe("00 Inbox");
				});
			});

			test("should extract all fields from LLM result", () => {
				const input = createInput({
					llmResult: createLLMResult({
						confidence: 0.85,
						documentType: "invoice",
						extractedFields: {
							amount: "100.00",
							provider: "Acme Corp",
							date: "2024-01-15",
						},
						reasoning: "Detected invoice with amount and provider",
					}),
				});

				const result = buildSuggestion(input);

				expectCreateNoteSuggestion(result, (suggestion) => {
					expect(suggestion.suggestedNoteType).toBe("invoice");
					expect(suggestion.extractedFields).toEqual({
						amount: "100.00",
						provider: "Acme Corp",
						date: "2024-01-15",
					});
					expect(suggestion.reason).toContain("Detected invoice");
				});
			});
		});

		describe("Attachment naming with hash", () => {
			test("should generate ideal attachment name without hash (collision check at execute)", () => {
				const input = createInput({
					filename: "receipt.pdf",
					llmResult: createLLMResult({
						confidence: 0.85,
						documentType: "invoice",
						extractedFields: {
							provider: "Coffee Shop",
							date: "2024-01-15",
						},
					}),
					hash: "abc123def456",
				});

				const result = buildSuggestion(input);

				expectCreateNoteSuggestion(result, (suggestion) => {
					expect(suggestion.suggestedAttachmentName).toBeDefined();
					// Preview shows ideal name WITHOUT hash (hash added at execute if collision)
					expect(suggestion.suggestedAttachmentName).not.toContain("abc1");
					expect(suggestion.suggestedAttachmentName).toContain("invoice");
					expect(suggestion.suggestedAttachmentName).toContain("2024-01-15");
					// Pattern match instead of exact string - allows flexibility in implementation
					expect(suggestion.suggestedAttachmentName).toMatch(
						/2024-01-15-invoice-.*\.pdf/,
					);
				});
			});

			test("should NOT generate attachment name without hash", () => {
				const input = createInput({
					filename: "receipt.pdf",
					llmResult: createLLMResult({
						confidence: 0.85,
						documentType: "invoice",
					}),
					// No hash provided
				});

				const result = buildSuggestion(input);

				expectCreateNoteSuggestion(result, (suggestion) => {
					expect(suggestion.suggestedAttachmentName).toBeUndefined();
				});
			});
		});
	});
});
