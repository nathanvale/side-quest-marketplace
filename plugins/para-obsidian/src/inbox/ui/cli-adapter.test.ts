import { describe, expect, test } from "bun:test";
import { createSuggestionId, type InboxSuggestion } from "../types";
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

		test("should parse 'E3 put in Health area' as edit (case insensitive)", () => {
			expect(parseCommand("E3 put in Health area")).toEqual({
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

		test("should parse 'S3' as skip (case insensitive)", () => {
			expect(parseCommand("S3")).toEqual({ type: "skip", id: 3 });
		});

		test("should parse 's15' as skip with larger id", () => {
			expect(parseCommand("s15")).toEqual({ type: "skip", id: 15 });
		});

		test("should parse 'q' as quit", () => {
			expect(parseCommand("q")).toEqual({ type: "quit" });
		});

		test("should parse 'Q' as quit (case insensitive)", () => {
			expect(parseCommand("Q")).toEqual({ type: "quit" });
		});

		test("should parse 'h' as help", () => {
			expect(parseCommand("h")).toEqual({ type: "help" });
		});

		test("should parse 'H' as help (case insensitive)", () => {
			expect(parseCommand("H")).toEqual({ type: "help" });
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

		test("should parse 'v3' as view", () => {
			expect(parseCommand("v3")).toEqual({ type: "view", id: 3 });
		});

		test("should parse 'V12' as view (case insensitive)", () => {
			expect(parseCommand("V12")).toEqual({ type: "view", id: 12 });
		});

		test("should parse 'v' without id as invalid", () => {
			expect(parseCommand("v")).toEqual({ type: "invalid", input: "v" });
		});

		test("should parse 'u' as undo", () => {
			expect(parseCommand("u")).toEqual({ type: "undo" });
		});

		test("should parse 'U' as undo (case insensitive)", () => {
			expect(parseCommand("U")).toEqual({ type: "undo" });
		});

		test("should parse 'n' as next-page", () => {
			expect(parseCommand("n")).toEqual({ type: "next-page" });
		});

		test("should parse 'N' as next-page (case insensitive)", () => {
			expect(parseCommand("N")).toEqual({ type: "next-page" });
		});

		test("should parse 'p' as prev-page", () => {
			expect(parseCommand("p")).toEqual({ type: "prev-page" });
		});

		test("should parse 'P' as prev-page (case insensitive)", () => {
			expect(parseCommand("P")).toEqual({ type: "prev-page" });
		});

		test("should parse 'e3' without prompt as invalid", () => {
			expect(parseCommand("e3")).toEqual({ type: "invalid", input: "e3" });
		});

		test("should trim whitespace from input", () => {
			expect(parseCommand("  a  ")).toEqual({ type: "approve-all" });
		});

		// Accept suggestion command tests
		test("should parse 'y1' as accept-suggestion", () => {
			expect(parseCommand("y1")).toEqual({ type: "accept-suggestion", id: 1 });
		});

		test("should parse 'Y1' as accept-suggestion (case insensitive)", () => {
			expect(parseCommand("Y1")).toEqual({ type: "accept-suggestion", id: 1 });
		});

		test("should parse 'y12' as accept-suggestion with larger id", () => {
			expect(parseCommand("y12")).toEqual({
				type: "accept-suggestion",
				id: 12,
			});
		});

		test("should parse 'y' without id as invalid", () => {
			expect(parseCommand("y")).toEqual({ type: "invalid", input: "y" });
		});

		// Set destination command tests
		test("should parse 'd1 Areas/Health' as set-destination", () => {
			expect(parseCommand("d1 Areas/Health")).toEqual({
				type: "set-destination",
				id: 1,
				path: "Areas/Health",
			});
		});

		test("should parse 'D2 Projects/Tax 2024' as set-destination (case insensitive)", () => {
			expect(parseCommand("D2 Projects/Tax 2024")).toEqual({
				type: "set-destination",
				id: 2,
				path: "Projects/Tax 2024",
			});
		});

		test("should parse 'd3 Resources' as set-destination", () => {
			expect(parseCommand("d3 Resources")).toEqual({
				type: "set-destination",
				id: 3,
				path: "Resources",
			});
		});

		test("should trim whitespace from destination path", () => {
			expect(parseCommand("d1   Areas/Finance  ")).toEqual({
				type: "set-destination",
				id: 1,
				path: "Areas/Finance",
			});
		});

		test("should reject paths with ../ (path traversal)", () => {
			expect(parseCommand("d1 ../etc/passwd")).toEqual({
				type: "invalid",
				input: "d1 ../etc/passwd",
			});
		});

		test("should reject paths with ../ in middle", () => {
			expect(parseCommand("d1 Areas/../Projects")).toEqual({
				type: "invalid",
				input: "d1 Areas/../Projects",
			});
		});

		test("should parse 'd' without id as invalid", () => {
			expect(parseCommand("d")).toEqual({ type: "invalid", input: "d" });
		});

		test("should parse 'd1' without path as invalid", () => {
			expect(parseCommand("d1")).toEqual({ type: "invalid", input: "d1" });
		});

		test("should handle multi-word paths with spaces", () => {
			expect(parseCommand("d1 Areas/Personal Finance")).toEqual({
				type: "set-destination",
				id: 1,
				path: "Areas/Personal Finance",
			});
		});

		test("should handle paths with special characters", () => {
			expect(parseCommand("d1 Areas/Health & Wellness")).toEqual({
				type: "set-destination",
				id: 1,
				path: "Areas/Health & Wellness",
			});
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
		const baseSuggestion: InboxSuggestion = {
			id: createSuggestionId("abc12300-0000-4000-8000-000000000001"),
			source: "/vault/Inbox/invoice-2024.pdf",
			processor: "attachments",
			confidence: "high",
			action: "create-note",
			suggestedNoteType: "invoice",
			suggestedTitle: "Invoice from Acme Corp",
			suggestedArea: "Finance",
			detectionSource: "llm+heuristic",
			reason: "PDF filename contains 'invoice' pattern",
		};

		test("should include index number", () => {
			const result = formatSuggestion(baseSuggestion, 1);
			expect(result).toContain("1");
		});

		test("should include filename from source path", () => {
			const result = formatSuggestion(baseSuggestion, 1);
			expect(result).toContain("invoice-2024.pdf");
		});

		test("should include confidence indicator", () => {
			const result = formatSuggestion(baseSuggestion, 1);
			expect(result).toContain("✅"); // high confidence = green checkmark
		});

		test("should include action", () => {
			const result = formatSuggestion(baseSuggestion, 1);
			expect(result).toContain("create-note");
		});

		test("should include suggested title when present", () => {
			const result = formatSuggestion(baseSuggestion, 1);
			expect(result).toContain("Invoice from Acme Corp");
		});

		test("should include suggested area when present", () => {
			const result = formatSuggestion(baseSuggestion, 1);
			expect(result).toContain("Finance");
		});

		test("should include confidence explanation in output", () => {
			const result = formatSuggestion(baseSuggestion, 1);
			// Confidence line shows detection method
			expect(result).toContain("Confidence: HIGH");
			expect(result).toContain("LLM + heuristics agree");
		});

		test("should handle suggestion without optional fields", () => {
			const minimalSuggestion: InboxSuggestion = {
				id: createSuggestionId("a1b78900-0000-4000-8000-000000000002"),
				source: "/vault/Inbox/random-file.md",
				processor: "notes",
				confidence: "low",
				action: "skip",
				detectionSource: "none",
				reason: "Could not determine type",
			};
			const result = formatSuggestion(minimalSuggestion, 2);
			expect(result).toContain("2");
			expect(result).toContain("random-file.md");
			expect(result).toContain("skip");
		});

		test("should display extraction warnings inline with preview", () => {
			const suggestionWithWarnings: InboxSuggestion = {
				id: createSuggestionId("abc12345-0000-4000-8000-000000000003"),
				source: "/vault/Inbox/mystery-invoice.pdf",
				processor: "attachments",
				confidence: "low",
				action: "create-note",
				suggestedNoteType: "invoice",
				suggestedTitle: "Unknown Invoice",
				detectionSource: "heuristic",
				reason: "Detected invoice pattern but missing key fields",
				extractionWarnings: [
					"Could not find invoice date",
					"Provider name unclear",
				],
			};
			const result = formatSuggestion(suggestionWithWarnings, 1);
			// Warnings now show inline - first warning visible, plus count of more
			expect(result).toContain("Could not find invoice date");
			expect(result).toContain("+1 more");
			expect(result).toContain("v1 for full details");
		});

		test("should not display warnings section when no warnings", () => {
			const result = formatSuggestion(baseSuggestion, 1);
			expect(result).not.toContain("Warnings");
		});

		test("should display suggestedAttachmentName when present", () => {
			const suggestionWithAttachment: InboxSuggestion = {
				...baseSuggestion,
				suggestedAttachmentName: "2024-01-15-acme-corp-invoice.pdf",
			};
			const result = formatSuggestion(suggestionWithAttachment, 1);
			expect(result).toContain("Attachment:");
			expect(result).toContain("2024-01-15-acme-corp-invoice.pdf");
		});

		test("should not display attachment line when suggestedAttachmentName is absent", () => {
			// baseSuggestion has no suggestedAttachmentName
			const result = formatSuggestion(baseSuggestion, 1);
			expect(result).not.toContain("Attachment:");
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
		const baseSuggestion: InboxSuggestion = {
			id: createSuggestionId("abc12345-0000-4000-8000-000000000001"),
			source: "/vault/Inbox/invoice-test.pdf",
			processor: "attachments",
			confidence: "high",
			action: "create-note",
			suggestedNoteType: "invoice",
			suggestedTitle: "Test Invoice 2024",
			suggestedDestination: "02 Areas/Finance",
			suggestedAttachmentName: "2024-01-invoice-test.pdf",
			detectionSource: "llm+heuristic",
			reason: "Detected invoice with all required fields",
			extractedFields: {
				invoiceDate: "2024-01-15",
				provider: "Test Provider Inc",
				amount: "$150.00",
			},
		};

		test("should display item number in header", () => {
			const result = formatSuggestionDetails(baseSuggestion, 3);
			expect(result).toContain("Item 3");
		});

		test("should display filename", () => {
			const result = formatSuggestionDetails(baseSuggestion, 1);
			expect(result).toContain("invoice-test.pdf");
		});

		test("should display suggested title", () => {
			const result = formatSuggestionDetails(baseSuggestion, 1);
			expect(result).toContain("Test Invoice 2024");
		});

		test("should display extracted fields", () => {
			const result = formatSuggestionDetails(baseSuggestion, 1);
			expect(result).toContain("invoiceDate");
			expect(result).toContain("2024-01-15");
			expect(result).toContain("provider");
			expect(result).toContain("Test Provider Inc");
			expect(result).toContain("amount");
			expect(result).toContain("$150.00");
		});

		test("should display warnings with recovery options", () => {
			const suggestionWithWarnings: InboxSuggestion = {
				...baseSuggestion,
				extractionWarnings: ["Missing invoice number", "Date format unclear"],
			};
			const result = formatSuggestionDetails(suggestionWithWarnings, 1);
			expect(result).toContain("Missing invoice number");
			expect(result).toContain("Date format unclear");
			// Should include recovery options
			expect(result).toContain("Recovery options");
			expect(result).toContain("e1"); // Edit hint
			expect(result).toContain("s1"); // Skip hint
		});

		test("should display destination", () => {
			const result = formatSuggestionDetails(baseSuggestion, 1);
			expect(result).toContain("02 Areas/Finance");
		});

		test("should display confidence and detection source", () => {
			const result = formatSuggestionDetails(baseSuggestion, 1);
			expect(result).toContain("HIGH"); // Now uppercase
			expect(result).toContain("LLM + heuristics agree"); // Descriptive text instead of raw value
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

	describe("formatSuggestion - destination display", () => {
		test("should show destination when set", () => {
			const suggestion: InboxSuggestion = {
				id: createSuggestionId(),
				action: "create-note",
				source: "/inbox/test.pdf",
				processor: "attachments",
				confidence: "high",
				detectionSource: "llm+heuristic",
				reason: "Test",
				suggestedNoteType: "invoice",
				suggestedTitle: "Test Invoice",
				suggestedDestination: "Areas/Finance",
			};

			const result = formatSuggestion(suggestion, 1);
			expect(result).toContain("├─ Destination: Areas/Finance");
			expect(result).not.toContain("NO DESTINATION SET");
		});

		test("should show warning when no destination set", () => {
			const suggestion: InboxSuggestion = {
				id: createSuggestionId(),
				action: "create-note",
				source: "/inbox/test.pdf",
				processor: "attachments",
				confidence: "high",
				detectionSource: "llm+heuristic",
				reason: "Test",
				suggestedNoteType: "invoice",
				suggestedTitle: "Test Invoice",
				// No suggestedDestination
			};

			const result = formatSuggestion(suggestion, 1);
			expect(result).toContain("⚠️ NO DESTINATION SET");
			expect(result).not.toContain("├─ Destination:");
		});

		test("should show LLM suggestion when available and different", () => {
			const suggestion: InboxSuggestion = {
				id: createSuggestionId(),
				action: "create-note",
				source: "/inbox/test.pdf",
				processor: "attachments",
				confidence: "high",
				detectionSource: "llm+heuristic",
				reason: "Test",
				suggestedNoteType: "invoice",
				suggestedTitle: "Test Invoice",
				llmSuggestedArea: "Areas/Health",
				// No suggestedDestination yet
			};

			const result = formatSuggestion(suggestion, 1);
			expect(result).toContain("💡 LLM suggests: Areas/Health");
			expect(result).toContain("y1 to accept");
		});

		test("should not show LLM suggestion when same as destination", () => {
			const suggestion: InboxSuggestion = {
				id: createSuggestionId(),
				action: "create-note",
				source: "/inbox/test.pdf",
				processor: "attachments",
				confidence: "high",
				detectionSource: "llm+heuristic",
				reason: "Test",
				suggestedNoteType: "invoice",
				suggestedTitle: "Test Invoice",
				suggestedDestination: "Areas/Health",
				llmSuggestedArea: "Areas/Health",
			};

			const result = formatSuggestion(suggestion, 1);
			expect(result).toContain("├─ Destination: Areas/Health");
			expect(result).not.toContain("💡 LLM suggests");
		});

		test("should show LLM project suggestion when area not available", () => {
			const suggestion: InboxSuggestion = {
				id: createSuggestionId(),
				action: "create-note",
				source: "/inbox/test.pdf",
				processor: "attachments",
				confidence: "high",
				detectionSource: "llm+heuristic",
				reason: "Test",
				suggestedNoteType: "booking",
				suggestedTitle: "Test Booking",
				llmSuggestedProject: "Projects/Travel 2024",
				// No suggestedDestination yet
			};

			const result = formatSuggestion(suggestion, 2);
			expect(result).toContain("💡 LLM suggests: Projects/Travel 2024");
			expect(result).toContain("y2 to accept");
		});

		test("should not show destination info for non-create-note suggestions", () => {
			const suggestion: InboxSuggestion = {
				id: createSuggestionId(),
				action: "skip",
				source: "/inbox/test.pdf",
				processor: "attachments",
				confidence: "low",
				detectionSource: "none",
				reason: "Cannot process",
			};

			const result = formatSuggestion(suggestion, 1);
			expect(result).not.toContain("Destination");
			expect(result).not.toContain("NO DESTINATION SET");
		});
	});
});
