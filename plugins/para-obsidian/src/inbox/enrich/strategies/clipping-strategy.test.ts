/**
 * Clipping Classification Strategy Tests
 *
 * Test suite for clipping type classification and strategy integration.
 *
 * @module inbox/enrich/strategies/clipping-strategy.test
 */

import { describe, expect, test } from "bun:test";
import type { EnrichmentContext, EnrichmentOptions } from "../types";
import {
	applyClippingClassification,
	clippingClassificationStrategy,
} from "./clipping-strategy";
import {
	type ClippingType,
	classifyClipping,
	extractYouTubeVideoId,
} from "./clipping-types";

// =============================================================================
// URL Pattern Detection Tests
// =============================================================================

describe("classifyClipping - URL pattern detection", () => {
	test("detects YouTube from various URL formats", () => {
		const urls = [
			"https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			"https://youtu.be/dQw4w9WgXcQ",
			"https://www.youtube.com/embed/dQw4w9WgXcQ",
			"https://www.youtube.com/v/dQw4w9WgXcQ",
			"https://www.youtube.com/shorts/dQw4w9WgXcQ",
		];

		for (const url of urls) {
			expect(classifyClipping(url)).toBe("youtube");
		}
	});

	test("detects GitHub URLs", () => {
		expect(
			classifyClipping(
				"https://github.com/anthropics/anthropic-sdk-typescript",
			),
		).toBe("github");
		expect(classifyClipping("https://github.com/user/repo/issues/123")).toBe(
			"github",
		);
	});

	test("detects social media URLs", () => {
		expect(classifyClipping("https://twitter.com/user/status/123")).toBe(
			"social",
		);
		expect(classifyClipping("https://x.com/user/status/123")).toBe("social");
		expect(classifyClipping("https://reddit.com/r/programming")).toBe("social");
	});

	test("detects documentation URLs", () => {
		expect(classifyClipping("https://docs.anthropic.com/api")).toBe(
			"documentation",
		);
		expect(
			classifyClipping("https://developer.mozilla.org/en-US/docs/Web"),
		).toBe("documentation");
	});

	test("detects recipe URLs", () => {
		expect(classifyClipping("https://allrecipes.com/recipe/123")).toBe(
			"recipe",
		);
		expect(classifyClipping("https://www.seriouseats.com/recipe")).toBe(
			"recipe",
		);
		expect(classifyClipping("https://www.bonappetit.com/recipe")).toBe(
			"recipe",
		);
	});

	test("detects product URLs", () => {
		expect(classifyClipping("https://www.amazon.com/product/123")).toBe(
			"product",
		);
		expect(classifyClipping("https://www.ebay.com/itm/123")).toBe("product");
		expect(classifyClipping("https://www.etsy.com/listing/123")).toBe(
			"product",
		);
	});

	test("detects podcast URLs", () => {
		expect(classifyClipping("https://open.spotify.com/episode/123")).toBe(
			"podcast",
		);
		expect(classifyClipping("https://podcasts.apple.com/podcast/123")).toBe(
			"podcast",
		);
		expect(classifyClipping("https://overcast.fm/+123")).toBe("podcast");
	});

	test("detects book URLs", () => {
		expect(classifyClipping("https://www.goodreads.com/book/show/123")).toBe(
			"book",
		);
	});

	test("defaults to generic for unknown URLs", () => {
		expect(classifyClipping("https://example.com/page")).toBe("generic");
		expect(classifyClipping("https://random-site.io/article")).toBe("generic");
	});
});

// =============================================================================
// Content Marker Detection Tests
// =============================================================================

