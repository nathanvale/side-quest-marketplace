/**
 * Voice memo transcription module.
 *
 * Provides functionality to scan Apple Voice Memos, transcribe them using
 * whisper.cpp, and insert formatted entries into daily notes.
 *
 * @module voice
 */

// Formatting
export { formatLogEntry, formatTimestamp } from "./formatter";
// Scanner
export {
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
	markAsProcessed,
	type ProcessedMemoMetadata,
	saveVoiceState,
	type VoiceState,
} from "./state";
// Transcription
export {
	checkFfmpeg,
	checkWhisperCli,
	type TranscriptionResult,
	transcribeVoiceMemo,
} from "./transcriber";
