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
	writeTextFileSync,
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
 * Voice memo processing state.
 */
export interface VoiceState {
	/** Map of filename -> metadata for processed memos */
	readonly processedMemos: Record<string, ProcessedMemoMetadata>;
	/** ISO 8601 timestamp of last scan */
	readonly lastScan: string | null;
}

/**
 * Load voice memo state from JSON file.
 *
 * If file doesn't exist or is corrupted, returns empty state.
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
		const parsed = JSON.parse(content) as VoiceState;

		return {
			processedMemos: parsed.processedMemos || {},
			lastScan: parsed.lastScan || null,
		};
	} catch {
		// Handle corrupted JSON gracefully
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

	// Write state as pretty-printed JSON
	const content = JSON.stringify(state, null, 2);
	writeTextFileSync(stateFilePath, content);
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
