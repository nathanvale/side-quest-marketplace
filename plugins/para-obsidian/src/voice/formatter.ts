/**
 * Obsidian-specific voice memo formatting utilities.
 *
 * Provides formatting functions for daily note log entries,
 * combining timestamp formatting from @sidequest/voice-memo
 * with Obsidian-specific patterns like wikilinks.
 *
 * @module voice/formatter
 */

import { dedupeConsecutiveLines, formatTimestamp } from "@sidequest/voice-memo";

/**
 * Format a voice memo log entry for daily notes.
 * Format: "- H:MM am/pm - 🎤 transcription"
 *
 * @param date - Date/time of the voice memo
 * @param transcription - Transcription text to format
 * @returns Formatted log entry string
 *
 * @example
 * ```ts
 * const entry = formatLogEntry(new Date(), "Meeting notes about project");
 * // Returns: "- 2:45 pm - 🎤 Meeting notes about project"
 * ```
 */
export function formatLogEntry(date: Date, transcription: string): string {
	const timestamp = formatTimestamp(date);
	const dedupedText = dedupeConsecutiveLines(transcription);
	const singleLine = dedupedText.replace(/\n+/g, " ").trim();
	return `- ${timestamp} - 🎤 ${singleLine}`;
}

/**
 * Format a wikilink log entry for daily notes.
 * Format: "- H:MM am/pm - 🎤 [[Note Title]]"
 *
 * Used when a full note is created from the voice memo
 * and should be linked from the daily note.
 *
 * @param date - Date/time of the voice memo
 * @param noteTitle - Title of the created note (without .md extension)
 * @returns Formatted wikilink entry string
 *
 * @example
 * ```ts
 * const entry = formatWikilinkLogEntry(new Date(), "🎤 2025-01-22 2-45pm");
 * // Returns: "- 2:45 pm - 🎤 [[🎤 2025-01-22 2-45pm]]"
 * ```
 */
export function formatWikilinkLogEntry(date: Date, noteTitle: string): string {
	const timestamp = formatTimestamp(date);
	return `- ${timestamp} - 🎤 [[${noteTitle}]]`;
}
