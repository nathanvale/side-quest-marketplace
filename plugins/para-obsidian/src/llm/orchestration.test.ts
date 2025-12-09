/**
 * Tests for LLM orchestration workflows.
 *
 * @module llm/orchestration.test
 */

import { describe, expect, test } from "bun:test";
import {
	type ConversionResult,
	type ConvertNoteOptions,
	cleanWikilinkValue,
	type ExtractMetadataOptions,
	flattenToString,
} from "./orchestration";

describe("ConversionResult interface", () => {
	test("has correct structure", () => {
		const result: ConversionResult = {
			filePath: "/vault/Project.md",
			validation: {
				valid: true,
				issues: [],
			},
			sectionsInjected: ["Why This Matters", "Success Criteria"],
			sectionsSkipped: [],
		};

		expect(result.filePath).toBe("/vault/Project.md");
		expect(result.validation.valid).toBe(true);
		expect(result.sectionsInjected).toHaveLength(2);
	});

	test("handles validation issues", () => {
		const result: ConversionResult = {
			filePath: "/vault/Task.md",
			validation: {
				valid: false,
				issues: [
					{
						field: "status",
						message: "Must be one of: todo, in-progress, done",
					},
				],
			},
			sectionsInjected: [],
			sectionsSkipped: [
				{ heading: "Notes", reason: "Heading not found in template" },
			],
		};

		expect(result.validation.valid).toBe(false);
		expect(result.validation.issues).toHaveLength(1);
		expect(result.sectionsSkipped).toHaveLength(1);
	});
});

describe("ConvertNoteOptions interface", () => {
	test("has required fields", () => {
		const options: ConvertNoteOptions = {
			sourceFile: "inbox/notes.md",
			template: "project",
		};

		expect(options.sourceFile).toBe("inbox/notes.md");
		expect(options.template).toBe("project");
	});

	test("has optional fields", () => {
		const options: ConvertNoteOptions = {
			sourceFile: "inbox/notes.md",
			template: "task",
			model: "qwen2.5:7b",
			titleOverride: "My Custom Title",
			dest: "01_Projects",
			dryRun: true,
		};

		expect(options.model).toBe("qwen2.5:7b");
		expect(options.titleOverride).toBe("My Custom Title");
		expect(options.dest).toBe("01_Projects");
		expect(options.dryRun).toBe(true);
	});
});

describe("ExtractMetadataOptions interface", () => {
	test("supports sourceFile mode (extract from file)", () => {
		const options: ExtractMetadataOptions = {
			sourceFile: "inbox/rough-notes.md",
			template: "task",
		};

		expect(options.sourceFile).toBe("inbox/rough-notes.md");
		expect(options.sourceContent).toBeUndefined();
		expect(options.template).toBe("task");
	});

	test("supports sourceContent mode (extract from raw text)", () => {
		const options: ExtractMetadataOptions = {
			sourceContent:
				"Managing my dog Muffin - vet visits, grooming, food subscription",
			template: "area",
		};

		expect(options.sourceFile).toBeUndefined();
		expect(options.sourceContent).toBe(
			"Managing my dog Muffin - vet visits, grooming, food subscription",
		);
		expect(options.template).toBe("area");
	});

	test("supports all optional fields with sourceContent", () => {
		const options: ExtractMetadataOptions = {
			sourceContent: "Book the plumber for kitchen sink repair",
			template: "task",
			model: "haiku",
			extractContent: false,
			argOverrides: { priority: "high", area: "[[Home]]" },
		};

		expect(options.sourceContent).toBeDefined();
		expect(options.model).toBe("haiku");
		expect(options.extractContent).toBe(false);
		expect(options.argOverrides).toEqual({
			priority: "high",
			area: "[[Home]]",
		});
	});
});

