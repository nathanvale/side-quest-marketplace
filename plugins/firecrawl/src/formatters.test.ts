/**
 * Tests for token-efficient formatters.
 */

import { describe, expect, test } from "bun:test";
import {
	formatExtractResponse,
	formatMapResponse,
	formatScrapeResponse,
	formatSearchResponse,
	formatUrlList,
} from "./formatters";

describe("formatScrapeResponse", () => {
	test("formats successful scrape with markdown", () => {
		const result = formatScrapeResponse({
			success: true,
			data: {
				markdown: "# Hello World\n\nThis is content.",
				metadata: {
					title: "Test Page",
					sourceURL: "https://example.com",
				},
			},
		});

		expect(result).toContain("# Test Page");
		expect(result).toContain("Source: https://example.com");
		expect(result).toContain("# Hello World");
		expect(result).toContain("This is content.");
	});

	test("formats scrape with summary fallback", () => {
		const result = formatScrapeResponse({
			success: true,
			data: {
				summary: "A brief summary of the page",
				metadata: { title: "Summary Page" },
			},
		});

		expect(result).toContain("# Summary Page");
		expect(result).toContain("Summary: A brief summary of the page");
	});

	test("includes link count", () => {
		const result = formatScrapeResponse({
			success: true,
			data: {
				markdown: "Content",
				links: ["https://a.com", "https://b.com", "https://c.com"],
			},
		});

		expect(result).toContain("Found 3 links");
	});

	test("handles error response", () => {
		const result = formatScrapeResponse({
			success: false,
			error: "Invalid URL",
		} as never);

		expect(result).toBe("Error: Invalid URL");
	});

	test("handles empty data", () => {
		const result = formatScrapeResponse({
			success: true,
		});

		expect(result).toBe("No data returned");
	});

	test("truncates long markdown", () => {
		const longContent = "x".repeat(10000);
		const result = formatScrapeResponse({
			success: true,
			data: { markdown: longContent },
		});

		expect(result).toContain("[truncated]");
		expect(result.length).toBeLessThan(longContent.length);
	});
});

describe("formatMapResponse", () => {
	test("formats successful map with links", () => {
		const result = formatMapResponse({
			success: true,
			links: [
				{ url: "https://example.com/page1", title: "Page 1" },
				{ url: "https://example.com/page2", title: "Page 2" },
			],
		});

		expect(result).toContain("Found 2 URLs");
		expect(result).toContain("- https://example.com/page1 - Page 1");
		expect(result).toContain("- https://example.com/page2 - Page 2");
	});

	test("handles links without titles", () => {
		const result = formatMapResponse({
			success: true,
			links: [{ url: "https://example.com/page1" }],
		});

		expect(result).toContain("- https://example.com/page1");
		expect(result).not.toContain(" - ");
	});

	test("truncates many links", () => {
		const links = Array.from({ length: 100 }, (_, i) => ({
			url: `https://example.com/page${i}`,
		}));

		const result = formatMapResponse({
			success: true,
			links,
		});

		expect(result).toContain("Found 100 URLs");
		expect(result).toContain("... and 50 more");
	});

	test("handles error response", () => {
		const result = formatMapResponse({
			success: false,
			error: "Site blocked",
		} as never);

		expect(result).toBe("Error: Site blocked");
	});

	test("handles no URLs found", () => {
		const result = formatMapResponse({
			success: true,
			links: [],
		});

		expect(result).toBe("No URLs found");
	});
});

describe("formatSearchResponse", () => {
	test("formats web results", () => {
		const result = formatSearchResponse({
			success: true,
			data: {
				web: [
					{
						url: "https://example.com",
						title: "Example",
						description: "An example site",
					},
				],
			},
		});

		expect(result).toContain("## Web Results (1)");
		expect(result).toContain("### Example");
		expect(result).toContain("https://example.com");
		expect(result).toContain("An example site");
	});

	test("includes markdown content when available", () => {
		const result = formatSearchResponse({
			success: true,
			data: {
				web: [
					{
						url: "https://example.com",
						title: "Example",
						markdown: "# Page content here",
					},
				],
			},
		});

		expect(result).toContain("# Page content here");
	});

	test("shows image count", () => {
		const result = formatSearchResponse({
			success: true,
			data: {
				images: [
					{
						imageUrl: "https://example.com/img.png",
						url: "https://example.com",
					},
					{
						imageUrl: "https://example.com/img2.png",
						url: "https://example.com",
					},
				],
			},
		});

		expect(result).toContain("## Images: 2 found");
	});

	test("formats news results", () => {
		const result = formatSearchResponse({
			success: true,
			data: {
				news: [
					{
						url: "https://news.example.com/article",
						title: "Breaking News",
						date: "2024-01-15",
					},
				],
			},
		});

		expect(result).toContain("## News Results (1)");
		expect(result).toContain("Breaking News");
		expect(result).toContain("2024-01-15");
	});

	test("handles error response", () => {
		const result = formatSearchResponse({
			success: false,
			error: "Rate limited",
		} as never);

		expect(result).toBe("Error: Rate limited");
	});
});

describe("formatExtractResponse", () => {
	test("formats completed extraction", () => {
		const result = formatExtractResponse({
			success: true,
			status: "completed",
			data: { name: "John", email: "john@example.com" },
		});

		expect(result).toContain("Status: completed");
		expect(result).toContain("## Extracted Data");
		expect(result).toContain('"name": "John"');
		expect(result).toContain('"email": "john@example.com"');
	});

	test("shows source count", () => {
		const result = formatExtractResponse({
			success: true,
			status: "completed",
			data: { title: "Test" },
			sources: ["https://example.com/page1", "https://example.com/page2"],
		});

		expect(result).toContain("Sources: 2 pages");
	});

	test("handles pending status", () => {
		const result = formatExtractResponse({
			success: true,
			status: "pending",
		});

		expect(result).toContain("Status: pending");
		expect(result).not.toContain("## Extracted Data");
	});

	test("handles error response", () => {
		const result = formatExtractResponse({
			success: false,
			error: "Schema validation failed",
		} as never);

		expect(result).toBe("Error: Schema validation failed");
	});
});

describe("formatUrlList", () => {
	test("formats links as simple URL list", () => {
		const result = formatUrlList([
			{ url: "https://example.com/a" },
			{ url: "https://example.com/b" },
			{ url: "https://example.com/c" },
		]);

		expect(result).toBe(
			"https://example.com/a\nhttps://example.com/b\nhttps://example.com/c",
		);
	});

	test("handles empty list", () => {
		const result = formatUrlList([]);
		expect(result).toBe("");
	});
});