describe("classifyClipping - content marker detection", () => {
	test("detects recipe from content markers", () => {
		const content =
			"Ingredients: 2 cups flour, 1 cup sugar. Prep time: 15 minutes.";
		expect(classifyClipping("https://example.com/recipe", content)).toBe(
			"recipe",
		);
	});

	test("detects product from price markers", () => {
		const content = "Price: $29.99. Add to cart now!";
		expect(classifyClipping("https://example.com/product", content)).toBe(
			"product",
		);
	});

	test("detects documentation from code markers", () => {
		const content = "```typescript\nconst api = new API();\n```\nAPI Reference";
		expect(classifyClipping("https://example.com/docs", content)).toBe(
			"documentation",
		);
	});

	test("URL pattern takes precedence over content markers", () => {
		// Even with recipe content, GitHub URL wins
		const content = "Ingredients: 2 cups flour";
		expect(classifyClipping("https://github.com/user/repo", content)).toBe(
			"github",
		);
	});

	test("defaults to generic when no markers match", () => {
		const content = "This is a random article about technology.";
		expect(classifyClipping("https://example.com/article", content)).toBe(
			"generic",
		);
	});
});

// =============================================================================
// YouTube Video ID Extraction Tests
// =============================================================================

describe("extractYouTubeVideoId", () => {
	test("extracts from watch URL", () => {
		expect(
			extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
		).toBe("dQw4w9WgXcQ");
		expect(
			extractYouTubeVideoId("https://youtube.com/watch?v=abc12345678"),
		).toBe("abc12345678");
	});

	test("extracts from youtu.be short URL", () => {
		expect(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe(
			"dQw4w9WgXcQ",
		);
		expect(extractYouTubeVideoId("https://youtu.be/abc12345678?t=123")).toBe(
			"abc12345678",
		);
	});

	test("extracts from embed URL", () => {
		expect(
			extractYouTubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ"),
		).toBe("dQw4w9WgXcQ");
	});

	test("extracts from /v/ URL", () => {
		expect(extractYouTubeVideoId("https://www.youtube.com/v/dQw4w9WgXcQ")).toBe(
			"dQw4w9WgXcQ",
		);
	});

	test("extracts from shorts URL", () => {
		expect(
			extractYouTubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ"),
		).toBe("dQw4w9WgXcQ");
	});

	test("returns null for non-YouTube URLs", () => {
		expect(extractYouTubeVideoId("https://example.com/video")).toBeNull();
		expect(extractYouTubeVideoId("https://vimeo.com/123456789")).toBeNull();
	});

	test("returns null for malformed YouTube URLs", () => {
		expect(extractYouTubeVideoId("https://www.youtube.com/")).toBeNull();
		expect(extractYouTubeVideoId("https://www.youtube.com/watch")).toBeNull();
	});
});

// =============================================================================
// Strategy canEnrich Tests
// =============================================================================

describe("clippingClassificationStrategy.canEnrich", () => {
	const createContext = (
		frontmatter: Record<string, unknown>,
	): EnrichmentContext => ({
		file: {
			path: "/vault/00 Inbox/test.md",
			extension: ".md",
			filename: "test.md",
		},
		frontmatter,
		body: "",
		vaultPath: "/vault",
	});

	test("returns eligible for type:clipping with distill_status:raw", () => {
		const ctx = createContext({
			type: "clipping",
			distill_status: "raw",
			source: "https://example.com",
		});

		const result = clippingClassificationStrategy.canEnrich(ctx);
		expect(result.eligible).toBe(true);
	});

	test("returns ineligible for non-clipping type", () => {
		const ctx = createContext({
			type: "bookmark",
			distill_status: "raw",
			source: "https://example.com",
		});

		const result = clippingClassificationStrategy.canEnrich(ctx);
		expect(result.eligible).toBe(false);
		expect(result.reason).toContain("Not a clipping");
	});

	test("returns ineligible for already classified", () => {
		const ctx = createContext({
			type: "clipping",
			distill_status: "classified",
			source: "https://example.com",
		});

		const result = clippingClassificationStrategy.canEnrich(ctx);
		expect(result.eligible).toBe(false);
		expect(result.reason).toContain("already classified");
	});

	test("returns ineligible for missing source URL", () => {
		const ctx = createContext({
			type: "clipping",
			distill_status: "raw",
		});

		const result = clippingClassificationStrategy.canEnrich(ctx);
		expect(result.eligible).toBe(false);
		expect(result.reason).toContain("Missing source URL");
	});
});

// =============================================================================
// Strategy enrich Tests
// =============================================================================

describe("clippingClassificationStrategy.enrich", () => {
	const createContext = (url: string, body = ""): EnrichmentContext => ({
		file: {
			path: "/vault/00 Inbox/test.md",
			extension: ".md",
			filename: "test.md",
		},
		frontmatter: {
			type: "clipping",
			distill_status: "raw",
			source: url,
		},
		body,
		vaultPath: "/vault",
	});

	const options: EnrichmentOptions = {
		cid: "test-cid",
		sessionCid: "test-session",
	};

	test("classifies GitHub URL correctly", async () => {
		const ctx = createContext("https://github.com/user/repo");
		const result = await clippingClassificationStrategy.enrich(ctx, options);

		expect(result.type).toBe("clipping-classification");
		if (result.type === "clipping-classification") {
			expect(result.data.clippingType).toBe("github");
			expect(result.data.classifiedAt).toBeDefined();
			expect(result.data.videoId).toBeUndefined();
		}
	});

	test("classifies YouTube URL and extracts video ID", async () => {
		const ctx = createContext("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
		const result = await clippingClassificationStrategy.enrich(ctx, options);

		expect(result.type).toBe("clipping-classification");
		if (result.type === "clipping-classification") {
			expect(result.data.clippingType).toBe("youtube");
			expect(result.data.videoId).toBe("dQw4w9WgXcQ");
			expect(result.data.classifiedAt).toBeDefined();
		}
	});

	test("classifies recipe from content markers", async () => {
		const ctx = createContext(
			"https://example.com/recipe",
			"Ingredients: 2 cups flour. Prep time: 15 minutes.",
		);
		const result = await clippingClassificationStrategy.enrich(ctx, options);

		expect(result.type).toBe("clipping-classification");
		if (result.type === "clipping-classification") {
			expect(result.data.clippingType).toBe("recipe");
		}
	});

	test("defaults to generic for unknown URL", async () => {
		const ctx = createContext("https://example.com/article");
		const result = await clippingClassificationStrategy.enrich(ctx, options);

		expect(result.type).toBe("clipping-classification");
		if (result.type === "clipping-classification") {
			expect(result.data.clippingType).toBe("generic");
		}
	});
});

// =============================================================================
// applyClippingClassification Tests
// =============================================================================

describe("applyClippingClassification", () => {
	test("sets clipping_type and distill_status:classified", () => {
		const frontmatter = {
			type: "clipping",
			distill_status: "raw",
			source: "https://example.com",
		};

		const enrichment = {
			clippingType: "article" as ClippingType,
			classifiedAt: "2025-01-13T10:00:00Z",
		};

		const updated = applyClippingClassification(frontmatter, enrichment);

		expect(updated.clipping_type).toBe("article");
		expect(updated.distill_status).toBe("classified");
		expect(updated.classified_at).toBe("2025-01-13T10:00:00Z");
		expect(updated.type).toBe("clipping");
		expect(updated.source).toBe("https://example.com");
	});

	test("sets video_id and transcript_status for YouTube", () => {
		const frontmatter = {
			type: "clipping",
			distill_status: "raw",
			source: "https://youtube.com/watch?v=abc12345678",
		};

		const enrichment = {
			clippingType: "youtube" as ClippingType,
			classifiedAt: "2025-01-13T10:00:00Z",
			videoId: "abc12345678",
		};

		const updated = applyClippingClassification(frontmatter, enrichment);

		expect(updated.clipping_type).toBe("youtube");
		expect(updated.distill_status).toBe("classified");
		expect(updated.video_id).toBe("abc12345678");
		expect(updated.transcript_status).toBe("pending");
	});

	test("does not set video_id for non-YouTube types", () => {
		const frontmatter = {
			type: "clipping",
			distill_status: "raw",
			source: "https://github.com/user/repo",
		};

		const enrichment = {
			clippingType: "github" as ClippingType,
			classifiedAt: "2025-01-13T10:00:00Z",
		};

		const updated = applyClippingClassification(frontmatter, enrichment);

		expect(updated.clipping_type).toBe("github");
		expect(updated.video_id).toBeUndefined();
		expect(updated.transcript_status).toBeUndefined();
	});
});
