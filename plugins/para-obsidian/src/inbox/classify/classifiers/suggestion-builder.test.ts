/**
 * Suggestion Builder Tests - Classifier Version
 *
 * Tests for the buildSuggestion() routing logic with two paths:
 * 1. Fast-path: Items with frontmatter routing (area/project) → auto-route to area/project
 * 2. LLM-path: Items without routing frontmatter → created in inbox folder
 *
 * @module classifiers/suggestion-builder.test
 */

import { describe, expect, test } from "bun:test";
import { isCreateNoteSuggestion } from "../../types";
import type { DocumentTypeResult } from "../llm-classifier";
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

describe("classifiers/suggestion-builder", () => {
	describe("buildSuggestion", () => {
		describe("Fast-path routing (frontmatter with area/project)", () => {
			test("should set destination for frontmatter-routed item with area", () => {
				const input = createInput({
					llmResult: createLLMResult({
						confidence: 0.85,
						documentType: "invoice",
						suggestedArea: "Finance",
					}),
					detectionSource: "frontmatter", // Frontmatter fast-path
				});

				const result = buildSuggestion(input);

				expect(result.action).toBe("create-note");
				if (isCreateNoteSuggestion(result)) {
					expect(result.suggestedDestination).toBe("Finance");
					expect(result.suggestedArea).toBe("Finance");
					expect(result.llmSuggestedArea).toBeUndefined();
					expect(result.llmSuggestedProject).toBeUndefined();
				}
			});

			test("should set destination for frontmatter-routed item with project", () => {
				const input = createInput({
					llmResult: createLLMResult({
						confidence: 0.85,
						documentType: "bookmark",
						suggestedProject: "Tax 2024",
					}),
					detectionSource: "frontmatter", // Frontmatter fast-path
				});

				const result = buildSuggestion(input);

				expect(result.action).toBe("create-note");
				if (isCreateNoteSuggestion(result)) {
					expect(result.suggestedDestination).toBe("Tax 2024");
					expect(result.suggestedProject).toBe("Tax 2024");
					expect(result.llmSuggestedArea).toBeUndefined();
					expect(result.llmSuggestedProject).toBeUndefined();
				}
			});

			test("should prefer area over project when both present (frontmatter)", () => {
				const input = createInput({
					llmResult: createLLMResult({
						confidence: 0.85,
						documentType: "invoice",
						suggestedArea: "Health",
						suggestedProject: "Medical 2024",
					}),
					detectionSource: "frontmatter", // Frontmatter fast-path
				});

				const result = buildSuggestion(input);

				expect(result.action).toBe("create-note");
				if (isCreateNoteSuggestion(result)) {
					expect(result.suggestedDestination).toBe("Health");
					expect(result.suggestedArea).toBe("Health");
					expect(result.suggestedProject).toBe("Medical 2024");
				}
			});
		});

		describe("LLM-path routing (no frontmatter routing)", () => {
			test("should set destination to inbox folder for LLM-detected bookmark with area", () => {
				const input = createInput({
					llmResult: createLLMResult({
						confidence: 0.85,
						documentType: "bookmark",
						suggestedArea: "Resources",
					}),
					// No detectionSource override - defaults to "llm"
				});

				const result = buildSuggestion(input);

				expect(result.action).toBe("create-note");
				if (isCreateNoteSuggestion(result)) {
					expect(result.suggestedDestination).toBe("00 Inbox"); // Note created in inbox
					expect(result.llmSuggestedArea).toBe("Resources"); // LLM suggestion stored for display
					expect(result.llmSuggestedProject).toBeUndefined();
					expect(result.suggestedArea).toBe("Resources"); // Original field preserved
				}
			});

			test("should set destination to inbox folder for LLM-detected item with project", () => {
				const input = createInput({
					llmResult: createLLMResult({
						confidence: 0.85,
						documentType: "invoice",
						suggestedProject: "Tax 2024",
					}),
				});

				const result = buildSuggestion(input);

				expect(result.action).toBe("create-note");
				if (isCreateNoteSuggestion(result)) {
					expect(result.suggestedDestination).toBe("00 Inbox"); // Note created in inbox
					expect(result.llmSuggestedArea).toBeUndefined();
					expect(result.llmSuggestedProject).toBe("Tax 2024"); // LLM suggestion stored for display
					expect(result.suggestedProject).toBe("Tax 2024"); // Original preserved
				}
			});

			test("should store both LLM suggestions when area and project present", () => {
				const input = createInput({
					llmResult: createLLMResult({
						confidence: 0.85,
						documentType: "booking",
						suggestedArea: "Travel",
						suggestedProject: "Europe Trip",
					}),
				});

				const result = buildSuggestion(input);

				expect(result.action).toBe("create-note");
				if (isCreateNoteSuggestion(result)) {
					expect(result.suggestedDestination).toBe("00 Inbox"); // Note created in inbox
					expect(result.llmSuggestedArea).toBe("Travel"); // Stored for display
					expect(result.llmSuggestedProject).toBe("Europe Trip"); // Stored for display
					expect(result.suggestedArea).toBe("Travel");
					expect(result.suggestedProject).toBe("Europe Trip");
				}
			});

			test("should set destination to inbox folder for heuristic-only detection", () => {
				const input = createInput({
					heuristicResult: createHeuristicResult({
						detected: true,
						suggestedType: "invoice",
						confidence: 0.75,
					}),
					llmResult: null,
				});

				const result = buildSuggestion(input);

				expect(result.action).toBe("create-note");
				if (isCreateNoteSuggestion(result)) {
					expect(result.suggestedDestination).toBe("00 Inbox"); // Note created in inbox
					expect(result.llmSuggestedArea).toBeUndefined();
					expect(result.llmSuggestedProject).toBeUndefined();
					expect(result.suggestedArea).toBeUndefined();
					expect(result.suggestedProject).toBeUndefined();
				}
			});

			test("should set destination to inbox folder for LLM+heuristic detection without routing fields", () => {
				const input = createInput({
					heuristicResult: createHeuristicResult({
						detected: true,
						suggestedType: "invoice",
						confidence: 0.75,
					}),
					llmResult: createLLMResult({
						confidence: 0.85,
						documentType: "invoice",
						// No suggestedArea or suggestedProject
					}),
				});

				const result = buildSuggestion(input);

				expect(result.confidence).toBe("high"); // Boosted by agreement
				expect(result.action).toBe("create-note");
				if (isCreateNoteSuggestion(result)) {
					expect(result.suggestedDestination).toBe("00 Inbox"); // Note created in inbox
					expect(result.llmSuggestedArea).toBeUndefined();
					expect(result.llmSuggestedProject).toBeUndefined();
				}
			});
		});

		describe("Edge cases", () => {
			test("should set destination to inbox folder for frontmatter detection without routing fields", () => {
				const input = createInput({
					llmResult: createLLMResult({
						confidence: 0.85,
						documentType: "invoice",
						// No suggestedArea or suggestedProject
					}),
					detectionSource: "frontmatter",
				});

				const result = buildSuggestion(input);

				expect(result.action).toBe("create-note");
				if (isCreateNoteSuggestion(result)) {
					// Frontmatter flag is set but no routing fields → created in inbox
					expect(result.suggestedDestination).toBe("00 Inbox");
					expect(result.llmSuggestedArea).toBeUndefined();
					expect(result.llmSuggestedProject).toBeUndefined();
				}
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

		describe("Backward compatibility", () => {
			test("should create notes in inbox folder for non-bookmark types", () => {
				const input = createInput({
					llmResult: createLLMResult({
						confidence: 0.85,
						documentType: "invoice",
						suggestedArea: "Finance",
					}),
				});

				const result = buildSuggestion(input);

				expect(result.action).toBe("create-note");
				if (isCreateNoteSuggestion(result)) {
					expect(result.suggestedNoteType).toBe("invoice");
					expect(result.suggestedArea).toBe("Finance");
					// LLM-path: destination is inbox folder
					expect(result.suggestedDestination).toBe("00 Inbox");
					expect(result.llmSuggestedArea).toBe("Finance");
				}
			});

			test("should extract all fields from LLM result", () => {
				const input = createInput({
					llmResult: createLLMResult({
						confidence: 0.85,
						documentType: "invoice",
						suggestedArea: "Finance",
						suggestedProject: "Tax 2024",
						extractedFields: {
							amount: "100.00",
							provider: "Acme Corp",
							date: "2024-01-15",
						},
						reasoning: "Detected invoice with amount and provider",
					}),
				});

				const result = buildSuggestion(input);

				expect(result.action).toBe("create-note");
				if (isCreateNoteSuggestion(result)) {
					expect(result.suggestedNoteType).toBe("invoice");
					expect(result.suggestedArea).toBe("Finance");
					expect(result.suggestedProject).toBe("Tax 2024");
					expect(result.extractedFields).toEqual({
						amount: "100.00",
						provider: "Acme Corp",
						date: "2024-01-15",
					});
					expect(result.reason).toContain("Detected invoice");
				}
			});
		});

		describe("Attachment naming with hash", () => {
			test("should generate timestamped attachment name when hash provided", () => {
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

				expect(result.action).toBe("create-note");
				if (isCreateNoteSuggestion(result)) {
					expect(result.suggestedAttachmentName).toBeDefined();
					// Hash is truncated to short form (first 4 chars) in filename
					expect(result.suggestedAttachmentName).toContain("abc1");
					expect(result.suggestedAttachmentName).toContain("invoice");
					expect(result.suggestedAttachmentName).toContain("2024-01-15");
				}
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

				expect(result.action).toBe("create-note");
				if (isCreateNoteSuggestion(result)) {
					expect(result.suggestedAttachmentName).toBeUndefined();
				}
			});
		});
	});
});
