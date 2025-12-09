/**
 * Tests for LLM orchestration workflows.
 *
 * @module llm/orchestration.test
 */

import { describe, expect, test } from "bun:test";
import type { ParaObsidianConfig } from "../config";
import {
	applyTitlePrefix,
	cleanWikilinkValue,
	type ConversionResult,
	type ConvertNoteOptions,
	type ExtractMetadataOptions,
	flattenToString,
	getWikilinkFieldsFromRules,
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

describe("getWikilinkFieldsFromRules", () => {
	test("returns empty array for undefined rules", () => {
		expect(getWikilinkFieldsFromRules(undefined)).toEqual([]);
	});

	test("returns empty array for rules without required", () => {
		expect(getWikilinkFieldsFromRules({})).toEqual([]);
	});

	test("returns empty array when no wikilink fields", () => {
		const rules = {
			required: {
				title: { type: "string" },
				status: { type: "enum" },
				tags: { type: "array" },
			},
		};
		expect(getWikilinkFieldsFromRules(rules)).toEqual([]);
	});

	test("extracts wikilink fields from rules", () => {
		const rules = {
			required: {
				title: { type: "string" },
				project: { type: "wikilink" },
				area: { type: "wikilink" },
				status: { type: "enum" },
			},
		};
		const result = getWikilinkFieldsFromRules(rules);
		expect(result).toContain("project");
		expect(result).toContain("area");
		expect(result).toHaveLength(2);
	});

	test("area template has no wikilink fields", () => {
		// This mirrors the actual area rules from defaults.ts
		const areaRules = {
			required: {
				title: { type: "string" },
				created: { type: "date" },
				type: { type: "enum" },
				status: { type: "enum" },
				tags: { type: "array" },
			},
		};
		const result = getWikilinkFieldsFromRules(areaRules);
		expect(result).toEqual([]);
		// Specifically: no accommodation or decision fields
		expect(result).not.toContain("accommodation");
		expect(result).not.toContain("decision");
	});

	test("project template has area wikilink field", () => {
		// This mirrors the actual project rules from defaults.ts
		const projectRules = {
			required: {
				title: { type: "string" },
				created: { type: "date" },
				type: { type: "enum" },
				status: { type: "enum" },
				target_completion: { type: "date" },
				area: { type: "wikilink" },
				tags: { type: "array" },
			},
		};
		const result = getWikilinkFieldsFromRules(projectRules);
		expect(result).toEqual(["area"]);
		// Specifically: no accommodation or decision fields
		expect(result).not.toContain("accommodation");
		expect(result).not.toContain("decision");
	});

	test("itinerary-day template has accommodation wikilink field", () => {
		// This mirrors the actual itinerary-day rules from defaults.ts
		const itineraryDayRules = {
			required: {
				title: { type: "string" },
				project: { type: "wikilink" },
				accommodation: { type: "wikilink" },
			},
		};
		const result = getWikilinkFieldsFromRules(itineraryDayRules);
		expect(result).toContain("project");
		expect(result).toContain("accommodation");
		expect(result).toHaveLength(2);
	});

	test("research template has decision wikilink field", () => {
		// This mirrors the actual research rules from defaults.ts
		const researchRules = {
			required: {
				title: { type: "string" },
				project: { type: "wikilink" },
				decision: { type: "wikilink" },
			},
		};
		const result = getWikilinkFieldsFromRules(researchRules);
		expect(result).toContain("project");
		expect(result).toContain("decision");
		expect(result).toHaveLength(2);
	});
});

describe("applyTitlePrefix", () => {
	const mockConfig: ParaObsidianConfig = {
		vault: "/vault",
		titlePrefixes: {
			research: "Research -",
			booking: "Booking -",
		},
	};

	test("applies prefix to title without prefix", () => {
		const result = applyTitlePrefix(
			"Christmas Day Hotels",
			"research",
			mockConfig,
		);
		expect(result).toBe("Research - Christmas Day Hotels");
	});

	test("does not duplicate existing prefix (exact case)", () => {
		const result = applyTitlePrefix(
			"Research - Christmas Day Hotels",
			"research",
			mockConfig,
		);
		expect(result).toBe("Research - Christmas Day Hotels");
	});

	test("does not duplicate existing prefix (case-insensitive)", () => {
		const result = applyTitlePrefix(
			"research - Christmas Day Hotels",
			"research",
			mockConfig,
		);
		expect(result).toBe("research - Christmas Day Hotels");
	});

	test("does not duplicate existing prefix (mixed case)", () => {
		const result = applyTitlePrefix(
			"RESEARCH - Hotels",
			"research",
			mockConfig,
		);
		expect(result).toBe("RESEARCH - Hotels");
	});

	test("returns title unchanged when no prefix configured", () => {
		const result = applyTitlePrefix("My Task", "task", mockConfig);
		expect(result).toBe("My Task");
	});

	test("applies booking prefix correctly", () => {
		const result = applyTitlePrefix(
			"Melbourne Sisters Hotel",
			"booking",
			mockConfig,
		);
		expect(result).toBe("Booking - Melbourne Sisters Hotel");
	});

	test("uses default prefix when not in config", () => {
		const configWithoutPrefixes: ParaObsidianConfig = {
			vault: "/vault",
		};
		const result = applyTitlePrefix(
			"Tasmania Trip",
			"trip",
			configWithoutPrefixes,
		);
		expect(result).toBe("Trip - Tasmania Trip");
	});

	test("does not add prefix to project (no default)", () => {
		const result = applyTitlePrefix("My Project", "project", mockConfig);
		expect(result).toBe("My Project");
	});

	test("handles empty string title", () => {
		const result = applyTitlePrefix("", "research", mockConfig);
		expect(result).toBe("Research - ");
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
