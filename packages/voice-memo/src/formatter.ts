/**
 * Voice memo formatting utilities.
 *
 * Generic formatting functions for timestamps and filenames.
 * Uses 12-hour time format with lowercase am/pm.
 *
 * @module voice-memo/formatter
 */

import { formatTime12Hour } from "@sidequest/core/formatters";

// Re-export dedupeConsecutiveLines from core for convenience
export { dedupeConsecutiveLines } from "@sidequest/core/formatters";

/**
 * Format timestamp in 12-hour time format.
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

// Re-export formatFilenameTime from core for backward compatibility
export { formatFilenameTime } from "@sidequest/core/formatters";
