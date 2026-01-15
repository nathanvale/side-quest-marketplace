/**
 * Voice memo transcription module.
 *
 * Provides functionality to scan Apple Voice Memos, transcribe them using
 * parakeet-mlx, and insert formatted entries into daily notes.
 *
 * @module voice
 */

// Formatting
export {
	dedupeConsecutiveLines,
	formatFilenameTime,
	formatLogEntry,
	formatTimestamp,
	formatWikilinkLogEntry,
} from "./formatter";
// Note creation
export {
	basicCleanup,
	type CreateVoiceMemoNoteOptions,
	createVoiceMemoNote,
	generateNoteTitle,
	processWithLLM,
	type VoiceMemoLLMResult,
	type VoiceMemoNoteResult,
} from "./note-creator";
// Scanner
export {
	isSafeFilename,
	parseVoiceMemoTimestamp,
	type ScanOptions,
	scanVoiceMemos,
	type VoiceMemo,
	type VoiceMemoTimestamp,
} from "./scanner";
// State management
export {
	isProcessed,
	loadVoiceState,
	type MemoMetadata,
	markAsProcessed,
	markAsSkipped,
	type ProcessedMemoMetadata,
	type SkippedMemoMetadata,
	saveVoiceState,
	type VoiceState,
} from "./state";
// Transcription
export {
	checkFfmpeg, // @deprecated - use isFfmpegAvailable
	checkParakeetMlx, // @deprecated - use isParakeetMlxAvailable
	checkWhisperCli, // @deprecated - use isParakeetMlxAvailable
	isFfmpegAvailable,
	isParakeetMlxAvailable,
	type TranscriptionResult,
	transcribeVoiceMemo,
} from "./transcriber";
// VTT parser
export {
	extractTextFromVtt,
	isVttFile,
	parseVtt,
	type VttCue,
	type VttParseResult,
} from "./vtt-parser";
