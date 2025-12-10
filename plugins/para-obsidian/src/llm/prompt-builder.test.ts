/**
 * Tests for composable prompt builder.
 *
 * @module llm/prompt-builder.test
 */

import { describe, expect, test } from "bun:test";
import type { ConstraintSet } from "./constraints";
import {
	buildConstraintSection,
	buildCriticalRules,
	buildExamplesSection,
	buildSourceStructureSection,
	buildStructuredPrompt,
	DEFAULT_CRITICAL_RULES,
	type PromptExample,
	type PromptTemplate,
} from "./prompt-builder";

describe("buildStructuredPrompt", () => {
	test("includes all sections in correct order", () => {
		const template: PromptTemplate = {
			systemRole: "You are a test assistant",
			sourceContent: "# Test Note\nSome content here",
			constraints: createMinimalConstraintSet(),
			criticalRules: ["Rule 1", "Rule 2"],
			examples: [
				{
					input: "test",
					output: { args: {}, content: {}, title: "Test" },
				},
			],
		};

		const prompt = buildStructuredPrompt(template);

		// Check section order
		const systemRoleIdx = prompt.indexOf("You are a test assistant");
		const contentIdx = prompt.indexOf("EXISTING NOTE CONTENT:");
		const constraintsIdx = prompt.indexOf("REQUIRED FIELDS");
		const rulesIdx = prompt.indexOf("CRITICAL RULES:");
		const examplesIdx = prompt.indexOf("EXAMPLES:");
		const outputIdx = prompt.indexOf("OUTPUT (JSON only");

		expect(systemRoleIdx).toBeGreaterThan(-1);
		expect(contentIdx).toBeGreaterThan(systemRoleIdx);
		expect(constraintsIdx).toBeGreaterThan(contentIdx);
		expect(rulesIdx).toBeGreaterThan(constraintsIdx);
		expect(examplesIdx).toBeGreaterThan(rulesIdx);
		expect(outputIdx).toBeGreaterThan(examplesIdx);
	});

	test("handles missing vault context gracefully", () => {
		const template: PromptTemplate = {
			systemRole: "Test",
			sourceContent: "Content",
			constraints: {
				...createMinimalConstraintSet(),
				vaultContext: undefined,
			},
		};

		const prompt = buildStructuredPrompt(template);

		// Should not include vault context section
		expect(prompt).not.toContain("VAULT CONTEXT:");
		expect(prompt).not.toContain("EXISTING AREAS");
	});

	test("includes examples when provided", () => {
		const template: PromptTemplate = {
			systemRole: "Test",
			sourceContent: "Content",
			constraints: createMinimalConstraintSet(),
			examples: [
				{
					input: "Sample input",
					output: {
						args: { field1: "value1" },
						content: { Section: "text" },
						title: "Sample",
					},
				},
			],
		};

		const prompt = buildStructuredPrompt(template);

		expect(prompt).toContain("EXAMPLES:");
		expect(prompt).toContain("Example 1:");
		expect(prompt).toContain("Input: Sample input");
		expect(prompt).toContain('"field1": "value1"');
	});

	test("applies default critical rules when none provided", () => {
		const template: PromptTemplate = {
			systemRole: "Test",
			sourceContent: "Content",
			constraints: createMinimalConstraintSet(),
		};

		const prompt = buildStructuredPrompt(template);

		expect(prompt).toContain("CRITICAL RULES:");
		expect(prompt).toContain("Extract values from the note content");
		expect(prompt).toContain(
			"For frontmatter (args): Use null for missing values",
		);
	});

	test("allows custom critical rules", () => {
		const template: PromptTemplate = {
			systemRole: "Test",
			sourceContent: "Content",
			constraints: createMinimalConstraintSet(),
			criticalRules: ["Custom rule 1", "Custom rule 2"],
		};

		const prompt = buildStructuredPrompt(template);

		expect(prompt).toContain("CRITICAL RULES:");
		expect(prompt).toContain("Custom rule 1");
		expect(prompt).toContain("Custom rule 2");
		// Should NOT contain default rules
		expect(prompt).not.toContain("Extract values from the note content");
	});

	test("wraps source content in delimiter", () => {
		const template: PromptTemplate = {
			systemRole: "Test",
			sourceContent: "# My Note\n\nContent here",
			constraints: createMinimalConstraintSet(),
		};

		const prompt = buildStructuredPrompt(template);

		expect(prompt).toContain("EXISTING NOTE CONTENT:");
		expect(prompt).toContain("---");
		expect(prompt).toContain("# My Note");
		expect(prompt).toContain("Content here");
	});
});

