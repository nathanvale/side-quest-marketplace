/**
 * Tests for local LLM integration.
 *
 * @module llm.test
 */

import { describe, expect, test } from "bun:test";
import {
	buildConversionPrompt,
	DEFAULT_LLM_MODEL,
	DEFAULT_OLLAMA_URL,
	parseOllamaResponse,
	type VaultContext,
} from "./llm";
import type { TemplateField } from "./templates";

describe("parseOllamaResponse", () => {
	test("parses valid JSON response", () => {
		const response = JSON.stringify({
			args: { title: "Test", status: "confirmed" },
			content: { "Booking Details": "Some details here" },
			title: "Test Booking",
		});

		const result = parseOllamaResponse(response);

		expect(result.args).toEqual({ title: "Test", status: "confirmed" });
		expect(result.content).toEqual({ "Booking Details": "Some details here" });
		expect(result.title).toBe("Test Booking");
	});

	test("handles markdown json code fence", () => {
		const response = `\`\`\`json
{
  "args": { "booking_type": "flight" },
  "content": {},
  "title": "Flight Booking"
}
\`\`\``;

		const result = parseOllamaResponse(response);

		expect(result.args).toEqual({ booking_type: "flight" });
		expect(result.title).toBe("Flight Booking");
	});

	test("handles plain code fence", () => {
		const response = `\`\`\`
{"args": {}, "content": {}, "title": "Untitled"}
\`\`\``;

		const result = parseOllamaResponse(response);

		expect(result.title).toBe("Untitled");
	});

	test("provides defaults for missing fields", () => {
		const response = JSON.stringify({});

		const result = parseOllamaResponse(response);

		expect(result.args).toEqual({});
		expect(result.content).toEqual({});
		expect(result.title).toBe("Untitled");
	});

	test("throws on invalid JSON", () => {
		const response = "not valid json at all";

		expect(() => parseOllamaResponse(response)).toThrow(
			"Failed to parse LLM response as JSON",
		);
	});

	test("throws on partial JSON", () => {
		const response = '{"args": {';

		expect(() => parseOllamaResponse(response)).toThrow(
			"Failed to parse LLM response as JSON",
		);
	});
});

describe("buildConversionPrompt", () => {
	const sampleFields: TemplateField[] = [
		{ key: "title", inFrontmatter: true, isAutoDate: false },
		{ key: "booking_type", inFrontmatter: true, isAutoDate: false },
		{ key: "status", inFrontmatter: true, isAutoDate: false },
		{ key: "created", inFrontmatter: true, isAutoDate: true },
		{ key: "Booking Details", inFrontmatter: false, isAutoDate: false },
	];

	test("includes existing content in prompt", () => {
		const content = "Flight to Tasmania on Dec 26";
		const prompt = buildConversionPrompt(content, "booking", sampleFields);

		expect(prompt).toContain(content);
		expect(prompt).toContain("EXISTING NOTE CONTENT:");
	});

	test("includes template name", () => {
		const prompt = buildConversionPrompt("test", "booking", sampleFields);

		expect(prompt).toContain("TARGET TEMPLATE: booking");
		expect(prompt).toContain('"booking" template');
	});

	test("includes non-auto-date fields", () => {
		const prompt = buildConversionPrompt("test", "booking", sampleFields);

		expect(prompt).toContain('"title"');
		expect(prompt).toContain('"booking_type"');
		expect(prompt).toContain('"status"');
		expect(prompt).toContain('"Booking Details"');
	});

	test("excludes auto-date fields", () => {
		const prompt = buildConversionPrompt("test", "booking", sampleFields);

		// created is auto-date, should not be in the prompt
		expect(prompt).not.toContain('"created"');
	});

	test("marks frontmatter vs body fields", () => {
		const prompt = buildConversionPrompt("test", "booking", sampleFields);

		expect(prompt).toContain('"title" (frontmatter)');
		expect(prompt).toContain('"Booking Details" (body)');
	});

	test("includes validation rules from defaults", () => {
		const prompt = buildConversionPrompt("test", "booking", sampleFields);

		// Should include booking validation rules from DEFAULT_FRONTMATTER_RULES
		expect(prompt).toContain("VALIDATION RULES:");
		expect(prompt).toContain("booking_type");
	});

	test("includes custom rules when provided", () => {
		const customRules = {
			required: {
				custom_field: { type: "enum" as const, enum: ["a", "b", "c"] },
			},
		};

		const prompt = buildConversionPrompt(
			"test",
			"booking",
			sampleFields,
			[], // sections
			customRules,
		);

		expect(prompt).toContain("custom_field");
		expect(prompt).toContain("a, b, c");
	});

	test("includes output format instructions", () => {
		const prompt = buildConversionPrompt("test", "booking", sampleFields);

		expect(prompt).toContain("OUTPUT FORMAT:");
		expect(prompt).toContain('"args"');
		expect(prompt).toContain('"content"');
		expect(prompt).toContain('"title"');
	});

	test("includes critical rules", () => {
		const prompt = buildConversionPrompt("test", "booking", sampleFields);

		expect(prompt).toContain("CRITICAL RULES:");
		expect(prompt).toContain("null for missing");
		expect(prompt).toContain("YYYY-MM-DD");
	});

	test("includes body sections when provided", () => {
		const sections = ["Booking Details", "Cost & Payment", "Important Notes"];
		const prompt = buildConversionPrompt(
			"test",
			"booking",
			sampleFields,
			sections,
		);

		expect(prompt).toContain("BODY SECTIONS TO FILL:");
		expect(prompt).toContain('"Booking Details"');
		expect(prompt).toContain('"Cost & Payment"');
		expect(prompt).toContain('"Important Notes"');
	});

	test("omits body sections header when empty", () => {
		const prompt = buildConversionPrompt("test", "booking", sampleFields, []);

		expect(prompt).not.toContain("BODY SECTIONS TO FILL:");
	});
});

