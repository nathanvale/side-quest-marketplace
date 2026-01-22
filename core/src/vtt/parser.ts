/**
 * WebVTT (.vtt) subtitle file parser.
 *
 * Extracts text content from VTT files, stripping timestamps and metadata.
 * VTT is a standard format for timed text tracks (subtitles, captions).
 *
 * @module vtt/parser
 */

/**
 * Parsed VTT cue (subtitle segment).
 */
export interface VttCue {
	readonly startTime: string;
	readonly endTime: string;
	readonly text: string;
	readonly speaker?: string;
}

/**
 * Result of parsing a VTT file.
 */
export interface VttParseResult {
	readonly cues: readonly VttCue[];
	readonly rawText: string;
}

/**
 * Check if a file path is a VTT file.
 *
 * @param filePath - Path to check
 * @returns True if the file has a .vtt extension (case-insensitive)
 */
export function isVttFile(filePath: string): boolean {
	return filePath.toLowerCase().endsWith(".vtt");
}

/**
 * Parse a VTT timestamp (e.g., "00:01:23.456" or "01:23.456").
 * Returns the timestamp string as-is (we don't need to convert to ms).
 */
function parseTimestamp(timestamp: string): string {
	return timestamp.trim();
}

/**
 * Parse VTT content and extract cues.
 *
 * VTT format:
 * ```
 * WEBVTT
 *
 * 00:00:00.000 --> 00:00:03.500
 * First line of text
 *
 * 00:00:03.500 --> 00:00:05.000
 * Second line of text
 * ```
 *
 * Also handles optional cue identifiers and styling tags.
 *
 * @param content - Raw VTT file content
 * @returns Parsed result with cues array and combined raw text
 */
export function parseVtt(content: string): VttParseResult {
	const lines = content.split(/\r?\n/);
	const cues: VttCue[] = [];

	let i = 0;

	// Skip WEBVTT header and any metadata
	while (i < lines.length) {
		const line = lines[i]?.trim() ?? "";
		if (line.startsWith("WEBVTT")) {
			i++;
			// Skip any header metadata (lines before first empty line)
			while (i < lines.length && (lines[i]?.trim() ?? "") !== "") {
				i++;
			}
			break;
		}
		i++;
	}

	// Parse cues
	while (i < lines.length) {
		const line = lines[i]?.trim() ?? "";

		// Skip empty lines
		if (line === "") {
			i++;
			continue;
		}

		// Check if this line is a timestamp line (contains "-->")
		if (line.includes("-->")) {
			const [startPart, endPart] = line.split("-->");
			if (startPart && endPart) {
				const startTime = parseTimestamp(startPart);
				// End time might have positioning info after it, strip that
				const endParts = endPart.trim().split(/\s+/);
				const endTime = parseTimestamp(endParts[0] ?? endPart);

				// Collect text lines until next empty line or timestamp
				i++;
				const textLines: string[] = [];
				let speaker: string | undefined;
				while (i < lines.length) {
					const textLine = lines[i] ?? "";
					const trimmedTextLine = textLine.trim();
					// Stop at empty line or next timestamp
					if (trimmedTextLine === "" || trimmedTextLine.includes("-->")) {
						break;
					}
					// Extract speaker from voice tag if present
					const extractedSpeaker = extractSpeaker(textLine);
					if (extractedSpeaker && !speaker) {
						speaker = extractedSpeaker;
					}
					// Strip VTT styling tags like <v Speaker Name> and </v>
					const cleanedLine = stripVttTags(textLine);
					if (cleanedLine.trim()) {
						textLines.push(cleanedLine.trim());
					}
					i++;
				}

				if (textLines.length > 0) {
					cues.push({
						startTime,
						endTime,
						text: textLines.join(" "),
						speaker,
					});
				}
			}
		} else {
			// This might be a cue identifier, skip it
			i++;
		}
	}

	// Combine all cue text into raw text
	const rawText = cues.map((cue) => cue.text).join("\n");

	return { cues, rawText };
}

/**
 * Extract speaker name from VTT voice tag.
 *
 * Matches: <v Speaker Name>text</v>
 * Returns the speaker name or undefined if not found.
 */
function extractSpeaker(text: string): string | undefined {
	const match = text.match(/<v\s+([^>]+)>/i);
	return match?.[1]?.trim();
}

/**
 * Strip VTT formatting tags from text.
 *
 * Handles:
 * - Voice tags: <v Speaker Name>text</v>
 * - Styling: <b>, <i>, <u>, <c.classname>
 * - Language: <lang en>
 * - Ruby text: <ruby>, <rt>
 */
function stripVttTags(text: string): string {
	return (
		text
			// Remove voice tags but keep content: <v Name>text</v> -> text
			.replace(/<v[^>]*>/gi, "")
			.replace(/<\/v>/gi, "")
			// Remove other common tags
			.replace(/<\/?[biuc][^>]*>/gi, "")
			.replace(/<\/?lang[^>]*>/gi, "")
			.replace(/<\/?ruby[^>]*>/gi, "")
			.replace(/<\/?rt[^>]*>/gi, "")
			// Remove any remaining tags
			.replace(/<[^>]+>/g, "")
	);
}

/**
 * Extract just the text from VTT content, suitable for LLM processing.
 *
 * This is the main entry point - takes VTT content and returns clean text.
 * If speakers are detected, formats as "Speaker: text" for each cue.
 *
 * @param content - Raw VTT file content
 * @returns Clean text extracted from the VTT, with optional speaker labels
 */
export function extractTextFromVtt(content: string): string {
	const result = parseVtt(content);

	// Check if any cues have speakers
	const hasSpeakers = result.cues.some((cue) => cue.speaker);

	if (!hasSpeakers) {
		return result.rawText;
	}

	// Format with speaker labels, grouping consecutive cues from same speaker
	const lines: string[] = [];
	let currentSpeaker: string | undefined;

	for (const cue of result.cues) {
		if (cue.speaker && cue.speaker !== currentSpeaker) {
			// New speaker - add speaker label
			lines.push(`${cue.speaker}: ${cue.text}`);
			currentSpeaker = cue.speaker;
		} else {
			// Same speaker or no speaker - just add text
			lines.push(cue.text);
		}
	}

	return lines.join("\n");
}
