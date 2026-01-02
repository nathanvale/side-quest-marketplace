/**
 * YouTube Transcript Service
 *
 * Native TypeScript implementation for fetching YouTube transcripts.
 * Replaces the MCP-based Python solution with a pure npm package approach.
 *
 * Features:
 * - Fetches transcripts via youtube-transcript npm package
 * - Formats output with 5-minute timestamp headers
 * - Fetches video title via YouTube oEmbed API
 * - Retries with exponential backoff
 * - Cleans HTML entities from transcript text
 *
 * @module youtube-transcript
 *
 * @example
 * ```typescript
 * import { fetchYouTubeTranscript, extractVideoId } from "@sidequest/core/youtube-transcript";
 *
 * // Fetch transcript by video ID
 * const result = await fetchYouTubeTranscript("dQw4w9WgXcQ");
 * console.log(result.title);      // "Rick Astley - Never Gonna Give You Up"
 * console.log(result.transcript); // "### 0:00 - 5:02\n\nWe're no strangers..."
 *
 * // Extract video ID from URL
 * const videoId = extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
 * ```
 */

// Public API
export { extractVideoId, fetchYouTubeTranscript } from "./client";
export type { YouTubeTranscriptErrorCode } from "./errors";
export { YouTubeTranscriptError } from "./errors";
export {
	chunkSegments,
	formatTimestamp,
	formatTranscriptAsPlainText,
	formatTranscriptWithTimestamps,
} from "./formatter";
export type {
	TranscriptFetchOptions,
	TranscriptFormatOptions,
	TranscriptSegment,
	YouTubeTranscriptResult,
} from "./types";
export { DEFAULT_FORMAT_OPTIONS } from "./types";
