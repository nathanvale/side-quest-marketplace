/**
 * Voice memo log entry formatting module.
 *
 * Formats timestamps and transcriptions for insertion into daily notes.
 * Uses Melbourne timezone and 12-hour time format with lowercase am/pm.
 *
 * @module voice/formatter
 */

import { formatTime12Hour } from "@sidequest/core/formatters";

/**
 * Format timestamp in Melbourne 12-hour time format.
 *
 * Format: "h:mm am/pm" (no leading zero for hours, lowercase am/pm)
 *
 * Examples:
 * - 9:30 am
 * - 2:45 pm
 * - 12:00 am (midnight)
 * - 12:00 pm (noon)
 *
 * @param date - Date object to format
 * @returns Formatted time string
 * @deprecated Use formatTime12Hour from @sidequest/core/formatters instead
 */
export function formatTimestamp(date: Date): string {
	return formatTime12Hour(date);
}

/**
 * Remove consecutive duplicate lines from text.
 *
 * Handles whisper.cpp hallucination where the model gets stuck
 * repeating the same phrase when audio becomes quiet or noisy.
 *
 * @param text - Text that may contain repeated lines
 * @returns Text with consecutive duplicates removed
 */
export function dedupeConsecutiveLines(text: string): string {
	const lines = text.split("\n");
	const deduped: string[] = [];

	for (const line of lines) {
		const trimmed = line.trim();
		// Skip empty lines and consecutive duplicates
		if (trimmed && deduped[deduped.length - 1] !== trimmed) {
			deduped.push(trimmed);
		}
	}

	return deduped.join("\n");
}

/**
 * Format voice memo transcription as log entry.
 *
 * Format: "- {time} - 🎤 {transcription}"
 *
 * Example:
 * "- 2:45 pm - 🎤 Transcribed voice memo content here..."
 *
 * Processing:
 * 1. Removes consecutive duplicate lines (whisper hallucination fix)
 * 2. Collapses all newlines to single spaces (single bullet point)
 *
 * @param timestamp - Voice memo timestamp
 * @param transcription - Transcribed text content
 * @returns Formatted log entry ready for insertion
 */
export function formatLogEntry(timestamp: Date, transcription: string): string {
	const time = formatTimestamp(timestamp);

	// Step 1: Remove consecutive duplicate lines (whisper hallucination)
	const deduped = dedupeConsecutiveLines(transcription);

	// Step 2: Collapse newlines to spaces for single bullet point
	const collapsed = deduped.replace(/\n+/g, " ").trim();

	return `- ${time} - 🎤 ${collapsed}`;
}

// Re-export formatFilenameTime from core for backward compatibility
export { formatFilenameTime } from "@sidequest/core/formatters";

/**
 * Format wikilink log entry for daily note.
 *
 * Format: "- {time} - 🎤 [[{noteTitle}]]"
 *
 * Used when creating voice memo notes instead of inline transcriptions.
 * The wikilink points to the separate voice memo note in the inbox.
 *
 * @param timestamp - Voice memo timestamp
 * @param noteTitle - Title of the voice memo note (for wikilink)
 * @returns Formatted log entry with wikilink
 */
export function formatWikilinkLogEntry(
	timestamp: Date,
	noteTitle: string,
): string {
	const time = formatTimestamp(timestamp);
	return `- ${time} - 🎤 [[${noteTitle}]]`;
}
