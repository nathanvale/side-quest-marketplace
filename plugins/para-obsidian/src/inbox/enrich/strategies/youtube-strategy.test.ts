/**
 * Tests for YouTube Enrichment Strategy
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { EnrichmentContext } from "../types";
import {
	applyYouTubeEnrichment,
	YouTubeEnrichmentError,
	youtubeEnrichmentStrategy,
} from "./youtube-strategy";

// Mock the youtube-transcript library
const mockFetchTranscript = mock(async (videoId: string) => {
	if (videoId === "AmdLVWMdjOk") {
		return [
			{ text: "This is the first part of the transcript." },
			{ text: "This is the second part." },
			{ text: "And here is the final part." },
		];
	}
	if (videoId === "unavailabl1") {
		throw new Error("Transcript unavailable for this video");
	}
	if (videoId === "notfound_12") {
		throw new Error("Video unavailable or not found");
	}
	if (videoId === "networkerr_") {
		throw new Error("ENOTFOUND youtube.com");
	}
	throw new Error(`Unexpected video ID: ${videoId}`);
});

// Mock the YoutubeTranscript module
mock.module("youtube-transcript", () => ({
	YoutubeTranscript: {
		fetchTranscript: mockFetchTranscript,
	},
}));

describe("YouTube Enrichment Strategy", () => {
	beforeEach(() => {
		mockFetchTranscript.mockClear();
	});

	afterEach(() => {
		mockFetchTranscript.mockClear();
	});

	describe("canEnrich", () => {
		test("returns eligible for valid YouTube video with pending transcript", () => {
			const ctx: EnrichmentContext = {
				file: {
					path: "/vault/inbox/test.md",
					filename: "test.md",
					extension: ".md",
					size: 100,
				},
				frontmatter: {
					type: "youtube",
					video_id: "AmdLVWMdjOk",
					transcript_status: "pending",
				},
				body: "",
				vaultPath: "/vault",
			};

			const result = youtubeEnrichmentStrategy.canEnrich(ctx);

			expect(result.eligible).toBe(true);
		});

		test("returns not eligible when type is not youtube", () => {
			const ctx: EnrichmentContext = {
				file: {
					path: "/vault/inbox/test.md",
					filename: "test.md",
					extension: ".md",
					size: 100,
				},
				frontmatter: {
					type: "bookmark",
					video_id: "AmdLVWMdjOk",
					transcript_status: "pending",
				},
				body: "",
				vaultPath: "/vault",
			};

			const result = youtubeEnrichmentStrategy.canEnrich(ctx);

			expect(result.eligible).toBe(false);
			expect(result.reason).toContain("Not a YouTube video");
		});

		test("returns not eligible when transcript_status is already processed", () => {
			const ctx: EnrichmentContext = {
				file: {
					path: "/vault/inbox/test.md",
					filename: "test.md",
					extension: ".md",
					size: 100,
				},
				frontmatter: {
					type: "youtube",
					video_id: "AmdLVWMdjOk",
					transcript_status: "processed",
				},
				body: "",
				vaultPath: "/vault",
			};

			const result = youtubeEnrichmentStrategy.canEnrich(ctx);

			expect(result.eligible).toBe(false);
			expect(result.reason).toContain("Transcript not pending");
		});

		test("returns not eligible when video_id is missing", () => {
			const ctx: EnrichmentContext = {
				file: {
					path: "/vault/inbox/test.md",
					filename: "test.md",
					extension: ".md",
					size: 100,
				},
				frontmatter: {
					type: "youtube",
					transcript_status: "pending",
				},
				body: "",
				vaultPath: "/vault",
			};

			const result = youtubeEnrichmentStrategy.canEnrich(ctx);

			expect(result.eligible).toBe(false);
			expect(result.reason).toContain("Invalid or missing video_id");
		});

		test("returns not eligible when video_id is not 11 chars", () => {
			const ctx: EnrichmentContext = {
				file: {
					path: "/vault/inbox/test.md",
					filename: "test.md",
					extension: ".md",
					size: 100,
				},
				frontmatter: {
					type: "youtube",
					video_id: "short",
					transcript_status: "pending",
				},
				body: "",
				vaultPath: "/vault",
			};

			const result = youtubeEnrichmentStrategy.canEnrich(ctx);

			expect(result.eligible).toBe(false);
			expect(result.reason).toContain("Invalid or missing video_id");
		});
	});

	describe("enrich", () => {
		test("successfully fetches and combines transcript", async () => {
			const ctx: EnrichmentContext = {
				file: {
					path: "/vault/inbox/test.md",
					filename: "test.md",
					extension: ".md",
					size: 100,
				},
				frontmatter: {
					type: "youtube",
					video_id: "AmdLVWMdjOk",
					transcript_status: "pending",
				},
				body: "",
				vaultPath: "/vault",
			};

			const result = await youtubeEnrichmentStrategy.enrich(ctx, {
				cid: "test-cid",
				sessionCid: "test-session-cid",
			});

			expect(result.type).toBe("youtube");
			if (result.type === "youtube") {
				expect(result.data.transcript).toBe(
					"This is the first part of the transcript. This is the second part. And here is the final part.",
				);
				expect(result.data.transcriptLength).toBeGreaterThan(0);
				expect(result.data.enrichedAt).toBeDefined();
			}
			expect(mockFetchTranscript).toHaveBeenCalledWith("AmdLVWMdjOk");
		});

		test("throws YouTubeEnrichmentError for unavailable transcript", async () => {
			const ctx: EnrichmentContext = {
				file: {
					path: "/vault/inbox/test.md",
					filename: "test.md",
					extension: ".md",
					size: 100,
				},
				frontmatter: {
					type: "youtube",
					video_id: "unavailabl1",
					transcript_status: "pending",
				},
				body: "",
				vaultPath: "/vault",
			};

			await expect(
				youtubeEnrichmentStrategy.enrich(ctx, {
					cid: "test-cid",
					sessionCid: "test-session-cid",
				}),
			).rejects.toThrow(YouTubeEnrichmentError);

			try {
				await youtubeEnrichmentStrategy.enrich(ctx, {
					cid: "test-cid",
					sessionCid: "test-session-cid",
				});
			} catch (error) {
				expect(error).toBeInstanceOf(YouTubeEnrichmentError);
				const ytError = error as YouTubeEnrichmentError;
				expect(ytError.code).toBe("YOUTUBE_TRANSCRIPT_UNAVAILABLE");
				expect(ytError.videoId).toBe("unavailabl1");
				expect(ytError.retryable).toBe(false);
			}
		});

		test("throws YouTubeEnrichmentError for video not found", async () => {
			const ctx: EnrichmentContext = {
				file: {
					path: "/vault/inbox/test.md",
					filename: "test.md",
					extension: ".md",
					size: 100,
				},
				frontmatter: {
					type: "youtube",
					video_id: "notfound_12",
					transcript_status: "pending",
				},
				body: "",
				vaultPath: "/vault",
			};

			try {
				await youtubeEnrichmentStrategy.enrich(ctx, {
					cid: "test-cid",
					sessionCid: "test-session-cid",
				});
			} catch (error) {
				expect(error).toBeInstanceOf(YouTubeEnrichmentError);
				const ytError = error as YouTubeEnrichmentError;
				expect(ytError.code).toBe("YOUTUBE_VIDEO_NOT_FOUND");
				expect(ytError.retryable).toBe(false);
			}
		});

		test("throws retryable error for network failures", async () => {
			const ctx: EnrichmentContext = {
				file: {
					path: "/vault/inbox/test.md",
					filename: "test.md",
					extension: ".md",
					size: 100,
				},
				frontmatter: {
					type: "youtube",
					video_id: "networkerr_",
					transcript_status: "pending",
				},
				body: "",
				vaultPath: "/vault",
			};

			try {
				await youtubeEnrichmentStrategy.enrich(ctx, {
					cid: "test-cid",
					sessionCid: "test-session-cid",
					maxRetries: 1, // Reduce retries to speed up test
				});
				// Force failure if no error thrown
				throw new Error("Expected YouTubeEnrichmentError to be thrown");
			} catch (error) {
				expect(error).toBeInstanceOf(YouTubeEnrichmentError);
				const ytError = error as YouTubeEnrichmentError;
				expect(ytError.code).toBe("YOUTUBE_NETWORK_ERROR");
				expect(ytError.retryable).toBe(true);
			}
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
