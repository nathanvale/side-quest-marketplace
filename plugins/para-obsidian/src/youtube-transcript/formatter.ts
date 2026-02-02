/**
 * YouTube Transcript Formatter
 *
 * Functions for formatting transcript segments into readable markdown.
 *
 * @module youtube-transcript/formatter
 */

import { formatDuration } from "@side-quest/core/formatters";
import type { TranscriptSegment } from "./types";
import { DEFAULT_FORMAT_OPTIONS } from "./types";

/**
 * Format seconds as MM:SS or HH:MM:SS timestamp.
 *
 * @param seconds - Time in seconds
 * @returns Formatted timestamp string
 *
 * @example
 * ```typescript
 * formatTimestamp(65);   // "1:05"
 * formatTimestamp(3665); // "1:01:05"
 * ```
 * @deprecated Use formatDuration from @sidequest/core/formatters instead
 */
export function formatTimestamp(seconds: number): string {
	return formatDuration(seconds);
}

/**
 * Group transcript segments into time-based chunks.
 *
 * @param segments - Array of transcript segments
 * @param chunkDurationSeconds - Duration of each chunk in seconds
 * @returns Array of segment arrays, one per chunk
 */
export function chunkSegments(
	segments: TranscriptSegment[],
	chunkDurationSeconds: number,
): TranscriptSegment[][] {
	// Guard against empty input
	if (segments.length === 0) {
		return [];
	}

	const chunks: TranscriptSegment[][] = [];
	let currentChunk: TranscriptSegment[] = [];
	let chunkStartTime = 0;

	for (const segment of segments) {
		// Start a new chunk if we've exceeded the duration
		if (
			segment.start >= chunkStartTime + chunkDurationSeconds &&
			currentChunk.length > 0
		) {
			chunks.push(currentChunk);
			currentChunk = [];
			chunkStartTime =
				Math.floor(segment.start / chunkDurationSeconds) * chunkDurationSeconds;
		}
		currentChunk.push(segment);
	}

	// Don't forget the last chunk
	if (currentChunk.length > 0) {
		chunks.push(currentChunk);
	}

	return chunks;
}

/**
 * Format transcript segments into markdown with timestamp headers.
 *
 * Creates sections for each time chunk with ### headers.
 *
 * @param segments - Array of transcript segments
 * @param chunkDurationSeconds - Duration of each chunk in seconds (default: 300)
 * @returns Formatted markdown string
 *
 * @example
 * ```typescript
 * const markdown = formatTranscriptWithTimestamps(segments);
 * // ### 0:00 - 5:02
 * //
 * // First chunk of text...
 * //
 * // ### 5:00 - 10:04
 * //
 * // Second chunk of text...
 * ```
 */
export function formatTranscriptWithTimestamps(
	segments: TranscriptSegment[],
	chunkDurationSeconds = DEFAULT_FORMAT_OPTIONS.chunkDurationSeconds,
): string {
	const chunks = chunkSegments(segments, chunkDurationSeconds);
	const parts: string[] = [];

	for (const chunk of chunks) {
		if (chunk.length === 0) continue;

		const firstSegment = chunk[0];
		const lastSegment = chunk[chunk.length - 1];
		if (!firstSegment || !lastSegment) continue;

		const startTime = firstSegment.start;
		const endTime = lastSegment.start + lastSegment.duration;
		const startTs = formatTimestamp(startTime);
		const endTs = formatTimestamp(endTime);

		// Combine text from all segments in chunk, cleaning up formatting
		const chunkText = chunk
			.map((s) => s.text.trim())
			.join(" ")
			// Collapse multiple spaces
			.replace(/ +/g, " ")
			// Add paragraph breaks at sentence endings followed by capital letters
			// (heuristic for topic changes)
			.replace(/([.!?])\s+([A-Z])/g, "$1\n\n$2")
			.trim();

		// Simple format with timestamp headers
		parts.push(`### ${startTs} - ${endTs}`);
		parts.push("");
		parts.push(chunkText);
		parts.push("");
	}

	return parts.join("\n").trim();
}

/**
 * Format transcript as plain text (fallback for untimed transcripts).
 *
 * @param segments - Array of transcript segments
 * @returns Plain text transcript
 */
export function formatTranscriptAsPlainText(
	segments: TranscriptSegment[],
): string {
	return segments
		.map((s) => s.text.trim())
		.join(" ")
		.replace(/\r\n/g, "\n")
		.replace(/(?<!\n)\n(?!\n)/g, " ")
		.replace(/ +/g, " ")
		.trim();
}
