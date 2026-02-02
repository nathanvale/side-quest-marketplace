/**
 * Voice memo scanner module.
 *
 * Scans the Apple Voice Memos directory for .m4a files, parses timestamps
 * from filenames, and returns VoiceMemo objects ready for processing.
 *
 * @module voice-memo/scanner
 */

import { lstatSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathExistsSync } from "@side-quest/core/fs";

/**
 * Parsed timestamp components from voice memo filename.
 */
export interface VoiceMemoTimestamp {
	readonly year: number;
	readonly month: number;
	readonly day: number;
	readonly hour: number;
	readonly minute: number;
	readonly second: number;
}

/**
 * Voice memo file with parsed metadata.
 */
export interface VoiceMemo {
	/** Full path to the .m4a file */
	readonly path: string;
	/** Original filename */
	readonly filename: string;
	/** Parsed timestamp as Date object */
	readonly timestamp: Date;
}

/**
 * Options for scanning voice memos.
 */
export interface ScanOptions {
	/** Only include memos from this date onward (inclusive) */
	readonly since?: Date;
}

/**
 * Regular expression for Apple Voice Memos filename format.
 * Format: YYYYMMDD HHMMSS-<UUID>.m4a
 *
 * Example: 20251228 143045-abc123.m4a
 */
const VOICE_MEMO_PATTERN =
	/^(\d{4})(\d{2})(\d{2}) (\d{2})(\d{2})(\d{2})-[a-zA-Z0-9]+\.m4a$/;

/**
 * Safe filename pattern for security validation.
 * Allows: alphanumeric, spaces, hyphens, underscores, dots
 * Prevents: command injection via shell metacharacters
 */
const SAFE_FILENAME_PATTERN = /^[\w\d\s._-]+\.m4a$/i;

/**
 * Validate filename contains only safe characters.
 * Prevents command injection via malicious filenames.
 *
 * @param filename - Voice memo filename to validate
 * @returns True if filename is safe for processing
 */
export function isSafeFilename(filename: string): boolean {
	return SAFE_FILENAME_PATTERN.test(filename);
}

/**
 * Parse timestamp from voice memo filename.
 *
 * Apple Voice Memos use filename format: YYYYMMDD HHMMSS-<UUID>.m4a
 *
 * @param filename - Voice memo filename (not full path)
 * @returns Parsed timestamp components, or null if invalid format or invalid values
 */
export function parseVoiceMemoTimestamp(
	filename: string,
): VoiceMemoTimestamp | null {
	const match = VOICE_MEMO_PATTERN.exec(filename);
	if (!match) {
		return null;
	}

	const year = Number.parseInt(match[1] as string, 10);
	const month = Number.parseInt(match[2] as string, 10);
	const day = Number.parseInt(match[3] as string, 10);
	const hour = Number.parseInt(match[4] as string, 10);
	const minute = Number.parseInt(match[5] as string, 10);
	const second = Number.parseInt(match[6] as string, 10);

	// Validate timestamp values are within sane ranges
	if (year < 2000 || year > 2100) return null;
	if (month < 1 || month > 12) return null;
	if (day < 1 || day > 31) return null;
	if (hour < 0 || hour > 23) return null;
	if (minute < 0 || minute > 59) return null;
	if (second < 0 || second > 59) return null;

	return {
		year,
		month,
		day,
		hour,
		minute,
		second,
	};
}

/**
 * Convert parsed timestamp components to Date object.
 *
 * @param parsed - Parsed timestamp components
 * @returns Date object
 */
function timestampToDate(parsed: VoiceMemoTimestamp): Date {
	// Month is 0-indexed in JavaScript Date
	return new Date(
		parsed.year,
		parsed.month - 1,
		parsed.day,
		parsed.hour,
		parsed.minute,
		parsed.second,
	);
}

/**
 * Scan voice memos directory for .m4a files.
 *
 * Finds all Apple Voice Memos files, parses timestamps from filenames,
 * and returns sorted list of VoiceMemo objects.
 *
 * Skips:
 * - Files with invalid filename format
 * - Empty files (size = 0, indicates iCloud not synced)
 * - Files before --since date (if provided)
 *
 * @param recordingsDir - Path to voice memos directory
 * @param options - Scan options (e.g., --since filter)
 * @returns Array of VoiceMemo objects, sorted by timestamp ascending
 */
export function scanVoiceMemos(
	recordingsDir: string,
	options: ScanOptions = {},
): VoiceMemo[] {
	// Handle non-existent directory gracefully
	if (!pathExistsSync(recordingsDir)) {
		return [];
	}

	const files = readdirSync(recordingsDir);
	const memos: VoiceMemo[] = [];

	for (const filename of files) {
		// Parse timestamp from filename
		const parsed = parseVoiceMemoTimestamp(filename);
		if (!parsed) {
			continue; // Skip non-voice-memo files
		}

		// Security: Validate filename has only safe characters
		if (!isSafeFilename(filename)) {
			continue; // Skip files with potentially dangerous characters
		}

		// Get full path and check file size
		const fullPath = join(recordingsDir, filename);

		// Security: Skip symlinks to prevent path traversal
		const lstats = lstatSync(fullPath);
		if (lstats.isSymbolicLink()) {
			continue;
		}

		const stats = statSync(fullPath);

		// Skip empty files (iCloud not synced)
		if (stats.size === 0) {
			continue;
		}

		// Convert to Date object
		const timestamp = timestampToDate(parsed);

		// Apply --since filter if provided
		if (options.since && timestamp < options.since) {
			continue;
		}

		memos.push({
			path: fullPath,
			filename,
			timestamp,
		});
	}

	// Sort by timestamp ascending (oldest first)
	memos.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

	return memos;
}
