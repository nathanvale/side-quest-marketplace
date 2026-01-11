/**
 * Tests for LLM client functions.
 *
 * @module llm/client.test
 */

import { describe, expect, test } from "bun:test";
import { parseOllamaResponse } from "./client";

describe("parseOllamaResponse", () => {
	test("handles string content values correctly", () => {
		const response = JSON.stringify({
			args: { title: "Test", date: "2024-01-01" },
			content: {
				"Why This Matters": "This is important",
				"Success Criteria": "- Complete task\n- Review results",
			},
			title: "Test Document",
		});

		const result = parseOllamaResponse(response);

		expect(result.title).toBe("Test Document");
		expect(result.args.title).toBe("Test");
		expect(result.content["Why This Matters"]).toBe("This is important");
		expect(result.content["Success Criteria"]).toBe(
			"- Complete task\n- Review results",
		);
	});

	test("coerces array content values to strings", () => {
		const response = JSON.stringify({
			args: { title: "Test" },
			content: {
				Notes: ["First item", "Second item", "Third item"],
			},
			title: "Test Document",
		});

		const result = parseOllamaResponse(response);

		expect(typeof result.content.Notes).toBe("string");
		expect(result.content.Notes).toBe("First item\nSecond item\nThird item");
	});

	test("coerces object content values to JSON strings", () => {
		const response = JSON.stringify({
			args: { title: "Test" },
			content: {
				Metadata: { author: "John", date: "2024-01-01" },
			},
			title: "Test Document",
		});

		const result = parseOllamaResponse(response);

		expect(typeof result.content.Metadata).toBe("string");
		expect(result.content.Metadata).toBe(
			JSON.stringify({ author: "John", date: "2024-01-01" }),
		);
	});

	test("coerces null content values to empty string", () => {
		const response = JSON.stringify({
			args: { title: "Test" },
			content: {
				Notes: null,
			},
			title: "Test Document",
		});

		const result = parseOllamaResponse(response);

		expect(result.content.Notes).toBe("");
	});

	test("handles missing content values with empty object", () => {
		// Note: JSON.stringify removes undefined values, so we test missing keys
		const response = JSON.stringify({
			args: { title: "Test" },
			content: {}, // Empty content object
			title: "Test Document",
		});

		const result = parseOllamaResponse(response);

		expect(result.content).toEqual({});
	});

	test("coerces number content values to strings", () => {
		const response = JSON.stringify({
			args: { title: "Test" },
			content: {
				Count: 42,
				Price: 19.99,
			},
			title: "Test Document",
		});

		const result = parseOllamaResponse(response);

		expect(result.content.Count).toBe("42");
		expect(result.content.Price).toBe("19.99");
	});

	test("coerces boolean content values to strings", () => {
		const response = JSON.stringify({
			args: { title: "Test" },
			content: {
				IsActive: true,
				IsDeleted: false,
			},
			title: "Test Document",
		});

		const result = parseOllamaResponse(response);

		expect(result.content.IsActive).toBe("true");
		expect(result.content.IsDeleted).toBe("false");
	});

	test("handles mixed content value types", () => {
		const response = JSON.stringify({
			args: { title: "Test" },
			content: {
				Text: "Normal text",
				Items: ["Item 1", "Item 2"],
				Metadata: { key: "value" },
				Empty: null,
				Count: 5,
				Active: true,
			},
			title: "Test Document",
		});

		const result = parseOllamaResponse(response);

		expect(result.content.Text).toBe("Normal text");
		expect(result.content.Items).toBe("Item 1\nItem 2");
		expect(result.content.Metadata).toBe(JSON.stringify({ key: "value" }));
		expect(result.content.Empty).toBe("");
		expect(result.content.Count).toBe("5");
		expect(result.content.Active).toBe("true");
	});

	test("strips markdown code fences from response", () => {
		const jsonContent = {
			args: { title: "Test" },
			content: { Notes: "Some notes" },
			title: "Test",
		};
		const response = `\`\`\`json\n${JSON.stringify(jsonContent)}\n\`\`\``;

		const result = parseOllamaResponse(response);

		expect(result.title).toBe("Test");
		expect(result.content.Notes).toBe("Some notes");
	});

	test("returns defaults for missing fields", () => {
		const response = JSON.stringify({});

		const result = parseOllamaResponse(response);

		expect(result.args).toEqual({});
		expect(result.content).toEqual({});
		expect(result.title).toBe("Untitled");
	});

	test("throws error for invalid JSON", () => {
		const response = "not valid json {";

		expect(() => parseOllamaResponse(response)).toThrow(
			/Failed to parse LLM response as JSON/,
		);
	});
});
