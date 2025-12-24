/**
 * YouTube Transcript Enrichment Strategy
 *
 * Strategy for enriching YouTube video files by fetching transcripts.
 *
 * This strategy:
 * 1. Checks if file has type:youtube and transcript_status:pending
 * 2. Validates video_id is present and well-formed (11 chars)
 * 3. Fetches transcript from YouTube using MCP youtube-transcript server
 * 4. Returns enriched metadata with transcript text
 *
 * Features:
 * - Uses MCP server for reliable transcript fetching
 * - Exponential backoff with jitter for transient failures
 * - Retry logic for network errors
 * - Graceful error handling with user-friendly messages
 *
 * @module inbox/enrich/strategies/youtube-strategy
 */

import { observe } from "../../../shared/instrumentation";
import { enrichLogger } from "../../../shared/logger";
import { fetchTranscriptViaMcp } from "../mcp-youtube-client";
import type {
	EnrichmentContext,
	EnrichmentEligibility,
	EnrichmentOptions,
	EnrichmentResult,
	EnrichmentStrategy,
	YouTubeEnrichment,
} from "../types";

const log = enrichLogger;

/**
 * Check if frontmatter represents a YouTube note.
 * Accepts both `type: "youtube"` and `type: "clipping"` with `clipping_type: "youtube"`.
 */
function isYouTubeFrontmatter(frontmatter: Record<string, unknown>): boolean {
	const type = frontmatter.type as string | undefined;
	const clippingType = frontmatter.clipping_type as string | undefined;
	return (
		type === "youtube" || (type === "clipping" && clippingType === "youtube")
	);
}

// Default configuration
const DEFAULT_TIMEOUT = 30000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;

/**
 * Sleep with exponential backoff and jitter.
 * @param attempt - Current attempt number (0-based)
 * @param baseDelay - Base delay in ms
 * @returns Promise that resolves after delay
 */
