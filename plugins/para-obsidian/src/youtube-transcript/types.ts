/**
 * YouTube Transcript Types
 *
 * Type definitions for the YouTube transcript fetching service.
 *
 * @module youtube-transcript/types
 */

/**
 * A single transcript segment with timing information.
 */
export interface TranscriptSegment {
	/** Start time in seconds */
	start: number;
	/** Duration in seconds */
	duration: number;
	/** Text content (HTML entities already unescaped) */
	text: string;
}

/**
 * Result from fetching a YouTube transcript.
 */
export interface YouTubeTranscriptResult {
	/** Video title from YouTube */
	title: string;
	/** Formatted markdown transcript with timestamp headers */
	transcript: string;
}

/**
 * Options for transcript formatting.
 */
export interface TranscriptFormatOptions {
	/** Chunk duration in seconds (default: 300 = 5 minutes) */
	chunkDurationSeconds?: number;
}

/**
 * Options for fetching a transcript.
 */
export interface TranscriptFetchOptions extends TranscriptFormatOptions {
	/** Preferred language for transcript (default: "en") */
	lang?: string;
}

/**
 * Default formatting options.
 */
export const DEFAULT_FORMAT_OPTIONS: Required<TranscriptFormatOptions> = {
	chunkDurationSeconds: 300, // 5 minutes
};
