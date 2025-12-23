/**
 * Tests for YouTube Enrichment Strategy
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { createTestContext } from "../../../testing/utils";
import type { EnrichmentContext } from "../types";

// Test constants for video IDs
const VALID_VIDEO_ID = "AmdLVWMdjOk";
const UNAVAILABLE_VIDEO_ID = "unavailabl1";
const NOT_FOUND_VIDEO_ID = "notfound_12";
const NETWORK_ERROR_VIDEO_ID = "networkerr_";

// Create mock function with implementation
const mockFetchTranscriptViaMcp = mock(async (videoId: string) => {
	if (videoId === VALID_VIDEO_ID) {
		return {
			title: "Test Video",
			transcript:
				"This is the first part of the transcript. This is the second part. And here is the final part.",
		};
	}
	if (videoId === UNAVAILABLE_VIDEO_ID) {
		throw new Error("Transcript unavailable for this video");
	}
	if (videoId === NOT_FOUND_VIDEO_ID) {
		throw new Error("Video unavailable or not found");
	}
	if (videoId === NETWORK_ERROR_VIDEO_ID) {
		throw new Error("ENOTFOUND youtube.com");
	}
	throw new Error(`Unexpected video ID: ${videoId}`);
});

// Set up module mock BEFORE importing the module under test
mock.module("../mcp-youtube-client", () => ({
	fetchTranscriptViaMcp: mockFetchTranscriptViaMcp,
}));

// NOW import the module under test (after mock is set up)
// Dynamic import ensures mock is applied before module loads
const { applyYouTubeEnrichment, youtubeEnrichmentStrategy } = await import(
	"./youtube-strategy"
);

// Factory function to create test contexts
function createYouTubeContext(
	overrides: Partial<EnrichmentContext["frontmatter"]> = {},
): EnrichmentContext {
	return {
		file: {
			path: "/vault/inbox/test.md",
			filename: "test.md",
			extension: ".md",
			size: 100,
		},
		frontmatter: {
			type: "youtube",
			video_id: VALID_VIDEO_ID,
			transcript_status: "pending",
			...overrides,
		},
		body: "",
		vaultPath: "/vault",
	};
}

describe("YouTube Enrichment Strategy", () => {
	beforeEach(() => {
		// Clear call history but keep the implementation
		mockFetchTranscriptViaMcp.mockClear();
	});

	afterEach(() => {
		// Restore module mocks
		mock.restore();
	});

	describe("canEnrich", () => {
		test("returns eligible for valid YouTube video with pending transcript", () => {
			const ctx = createYouTubeContext();
			const result = youtubeEnrichmentStrategy.canEnrich(ctx);
			expect(result.eligible).toBe(true);
		});

		test("returns not eligible when type is not youtube", () => {
			const ctx = createYouTubeContext({ type: "bookmark" });
			const result = youtubeEnrichmentStrategy.canEnrich(ctx);
			expect(result.eligible).toBe(false);
			expect(result.reason).toContain("Not a YouTube video");
		});

		test("returns not eligible when transcript_status is already processed", () => {
			const ctx = createYouTubeContext({ transcript_status: "processed" });
			const result = youtubeEnrichmentStrategy.canEnrich(ctx);
			expect(result.eligible).toBe(false);
			expect(result.reason).toContain("Transcript not pending");
		});

		test("returns not eligible when video_id is missing", () => {
			const ctx = createYouTubeContext({ video_id: undefined });
			const result = youtubeEnrichmentStrategy.canEnrich(ctx);
			expect(result.eligible).toBe(false);
			expect(result.reason).toContain("Invalid or missing video_id");
		});

		test("returns not eligible when video_id is not 11 chars", () => {
			const ctx = createYouTubeContext({ video_id: "short" });
			const result = youtubeEnrichmentStrategy.canEnrich(ctx);
			expect(result.eligible).toBe(false);
			expect(result.reason).toContain("Invalid or missing video_id");
		});
	});

	describe("enrich", () => {
		test("successfully fetches and combines transcript", async () => {
			const ctx = createYouTubeContext();
			// Use shared context factory for consistent test data
			const testContext = createTestContext("/vault");
			const result = await youtubeEnrichmentStrategy.enrich(ctx, {
				cid: testContext.cid,
				sessionCid: testContext.sessionCid,
			});

			expect(result.type).toBe("youtube");
			if (result.type === "youtube") {
				expect(result.data.transcript).toBe(
					"This is the first part of the transcript. This is the second part. And here is the final part.",
				);
				expect(result.data.transcriptLength).toBeGreaterThan(0);
				expect(result.data.enrichedAt).toBeDefined();
			}
			expect(mockFetchTranscriptViaMcp).toHaveBeenCalledWith(VALID_VIDEO_ID);
		});

		test("throws YouTubeEnrichmentError for unavailable transcript", async () => {
			const ctx = createYouTubeContext({ video_id: UNAVAILABLE_VIDEO_ID });
			const testContext = createTestContext("/vault");

			await expect(
				youtubeEnrichmentStrategy.enrich(ctx, {
					cid: testContext.cid,
					sessionCid: testContext.sessionCid,
				}),
			).rejects.toThrow(
				expect.objectContaining({
					name: "YouTubeEnrichmentError",
					code: "YOUTUBE_TRANSCRIPT_UNAVAILABLE",
					videoId: UNAVAILABLE_VIDEO_ID,
					retryable: false,
				}),
			);
		});

		test("throws YouTubeEnrichmentError for video not found", async () => {
			const ctx = createYouTubeContext({ video_id: NOT_FOUND_VIDEO_ID });
			const testContext = createTestContext("/vault");

			await expect(
				youtubeEnrichmentStrategy.enrich(ctx, {
					cid: testContext.cid,
					sessionCid: testContext.sessionCid,
				}),
			).rejects.toThrow(
				expect.objectContaining({
					name: "YouTubeEnrichmentError",
					code: "YOUTUBE_VIDEO_NOT_FOUND",
					retryable: false,
				}),
			);
		});

		test("throws retryable error for network failures", async () => {
			const ctx = createYouTubeContext({ video_id: NETWORK_ERROR_VIDEO_ID });
			const testContext = createTestContext("/vault");

			await expect(
				youtubeEnrichmentStrategy.enrich(ctx, {
					cid: testContext.cid,
					sessionCid: testContext.sessionCid,
					maxRetries: 1, // Reduce retries to speed up test
				}),
			).rejects.toThrow(
				expect.objectContaining({
					name: "YouTubeEnrichmentError",
					code: "YOUTUBE_NETWORK_ERROR",
					retryable: true,
				}),
			);
		});
	});

	describe("applyYouTubeEnrichment", () => {
		test("correctly updates frontmatter with enrichment data", () => {
			const frontmatter = {
				type: "youtube",
				video_id: "AmdLVWMdjOk",
				transcript_status: "pending",
				title: "Test Video",
			};

			const enrichment = {
				transcript: "Test transcript content",
				transcriptLength: 23,
				enrichedAt: "2025-12-21T10:00:00.000Z",
			};

			const result = applyYouTubeEnrichment(frontmatter, enrichment);

			expect(result).toEqual({
				type: "youtube",
				video_id: "AmdLVWMdjOk",
				transcript_status: "processed",
				transcript_length: 23,
				transcript_enriched_at: "2025-12-21T10:00:00.000Z",
				title: "Test Video",
			});
		});

		test("preserves other frontmatter fields", () => {
			const frontmatter = {
				type: "youtube",
				video_id: "AmdLVWMdjOk",
				transcript_status: "pending",
				channel: "Test Channel",
				duration: "PT5072S",
				published: "2025-12-16",
			};

			const enrichment = {
				transcript: "Test transcript",
				transcriptLength: 15,
				enrichedAt: "2025-12-21T10:00:00.000Z",
			};

			const result = applyYouTubeEnrichment(frontmatter, enrichment);

			expect(result.channel).toBe("Test Channel");
			expect(result.duration).toBe("PT5072S");
			expect(result.published).toBe("2025-12-16");
			expect(result.transcript_status).toBe("processed");
		});
	});
});
