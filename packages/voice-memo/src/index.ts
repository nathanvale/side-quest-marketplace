/**
 * Voice memo transcription and processing utilities.
 *
 * This package provides generic tools for:
 * - Scanning Apple Voice Memos directories
 * - Transcribing audio using parakeet-mlx or whisper
 * - Tracking processed memo state
 * - Generic formatting utilities
 *
 * @example
 * ```ts
 * import {
 *   scanVoiceMemos,
 *   transcribeVoiceMemo,
 *   loadVoiceState,
 *   markAsProcessed,
 * } from "@sidequest/voice-memo";
 *
 * // Scan for voice memos
 * const memos = scanVoiceMemos("/path/to/recordings");
 *
 * // Transcribe a memo
 * const transcription = await transcribeVoiceMemo(memos[0].path);
 *
 * // Track state
 * const state = loadVoiceState("~/.para/voice-state.json");
 * if (!isProcessed(state, memos[0].filename)) {
 *   // Process...
 *   const newState = markAsProcessed(state, memos[0].filename, metadata);
 *   saveVoiceState("~/.para/voice-state.json", newState);
 * }
 * ```
 *
 * @module voice-memo
 */

// Formatter (generic only)
export {
	dedupeConsecutiveLines,
	formatFilenameTime,
	formatTimestamp,
} from "./formatter.ts";
export type { ScanOptions, VoiceMemo, VoiceMemoTimestamp } from "./scanner.ts";
// Scanner
export {
	isSafeFilename,
	parseVoiceMemoTimestamp,
	scanVoiceMemos,
} from "./scanner.ts";
export type {
	MemoMetadata,
	ProcessedMemoMetadata,
	SkippedMemoMetadata,
	VoiceState,
} from "./state.ts";

// State
export {
	isProcessed,
	loadVoiceState,
	markAsProcessed,
	markAsSkipped,
	saveVoiceState,
} from "./state.ts";
export type { TranscriptionResult } from "./transcriber.ts";
// Transcriber
export {
	checkFfmpeg,
	checkParakeetMlx,
	checkWhisperCli,
	isFfmpegAvailable,
	isParakeetMlxAvailable,
	transcribeVoiceMemo,
} from "./transcriber.ts";
