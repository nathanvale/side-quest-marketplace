/**
 * Tests for Firecrawl Enrichment Module
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
	enrichWithFirecrawl,
	getFirecrawlMethod,
	shouldUseFirecrawl,
} from "./firecrawl-enrichment";

// Mock the Firecrawl client
const mockScrape = mock(
	async (_options: unknown): Promise<unknown> => ({
		success: true,
		data: {
			markdown: "# Test Article\n\nThis is test content.",
		},
	}),
);

const mockExtract = mock(
	async (_options: unknown): Promise<unknown> => ({
		success: true,
		id: "test-job-id",
	}),
);

const mockGetExtractStatus = mock(
	async (_id: string): Promise<unknown> => ({
		success: true,
		status: "completed",
		data: {
			title: "Test Recipe",
			description: "A delicious test recipe",
			ingredients: ["flour", "water", "salt"],
			instructions: ["Mix ingredients", "Bake at 350F"],
		},
	}),
);

// Mock the firecrawl client module
mock.module("@sidequest/firecrawl/client", () => ({
	createFirecrawlClient: () => ({
		scrape: mockScrape,
		extract: mockExtract,
		getExtractStatus: mockGetExtractStatus,
	}),
}));

describe("Firecrawl Enrichment", () => {
	let originalEnv: string | undefined;

	beforeEach(() => {
		// Save original API key
		originalEnv = process.env.FIRECRAWL_API_KEY;

		// Clear mock call history
		mockScrape.mockClear();
		mockExtract.mockClear();
		mockGetExtractStatus.mockClear();
	});

	afterEach(() => {
		// Restore original API key
		if (originalEnv) {
			process.env.FIRECRAWL_API_KEY = originalEnv;
		} else {
			delete process.env.FIRECRAWL_API_KEY;
		}

		// Restore mocks
		mock.restore();
	});

	describe("shouldUseFirecrawl", () => {
		test("returns false for YouTube videos", () => {
			expect(shouldUseFirecrawl("youtube")).toBe(false);
		});

		test("returns true for articles", () => {
			expect(shouldUseFirecrawl("article")).toBe(true);
		});

		test("returns true for recipes", () => {
			expect(shouldUseFirecrawl("recipe")).toBe(true);
		});

		test("returns true for generic clippings", () => {
			expect(shouldUseFirecrawl("generic")).toBe(true);
		});
	});

	describe("getFirecrawlMethod", () => {
		test("returns extract for recipes", () => {
			expect(getFirecrawlMethod("recipe")).toBe("extract");
		});

		test("returns scrape for articles", () => {
			expect(getFirecrawlMethod("article")).toBe("scrape");
		});

		test("returns scrape for generic clippings", () => {
			expect(getFirecrawlMethod("generic")).toBe("scrape");
		});

		test("returns scrape for documentation", () => {
			expect(getFirecrawlMethod("documentation")).toBe("scrape");
		});
	});

	describe("enrichWithFirecrawl", () => {
		describe("without API key", () => {
			test("returns skipped status when API key not set", async () => {
				delete process.env.FIRECRAWL_API_KEY;

				const result = await enrichWithFirecrawl(
					"https://example.com/article",
					"article",
				);

				expect(result.status).toBe("skipped");
				expect(result.reason).toBe("FIRECRAWL_API_KEY not set");
				expect(mockScrape).not.toHaveBeenCalled();
			});
		});

		describe("with API key", () => {
			beforeEach(() => {
				process.env.FIRECRAWL_API_KEY = "test-api-key";
			});

			describe("scrape method", () => {
				test("successfully scrapes article content", async () => {
					const result = await enrichWithFirecrawl(
						"https://example.com/article",
						"article",
					);

					expect(result.status).toBe("success");
					expect(result.enrichment?.method).toBe("scrape");
					expect(result.enrichment?.markdown).toBe(
						"# Test Article\n\nThis is test content.",
					);
					expect(result.enrichment?.apiKeyAvailable).toBe(true);
					expect(mockScrape).toHaveBeenCalledWith({
						url: "https://example.com/article",
						formats: ["markdown"],
						onlyMainContent: true,
					});
				});

				test("handles scrape errors", async () => {
					mockScrape.mockResolvedValueOnce({
						success: false,
						error: "Site blocked scraping",
					});

					const result = await enrichWithFirecrawl(
						"https://example.com/blocked",
						"article",
					);

					expect(result.status).toBe("failed");
					expect(result.error).toBe("Site blocked scraping");
				});

				test("handles empty markdown response", async () => {
					mockScrape.mockResolvedValueOnce({
						success: true,
						data: {},
					});

					const result = await enrichWithFirecrawl(
						"https://example.com/empty",
						"article",
					);

					expect(result.status).toBe("failed");
					expect(result.error).toBe("No markdown content returned");
				});
			});

			describe("extract method", () => {
				test("successfully extracts recipe data", async () => {
					const result = await enrichWithFirecrawl(
						"https://example.com/recipe",
						"recipe",
					);

					expect(result.status).toBe("success");
					expect(result.enrichment?.method).toBe("extract");
					expect(result.enrichment?.structuredData).toEqual({
						title: "Test Recipe",
						description: "A delicious test recipe",
						ingredients: ["flour", "water", "salt"],
						instructions: ["Mix ingredients", "Bake at 350F"],
					});
					expect(mockExtract).toHaveBeenCalledWith({
						urls: ["https://example.com/recipe"],
						schema: expect.objectContaining({
							type: "object",
							properties: expect.objectContaining({
								title: expect.any(Object),
								ingredients: expect.any(Object),
							}),
						}),
						prompt: expect.stringContaining("Extract recipe details"),
					});
					expect(mockGetExtractStatus).toHaveBeenCalledWith("test-job-id");
				});

				test("handles extract job errors", async () => {
					mockExtract.mockResolvedValueOnce({
						success: false,
						error: "Invalid URL",
					});

					const result = await enrichWithFirecrawl(
						"https://example.com/invalid",
						"recipe",
					);

					expect(result.status).toBe("failed");
					expect(result.error).toBe("Invalid URL");
				});

				test("handles missing job ID", async () => {
					mockExtract.mockResolvedValueOnce({
						success: true,
					});

					const result = await enrichWithFirecrawl(
						"https://example.com/recipe",
						"recipe",
					);

					expect(result.status).toBe("failed");
					expect(result.error).toBe("No job ID returned from extract");
				});

				// Skip timeout test - it takes 30+ seconds to complete
				// The implementation polls 15 times with 2s delays
				test.skip("handles pending status timeout", async () => {
					// Always return pending
					mockGetExtractStatus.mockResolvedValue({
						success: true,
						status: "pending",
					});

					const result = await enrichWithFirecrawl(
						"https://example.com/slow",
						"recipe",
					);

					expect(result.status).toBe("failed");
					expect(result.error).toBe("Extract job timed out after 30s");
				});

				test("handles failed extract job", async () => {
					mockGetExtractStatus.mockResolvedValueOnce({
						success: true,
						status: "failed",
						error: "Extraction failed",
					});

					const result = await enrichWithFirecrawl(
						"https://example.com/failed",
						"recipe",
					);

					expect(result.status).toBe("failed");
					expect(result.error).toBe("Extraction failed");
				});

				test("handles missing data in completed job", async () => {
					mockGetExtractStatus.mockResolvedValueOnce({
						success: true,
						status: "completed",
					});

					const result = await enrichWithFirecrawl(
						"https://example.com/no-data",
						"recipe",
					);

					expect(result.status).toBe("failed");
					expect(result.error).toBe("No structured data returned");
				});
			});

			describe("error handling", () => {
				test("handles network errors", async () => {
					mockScrape.mockRejectedValueOnce(new Error("Network error"));

					const result = await enrichWithFirecrawl(
						"https://example.com/error",
						"article",
					);

					expect(result.status).toBe("failed");
					expect(result.error).toBe("Network error");
				});

				test("handles non-Error exceptions", async () => {
					mockScrape.mockRejectedValueOnce("string error");

					const result = await enrichWithFirecrawl(
						"https://example.com/error",
						"article",
					);

					expect(result.status).toBe("failed");
					expect(result.error).toBe("string error");
				});
			});
		});
	});
});
