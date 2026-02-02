/**
 * YouTube Transcript Client
 *
 * Fetches YouTube transcripts using the youtube-captions-api npm package.
 * Provides a native TypeScript alternative to the MCP-based Python solution.
 *
 * @module youtube-transcript/client
 */

import { unescapeHtml } from "@side-quest/core/html";
import { getErrorMessage, retry, safeJsonParse } from "@side-quest/core/utils";
import {
	NoTranscriptFound,
	TranscriptsDisabled,
	YouTubeTranscriptApi,
} from "youtube-captions-api";
import { YouTubeTranscriptError } from "./errors";
import {
	formatTranscriptAsPlainText,
	formatTranscriptWithTimestamps,
} from "./formatter";
import type {
	TranscriptFetchOptions,
	TranscriptSegment,
	YouTubeTranscriptResult,
} from "./types";
import { DEFAULT_FORMAT_OPTIONS } from "./types";

/**
 * Default timeout for fetch operations in milliseconds.
 */
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Fetch video title via YouTube oEmbed API (no auth required).
 *
 * @param videoId - YouTube video ID
 * @returns Video title or empty string if not available
 */
async function fetchVideoTitle(videoId: string): Promise<string> {
	const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;

	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

		const response = await fetch(url, { signal: controller.signal });
		clearTimeout(timeoutId);

		if (!response.ok) {
			return "";
		}

		const text = await response.text();
		const data = safeJsonParse<{ title?: string }>(text, {});
		return data.title ?? "";
	} catch {
		// Title fetch is best-effort, don't fail the whole operation
		return "";
	}
}

/**
 * Fetch a YouTube video transcript.
 *
 * Fetches the transcript using the youtube-transcript npm package,
 * formats it with timestamp headers, and returns the result.
 *
 * @param videoId - YouTube video ID (e.g., "dQw4w9WgXcQ")
 * @param options - Fetch and formatting options
 * @returns Promise resolving to transcript result with title and formatted text
 * @throws YouTubeTranscriptError on failure
 *
 * @example
 * ```typescript
 * import { fetchYouTubeTranscript } from "./youtube-transcript";
 *
 * const result = await fetchYouTubeTranscript("dQw4w9WgXcQ");
 * console.log(result.title);      // "Rick Astley - Never Gonna Give You Up"
 * console.log(result.transcript); // "### 0:00 - 5:02\n\nWe're no strangers to love..."
 * ```
 */
export async function fetchYouTubeTranscript(
	videoId: string,
	options?: TranscriptFetchOptions,
): Promise<YouTubeTranscriptResult> {
	const lang = options?.lang ?? "en";
	const chunkDurationSeconds =
		options?.chunkDurationSeconds ??
		DEFAULT_FORMAT_OPTIONS.chunkDurationSeconds;

	// Create transcript API client
	const transcriptApi = new YouTubeTranscriptApi();

	// Fetch title and transcript in parallel
	const [title, transcriptResult] = await Promise.all([
		// Title fetch with retry (best-effort)
		retry(() => fetchVideoTitle(videoId), {
			maxAttempts: 2,
			initialDelay: 500,
		}).catch(() => ""),

		// Transcript fetch with retry
		retry(
			async () => {
				try {
					return await transcriptApi.fetch(videoId, { languages: [lang] });
				} catch (error) {
					// Map library errors to our error types
					if (error instanceof TranscriptsDisabled) {
						throw YouTubeTranscriptError.transcriptDisabled(videoId);
					}
					if (error instanceof NoTranscriptFound) {
						throw YouTubeTranscriptError.languageNotAvailable(videoId, lang);
					}

					const message = getErrorMessage(error);

					if (
						message.includes("unavailable") ||
						message.includes("not found")
					) {
						throw YouTubeTranscriptError.videoNotFound(videoId);
					}

					throw YouTubeTranscriptError.fetchFailed(
						videoId,
						error instanceof Error ? error : new Error(message),
					);
				}
			},
			{
				maxAttempts: 3,
				initialDelay: 1000,
				maxDelay: 5000,
				shouldRetry: (error) => {
					// Don't retry permanent failures
					if (error instanceof YouTubeTranscriptError) {
						return error.code === "FETCH_FAILED";
					}
					return true;
				},
			},
		),
	]);

	// Extract snippets from the result
	const rawSegments = transcriptResult?.snippets;

	if (!rawSegments || rawSegments.length === 0) {
		throw YouTubeTranscriptError.fetchFailed(
			videoId,
			new Error("No transcript segments returned"),
		);
	}

	// Map library response to our segment format
	// youtube-captions-api uses `start` for start time in seconds
	const segments: TranscriptSegment[] = rawSegments.map(
		(segment: { text: string; start: number; duration: number }) => ({
			start: segment.start,
			duration: segment.duration,
			// Unescape HTML entities in transcript text
			text: unescapeHtml(segment.text),
		}),
	);

	// Format with timestamp headers if we have timing data
	const hasTimingData = segments.some((s) => s.start > 0);
	const transcript = hasTimingData
		? formatTranscriptWithTimestamps(segments, chunkDurationSeconds)
		: formatTranscriptAsPlainText(segments);

	return {
		title,
		transcript,
	};
}

/**
 * Extract video ID from a YouTube URL.
 *
 * @param url - YouTube URL (various formats supported)
 * @returns Video ID or null if not found
 *
 * @example
 * ```typescript
 * extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"); // "dQw4w9WgXcQ"
 * extractVideoId("https://youtu.be/dQw4w9WgXcQ"); // "dQw4w9WgXcQ"
 * extractVideoId("dQw4w9WgXcQ"); // "dQw4w9WgXcQ"
 * ```
 */
export function extractVideoId(url: string): string | null {
	// Already a video ID (11 characters)
	if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
		return url;
	}

	// Standard YouTube URL
	const standardMatch = url.match(
		/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
	);
	if (standardMatch?.[1]) {
		return standardMatch[1];
	}

	// YouTube embed URL
	const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
	if (embedMatch?.[1]) {
		return embedMatch[1];
	}

	// YouTube shorts URL
	const shortsMatch = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
	if (shortsMatch?.[1]) {
		return shortsMatch[1];
	}

	return null;
}
