/**
 * Voice memo processing for para-obsidian.
 *
 * Generic transcription utilities from @sidequest/voice-memo,
 * Obsidian-specific note creation and formatting from local modules.
 *
 * @module voice
 */

// Re-export VTT utilities from core
export {
	extractTextFromVtt,
	isVttFile,
	parseVtt,
	type VttCue,
	type VttParseResult,
} from "@side-quest/core/vtt";
// Re-export generic utilities from voice-memo
export {
	checkFfmpeg,
	checkParakeetMlx,
	checkWhisperCli,
	dedupeConsecutiveLines,
	// Generic formatting
	formatTimestamp,
	isFfmpegAvailable,
	isParakeetMlxAvailable,
	isProcessed,
	isSafeFilename,
	// State
	loadVoiceState,
	type MemoMetadata,
	markAsProcessed,
	markAsSkipped,
	type ProcessedMemoMetadata,
	parseVoiceMemoTimestamp,
	type ScanOptions,
	type SkippedMemoMetadata,
	saveVoiceState,
	// Scanner
	scanVoiceMemos,
	type TranscriptionResult,
	// Transcriber
	transcribeVoiceMemo,
	// Types
	type VoiceMemo,
	type VoiceMemoTimestamp,
	type VoiceState,
} from "@sidequest/voice-memo";

// Export Obsidian-specific formatters
export { formatLogEntry, formatWikilinkLogEntry } from "./formatter.js";

// Export Obsidian-specific note creation
export {
	basicCleanup,
	// Types
	type CreateVoiceMemoNoteOptions,
	createVoiceMemoNote,
	formatFilenameTime,
	generateNoteTitle,
	type ProcessWithLLMOptions,
	processWithLLM,
	type VoiceMemoLLMResult,
	type VoiceMemoNoteResult,
} from "./note-creator.js";
