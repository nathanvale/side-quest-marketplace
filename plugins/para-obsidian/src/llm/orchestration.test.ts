/**
 * Tests for LLM orchestration workflows.
 *
 * @module llm/orchestration.test
 */

import { describe, expect, test } from "bun:test";
import type { ConversionResult, ConvertNoteOptions } from "./orchestration";

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

// Note: Full integration tests for convertNoteToTemplate, suggestFieldValues,
// and batchConvert would require:
// 1. Mock Ollama server or recorded responses
// 2. Test vault with templates
// 3. Mock file system operations
//
// These would be better suited for end-to-end tests in a separate test suite.
// The interfaces above ensure type safety for consumers of the orchestration API.
