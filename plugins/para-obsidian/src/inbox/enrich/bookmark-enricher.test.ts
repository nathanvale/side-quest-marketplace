/**
 * Bookmark Enricher Tests
 *
 * Tests for the Firecrawl-based bookmark enrichment module.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	enrichBookmarkWithFirecrawl,
	extractDomain,
	isValidUrl,
	RateLimiter,
} from "./bookmark-enricher";
import { BookmarkEnrichmentError } from "./types";

describe("extractDomain", () => {
	test("extracts domain from http URL", () => {
		expect(extractDomain("http://example.com/path")).toBe("example.com");
	});

	test("extracts domain from https URL", () => {
		expect(extractDomain("https://docs.github.com/en/actions")).toBe(
			"docs.github.com",
		);
	});

	test("removes www prefix", () => {
		expect(extractDomain("https://www.example.com")).toBe("example.com");
	});

	test("returns 'unknown' for invalid URL", () => {
		expect(extractDomain("not-a-url")).toBe("unknown");
		expect(extractDomain("")).toBe("unknown");
	});
});

describe("isValidUrl", () => {
	test("accepts http URLs", () => {
		expect(isValidUrl("http://example.com")).toBe(true);
	});

	test("accepts https URLs", () => {
		expect(isValidUrl("https://example.com/path?query=1")).toBe(true);
	});

	test("rejects non-http protocols", () => {
		expect(isValidUrl("ftp://example.com")).toBe(false);
		expect(isValidUrl("file:///path")).toBe(false);
	});

	test("rejects invalid URLs", () => {
		expect(isValidUrl("not-a-url")).toBe(false);
		expect(isValidUrl("")).toBe(false);
	});
});

describe("RateLimiter", () => {
	test("allows first request immediately", async () => {
		const limiter = new RateLimiter(1000);
		const start = Date.now();
		await limiter.wait();
		const elapsed = Date.now() - start;
		expect(elapsed).toBeLessThan(50); // Should be nearly instant
	});

	test("delays subsequent requests", async () => {
		const limiter = new RateLimiter(100); // Short delay for testing
		await limiter.wait(); // First request
		const start = Date.now();
		await limiter.wait(); // Second request should wait
		const elapsed = Date.now() - start;
		expect(elapsed).toBeGreaterThanOrEqual(90); // Should wait ~100ms
	});
});

describe("enrichBookmarkWithFirecrawl", () => {
	const originalEnv = process.env.FIRECRAWL_API_KEY;

	beforeEach(() => {
		// Set a fake API key for tests
		process.env.FIRECRAWL_API_KEY = "test-api-key";
	});

	afterEach(() => {
		// Restore original env
		if (originalEnv) {
			process.env.FIRECRAWL_API_KEY = originalEnv;
		} else {
			delete process.env.FIRECRAWL_API_KEY;
		}
	});

	test("throws INVALID_URL for missing URL", async () => {
		try {
			await enrichBookmarkWithFirecrawl("", "Test Title");
			expect.unreachable("Should have thrown");
		} catch (error) {
			expect(error).toBeInstanceOf(BookmarkEnrichmentError);
			const enrichError = error as BookmarkEnrichmentError;
			expect(enrichError.code).toBe("INVALID_URL");
			expect(enrichError.retryable).toBe(false);
		}
	});

	test("throws INVALID_URL for malformed URL", async () => {
		try {
			await enrichBookmarkWithFirecrawl("not-a-valid-url", "Test Title");
			expect.unreachable("Should have thrown");
		} catch (error) {
			expect(error).toBeInstanceOf(BookmarkEnrichmentError);
			const enrichError = error as BookmarkEnrichmentError;
			expect(enrichError.code).toBe("INVALID_URL");
		}
	});

	test("throws API_KEY_MISSING when env var not set", async () => {
		delete process.env.FIRECRAWL_API_KEY;

		try {
			await enrichBookmarkWithFirecrawl("https://example.com", "Test Title");
			expect.unreachable("Should have thrown");
		} catch (error) {
			expect(error).toBeInstanceOf(BookmarkEnrichmentError);
			const enrichError = error as BookmarkEnrichmentError;
			expect(enrichError.code).toBe("API_KEY_MISSING");
			expect(enrichError.retryable).toBe(false);
		}
	});

	// Note: Integration tests with actual Firecrawl API should be in a separate
	// test file and only run when FIRECRAWL_API_KEY is set to a real key.
	// These unit tests focus on error handling and validation logic.
});

describe("BookmarkEnrichmentError", () => {
	test("creates error with all properties", () => {
		const error = new BookmarkEnrichmentError(
			"Test error message",
			"FIRECRAWL_RATE_LIMITED",
			"https://example.com",
			true,
			60000,
		);

		expect(error.message).toBe("Test error message");
		expect(error.code).toBe("FIRECRAWL_RATE_LIMITED");
		expect(error.url).toBe("https://example.com");
		expect(error.retryable).toBe(true);
		expect(error.retryAfterMs).toBe(60000);
		expect(error.name).toBe("BookmarkEnrichmentError");
	});

	test("defaults retryable to false", () => {
		const error = new BookmarkEnrichmentError(
			"Test error",
			"INVALID_URL",
			"bad-url",
		);

		expect(error.retryable).toBe(false);
		expect(error.retryAfterMs).toBeUndefined();
	});
});