describe("buildConversionPrompt with vault context", () => {
	const sampleFields: TemplateField[] = [
		{ key: "title", inFrontmatter: true, isAutoDate: false },
		{ key: "Project", inFrontmatter: true, isAutoDate: false },
	];

	test("includes existing areas in prompt", () => {
		const vaultContext: VaultContext = {
			areas: ["Work", "Health", "Finance"],
			projects: [],
			suggestedTags: [],
		};

		const prompt = buildConversionPrompt(
			"Content",
			"project",
			sampleFields,
			[],
			undefined,
			vaultContext,
		);

		expect(prompt).toContain("EXISTING AREAS");
		expect(prompt).toContain("- Work");
		expect(prompt).toContain("- Health");
		expect(prompt).toContain("- Finance");
	});

	test("includes existing projects in prompt", () => {
		const vaultContext: VaultContext = {
			areas: [],
			projects: ["Build Garden Shed", "Learn Piano"],
			suggestedTags: [],
		};

		const prompt = buildConversionPrompt(
			"Content",
			"task",
			sampleFields,
			[],
			undefined,
			vaultContext,
		);

		expect(prompt).toContain("EXISTING PROJECTS");
		expect(prompt).toContain("- Build Garden Shed");
		expect(prompt).toContain("- Learn Piano");
	});

	test("includes allowed tags in prompt", () => {
		const vaultContext: VaultContext = {
			areas: [],
			projects: [],
			suggestedTags: ["project", "task", "daily", "journal"],
		};

		const prompt = buildConversionPrompt(
			"Content",
			"project",
			sampleFields,
			[],
			undefined,
			vaultContext,
		);

		expect(prompt).toContain("ALLOWED TAGS");
		expect(prompt).toContain("project, task, daily, journal");
		expect(prompt).toContain("DO NOT invent new tags");
	});

	test("works without vault context (backward compatible)", () => {
		const prompt = buildConversionPrompt("Content", "project", sampleFields);

		expect(prompt).not.toContain("VAULT CONTEXT:");
		expect(prompt).toContain("OUTPUT FORMAT"); // Should still work
	});

	test("includes wikilink formatting guidance", () => {
		const vaultContext: VaultContext = {
			areas: ["Work"],
			projects: [],
			suggestedTags: [],
		};

		const prompt = buildConversionPrompt(
			"Content",
			"project",
			sampleFields,
			[],
			undefined,
			vaultContext,
		);

		expect(prompt).toContain("[[");
		expect(prompt).toContain("Wikilinks must NOT be quoted");
		expect(prompt).toContain("Dataview");
	});
});

describe("constants", () => {
	test("DEFAULT_LLM_MODEL is set", () => {
		expect(DEFAULT_LLM_MODEL).toBe("qwen2.5:14b");
	});

	test("DEFAULT_OLLAMA_URL is localhost", () => {
		expect(DEFAULT_OLLAMA_URL).toBe("http://localhost:11434");
	});
});