describe("buildConstraintSection", () => {
	test("separates required vs optional fields", () => {
		const constraints: ConstraintSet = {
			fields: [
				{
					key: "requiredField",
					type: "string",
					required: true,
					location: "frontmatter",
				},
				{
					key: "optionalField",
					type: "string",
					required: false,
					location: "frontmatter",
				},
			],
			outputSchema: {
				sections: [],
				format: "json",
				argsExample: {},
				contentExample: {},
			},
			vaultContext: undefined,
		};

		const section = buildConstraintSection(constraints);

		expect(section).toContain("REQUIRED FIELDS (cannot be null):");
		expect(section).toContain('"requiredField" (frontmatter)');
		expect(section).toContain("OPTIONAL FIELDS (use null if not applicable):");
		expect(section).toContain('"optionalField" (frontmatter)');
	});

	test("includes body sections list", () => {
		const constraints: ConstraintSet = {
			fields: [],
			outputSchema: {
				sections: ["Why This Matters", "Success Criteria"],
				format: "json",
				argsExample: {},
				contentExample: {},
			},
			vaultContext: undefined,
		};

		const section = buildConstraintSection(constraints);

		expect(section).toContain("BODY SECTIONS TO FILL:");
		expect(section).toContain('"Why This Matters"');
		expect(section).toContain('"Success Criteria"');
	});

	test("includes vault context when present", () => {
		const constraints: ConstraintSet = {
			fields: [],
			outputSchema: {
				sections: [],
				format: "json",
				argsExample: {},
				contentExample: {},
			},
			vaultContext: {
				areas: ["Work", "Home"],
				projects: ["Project A"],
				suggestedTags: ["tag1", "tag2"],
			},
		};

		const section = buildConstraintSection(constraints);

		expect(section).toContain("VAULT CONTEXT:");
		expect(section).toContain("EXISTING AREAS");
		expect(section).toContain("- Work");
		expect(section).toContain("- Home");
		expect(section).toContain("EXISTING PROJECTS");
		expect(section).toContain("- Project A");
		expect(section).toContain("ALLOWED TAGS");
		expect(section).toContain("tag1, tag2");
	});

	test("handles empty vault context", () => {
		const constraints: ConstraintSet = {
			fields: [],
			outputSchema: {
				sections: [],
				format: "json",
				argsExample: {},
				contentExample: {},
			},
			vaultContext: {
				areas: [],
				projects: [],
				suggestedTags: [],
			},
		};

		const section = buildConstraintSection(constraints);

		expect(section).toContain("VAULT CONTEXT:");
		expect(section).toContain(
			"[None yet - suggest one based on content analysis]",
		);
		expect(section).toContain(
			"[None yet - suggest one if task relates to a project]",
		);
	});

	test("includes output schema", () => {
		const constraints: ConstraintSet = {
			fields: [],
			outputSchema: {
				sections: [],
				format: "json",
				argsExample: {},
				contentExample: {},
			},
			vaultContext: undefined,
		};

		const section = buildConstraintSection(constraints);

		expect(section).toContain("OUTPUT FORMAT:");
		expect(section).toContain('"args": {');
		expect(section).toContain('"content": {');
		expect(section).toContain('"title":');
	});

	test("formats validation rules correctly", () => {
		const constraints: ConstraintSet = {
			fields: [
				{
					key: "status",
					type: "enum",
					required: true,
					location: "frontmatter",
					enumValues: ["planning", "active", "completed"],
				},
				{
					key: "created",
					type: "date",
					required: true,
					location: "frontmatter",
				},
				{
					key: "area",
					type: "wikilink",
					required: true,
					location: "frontmatter",
				},
				{
					key: "tags",
					type: "array",
					required: true,
					location: "frontmatter",
					arrayIncludes: ["project"],
				},
			],
			outputSchema: {
				sections: [],
				format: "json",
				argsExample: {},
				contentExample: {},
			},
			vaultContext: undefined,
		};

		const section = buildConstraintSection(constraints);

		expect(section).toContain("REQUIRED FIELDS");
		expect(section).toContain('"status"');
		expect(section).toContain("planning, active, completed");
		expect(section).toContain('"created"');
		expect(section).toContain('"area"');
		expect(section).toContain('"tags"');
		expect(section).toContain("project");
	});

	test("distinguishes frontmatter vs body fields", () => {
		const constraints: ConstraintSet = {
			fields: [
				{
					key: "frontmatterField",
					type: "string",
					required: true,
					location: "frontmatter",
				},
				{
					key: "bodyField",
					type: "string",
					required: true,
					location: "body",
				},
			],
			outputSchema: {
				sections: [],
				format: "json",
				argsExample: {},
				contentExample: {},
			},
			vaultContext: undefined,
		};

		const section = buildConstraintSection(constraints);

		expect(section).toContain('"frontmatterField" (frontmatter)');
		expect(section).toContain('"bodyField" (body)');
	});
});

