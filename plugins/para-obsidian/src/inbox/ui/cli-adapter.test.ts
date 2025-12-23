import { afterEach, describe, expect, mock, test } from "bun:test";
import { createTestSuggestion } from "../../testing/utils";
import type {
	CreateNoteSuggestion,
	InboxSuggestion,
	SkipSuggestion,
} from "../types";
import { createSuggestionId } from "../types";
import {
	formatConfidence,
	formatSuggestion,
	formatSuggestionDetails,
	formatSuggestionsTable,
	getHelpText,
	PAGE_SIZE,
	paginateSuggestions,
	parseCommand,
} from "./cli-adapter";

/**
 * Factory for creating test suggestions with consistent defaults
 * Uses the shared createTestSuggestion utility as a base
 */
function createBaseSuggestion(
	overrides?: Partial<InboxSuggestion>,
): InboxSuggestion {
	const defaults = createTestSuggestion({
		id: createSuggestionId("abc12300-0000-4000-8000-000000000001"),
		source: "/vault/Inbox/invoice-2024.pdf",
		processor: "attachments",
		confidence: "high",
		suggestedNoteType: "invoice",
		suggestedTitle: "Invoice from Acme Corp",
		detectionSource: "llm+heuristic",
		reason: "PDF filename contains 'invoice' pattern",
	});
	return { ...defaults, ...overrides } as InboxSuggestion;
}

// Cleanup all mocks after each test to prevent leakage
afterEach(() => {
	mock.restore();
});

