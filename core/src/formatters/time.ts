/**
 * Time formatting utilities.
 *
 * Provides consistent time and duration formatting across the codebase.
 *
 * @module formatters/time
 * @example
 * ```ts
 * import {
 *   formatTime12Hour,
 *   formatFilenameTime,
 *   formatDuration,
 *   formatDateWithSpaces,
 * } from "@sidequest/core/formatters/time";
 *
 * // 12-hour time format
 * formatTime12Hour(new Date("2024-12-10T14:30:00")); // "2:30 pm"
 * formatTime12Hour(new Date("2024-12-10T00:00:00")); // "12:00 am"
 * formatTime12Hour(new Date("2024-12-10T12:00:00")); // "12:00 pm"
 *
 * // Filename-safe time format
 * formatFilenameTime(new Date("2024-12-10T14:30:00")); // "2-30pm"
 *
 * // Duration formatting
 * formatDuration(65);   // "1:05"
 * formatDuration(3665); // "1:01:05"
 *
 * // Date with spaces
 * formatDateWithSpaces("2024-12-10"); // "2024 12 10"
 * ```
 */

/**
 * Format Date as 12-hour time with lowercase am/pm.
 *
 * Converts a Date object to human-readable 12-hour format with no leading
 * zero for hours and lowercase am/pm indicators.
 *
 * @param date - Date object to format
 * @returns Formatted time string (e.g., "2:30 pm", "12:00 am")
 *
 * @example
 * ```ts
 * formatTime12Hour(new Date("2024-12-10T09:30:00")); // "9:30 am"
 * formatTime12Hour(new Date("2024-12-10T14:45:00")); // "2:45 pm"
 * formatTime12Hour(new Date("2024-12-10T00:00:00")); // "12:00 am" (midnight)
 * formatTime12Hour(new Date("2024-12-10T12:00:00")); // "12:00 pm" (noon)
 * ```
 */
export function formatTime12Hour(date: Date): string {
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
 * Format time for use in filenames (no colons or spaces).
 *
 * Converts a Date object to a filename-safe format suitable for file systems
 * that don't allow colons or prefer no spaces.
 *
 * @param date - Date object to format
 * @returns Filename-safe time string (e.g., "2-30pm", "12-00am")
 *
 * @example
 * ```ts
 * formatFilenameTime(new Date("2024-12-10T14:30:00")); // "2-30pm"
 * formatFilenameTime(new Date("2024-12-10T09:05:00")); // "9-05am"
 * formatFilenameTime(new Date("2024-12-10T00:00:00")); // "12-00am"
 * formatFilenameTime(new Date("2024-12-10T12:00:00")); // "12-00pm"
 * ```
 */
export function formatFilenameTime(date: Date): string {
	const hours24 = date.getHours();
	let hours12 = hours24 % 12;
	if (hours12 === 0) {
		hours12 = 12;
	}
	const minutes = date.getMinutes().toString().padStart(2, "0");
	const period = hours24 < 12 ? "am" : "pm";
	return `${hours12}-${minutes}${period}`;
}

/**
 * Format seconds as MM:SS or HH:MM:SS duration.
 *
 * Converts a duration in seconds to a human-readable timestamp format.
 * Uses MM:SS for durations under an hour, HH:MM:SS for longer durations.
 * Negative values are treated as zero.
 *
 * @param seconds - Duration in seconds (negative treated as 0)
 * @returns Formatted duration string
 *
 * @example
 * ```ts
 * formatDuration(0);     // "0:00"
 * formatDuration(45);    // "0:45"
 * formatDuration(65);    // "1:05"
 * formatDuration(3665);  // "1:01:05"
 * formatDuration(-10);   // "0:00" (negatives treated as 0)
 * ```
 */
export function formatDuration(seconds: number): string {
	// Treat negative as zero
	if (seconds < 0) {
		seconds = 0;
	}

	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor(seconds % 60);

	if (h > 0) {
		return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
	}
	return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Format date string with spaces instead of hyphens.
 *
 * Converts ISO date format (YYYY-MM-DD) to space-separated format (YYYY MM DD).
 * Useful for note titles and human-readable contexts.
 *
 * @param date - Date in YYYY-MM-DD format
 * @returns Date in YYYY MM DD format
 *
 * @example
 * ```ts
 * formatDateWithSpaces("2024-12-10"); // "2024 12 10"
 * formatDateWithSpaces("2025-01-01"); // "2025 01 01"
 * ```
 */
export function formatDateWithSpaces(date: string): string {
	return date.replace(/-/g, " ");
}