async function sleepWithBackoff(
	attempt: number,
	baseDelay: number,
): Promise<void> {
	// Exponential backoff: baseDelay * 2^attempt
	const exponentialDelay = baseDelay * 2 ** attempt;
	// Add jitter: +/- 25%
	const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
	const delay = Math.min(exponentialDelay + jitter, MAX_DELAY_MS);

	await new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Error codes specific to YouTube enrichment failures.
 */
export type YouTubeErrorCode =
	| "YOUTUBE_INVALID_VIDEO_ID" // Video ID is malformed or missing
	| "YOUTUBE_TRANSCRIPT_UNAVAILABLE" // Transcript disabled/unavailable
	| "YOUTUBE_NETWORK_ERROR" // Network/connectivity issue
	| "YOUTUBE_REGION_BLOCKED" // Video blocked in region
	| "YOUTUBE_VIDEO_NOT_FOUND"; // Video doesn't exist or is private

/**
 * Error thrown when YouTube transcript enrichment fails.
 */
export class YouTubeEnrichmentError extends Error {
	readonly code: YouTubeErrorCode;
	readonly videoId: string;
	readonly retryable: boolean;

	constructor(
		message: string,
		code: YouTubeErrorCode,
		videoId: string,
		retryable = false,
	) {
		super(message);
		this.name = "YouTubeEnrichmentError";
		this.code = code;
		this.videoId = videoId;
		this.retryable = retryable;
		Object.setPrototypeOf(this, YouTubeEnrichmentError.prototype);
	}
}

/**
 * Validates that a video ID is well-formed.
 *
 * @param videoId - Video ID to validate
 * @returns True if valid 11-character YouTube video ID
 */
function isValidVideoId(videoId: unknown): videoId is string {
	return typeof videoId === "string" && videoId.length === 11;
}

/**
 * Enriches a YouTube video with transcript data.
 *
 * This function:
 * 1. Validates the video ID
 * 2. Fetches transcript from YouTube (with retries)
 * 3. Returns structured enrichment data
 *
 * @param videoId - YouTube video ID to enrich
 * @param originalTitle - Original title from frontmatter (unused, for consistency)
 * @param options - Enrichment options
 * @returns Promise resolving to enrichment data
 * @throws YouTubeEnrichmentError on failure
 *
 * @example
 * ```typescript
 * const enrichment = await enrichYouTubeWithTranscript(
 *   "AmdLVWMdjOk",
 *   "Original Title",
 *   { maxRetries: 3, cid: "abc123", sessionCid: "session-abc" }
 * );
 * console.log(enrichment.transcript);
 * ```
 */
export async function enrichYouTubeWithTranscript(
	videoId: string,
	_originalTitle: string,
	options: EnrichmentOptions,
): Promise<YouTubeEnrichment> {
	const {
		maxRetries = DEFAULT_MAX_RETRIES,
		baseDelayMs = DEFAULT_BASE_DELAY_MS,
		cid,
		sessionCid,
		parentCid,
	} = options;

	return await observe(
		log,
		"enrich:youtube",
		async () => {
			// Validate video ID
			if (!videoId || !isValidVideoId(videoId)) {
				throw new YouTubeEnrichmentError(
					`Invalid video ID: ${videoId}`,
					"YOUTUBE_INVALID_VIDEO_ID",
					videoId || "",
					false,
				);
			}

			if (log) {
				log.info`YouTube enrichment starting videoId=${videoId}`;
			}

			// Fetch transcript using MCP server with retries
			const transcript = await observe(
				log,
				"enrich:youtubeTranscript",
				async () => {
					if (log) {
						log.info`YouTube transcript fetch starting videoId=${videoId}`;
					}

					let lastError: Error | null = null;

					for (let attempt = 0; attempt <= maxRetries; attempt++) {
						try {
							if (log) {
								log.debug`YouTube transcript attempt=${attempt + 1}/${maxRetries + 1} videoId=${videoId}`;
							}

							// Use MCP server instead of npm package
							const result = await fetchTranscriptViaMcp(videoId);
							const transcriptText = result.transcript;

							if (!transcriptText || transcriptText.length === 0) {
								throw new YouTubeEnrichmentError(
									"No transcript content returned",
									"YOUTUBE_TRANSCRIPT_UNAVAILABLE",
									videoId,
									false,
								);
							}

							if (log) {
								log.debug`YouTube transcript success videoId=${videoId} length=${transcriptText.length}`;
							}
							return transcriptText;
						} catch (error) {
							lastError = error as Error;
							const errorMessage =
								error instanceof Error ? error.message : String(error);

							// Re-throw YouTubeEnrichmentError as-is (already categorized)
							if (error instanceof YouTubeEnrichmentError) {
								throw error;
							}

							// Network/connectivity errors (retryable)
							const isNetworkError =
								errorMessage.includes("ENOTFOUND") ||
								errorMessage.includes("ECONNREFUSED") ||
								errorMessage.includes("ETIMEDOUT") ||
								errorMessage.includes("timeout") ||
								errorMessage.includes("spawn") ||
								errorMessage.includes("ENOENT");

							if (isNetworkError && attempt < maxRetries) {
								if (log) {
									log.warn`YouTube transcript network error videoId=${videoId} attempt=${attempt + 1} error=${errorMessage} retrying...`;
								}
								await sleepWithBackoff(attempt, baseDelayMs);
								continue;
							}

							// Video not found or private (not retryable)
							const isNotFound =
								errorMessage.includes("Video unavailable") ||
								errorMessage.includes("not found") ||
								errorMessage.includes("private");

							if (isNotFound) {
								if (log) {
									log.warn`YouTube transcript video not found videoId=${videoId} error=${errorMessage}`;
								}
								throw new YouTubeEnrichmentError(
									`Video not found or private: ${errorMessage}`,
									"YOUTUBE_VIDEO_NOT_FOUND",
									videoId,
									false,
								);
							}

							// Transcript unavailable (not retryable)
							const isTranscriptUnavailable =
								errorMessage.includes("Transcript") ||
								errorMessage.includes("disabled") ||
								errorMessage.includes("unavailable") ||
								errorMessage.includes("No transcript");

							if (isTranscriptUnavailable) {
								if (log) {
									log.warn`YouTube transcript unavailable videoId=${videoId} error=${errorMessage}`;
								}
								throw new YouTubeEnrichmentError(
									`Transcript unavailable for video: ${errorMessage}`,
									"YOUTUBE_TRANSCRIPT_UNAVAILABLE",
									videoId,
									false,
								);
							}

							// Region blocked (not retryable)
							const isRegionBlocked =
								errorMessage.includes("region") ||
								errorMessage.includes("blocked");

							if (isRegionBlocked) {
								if (log) {
									log.warn`YouTube transcript region blocked videoId=${videoId} error=${errorMessage}`;
								}
								throw new YouTubeEnrichmentError(
									`Video blocked in your region: ${errorMessage}`,
									"YOUTUBE_REGION_BLOCKED",
									videoId,
									false,
								);
							}

							// Generic error - retry if attempts remain
							if (log) {
								log.warn`YouTube transcript error videoId=${videoId} attempt=${attempt + 1} error=${errorMessage}`;
							}

							if (attempt >= maxRetries) {
								throw new YouTubeEnrichmentError(
									errorMessage,
									"YOUTUBE_NETWORK_ERROR",
									videoId,
									true,
								);
							}

							await sleepWithBackoff(attempt, baseDelayMs);
						}
					}

					// Should never reach here, but handle edge case
					throw new YouTubeEnrichmentError(
						lastError?.message || "Failed to fetch transcript after retries",
						"YOUTUBE_NETWORK_ERROR",
						videoId,
						true,
					);
				},
				{ parentCid: cid, context: { videoId, sessionCid } },
			);

			if (log) {
				log.info`YouTube enrichment complete videoId=${videoId} transcriptLength=${transcript.length}`;
			}

			return {
				transcript,
				transcriptLength: transcript.length,
				enrichedAt: new Date().toISOString(),
			};
		},
		{ parentCid, context: { videoId, sessionCid } },
	);
}

/**
 * YouTube transcript enrichment strategy.
 *
 * Handles files with type:youtube frontmatter that have pending transcripts.
 * Fetches transcript from YouTube and enriches frontmatter with transcript metadata.
 */
export const youtubeEnrichmentStrategy: EnrichmentStrategy = {
	id: "youtube-transcript",
	name: "YouTube Transcript Enrichment",
	priority: 100, // Higher than bookmark (75)

	canEnrich(ctx: EnrichmentContext): EnrichmentEligibility {
		const { frontmatter, file } = ctx;

		// Must be a YouTube video type (either type:youtube or type:clipping with clipping_type:youtube)
		if (!isYouTubeFrontmatter(frontmatter)) {
			const type = frontmatter.type as string | undefined;
			const clippingType = frontmatter.clipping_type as string | undefined;
			const typeInfo =
				type === "clipping"
					? `clipping/${clippingType ?? "none"}`
					: (type ?? "none");
			return {
				eligible: false,
				reason: `Not a YouTube video (type: ${typeInfo})`,
			};
		}

		// Must have pending transcript status
		if (frontmatter.transcript_status !== "pending") {
			if (log) {
				log.debug`YouTube eligibility: transcript not pending file=${file.filename} status=${frontmatter.transcript_status}`;
			}
			return {
				eligible: false,
				reason: "Transcript not pending (already transcribed or skipped)",
			};
		}

		// Must have valid video_id
		if (!isValidVideoId(frontmatter.video_id)) {
			if (log) {
				log.debug`YouTube eligibility: invalid video_id file=${file.filename} video_id=${frontmatter.video_id}`;
			}
			return {
				eligible: false,
				reason: "Invalid or missing video_id (must be 11 chars)",
			};
		}

		if (log) {
			log.debug`YouTube eligibility: eligible file=${file.filename} video_id=${frontmatter.video_id}`;
		}
		return { eligible: true };
	},

	async enrich(
		ctx: EnrichmentContext,
		options?: EnrichmentOptions,
	): Promise<EnrichmentResult> {
		const { frontmatter, file } = ctx;
		const videoId = frontmatter.video_id as string;
		const originalTitle = (frontmatter.title as string) || file.filename;

		// Generate cid for this enrichment operation
		const cid = options?.cid || "no-cid";
		const sessionCid = options?.sessionCid;
		const parentCid = options?.parentCid;

		if (log) {
			log.info`YouTube enrichment starting sessionCid=${sessionCid} cid=${cid} file=${file.filename} videoId=${videoId}`;
		}

		try {
			const enrichment = await enrichYouTubeWithTranscript(
				videoId,
				originalTitle,
				{
					maxRetries: options?.maxRetries ?? DEFAULT_MAX_RETRIES,
					baseDelayMs: options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS,
					timeout: options?.timeout ?? DEFAULT_TIMEOUT,
					cid,
					sessionCid,
					parentCid,
				},
			);

			if (log) {
				log.info`YouTube enrichment success sessionCid=${sessionCid} cid=${cid} file=${file.filename} transcriptLength=${enrichment.transcriptLength}`;
			}

			return {
				type: "youtube",
				data: enrichment,
			};
		} catch (error) {
			if (log) {
				const errMsg = error instanceof Error ? error.message : "Unknown error";
				log.error`YouTube enrichment failed sessionCid=${sessionCid} cid=${cid} file=${file.filename} videoId=${videoId} error=${errMsg}`;
			}

			// Re-throw YouTubeEnrichmentError as-is
			if (error instanceof YouTubeEnrichmentError) {
				throw error;
			}

			// Wrap unknown errors
			throw new YouTubeEnrichmentError(
				error instanceof Error ? error.message : "Unknown error",
				"YOUTUBE_NETWORK_ERROR",
				videoId,
				true,
			);
		}
	},
};

/**
 * Applies YouTube enrichment data to frontmatter.
 * Updates transcript_status to "processed" and adds metadata.
 *
 * @param frontmatter - Original frontmatter
 * @param enrichment - Enrichment data from strategy
 * @returns Updated frontmatter with enrichment fields
 */
export function applyYouTubeEnrichment(
	frontmatter: Record<string, unknown>,
	enrichment: YouTubeEnrichment,
): Record<string, unknown> {
	return {
		...frontmatter,
		transcript_status: "processed",
		transcript_length: enrichment.transcriptLength,
		transcript_enriched_at: enrichment.enrichedAt,
	};
}
