/**
 * Voice memo log entry formatting module.
 *
 * Formats timestamps and transcriptions for insertion into daily notes.
 * Uses Melbourne timezone and 12-hour time format with lowercase am/pm.
 *
 * @module voice/formatter
 */

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
 */
export function formatTimestamp(date: Date): string {
	// Get hours in 24-hour format
	const hours24 = date.getHours();

	// Convert to 12-hour format
	let hours12 = hours24 % 12;
	if (hours12 === 0) {
		hours12 = 12; // Midnight and noon are 12, not 0
	}

	// Get minutes with leading zero
	const minutes = date.getMinutes().toString().padStart(2, "0");

	// Determine am/pm (lowercase)
	const period = hours24 < 12 ? "am" : "pm";

	return `${hours12}:${minutes} ${period}`;
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