describe("buildCriticalRules", () => {
	test("uses defaults when no custom rules provided", () => {
		const rules = buildCriticalRules();

		expect(rules).toContain("Extract values from the note content");
		expect(rules).toContain(
			"For frontmatter (args): Use null for missing values",
		);
		expect(rules).toContain("Dates MUST be YYYY-MM-DD format");
	});

	test("uses custom rules when provided", () => {
		const customRules = ["Custom 1", "Custom 2", "Custom 3"];
		const rules = buildCriticalRules(customRules);

		expect(rules).toBe("Custom 1\nCustom 2\nCustom 3");
	});

	test("includes all default rules", () => {
		const rules = buildCriticalRules();

		// Spot check critical rules
		expect(rules).toContain("String values must be properly quoted");
		expect(rules).toContain("Enum values MUST match exactly");
		expect(rules).toContain("preserve markdown formatting");
		expect(rules).toContain('CORRECT: "area": null');
		expect(rules).toContain("Tags MUST include required values");
	});
});

describe("buildExamplesSection", () => {
	test("formats examples with input/output", () => {
		const examples: PromptExample[] = [
			{
				input: "Test input",
				output: {
					args: { field1: "value1" },
					content: { Section: "content" },
					title: "Test Title",
				},
			},
		];

		const section = buildExamplesSection(examples);

		expect(section).toContain("EXAMPLES:");
		expect(section).toContain("Example 1:");
		expect(section).toContain("Input: Test input");
		expect(section).toContain("Output:");
		expect(section).toContain('"field1": "value1"');
		expect(section).toContain('"Section": "content"');
		expect(section).toContain('"title": "Test Title"');
	});

	test("handles multiple examples", () => {
		const examples: PromptExample[] = [
			{
				input: "First",
				output: { args: {}, content: {}, title: "First" },
			},
			{
				input: "Second",
				output: { args: {}, content: {}, title: "Second" },
			},
			{
				input: "Third",
				output: { args: {}, content: {}, title: "Third" },
			},
		];

		const section = buildExamplesSection(examples);

		expect(section).toContain("Example 1:");
		expect(section).toContain("Example 2:");
		expect(section).toContain("Example 3:");
		expect(section).toContain("Input: First");
		expect(section).toContain("Input: Second");
		expect(section).toContain("Input: Third");
	});

	test("JSON formatting is correct", () => {
		const examples: PromptExample[] = [
			{
				input: "test",
				output: {
					args: { a: "1", b: "2" },
					content: { X: "content" },
					title: "T",
				},
			},
		];

		const section = buildExamplesSection(examples);

		// Should be pretty-printed JSON
		expect(section).toContain("{\n");
		expect(section).toContain("  ");
		expect(section).toContain("}");
	});

	test("handles null values in args", () => {
		const examples: PromptExample[] = [
			{
				input: "test",
				output: {
					args: { field: null },
					content: {},
					title: "Test",
				},
			},
		];

		const section = buildExamplesSection(examples);

		expect(section).toContain('"field": null');
	});
});

