/**
 * WebVTT (Web Video Text Tracks) parser module.
 *
 * Provides utilities for parsing VTT subtitle files, commonly used for:
 * - Video subtitles and captions
 * - Meeting transcripts (Microsoft Teams, Zoom)
 * - Audio transcription output
 *
 * @example
 * ```ts
 * import { parseVtt, extractTextFromVtt, isVttFile } from "@sidequest/core/vtt";
 *
 * // Check if a file is VTT format
 * if (isVttFile("meeting-transcript.vtt")) {
 *   const content = await Bun.file("meeting-transcript.vtt").text();
 *
 *   // Parse to get structured cues with timestamps
 *   const result = parseVtt(content);
 *   console.log(result.cues); // Array of VttCue objects
 *
 *   // Or extract just the text (suitable for LLM processing)
 *   const text = extractTextFromVtt(content);
 *   console.log(text); // Plain text with optional speaker labels
 * }
 * ```
 *
 * @module vtt
 */

export {
	extractTextFromVtt,
	isVttFile,
	parseVtt,
	type VttCue,
	type VttParseResult,
} from "./parser.ts";
