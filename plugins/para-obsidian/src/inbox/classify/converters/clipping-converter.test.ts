/**
 * Tests for clipping-to-bookmark converter.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { VaultContext } from "../../core/vault/context";
import { convertClippingToBookmark } from "./clipping-converter";

describe("convertClippingToBookmark", () => {
	let originalApiKey: string | undefined;
	let vaultContext: VaultContext;

	beforeEach(() => {
		originalApiKey = process.env.FIRECRAWL_API_KEY;
		vaultContext = {
			areas: ["Finance", "Health", "Development", "Learning"],
			projects: ["Tax 2024", "Website Redesign"],
		};
	});

	afterEach(() => {
		// Restore original API key
		if (originalApiKey) {
			process.env.FIRECRAWL_API_KEY = originalApiKey;
		} else {
			delete process.env.FIRECRAWL_API_KEY;
		}
	});

	describe("basic conversion", () => {
		test("converts clipping with URL and title", async () => {
			delete process.env.FIRECRAWL_API_KEY; // No API key

			const frontmatter = {
				url: "https://example.com",
				title: "Example Page",
				type: "clipping",
			};

			const result = await convertClippingToBookmark(
				frontmatter,
				"Page excerpt content",
				vaultContext,
			);

			expect(result.success).toBe(true);
			expect(result.title).toBe("Example Page");
			expect(result.firecrawlAttempted).toBe(false);
			expect(result.errorType).toBe("api-key-missing");
		});

		test("fails when URL is missing", async () => {
			const frontmatter = {
				title: "No URL",
				type: "clipping",
			};

			const result = await convertClippingToBookmark(
				frontmatter,
				"",
				vaultContext,
			);

			expect(result.success).toBe(false);
			expect(result.error).toContain("URL required");
			expect(result.firecrawlAttempted).toBe(false);
		});

		test("uses 'Untitled Bookmark' when title is missing", async () => {
			delete process.env.FIRECRAWL_API_KEY;

			const frontmatter = {
				url: "https://example.com",
				type: "clipping",
			};

			const result = await convertClippingToBookmark(
				frontmatter,
				"",
				vaultContext,
			);

			expect(result.success).toBe(true);
			expect(result.title).toBe("Untitled Bookmark");
		});
	});

	describe("Firecrawl enrichment", () => {
		test("attempts Firecrawl when API key is set", async () => {
			process.env.FIRECRAWL_API_KEY = "test-api-key";

			// Mock the Firecrawl client
			const mockCreateClient = mock(() => ({
				scrape: mock(async () => ({
					success: true,
					data: {
						markdown: "# Example\nThis is a test page with some content.",
					},
				})),
			}));

			// Mock the dynamic import
			mock.module("@sidequest/firecrawl/client", () => ({
				createFirecrawlClient: mockCreateClient,
			}));

			const frontmatter = {
				url: "https://example.com",
				title: "Example",
				type: "clipping",
			};

			const result = await convertClippingToBookmark(
				frontmatter,
				"",
				vaultContext,
			);

			expect(result.success).toBe(true);
			expect(result.firecrawlAttempted).toBe(true);
			expect(result.summary).toBeDefined();
			expect(result.summary).toContain("Example");
		});

		test("handles Firecrawl API errors gracefully", async () => {
			process.env.FIRECRAWL_API_KEY = "test-api-key";

			// Mock failed Firecrawl response
			const mockCreateClient = mock(() => ({
				scrape: mock(async () => ({
					success: false,
					error: "HTTP 429: Rate limit exceeded",
				})),
			}));

			mock.module("@sidequest/firecrawl/client", () => ({
				createFirecrawlClient: mockCreateClient,
			}));

			const frontmatter = {
				url: "https://example.com",
				title: "Example",
				type: "clipping",
			};

			const result = await convertClippingToBookmark(
				frontmatter,
				"",
				vaultContext,
			);

			expect(result.success).toBe(true); // Conversion still succeeds
			expect(result.firecrawlAttempted).toBe(true);
			expect(result.summary).toBeUndefined();
			expect(result.errorType).toBe("rate-limit");
		});

		test("handles network errors gracefully", async () => {
			process.env.FIRECRAWL_API_KEY = "test-api-key";

			// Mock network error
			const mockCreateClient = mock(() => ({
				scrape: mock(async () => {
					throw new Error("Network error: ENOTFOUND");
				}),
			}));

			mock.module("@sidequest/firecrawl/client", () => ({
				createFirecrawlClient: mockCreateClient,
			}));

			const frontmatter = {
				url: "https://example.com",
				title: "Example",
				type: "clipping",
			};

			const result = await convertClippingToBookmark(
				frontmatter,
				"",
				vaultContext,
			);

			expect(result.success).toBe(true);
			expect(result.firecrawlAttempted).toBe(true);
			expect(result.summary).toBeUndefined();
			expect(result.errorType).toBe("network");
		});

		test("handles timeout errors", async () => {
			process.env.FIRECRAWL_API_KEY = "test-api-key";

			// Mock scrape that rejects with timeout error
			const mockCreateClient = mock(() => ({
				scrape: mock(async () => {
					throw new Error("Firecrawl timeout");
				}),
			}));

			mock.module("@sidequest/firecrawl/client", () => ({
				createFirecrawlClient: mockCreateClient,
			}));

			const frontmatter = {
				url: "https://example.com",
				title: "Example",
				type: "clipping",
			};

			const result = await convertClippingToBookmark(
				frontmatter,
				"",
				vaultContext,
			);

			expect(result.success).toBe(true);
			expect(result.firecrawlAttempted).toBe(true);
			expect(result.summary).toBeUndefined();
			expect(result.errorType).toBe("timeout");
		});
	});

	describe("URL routing suggestions", () => {
		beforeEach(() => {
			delete process.env.FIRECRAWL_API_KEY; // Skip Firecrawl for routing tests
		});

		test("suggests Finance area for banking URLs", async () => {
			const frontmatter = {
				url: "https://mybank.com/account",
				title: "Bank Account",
				type: "clipping",
			};

			const result = await convertClippingToBookmark(
				frontmatter,
				"",
				vaultContext,
			);

			expect(result.suggestedArea).toBe("Finance");
			expect(result.suggestedProject).toBeUndefined();
		});

		test("suggests Health area for medical URLs", async () => {
			const frontmatter = {
				url: "https://hospital.org/patient-portal",
				title: "Patient Portal",
				type: "clipping",
			};

			const result = await convertClippingToBookmark(
				frontmatter,
				"",
				vaultContext,
			);

			expect(result.suggestedArea).toBe("Health");
		});

		test("suggests Development area for GitHub URLs", async () => {
			const frontmatter = {
				url: "https://github.com/user/repo",
				title: "GitHub Repo",
				type: "clipping",
			};

			const result = await convertClippingToBookmark(
				frontmatter,
				"",
				vaultContext,
			);

			expect(result.suggestedArea).toBe("Development");
		});

		test("suggests Learning area for course URLs", async () => {
			const frontmatter = {
				url: "https://udemy.com/course/typescript-101",
				title: "TypeScript Course",
				type: "clipping",
			};

			const result = await convertClippingToBookmark(
				frontmatter,
				"",
				vaultContext,
			);

			expect(result.suggestedArea).toBe("Learning");
		});

		test("suggests based on content when URL pattern doesn't match", async () => {
			const frontmatter = {
				url: "https://random-site.com/article",
				title: "Random Article",
				type: "clipping",
			};

			const content =
				"This article discusses personal finance and budgeting tips.";

			const result = await convertClippingToBookmark(
				frontmatter,
				content,
				vaultContext,
			);

			expect(result.suggestedArea).toBe("Finance");
		});

		test("returns no suggestion when pattern doesn't match vault areas", async () => {
			const vaultContextWithoutFinance: VaultContext = {
				areas: ["Work", "Personal"],
				projects: [],
			};

			const frontmatter = {
				url: "https://mybank.com/account",
				title: "Bank Account",
				type: "clipping",
			};

			const result = await convertClippingToBookmark(
				frontmatter,
				"",
				vaultContextWithoutFinance,
			);

			expect(result.suggestedArea).toBeUndefined();
			expect(result.suggestedProject).toBeUndefined();
		});
	});

	describe("summary truncation", () => {
		test("truncates long summaries at sentence boundaries", async () => {
			process.env.FIRECRAWL_API_KEY = "test-api-key";

			// Create a long markdown with clear sentences
			const longMarkdown =
				"# Title\n\n" +
				"This is sentence one. ".repeat(50) +
				"This is sentence two. ".repeat(50) +
				"This is sentence three.";

			const mockCreateClient = mock(() => ({
				scrape: mock(async () => ({
					success: true,
					data: { markdown: longMarkdown },
				})),
			}));

			mock.module("@sidequest/firecrawl/client", () => ({
				createFirecrawlClient: mockCreateClient,
			}));

			const frontmatter = {
				url: "https://example.com",
				title: "Example",
				type: "clipping",
			};

			const result = await convertClippingToBookmark(
				frontmatter,
				"",
				vaultContext,
			);

			expect(result.summary).toBeDefined();
			if (result.summary) {
				expect(result.summary.length).toBeLessThanOrEqual(2000);
				// Should end with a sentence boundary (period, not ellipsis if sentence found)
				const endsWithSentence = /[.!?]$/.test(result.summary.trim());
				const endsWithEllipsis = result.summary.endsWith("...");
				expect(endsWithSentence || endsWithEllipsis).toBe(true);
			}
		});

		test("preserves short summaries unchanged", async () => {
			process.env.FIRECRAWL_API_KEY = "test-api-key";

			const shortMarkdown = "# Title\n\nThis is a short summary.";

			const mockCreateClient = mock(() => ({
				scrape: mock(async () => ({
					success: true,
					data: { markdown: shortMarkdown },
				})),
			}));

			mock.module("@sidequest/firecrawl/client", () => ({
				createFirecrawlClient: mockCreateClient,
			}));

			const frontmatter = {
				url: "https://example.com",
				title: "Example",
				type: "clipping",
			};

			const result = await convertClippingToBookmark(
				frontmatter,
				"",
				vaultContext,
			);

			expect(result.summary).toBe(shortMarkdown);
		});
	});
});