describe("buildSourceStructureSection", () => {
	test("formats source headings list", () => {
		const result = buildSourceStructureSection(
			["Project Overview", "Technical Requirements"],
			["Why This Matters", "Success Criteria"],
		);

		expect(result).toContain("SOURCE DOCUMENT STRUCTURE:");
		expect(result).toContain('"Project Overview"');
		expect(result).toContain('"Technical Requirements"');
	});

	test("includes mapping guidance when provided", () => {
		const mapping = new Map<string, string | null>([
			["Why This Matters", "Project Overview"],
			["Success Criteria", null], // no match, should generate
		]);

		const result = buildSourceStructureSection(
			["Project Overview"],
			["Why This Matters", "Success Criteria"],
			mapping,
		);

		expect(result).toContain("SECTION MAPPING GUIDANCE:");
		expect(result).toContain(
			'"Why This Matters" ← extract from: "Project Overview"',
		);
		expect(result).toContain(
			'"Success Criteria" ← generate based on context (no direct source match)',
		);
	});

	test("handles empty source headings array", () => {
		const result = buildSourceStructureSection([], ["Section 1"]);

		// Function still outputs structure, just with no headings listed
		expect(result).toContain("SOURCE DOCUMENT STRUCTURE:");
		expect(result).toContain("The source document contains these sections:");
		expect(result).toContain("SECTION MAPPING GUIDANCE:");
		// No headings should be listed (no "- " lines for headings)
		const lines = result.split("\n");
		const headingLines = lines.filter((line) => line.trim().startsWith('- "'));
		expect(headingLines.length).toBe(0);
	});

	test("shows general guidance when no mapping provided", () => {
		const result = buildSourceStructureSection(
			["Overview"],
			["Description"],
			undefined, // no mapping
		);

		expect(result).toContain("SECTION MAPPING GUIDANCE:");
		expect(result).toContain(
			"Extract content from relevant source sections or generate appropriate content for each template section.",
		);
		expect(result).toContain(
			"Use the source headings as guidance, but adapt content to fit the template structure.",
		);
	});

	test("handles section in template but not in mapping", () => {
		const mapping = new Map<string, string | null>([["Section A", "Source A"]]);

		const result = buildSourceStructureSection(
			["Source A", "Source B"],
			["Section A", "Section B"], // Section B not in mapping
			mapping,
		);

		expect(result).toContain('"Section A" ← extract from: "Source A"');
		expect(result).toContain('"Section B" ← determine from source content');
	});
});

describe("DEFAULT_CRITICAL_RULES", () => {
	test("has expected number of rules", () => {
		// Rules 1-14 with sub-items for multi-line rules (3, 6, 11, 12, 13, 14)
		expect(DEFAULT_CRITICAL_RULES.length).toBe(30);
	});

	test("includes rule numbers", () => {
		const joined = DEFAULT_CRITICAL_RULES.join("\n");
		expect(joined).toContain("1. Extract values");
		expect(joined).toContain("2. For frontmatter");
		expect(joined).toContain("3. For body sections");
	});

	test("includes wikilink null handling rule", () => {
		const joined = DEFAULT_CRITICAL_RULES.join("\n");
		expect(joined).toContain('CORRECT: "area": null');
		expect(joined).toContain('WRONG: "area": "[[null]]"');
	});

	test("includes required tag validation rule", () => {
		const joined = DEFAULT_CRITICAL_RULES.join("\n");
		expect(joined).toContain("Tags MUST include required values");
	});

	test("includes title formatting rule to prevent YAML-breaking colons", () => {
		const joined = DEFAULT_CRITICAL_RULES.join("\n");
		expect(joined).toContain("NEVER use colons (:) in titles");
		expect(joined).toContain("they break YAML parsing");
	});
});