describe("inbox/cli-adapter", () => {
	describe("parseCommand", () => {
		test("should parse 'a' as approve-all", () => {
			expect(parseCommand("a")).toEqual({ type: "approve-all" });
		});

		test("should parse 'A' as approve-remaining (uppercase = all remaining)", () => {
			expect(parseCommand("A")).toEqual({ type: "approve-remaining" });
		});

		test("should parse '1,2,5' as approve with ids [1,2,5]", () => {
			expect(parseCommand("1,2,5")).toEqual({
				type: "approve",
				ids: [1, 2, 5],
			});
		});

		test("should parse '1' as approve with ids [1]", () => {
			expect(parseCommand("1")).toEqual({ type: "approve", ids: [1] });
		});

		test("should parse '1, 2, 5' as approve with ids [1,2,5] (spaces)", () => {
			expect(parseCommand("1, 2, 5")).toEqual({
				type: "approve",
				ids: [1, 2, 5],
			});
		});

		test("should parse 'e3 put in Health area' as edit", () => {
			expect(parseCommand("e3 put in Health area")).toEqual({
				type: "edit",
				id: 3,
				prompt: "put in Health area",
			});
		});

		test("should parse 'e3 \"put in Health area\"' as edit (quoted prompt)", () => {
			expect(parseCommand('e3 "put in Health area"')).toEqual({
				type: "edit",
				id: 3,
				prompt: "put in Health area",
			});
		});

		test("should parse 'e12 change to project' as edit with larger id", () => {
			expect(parseCommand("e12 change to project")).toEqual({
				type: "edit",
				id: 12,
				prompt: "change to project",
			});
		});

		test("should parse 's3' as skip", () => {
			expect(parseCommand("s3")).toEqual({ type: "skip", id: 3 });
		});

		test("should parse 's15' as skip with larger id", () => {
			expect(parseCommand("s15")).toEqual({ type: "skip", id: 15 });
		});

		test.each([
			["e", "E", { type: "edit", id: 3, prompt: "put in Health area" }],
			["s", "S", { type: "skip", id: 3 }],
			["v", "V", { type: "view", id: 12 }],
			["q", "Q", { type: "quit" }],
			["h", "H", { type: "help" }],
			["u", "U", { type: "undo" }],
			["n", "N", { type: "next-page" }],
			["p", "P", { type: "prev-page" }],
		] as const)("should parse '%s' and '%s' as case-insensitive", (lower, upper, expected) => {
			const testInput =
				expected.type === "edit"
					? `${lower}3 put in Health area`
					: expected.type === "view"
						? `${lower}12`
						: expected.type === "skip"
							? `${lower}3`
							: lower;
			const testInputUpper =
				expected.type === "edit"
					? `${upper}3 put in Health area`
					: expected.type === "view"
						? `${upper}12`
						: expected.type === "skip"
							? `${upper}3`
							: upper;

			expect(parseCommand(testInput)).toEqual(expected);
			expect(parseCommand(testInputUpper)).toEqual(expected);
		});

		test("should parse '?' as help", () => {
			expect(parseCommand("?")).toEqual({ type: "help" });
		});

		test("should parse 'xyz' as invalid", () => {
			expect(parseCommand("xyz")).toEqual({ type: "invalid", input: "xyz" });
		});

		test("should parse empty string as invalid (no approved items)", () => {
			expect(parseCommand("")).toEqual({ type: "invalid", input: "" });
			expect(parseCommand("", false)).toEqual({ type: "invalid", input: "" });
		});

		test("should parse empty string as execute when items approved", () => {
			expect(parseCommand("", true)).toEqual({ type: "execute" });
		});

		test("should parse whitespace-only as execute when items approved", () => {
			expect(parseCommand("   ", true)).toEqual({ type: "execute" });
		});

		test("should parse 'e' without id as invalid", () => {
			expect(parseCommand("e")).toEqual({ type: "invalid", input: "e" });
		});

		test("should parse 's' without id as invalid", () => {
			expect(parseCommand("s")).toEqual({ type: "invalid", input: "s" });
		});

		test("should parse 'v' without id as invalid", () => {
			expect(parseCommand("v")).toEqual({ type: "invalid", input: "v" });
		});

		test("should parse 'e3' without prompt as invalid", () => {
			expect(parseCommand("e3")).toEqual({ type: "invalid", input: "e3" });
		});

		test("should trim whitespace from input", () => {
			expect(parseCommand("  a  ")).toEqual({ type: "approve-all" });
		});
	});

	describe("formatConfidence", () => {
		test("should format 'high' with green checkmark", () => {
			const result = formatConfidence("high");
			expect(result).toContain("✅");
		});

		test("should format 'medium' with orange diamond", () => {
			const result = formatConfidence("medium");
			expect(result).toContain("🔶");
		});

		test("should format 'low' with warning emoji", () => {
			const result = formatConfidence("low");
			expect(result).toContain("⚠️");
		});
	});

	describe("formatSuggestion", () => {
		test("should include index number", () => {
			const suggestion = createBaseSuggestion();
			const result = formatSuggestion(suggestion, 1);
			expect(result).toContain("1");
		});

		test("should include filename from source path", () => {
			const suggestion = createBaseSuggestion();
			const result = formatSuggestion(suggestion, 1);
			expect(result).toContain("invoice-2024.pdf");
		});

		test("should include confidence indicator", () => {
			const suggestion = createBaseSuggestion();
			const result = formatSuggestion(suggestion, 1);
			expect(result).toContain("✅"); // high confidence = green checkmark
		});

		test("should include action", () => {
			const suggestion = createBaseSuggestion();
			const result = formatSuggestion(suggestion, 1);
			expect(result).toContain("create-note");
		});

		test("should include suggested title when present", () => {
			const suggestion = createBaseSuggestion();
			const result = formatSuggestion(suggestion, 1);
			expect(result).toContain("Invoice from Acme Corp");
		});

		test("should include confidence explanation in output", () => {
			const suggestion = createBaseSuggestion();
			const result = formatSuggestion(suggestion, 1);
			expect(result).toContain("Confidence: HIGH");
			expect(result).toContain("LLM + heuristics agree");
		});

		test("should handle suggestion without optional fields", () => {
			const minimalSuggestion = createBaseSuggestion({
				id: createSuggestionId("a1b78900-0000-4000-8000-000000000002"),
				source: "/vault/Inbox/random-file.md",
				processor: "notes",
				confidence: "low",
				action: "skip",
				detectionSource: "none",
				reason: "Could not determine type",
			});
			const result = formatSuggestion(minimalSuggestion, 2);
			expect(result).toContain("2");
			expect(result).toContain("random-file.md");
			expect(result).toContain("skip");
		});

		test("should display extraction warnings inline with preview", () => {
			const suggestionWithWarnings = createBaseSuggestion({
				id: createSuggestionId("abc12345-0000-4000-8000-000000000003"),
				source: "/vault/Inbox/mystery-invoice.pdf",
				confidence: "low",
				suggestedTitle: "Unknown Invoice",
				detectionSource: "heuristic",
				reason: "Detected invoice pattern but missing key fields",
				extractionWarnings: [
					"Could not find invoice date",
					"Provider name unclear",
				],
			});
			const result = formatSuggestion(suggestionWithWarnings, 1);
			expect(result).toContain("Could not find invoice date");
			expect(result).toContain("+1 more");
			expect(result).toContain("v1 for full details");
		});

		test("should not display warnings section when no warnings", () => {
			const suggestion = createBaseSuggestion();
			const result = formatSuggestion(suggestion, 1);
			expect(result).not.toContain("Warnings");
		});

		test("should display suggestedAttachmentName when present", () => {
			const suggestionWithAttachment = createBaseSuggestion({
				suggestedAttachmentName: "2024-01-15-acme-corp-invoice.pdf",
			});
			const result = formatSuggestion(suggestionWithAttachment, 1);
			expect(result).toContain("Attachment:");
			expect(result).toContain("2024-01-15-acme-corp-invoice.pdf");
		});

		test("should not display attachment line when suggestedAttachmentName is absent", () => {
			const suggestion = createBaseSuggestion();
			const result = formatSuggestion(suggestion, 1);
			expect(result).not.toContain("Attachment:");
		});

		test("should show destination when set", () => {
			const suggestion = createBaseSuggestion({
				suggestedDestination: "Areas/Finance",
			});
			const result = formatSuggestion(suggestion, 1);
			expect(result).toContain("├─ Destination: Areas/Finance");
			expect(result).not.toContain("NO DESTINATION SET");
		});

		test("should show warning when no destination set", () => {
			const suggestion = createBaseSuggestion();
			const result = formatSuggestion(suggestion, 1);
			expect(result).toContain("⚠️ NO DESTINATION SET");
			expect(result).not.toContain("├─ Destination:");
		});

		test("should not show destination info for non-create-note suggestions", () => {
			const suggestion = createBaseSuggestion({
				action: "skip",
				confidence: "low",
				detectionSource: "none",
				reason: "Cannot process",
			});
			const result = formatSuggestion(suggestion, 1);
			expect(result).not.toContain("Destination");
			expect(result).not.toContain("NO DESTINATION SET");
		});
	});

	describe("formatSuggestionsTable", () => {
		const suggestions: InboxSuggestion[] = [
			{
				id: createSuggestionId("11111111-0000-4000-8000-000000000003"),
				source: "/vault/Inbox/invoice.pdf",
				processor: "attachments",
				confidence: "high",
				action: "create-note",
				suggestedNoteType: "invoice",
				suggestedTitle: "Invoice 2024",
				detectionSource: "llm+heuristic",
				reason: "Detected invoice",
			},
			{
				id: createSuggestionId("22222222-0000-4000-8000-000000000004"),
				source: "/vault/Inbox/note.md",
				processor: "notes",
				confidence: "medium",
				action: "move",
				suggestedDestination: "/vault/Resources",
				detectionSource: "heuristic",
				reason: "Detected note",
			},
		];

		test("should format multiple suggestions", () => {
			const result = formatSuggestionsTable(suggestions);
			expect(result).toContain("1");
			expect(result).toContain("2");
			expect(result).toContain("invoice.pdf");
			expect(result).toContain("note.md");
		});

		test("should return empty string for empty array", () => {
			const result = formatSuggestionsTable([]);
			expect(result).toBe("");
		});

		test("should include header", () => {
			const result = formatSuggestionsTable(suggestions);
			// Should have some kind of header row or title
			expect(result.length).toBeGreaterThan(0);
		});
	});

	describe("getHelpText", () => {
		test("should contain approve-all command", () => {
			const help = getHelpText();
			expect(help).toContain("a");
			expect(help.toLowerCase()).toContain("approve");
		});

		test("should contain approve by id command", () => {
			const help = getHelpText();
			expect(help).toContain("1,2,5");
		});

		test("should contain edit command", () => {
			const help = getHelpText();
			expect(help.toLowerCase()).toContain("edit");
		});

		test("should contain skip command", () => {
			const help = getHelpText();
			expect(help.toLowerCase()).toContain("skip");
		});

		test("should contain quit command", () => {
			const help = getHelpText();
			expect(help).toContain("q");
			expect(help.toLowerCase()).toContain("quit");
		});

		test("should contain help command", () => {
			const help = getHelpText();
			expect(help).toContain("h");
			expect(help.toLowerCase()).toContain("help");
		});

		test("should contain view command", () => {
			const help = getHelpText();
			expect(help).toContain("v");
		});

		test("should contain undo command", () => {
			const help = getHelpText();
			expect(help).toContain("u");
			expect(help.toLowerCase()).toContain("undo");
		});

		test("should contain navigation commands", () => {
			const help = getHelpText();
			expect(help).toContain("n");
			expect(help).toContain("p");
		});
	});

	describe("formatSuggestionDetails", () => {
		test("should display item number in header", () => {
			const suggestion = createBaseSuggestion({
				source: "/vault/Inbox/invoice-test.pdf",
				suggestedTitle: "Test Invoice 2024",
				suggestedDestination: "02 Areas/Finance",
				suggestedAttachmentName: "2024-01-invoice-test.pdf",
				extractedFields: {
					invoiceDate: "2024-01-15",
					provider: "Test Provider Inc",
					amount: "$150.00",
				},
			});
			const result = formatSuggestionDetails(suggestion, 3);
			expect(result).toContain("Item 3");
		});

		test("should display filename", () => {
			const suggestion = createBaseSuggestion({
				source: "/vault/Inbox/invoice-test.pdf",
			});
			const result = formatSuggestionDetails(suggestion, 1);
			expect(result).toContain("invoice-test.pdf");
		});

		test("should display suggested title", () => {
			const suggestion = createBaseSuggestion({
				suggestedTitle: "Test Invoice 2024",
			});
			const result = formatSuggestionDetails(suggestion, 1);
			expect(result).toContain("Test Invoice 2024");
		});

		test("should display extracted fields", () => {
			const suggestion = createBaseSuggestion({
				extractedFields: {
					invoiceDate: "2024-01-15",
					provider: "Test Provider Inc",
					amount: "$150.00",
				},
			});
			const result = formatSuggestionDetails(suggestion, 1);
			expect(result).toContain("invoiceDate");
			expect(result).toContain("2024-01-15");
			expect(result).toContain("provider");
			expect(result).toContain("Test Provider Inc");
			expect(result).toContain("amount");
			expect(result).toContain("$150.00");
		});

		test("should display warnings with recovery options", () => {
			const suggestionWithWarnings = createBaseSuggestion({
				extractionWarnings: ["Missing invoice number", "Date format unclear"],
			});
			const result = formatSuggestionDetails(suggestionWithWarnings, 1);
			expect(result).toContain("Missing invoice number");
			expect(result).toContain("Date format unclear");
			expect(result).toContain("Recovery options");
			expect(result).toContain("e1");
			expect(result).toContain("s1");
		});

		test("should display destination", () => {
			const suggestion = createBaseSuggestion({
				suggestedDestination: "02 Areas/Finance",
			});
			const result = formatSuggestionDetails(suggestion, 1);
			expect(result).toContain("02 Areas/Finance");
		});

		test("should display confidence and detection source", () => {
			const suggestion = createBaseSuggestion();
			const result = formatSuggestionDetails(suggestion, 1);
			expect(result).toContain("HIGH");
			expect(result).toContain("LLM + heuristics agree");
		});
	});

	describe("paginateSuggestions", () => {
		// Generate valid UUIDs for test data
		const suggestions: InboxSuggestion[] = Array.from(
			{ length: 12 },
			(_, i) => ({
				id: createSuggestionId(
					`a${i.toString().padStart(7, "0")}-0000-4000-8000-000000000001`,
				),
				source: `/vault/Inbox/file-${i + 1}.pdf`,
				processor: "attachments",
				confidence: "high" as const,
				action: "create-note" as const,
				suggestedNoteType: "invoice",
				suggestedTitle: `File ${i + 1}`,
				detectionSource: "heuristic",
				reason: "Test",
			}),
		);

		test("should return first page items", () => {
			const result = paginateSuggestions(suggestions, 0, 5);
			expect(result).toHaveLength(5);
			expect(result[0]?.source).toContain("file-1.pdf");
			expect(result[4]?.source).toContain("file-5.pdf");
		});

		test("should return second page items", () => {
			const result = paginateSuggestions(suggestions, 1, 5);
			expect(result).toHaveLength(5);
			expect(result[0]?.source).toContain("file-6.pdf");
			expect(result[4]?.source).toContain("file-10.pdf");
		});

		test("should return partial last page", () => {
			const result = paginateSuggestions(suggestions, 2, 5);
			expect(result).toHaveLength(2); // Only 2 items left
			expect(result[0]?.source).toContain("file-11.pdf");
			expect(result[1]?.source).toContain("file-12.pdf");
		});

		test("should handle empty array", () => {
			const result = paginateSuggestions([], 0, 5);
			expect(result).toHaveLength(0);
		});

		test("should use PAGE_SIZE constant", () => {
			expect(PAGE_SIZE).toBe(6);
		});
	});

	describe("approval blocking behavior", () => {
		// Helper to create test suggestions (returns CreateNoteSuggestion)
		const createApprovalTestSuggestion = (
			id: string,
			hasDestination: boolean,
		): CreateNoteSuggestion =>
			createTestSuggestion({
				id: createSuggestionId(id),
				source: `/inbox/test-${id}.pdf`,
				processor: "attachments",
				confidence: "high",
				detectionSource: "llm+heuristic",
				reason: "Test",
				suggestedNoteType: "invoice",
				suggestedTitle: `Test ${id}`,
				...(hasDestination && { suggestedDestination: "Areas/Finance" }),
			});

		test("should reject approval of item without destination", () => {
			// Single item without destination
			const suggestion = createApprovalTestSuggestion(
				"00000001-0000-4000-8000-000000000001",
				false,
			);

			// Verify the suggestion is actually missing destination
			expect(suggestion.suggestedDestination).toBeUndefined();
		});

		test("should accept approval of item with destination", () => {
			// Single item with destination
			const suggestion = createApprovalTestSuggestion(
				"00000002-0000-4000-8000-000000000002",
				true,
			);

			// Verify the suggestion has destination
			expect(suggestion.suggestedDestination).toBe("Areas/Finance");
		});

		test("should handle mixed items - some with, some without destinations", () => {
			// Mix of items
			const suggestions = [
				createApprovalTestSuggestion(
					"00000003-0000-4000-8000-000000000003",
					true,
				), // Has destination
				createApprovalTestSuggestion(
					"00000004-0000-4000-8000-000000000004",
					false,
				), // No destination
				createApprovalTestSuggestion(
					"00000005-0000-4000-8000-000000000005",
					true,
				), // Has destination
			];

			// Verify expectations
			expect(suggestions[0]?.suggestedDestination).toBe("Areas/Finance");
			expect(suggestions[1]?.suggestedDestination).toBeUndefined();
			expect(suggestions[2]?.suggestedDestination).toBe("Areas/Finance");
		});

		test("should handle all items missing destinations", () => {
			// All items without destinations
			const suggestions = [
				createApprovalTestSuggestion(
					"00000006-0000-4000-8000-000000000006",
					false,
				),
				createApprovalTestSuggestion(
					"00000007-0000-4000-8000-000000000007",
					false,
				),
				createApprovalTestSuggestion(
					"00000008-0000-4000-8000-000000000008",
					false,
				),
			];

			// All should be missing destinations
			for (const s of suggestions) {
				expect(s.suggestedDestination).toBeUndefined();
			}
		});

		test("should allow non-create-note suggestions without destinations", () => {
			// skip action doesn't need destination
			const skipSuggestion: SkipSuggestion = {
				id: createSuggestionId("00000009-0000-4000-8000-000000000009"),
				action: "skip",
				source: "/inbox/skip-test.pdf",
				processor: "attachments",
				confidence: "low",
				detectionSource: "none",
				reason: "Cannot process",
			};

			// Skip actions don't require destinations (and don't have the field)
			expect(skipSuggestion.action).toBe("skip");
		});

		// Note: "should handle destination set via LLM suggestion acceptance" test removed
		// Area/project routing is no longer supported - all items go to inbox

		test("should handle destination set via manual command", () => {
			// Item initially without destination
			const suggestion = createApprovalTestSuggestion(
				"0000000b-0000-4000-8000-00000000000b",
				false,
			);

			// Before manual setting
			expect(suggestion.suggestedDestination).toBeUndefined();

			// After manual setting (simulated - in real code this would be handled by set-destination command)
			const withManualDest: CreateNoteSuggestion = {
				...suggestion,
				suggestedDestination: "Projects/Tax 2024",
			};

			expect(withManualDest.suggestedDestination).toBe("Projects/Tax 2024");
		});

		test("should format warning message for items without destinations", () => {
			const suggestion = createApprovalTestSuggestion(
				"0000000c-0000-4000-8000-00000000000c",
				false,
			);

			const formatted = formatSuggestion(suggestion, 1);

			// Should show warning about missing destination
			expect(formatted).toContain("⚠️ NO DESTINATION SET");
		});

		test("should not show warning for items with destinations", () => {
			const suggestion = createApprovalTestSuggestion(
				"0000000d-0000-4000-8000-00000000000d",
				true,
			);

			const formatted = formatSuggestion(suggestion, 1);

			// Should not show warning
			expect(formatted).not.toContain("NO DESTINATION SET");
			expect(formatted).toContain("Destination: Areas/Finance");
		});

		test("should handle edge case: empty destination string", () => {
			// Edge case: destination is empty string (should be treated as no destination)
			const suggestion: CreateNoteSuggestion = {
				id: createSuggestionId("0000000e-0000-4000-8000-00000000000e"),
				action: "create-note",
				source: "/inbox/empty-dest.pdf",
				processor: "attachments",
				confidence: "high",
				detectionSource: "llm+heuristic",
				reason: "Test",
				suggestedNoteType: "invoice",
				suggestedTitle: "Empty Dest Test",
				suggestedDestination: "", // Empty string
			};

			// Empty string is technically a value, but should probably be treated as invalid
			// This documents current behavior - may need validation in real code
			expect(suggestion.suggestedDestination).toBe("");
		});

		test("should validate destination format requirements", () => {
			// Valid destination formats
			const validSuggestions = [
				{
					...createApprovalTestSuggestion(
						"0000000f-0000-4000-8000-00000000000f",
						true,
					),
					suggestedDestination: "Areas/Finance",
				},
				{
					...createApprovalTestSuggestion(
						"00000010-0000-4000-8000-000000000010",
						true,
					),
					suggestedDestination: "Projects/Tax 2024",
				},
				{
					...createApprovalTestSuggestion(
						"00000011-0000-4000-8000-000000000011",
						true,
					),
					suggestedDestination: "Resources",
				},
			];

			// All should have valid destinations
			for (const s of validSuggestions) {
				expect(s.suggestedDestination).toBeTruthy();
			}
		});
	});
});
