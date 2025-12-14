import { describe, expect, test } from "bun:test";
import {
	formatConfidence,
	formatSuggestion,
	formatSuggestionsTable,
	getHelpText,
	parseCommand,
} from "./cli-adapter";
import { createSuggestionId, type InboxSuggestion } from "./types";

describe("inbox/cli-adapter", () => {
	describe("parseCommand", () => {
		test("should parse 'a' as approve-all", () => {
			expect(parseCommand("a")).toEqual({ type: "approve-all" });
		});

		test("should parse 'A' as approve-all (case insensitive)", () => {
			expect(parseCommand("A")).toEqual({ type: "approve-all" });
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

		test("should parse empty string as invalid", () => {
			expect(parseCommand("")).toEqual({ type: "invalid", input: "" });
		});

		test("should parse 'e' without id as invalid", () => {
			expect(parseCommand("e")).toEqual({ type: "invalid", input: "e" });
		});

		test("should parse 's' without id as invalid", () => {
			expect(parseCommand("s")).toEqual({ type: "invalid", input: "s" });
		});

		test("should parse 'e3' without prompt as invalid", () => {
			expect(parseCommand("e3")).toEqual({ type: "invalid", input: "e3" });
		});

		test("should trim whitespace from input", () => {
			expect(parseCommand("  a  ")).toEqual({ type: "approve-all" });
		});
	});

	describe("formatConfidence", () => {
		test("should format 'high' with checkmark", () => {
			const result = formatConfidence("high");
			expect(result).toContain("✓");
		});

		test("should format 'medium' with question mark", () => {
			const result = formatConfidence("medium");
			expect(result).toContain("?");
		});

		test("should format 'low' with warning icon", () => {
			const result = formatConfidence("low");
			expect(result).toContain("⚠");
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
			expect(result).toContain("✓");
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

		test("should include reason", () => {
			const result = formatSuggestion(baseSuggestion, 1);
			expect(result).toContain("PDF filename contains 'invoice' pattern");
		});

		test("should handle suggestion without optional fields", () => {
			const minimalSuggestion: InboxSuggestion = {
				id: createSuggestionId("xyz78900-0000-4000-8000-000000000002"),
				source: "/vault/Inbox/random-file.md",
				processor: "notes",
				confidence: "low",
				action: "skip",
				reason: "Could not determine type",
			};
			const result = formatSuggestion(minimalSuggestion, 2);
			expect(result).toContain("2");
			expect(result).toContain("random-file.md");
			expect(result).toContain("skip");
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
				suggestedTitle: "Invoice 2024",
				reason: "Detected invoice",
			},
			{
				id: createSuggestionId("22222222-0000-4000-8000-000000000004"),
				source: "/vault/Inbox/note.md",
				processor: "notes",
				confidence: "medium",
				action: "move",
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
	});
});
