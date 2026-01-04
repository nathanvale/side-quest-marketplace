/**
 * Voice memo state management module.
 *
 * Tracks which voice memos have been processed to prevent duplicate
 * transcriptions. State persisted to JSON file at:
 * ~/.config/para-obsidian/voice-state.json
 *
 * @module voice/state
 */

import { dirname } from "node:path";
import {
	ensureDirSync,
	pathExistsSync,
	readTextFileSync,
	writeTextFileSyncAtomic,
} from "@sidequest/core/fs";

/**
 * Metadata about a processed voice memo.
 */
export interface ProcessedMemoMetadata {
	/** ISO 8601 timestamp when memo was processed */
	readonly processedAt: string;
	/** First 100 characters of transcription (for debugging) */
	readonly transcription: string;
	/** Date of daily note where memo was inserted (YYYY-MM-DD) */
	readonly dailyNote: string;
}

/**
 * Metadata about a skipped voice memo (e.g., empty transcription).
 */
export interface SkippedMemoMetadata {
	/** ISO 8601 timestamp when memo was skipped */
	readonly skippedAt: string;
	/** Reason why the memo was skipped */
	readonly reason: string;
	/** Marker to distinguish from processed memos */
	readonly status: "skipped";
}

/**
 * Union type for memo metadata (processed or skipped).
 */
export type MemoMetadata = ProcessedMemoMetadata | SkippedMemoMetadata;

/**
 * Voice memo processing state.
 */
export interface VoiceState {
	/** Map of filename -> metadata for processed or skipped memos */
	readonly processedMemos: Record<string, MemoMetadata>;
	/** ISO 8601 timestamp of last scan */
	readonly lastScan: string | null;
}

/**
 * Type guard to validate VoiceState structure at runtime.
 *
 * Ensures the parsed JSON has the correct shape to prevent runtime errors
 * from invalid state files.
 *
 * @param data - Unknown data to validate
 * @returns True if data is a valid VoiceState
 */
function isValidVoiceState(data: unknown): data is VoiceState {
	// Check root is an object
	if (typeof data !== "object" || data === null) {
		return false;
	}
	if (Array.isArray(data)) {
		return false;
	}

	// Check processedMemos field exists
	if (!("processedMemos" in data)) {
		return false;
	}

	const state = data as { processedMemos: unknown; lastScan?: unknown };

	// Check processedMemos is an object (not array)
	if (
		typeof state.processedMemos !== "object" ||
		state.processedMemos === null
	) {
		return false;
	}
	if (Array.isArray(state.processedMemos)) {
		return false;
	}

	// Validate each entry has required fields (processed or skipped)
	for (const [_key, value] of Object.entries(state.processedMemos)) {
		if (typeof value !== "object" || value === null) {
			return false;
		}

		// Check if it's a skipped memo
		if ("status" in value && value.status === "skipped") {
			if (!("skippedAt" in value) || !("reason" in value)) {
				return false;
			}
			continue;
		}

		// Otherwise it must be a processed memo
		if (
			!("processedAt" in value) ||
			!("dailyNote" in value) ||
			!("transcription" in value)
		) {
			return false;
		}
	}

	return true;
}

/**
 * Load voice memo state from JSON file.
 *
 * If file doesn't exist or is corrupted, returns empty state.
 * Performs runtime validation to ensure JSON has correct structure.
 *
 * @param stateFilePath - Path to state JSON file
 * @returns Voice memo state
 */
export function loadVoiceState(stateFilePath: string): VoiceState {
	if (!pathExistsSync(stateFilePath)) {
		return {
			processedMemos: {},
			lastScan: null,
		};
	}

	try {
		const content = readTextFileSync(stateFilePath);
		const parsed: unknown = JSON.parse(content);

		// Validate structure before using
		if (!isValidVoiceState(parsed)) {
			// Invalid structure - return empty state (graceful degradation)
			return {
				processedMemos: {},
				lastScan: null,
			};
		}

		return {
			processedMemos: parsed.processedMemos,
			lastScan: parsed.lastScan,
		};
	} catch {
		// Handle corrupted JSON or read errors gracefully
		return {
			processedMemos: {},
			lastScan: null,
		};
	}
}

/**
 * Save voice memo state to JSON file.
 *
 * Creates parent directory if it doesn't exist.
 * Overwrites existing file atomically.
 *
 * @param stateFilePath - Path to state JSON file
 * @param state - Voice memo state to save
 */
export function saveVoiceState(stateFilePath: string, state: VoiceState): void {
	// Ensure parent directory exists
	const parentDir = dirname(stateFilePath);
	ensureDirSync(parentDir);

	// Write state atomically (temp file + rename) to prevent corruption
	const content = JSON.stringify(state, null, 2);
	writeTextFileSyncAtomic(stateFilePath, content);
}

/**
 * Check if a voice memo has been processed.
 *
 * @param state - Current voice memo state
 * @param filename - Voice memo filename (not full path)
 * @returns True if memo already processed
 */
export function isProcessed(state: VoiceState, filename: string): boolean {
	return filename in state.processedMemos;
}

/**
 * Mark a voice memo as processed.
 *
 * Returns new state object (immutable update).
 * Updates lastScan to processedAt timestamp.
 *
 * @param state - Current voice memo state
 * @param filename - Voice memo filename (not full path)
 * @param metadata - Processing metadata
 * @returns Updated state
 */
export function markAsProcessed(
	state: VoiceState,
	filename: string,
	metadata: ProcessedMemoMetadata,
): VoiceState {
	return {
		processedMemos: {
			...state.processedMemos,
			[filename]: metadata,
		},
		lastScan: metadata.processedAt,
	};
}

/**
 * Mark a voice memo as skipped (e.g., empty transcription).
 *
 * Returns new state object (immutable update).
 * Updates lastScan to skippedAt timestamp.
 *
 * @param state - Current voice memo state
 * @param filename - Voice memo filename (not full path)
 * @param reason - Reason why the memo was skipped
 * @returns Updated state
 */
export function markAsSkipped(
	state: VoiceState,
	filename: string,
	reason: string,
): VoiceState {
	const skippedAt = new Date().toISOString();
	return {
		processedMemos: {
			...state.processedMemos,
			[filename]: {
				skippedAt,
				reason,
				status: "skipped",
			},
		},
		lastScan: skippedAt,
	};
}
