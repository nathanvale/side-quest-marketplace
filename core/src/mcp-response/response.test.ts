import { describe, expect, test } from "bun:test";
import {
	formatError,
	type McpErrorResponse,
	type McpResponse,
	parseResponseFormat,
	ResponseFormat,
	respondError,
	respondText,
} from "./response";

describe("ResponseFormat", () => {
	test("has correct enum values", () => {
		expect(ResponseFormat.MARKDOWN).toBe(ResponseFormat.MARKDOWN);
		expect(ResponseFormat.JSON).toBe(ResponseFormat.JSON);

		// Check the actual string values
		expect(ResponseFormat.MARKDOWN as string).toBe("markdown");
		expect(ResponseFormat.JSON as string).toBe("json");
	});
});

describe("parseResponseFormat", () => {
	test('returns JSON when value is "json"', () => {
		expect(parseResponseFormat("json")).toBe(ResponseFormat.JSON);
	});

	test("returns MARKDOWN for any other string", () => {
		expect(parseResponseFormat("markdown")).toBe(ResponseFormat.MARKDOWN);
		expect(parseResponseFormat("html")).toBe(ResponseFormat.MARKDOWN);
		expect(parseResponseFormat("")).toBe(ResponseFormat.MARKDOWN);
		expect(parseResponseFormat("MARKDOWN")).toBe(ResponseFormat.MARKDOWN);
	});

	test("returns MARKDOWN when value is undefined", () => {
		expect(parseResponseFormat(undefined)).toBe(ResponseFormat.MARKDOWN);
	});
});

describe("formatError", () => {
	describe("with Error objects", () => {
		test("formats error as JSON with isError flag", () => {
			const error = new Error("Something went wrong");
			const result = formatError(error, ResponseFormat.JSON);
			const parsed = JSON.parse(result);

			expect(parsed).toEqual({
				error: "Something went wrong",
				isError: true,
			});
		});

		test("formats error as Markdown with bold prefix", () => {
			const error = new Error("Something went wrong");
			const result = formatError(error, ResponseFormat.MARKDOWN);

			expect(result).toBe("**Error:** Something went wrong");
		});
	});

	describe("with string errors", () => {
		test("formats string as JSON with isError flag", () => {
			const result = formatError("Custom error message", ResponseFormat.JSON);
			const parsed = JSON.parse(result);

			expect(parsed).toEqual({
				error: "Custom error message",
				isError: true,
			});
		});

		test("formats string as Markdown with bold prefix", () => {
			const result = formatError(
				"Custom error message",
				ResponseFormat.MARKDOWN,
			);

			expect(result).toBe("**Error:** Custom error message");
		});
	});

	describe("with other types", () => {
		test("formats null/undefined as string", () => {
			const resultNull = formatError(null, ResponseFormat.MARKDOWN);
			const resultUndefined = formatError(undefined, ResponseFormat.MARKDOWN);

			expect(resultNull).toBe("**Error:** null");
			expect(resultUndefined).toBe("**Error:** undefined");
		});

		test("formats objects as string", () => {
			const result = formatError({ code: "ERR_001" }, ResponseFormat.MARKDOWN);

			expect(result).toBe("**Error:** [object Object]");
		});
	});

	describe("JSON formatting", () => {
		test("produces valid JSON with pretty printing", () => {
			const error = new Error("Test error");
			const result = formatError(error, ResponseFormat.JSON);

			// Verify it's valid JSON
			expect(() => JSON.parse(result)).not.toThrow();

			// Verify pretty printing (contains newlines)
			expect(result).toContain("\n");
		});
	});
});

describe("respondText", () => {
	test("returns MCP response with text content", () => {
		const result = respondText(ResponseFormat.MARKDOWN, "Hello world");

		expect(result).toEqual({
			content: [
				{
					type: "text",
					text: "Hello world",
				},
			],
		});
	});

	test("returns same structure for JSON format", () => {
		const result = respondText(
			ResponseFormat.JSON,
			JSON.stringify({ message: "Hello" }),
		);

		expect(result).toEqual({
			content: [
				{
					type: "text",
					text: '{"message":"Hello"}',
				},
			],
		});
	});

	test("preserves exact text content", () => {
		const complexText = "Line 1\nLine 2\n\nWith **markdown** and `code`";
		const result = respondText(ResponseFormat.MARKDOWN, complexText);

		expect(result.content[0]?.text).toBe(complexText);
	});

	test("handles empty string", () => {
		const result = respondText(ResponseFormat.MARKDOWN, "");

		expect(result.content[0]?.text).toBe("");
	});
});

describe("respondError", () => {
	test("returns MCP error response with isError flag", () => {
		const error = new Error("Test error");
		const result = respondError(ResponseFormat.JSON, error);

		expect(result.isError).toBe(true);
		expect(result.content).toHaveLength(1);
		expect(result.content[0]?.type).toBe("text");

		const parsed = JSON.parse(result.content[0]!.text);
		expect(parsed).toEqual({
			error: "Test error",
			isError: true,
		});
	});

	test("formats error using formatError function", () => {
		const error = new Error("Specific error");
		const result = respondError(ResponseFormat.MARKDOWN, error);

		expect(result.content[0]?.text).toBe("**Error:** Specific error");
	});

	test("works with string errors", () => {
		const result = respondError(ResponseFormat.JSON, "String error");

		const parsed = JSON.parse(result.content[0]!.text);
		expect(parsed.error).toBe("String error");
		expect(parsed.isError).toBe(true);
	});

	test("type guard for McpErrorResponse", () => {
		const error = new Error("Test");
		const result = respondError(ResponseFormat.JSON, error);

		// TypeScript type narrowing
		if ("isError" in result && result.isError === true) {
			const errorResponse: McpErrorResponse = result;
			expect(errorResponse.isError).toBe(true);
		}
	});
});

describe("Integration scenarios", () => {
	test("typical tool success flow", () => {
		const format = parseResponseFormat("json");
		const data = { status: "success", count: 42 };
		const response = respondText(format, JSON.stringify(data));

		expect(response.content[0]?.text).toBe('{"status":"success","count":42}');
	});

	test("typical tool error flow", () => {
		const format = parseResponseFormat("json");
		const error = new Error("Database connection failed");
		const response = respondError(format, error);

		expect(response.isError).toBe(true);

		const parsed = JSON.parse(response.content[0]!.text);
		expect(parsed.error).toBe("Database connection failed");
		expect(parsed.isError).toBe(true);
	});

	test("markdown formatting for human-readable output", () => {
		const format = parseResponseFormat("markdown");
		const text = "# Results\n\nFound 5 items.";
		const response = respondText(format, text);

		expect(response.content[0]?.text).toBe("# Results\n\nFound 5 items.");
	});

	test("error detection in client code", () => {
		const response1 = respondText(ResponseFormat.JSON, '{"ok": true}');
		const response2 = respondError(ResponseFormat.JSON, "Failed");

		// Client can check for error responses
		expect("isError" in response1).toBe(false);
		expect("isError" in response2).toBe(true);
		expect((response2 as McpErrorResponse).isError).toBe(true);
	});
});
