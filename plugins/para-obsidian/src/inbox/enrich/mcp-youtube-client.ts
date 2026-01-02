/**
 * YouTube Transcript Client
 *
 * Provides a simple interface to fetch YouTube transcripts.
 *
 * This module re-exports the native TypeScript implementation from @sidequest/core,
 * which replaces the previous MCP-based Python solution.
 *
 * @module inbox/enrich/mcp-youtube-client
 */

import {
	fetchYouTubeTranscript,
	type TranscriptFormatOptions,
	type TranscriptSegment,
	type YouTubeTranscriptResult,
} from "@sidequest/core/youtube-transcript";
import { enrichLogger } from "../../shared/logger";

// Re-export types for backward compatibility
export type {
	TranscriptFormatOptions,
	TranscriptSegment,
	YouTubeTranscriptResult,
};

/**
 * Fetches a YouTube transcript.
 *
 * Uses the native TypeScript implementation from @sidequest/core
 * (replaces the previous MCP-based Python solution).
 *
 * @param videoId - YouTube video ID (11 characters)
 * @param lang - Preferred language for transcript (default: "en")
 * @param formatOptions - Formatting options for the output
 * @returns Promise resolving to transcript result
 * @throws YouTubeTranscriptError if transcript unavailable
 *
 * @example
 * ```typescript
 * const result = await fetchTranscriptViaMcp("AmdLVWMdjOk");
 * console.log(result.transcript);
 * ```
 */
export async function fetchTranscriptViaMcp(
	videoId: string,
	lang = "en",
	formatOptions?: TranscriptFormatOptions,
): Promise<YouTubeTranscriptResult> {
	const log = enrichLogger;

	if (log) {
		log.debug`YouTube transcript fetch starting videoId=${videoId}`;
	}

	const result = await fetchYouTubeTranscript(videoId, {
		lang,
		...formatOptions,
	});

	if (log) {
		log.info`YouTube transcript fetched videoId=${videoId} titleLength=${result.title.length} transcriptLength=${result.transcript.length}`;
	}

	return result;
}