describe("flattenToString", () => {
	test("returns null for null input", () => {
		expect(flattenToString(null)).toBeNull();
	});

	test("returns null for undefined input", () => {
		expect(flattenToString(undefined)).toBeNull();
	});

	test("returns null for empty array", () => {
		expect(flattenToString([])).toBeNull();
	});

	test("returns string as-is", () => {
		expect(flattenToString("simple")).toBe("simple");
	});

	test("extracts string from single-level array", () => {
		expect(flattenToString(["value"])).toBe("value");
	});

	test("extracts string from nested array (depth 2)", () => {
		expect(flattenToString([["- Lodge Name"]])).toBe("- Lodge Name");
	});

	test("extracts string from deeply nested array (depth 3)", () => {
		expect(flattenToString([[["deep"]]])).toBe("deep");
	});

	test("extracts string from very deep nested array", () => {
		expect(flattenToString([[[["very deep"]]]])).toBe("very deep");
	});

	test("handles number by converting to string", () => {
		expect(flattenToString(42)).toBe("42");
	});

	test("handles boolean by converting to string", () => {
		expect(flattenToString(true)).toBe("true");
	});

	test("handles nested empty arrays", () => {
		expect(flattenToString([[]])).toBeNull();
	});

	test("handles the exact accommodation bug case", () => {
		expect(flattenToString([["- Accommodation Strahan Village"]])).toBe(
			"- Accommodation Strahan Village",
		);
	});
});

describe("cleanWikilinkValue", () => {
	test("returns null for null input", () => {
		expect(cleanWikilinkValue(null)).toBeNull();
	});

	test("returns null for empty array", () => {
		expect(cleanWikilinkValue([])).toBeNull();
	});

	test("strips wikilink brackets from string", () => {
		expect(cleanWikilinkValue("[[Home]]")).toBe("Home");
	});

	test("strips markdown list prefix from string", () => {
		expect(cleanWikilinkValue("- Some Value")).toBe("Some Value");
	});

	test("strips asterisk list prefix from string", () => {
		expect(cleanWikilinkValue("* Some Value")).toBe("Some Value");
	});

	test("handles nested array with markdown prefix", () => {
		expect(cleanWikilinkValue([["- Lake St Clair Lodge"]])).toBe(
			"Lake St Clair Lodge",
		);
	});

	test("handles nested array with wikilinks and markdown prefix", () => {
		expect(cleanWikilinkValue([["- [[Some Project]]"]])).toBe("Some Project");
	});

	test("handles the exact accommodation bug case", () => {
		// This is the exact case that was causing issues
		expect(cleanWikilinkValue([["- Accommodation Strahan Village"]])).toBe(
			"Accommodation Strahan Village",
		);
	});

	test("handles deeply nested arrays", () => {
		expect(cleanWikilinkValue([[["- Deep Value"]]])).toBe("Deep Value");
	});

	test("returns null for string 'null'", () => {
		expect(cleanWikilinkValue("null")).toBeNull();
	});

	test("returns null for empty string", () => {
		expect(cleanWikilinkValue("")).toBeNull();
	});

	test("returns null for whitespace-only string", () => {
		expect(cleanWikilinkValue("   ")).toBeNull();
	});

	test("handles wikilink-wrapped null", () => {
		expect(cleanWikilinkValue("[[null]]")).toBeNull();
	});

	test("preserves simple values without transformations", () => {
		expect(cleanWikilinkValue("Lake St Clair Lodge")).toBe(
			"Lake St Clair Lodge",
		);
	});

	test("trims whitespace from extracted values", () => {
		expect(cleanWikilinkValue("  Some Value  ")).toBe("Some Value");
	});
});

// Note: Full integration tests for convertNoteToTemplate, suggestFieldValues,
// and batchConvert would require:
// 1. Mock Ollama server or recorded responses
// 2. Test vault with templates
// 3. Mock file system operations
//
// These would be better suited for end-to-end tests in a separate test suite.
// The interfaces above ensure type safety for consumers of the orchestration API.
