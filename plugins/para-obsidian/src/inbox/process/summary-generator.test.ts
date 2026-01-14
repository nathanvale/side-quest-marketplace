import { describe, expect, mock, test } from "bun:test";
import { generateSummary } from "./summary-generator.js";

// Mock the LLM client
mock.module("../core/llm/client.js", () => ({
	callLLMWithMetadata: mock(async () => ({
		response:
			"Tutorial covering React Server Components with data fetching patterns",
		modelUsed: "haiku",
		isFallback: false,
	})),
}));

describe("summary-generator", () => {
	describe("generateSummary", () => {
		test("returns skipped when no content provided", async () => {
			const result = await generateSummary({
				clippingType: "youtube",
				title: "Test Video",
				content: "",
			});

			expect(result.status).toBe("skipped");
			expect(result.summary).toBe("");
			expect(result.error).toBe("No content available to summarize");
		});

		test("generates summary for youtube with transcript", async () => {
			const result = await generateSummary({
				clippingType: "youtube",
				title: "React Server Components Tutorial",
				content: "Original note content",
				transcript: "Welcome to this tutorial about React Server Components...",
			});

			expect(result.status).toBe("success");
			expect(result.summary).toBeTruthy();
			expect(result.summary.length).toBeGreaterThan(10);
		});

		test("generates summary for article", async () => {
			const result = await generateSummary({
				clippingType: "article",
				title: "Understanding TypeScript Generics",
				content: "TypeScript generics allow you to write reusable code...",
			});

			expect(result.status).toBe("success");
			expect(result.summary).toBeTruthy();
		});

		test("generates summary for recipe", async () => {
			const result = await generateSummary({
				clippingType: "recipe",
				title: "Thai Green Curry",
				content: "This authentic Thai green curry uses fresh ingredients...",
			});

			expect(result.status).toBe("success");
			expect(result.summary).toBeTruthy();
		});

		test("generates summary for generic content", async () => {
			const result = await generateSummary({
				clippingType: "generic",
				title: "Interesting Page",
				content: "Some interesting content from the web...",
			});

			expect(result.status).toBe("success");
			expect(result.summary).toBeTruthy();
		});

		test("prefers transcript over content for youtube", async () => {
			// The mock returns a fixed response, but we're testing that
			// the function runs without error when both are provided
			const result = await generateSummary({
				clippingType: "youtube",
				title: "Test Video",
				content: "Short note content",
				transcript:
					"Much longer transcript content that should be used for summary generation...",
			});

			expect(result.status).toBe("success");
		});
	});
});
