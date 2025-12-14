/**
 * Tests for local LLM integration.
 *
 * @module llm.test
 */

import { describe, expect, test } from "bun:test";
import {
	DEFAULT_LLM_MODEL,
	DEFAULT_OLLAMA_URL,
	parseOllamaResponse,
	validateModel,
} from "../client";

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

describe("constants", () => {
	test("DEFAULT_LLM_MODEL is set to haiku", () => {
		expect(DEFAULT_LLM_MODEL).toBe("haiku");
	});

	test("DEFAULT_OLLAMA_URL is localhost", () => {
		expect(DEFAULT_OLLAMA_URL).toBe("http://localhost:11434");
	});
});

describe("validateModel", () => {
	test("validates allowed Claude models", () => {
		const allowed = ["sonnet", "haiku", "qwen:7b"];
		expect(validateModel("sonnet", allowed)).toBe("sonnet");
		expect(validateModel("haiku", allowed)).toBe("haiku");
	});

	test("validates allowed Ollama models", () => {
		const allowed = [
			"sonnet",
			"haiku",
			"qwen:7b",
			"qwen:14b",
			"qwen2.5:14b",
			"qwen-coder:17b",
		];
		expect(validateModel("qwen:7b", allowed)).toBe("qwen:7b");
		expect(validateModel("qwen:14b", allowed)).toBe("qwen:14b");
		expect(validateModel("qwen2.5:14b", allowed)).toBe("qwen2.5:14b");
		expect(validateModel("qwen-coder:17b", allowed)).toBe("qwen-coder:17b");
	});

	test("throws on invalid model", () => {
		const allowed = ["sonnet", "haiku"];
		expect(() => validateModel("invalid", allowed)).toThrow(/Invalid model/);
		expect(() => validateModel("qwen:7b", allowed)).toThrow(/Invalid model/);
	});

	test("error message includes allowed models", () => {
		const allowed = ["sonnet", "haiku"];
		try {
			validateModel("qwen:7b", allowed);
			expect(true).toBe(false); // Should not reach here
		} catch (error) {
			expect(error instanceof Error).toBe(true);
			expect((error as Error).message).toContain("sonnet");
			expect((error as Error).message).toContain("haiku");
			expect((error as Error).message).toContain("Invalid model");
			expect((error as Error).message).toContain("qwen:7b");
		}
	});

	test("error message mentions .paraobsidianrc", () => {
		const allowed = ["sonnet"];
		try {
			validateModel("haiku", allowed);
			expect(true).toBe(false); // Should not reach here
		} catch (error) {
			expect(error instanceof Error).toBe(true);
			expect((error as Error).message).toContain(".paraobsidianrc");
		}
	});
});