describe("Integration: full prompt generation", () => {
	test("generates complete prompt matching existing format", () => {
		const template: PromptTemplate = {
			systemRole:
				'You are extracting structured data from an existing note to convert it to a "project" template.',
			sourceContent:
				"# My Project\n\nThis is a test project for the garden shed.",
			constraints: {
				fields: [
					{
						key: "Project title",
						type: "string",
						required: true,
						location: "frontmatter",
					},
					{
						key: "Area",
						type: "wikilink",
						required: true,
						location: "frontmatter",
					},
					{
						key: "status",
						type: "enum",
						required: true,
						location: "frontmatter",
						enumValues: ["planning", "active", "completed"],
					},
					{
						key: "tags",
						type: "array",
						required: true,
						location: "frontmatter",
						arrayIncludes: ["project"],
					},
				],
				outputSchema: {
					sections: ["Why This Matters", "Success Criteria"],
					format: "json",
					argsExample: {
						"Project title": "<value>",
						Area: "[[Name]]",
						status: "planning",
						tags: "tag1, tag2",
					},
					contentExample: {
						"Why This Matters": "<content for this section>",
						"Success Criteria": "<content for this section>",
					},
				},
				vaultContext: {
					areas: ["Home", "Work"],
					projects: [],
					suggestedTags: ["project", "work", "home"],
				},
			},
		};

		const prompt = buildStructuredPrompt(template);

		// Verify structure
		expect(prompt).toContain("You are extracting structured data");
		expect(prompt).toContain("EXISTING NOTE CONTENT:");
		expect(prompt).toContain("# My Project");
		expect(prompt).toContain("REQUIRED FIELDS (cannot be null):");
		expect(prompt).toContain('"Project title" (frontmatter)');
		expect(prompt).toContain('"Area" (frontmatter)');
		expect(prompt).toContain("BODY SECTIONS TO FILL:");
		expect(prompt).toContain('"Why This Matters"');
		expect(prompt).toContain('"Success Criteria"');
		expect(prompt).toContain("VAULT CONTEXT:");
		expect(prompt).toContain("EXISTING AREAS");
		expect(prompt).toContain("- Home");
		expect(prompt).toContain("- Work");
		expect(prompt).toContain("ALLOWED TAGS");
		expect(prompt).toContain("project, work, home");
		expect(prompt).toContain("OUTPUT FORMAT:");
		expect(prompt).toContain("CRITICAL RULES:");
		expect(prompt).toContain("Extract values from the note content");
		expect(prompt).toContain(
			"OUTPUT (JSON only, no explanation, no markdown fences):",
		);
	});

	test("minimal prompt without optional sections", () => {
		const template: PromptTemplate = {
			systemRole: "Test",
			sourceContent: "Content",
			constraints: {
				fields: [],
				outputSchema: {
					sections: [],
					format: "json",
					argsExample: {},
					contentExample: {},
				},
				vaultContext: undefined,
			},
		};

		const prompt = buildStructuredPrompt(template);

		// Should still have basic structure
		expect(prompt).toContain("Test");
		expect(prompt).toContain("EXISTING NOTE CONTENT:");
		expect(prompt).toContain("Content");
		expect(prompt).toContain("OUTPUT FORMAT:");
		expect(prompt).toContain("CRITICAL RULES:");
		expect(prompt).toContain("OUTPUT (JSON only");

		// Should NOT have vault context
		expect(prompt).not.toContain("VAULT CONTEXT:");
	});
});

// Helper functions
function createMinimalConstraintSet(): ConstraintSet {
	return {
		fields: [
			{
				key: "testField",
				type: "string",
				required: true,
				location: "frontmatter",
			},
		],
		outputSchema: {
			sections: [],
			format: "json",
			argsExample: {},
			contentExample: {},
		},
		vaultContext: undefined,
	};
}
