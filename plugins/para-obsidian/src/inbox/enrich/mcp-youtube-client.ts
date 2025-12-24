/**
 * MCP Client for YouTube Transcript Server
 *
 * Provides a simple interface to fetch YouTube transcripts via the
 * mcp-youtube-transcript MCP server.
 *
 * @module inbox/enrich/mcp-youtube-client
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { enrichLogger } from "../../shared/logger";

const log = enrichLogger;

/**
 * A single timed transcript segment from YouTube.
 */
export interface TranscriptSegment {
	/** Start time in seconds */
	start: number;
	/** Duration in seconds */
	duration: number;
	/** Text content */
	text: string;
}

/**
 * Result from the YouTube transcript MCP tool.
 */
export interface YouTubeTranscriptResult {
	title: string;
	transcript: string;
	nextCursor?: string | null;
}

/**
 * Configuration for transcript formatting.
 */
export interface TranscriptFormatOptions {
	/** Chunk duration in seconds (default: 300 = 5 minutes) */
	chunkDurationSeconds?: number;
}

const DEFAULT_FORMAT_OPTIONS: Required<TranscriptFormatOptions> = {
	chunkDurationSeconds: 300, // 5 minutes
};

/**
 * Format seconds as MM:SS or HH:MM:SS timestamp.
 */
function formatTimestamp(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor(seconds % 60);

	if (h > 0) {
		return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
	}
	return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Group transcript segments into time-based chunks.
 */
function chunkSegments(
	segments: TranscriptSegment[],
	chunkDurationSeconds: number,
): TranscriptSegment[][] {
	const chunks: TranscriptSegment[][] = [];
	let currentChunk: TranscriptSegment[] = [];
	let chunkStartTime = 0;

	for (const segment of segments) {
		// Start a new chunk if we've exceeded the duration
		if (
			segment.start >= chunkStartTime + chunkDurationSeconds &&
			currentChunk.length > 0
		) {
			chunks.push(currentChunk);
			currentChunk = [];
			chunkStartTime =
				Math.floor(segment.start / chunkDurationSeconds) * chunkDurationSeconds;
		}
		currentChunk.push(segment);
	}

	// Don't forget the last chunk
	if (currentChunk.length > 0) {
		chunks.push(currentChunk);
	}

	return chunks;
}

/**
 * Format transcript segments into markdown with timestamp headers.
 *
 * Creates sections for each time chunk with ### headers.
 */
function formatTranscriptWithTimestamps(
	segments: TranscriptSegment[],
	options: Required<TranscriptFormatOptions>,
): string {
	const chunks = chunkSegments(segments, options.chunkDurationSeconds);
	const parts: string[] = [];

	for (const chunk of chunks) {
		if (chunk.length === 0) continue;

		const firstSegment = chunk[0];
		const lastSegment = chunk[chunk.length - 1];
		if (!firstSegment || !lastSegment) continue;

		const startTime = firstSegment.start;
		const endTime = lastSegment.start + lastSegment.duration;
		const startTs = formatTimestamp(startTime);
		const endTs = formatTimestamp(endTime);

		// Combine text from all segments in chunk, cleaning up formatting
		const chunkText = chunk
			.map((s) => s.text.trim())
			.join(" ")
			// Collapse multiple spaces
			.replace(/ +/g, " ")
			// Add paragraph breaks at sentence endings followed by capital letters
			// (heuristic for topic changes)
			.replace(/([.!?])\s+([A-Z])/g, "$1\n\n$2")
			.trim();

		// Simple format with timestamp headers
		parts.push(`### ${startTs} - ${endTs}`);
		parts.push("");
		parts.push(chunkText);
		parts.push("");
	}

	return parts.join("\n").trim();
}

/**
 * Format transcript as plain text (legacy format).
 */
function formatTranscriptAsPlainText(segments: TranscriptSegment[]): string {
	return segments
		.map((s) => s.text.trim())
		.join(" ")
		.replace(/\r\n/g, "\n")
		.replace(/(?<!\n)\n(?!\n)/g, " ")
		.replace(/ +/g, " ")
		.trim();
}

/**
 * Create the MCP transport for the YouTube transcript server.
 */
function createTransport(): StdioClientTransport {
	return new StdioClientTransport({
		command: "uvx",
		args: [
			"--from",
			"git+https://github.com/jkawamoto/mcp-youtube-transcript",
			"mcp-youtube-transcript",
		],
		env: {
			...process.env,
			PYTHONWARNINGS: "ignore",
			LOG_LEVEL: "ERROR",
		},
		stderr: "ignore",
	});
}

/**
 * Fetches a YouTube transcript using the MCP youtube-transcript server.
 *
 * Uses the timed transcript endpoint and formats output with timestamp
 * headers for better readability.
 *
 * @param videoId - YouTube video ID (11 characters)
 * @param lang - Preferred language for transcript (default: "en")
 * @param formatOptions - Formatting options for the output
 * @returns Promise resolving to transcript result
 * @throws Error if MCP server fails or transcript unavailable
 *
 * @example
 * ```typescript
 * const result = await fetchTranscriptViaMcp("AmdLVWMdjOk");
 * console.log(result.transcript);
 * ```
 */
export async function fetchTranscriptViaMcp(
	videoId: string,
	lang = "en",
	formatOptions?: TranscriptFormatOptions,
): Promise<YouTubeTranscriptResult> {
	const url = `https://www.youtube.com/watch?v=${videoId}`;
	const options = { ...DEFAULT_FORMAT_OPTIONS, ...formatOptions };

	if (log) {
		log.debug`MCP YouTube client starting videoId=${videoId}`;
	}

	const transport = createTransport();
	const client = new Client(
		{ name: "para-obsidian", version: "1.0.0" },
		{ capabilities: {} },
	);

	try {
		await client.connect(transport);

		if (log) {
			log.debug`MCP YouTube client connected`;
		}

		// Fetch timed transcript (with timestamps)
		const segments: TranscriptSegment[] = [];
		let title = "";
		let nextCursor: string | null = null;

		do {
			const args: Record<string, unknown> = { url, lang };
			if (nextCursor) {
				args.next_cursor = nextCursor;
			}

			const result = await client.callTool({
				name: "get_timed_transcript",
				arguments: args,
			});

			if (log) {
				log.debug`MCP YouTube tool response received`;
			}

			// Parse response
			if (result.content && Array.isArray(result.content)) {
				for (const block of result.content) {
					if (block.type === "text" && typeof block.text === "string") {
						try {
							const parsed = JSON.parse(block.text);
							if (parsed.title && !title) {
								title = parsed.title;
							}
							// Timed transcript returns snippets array
							if (parsed.snippets && Array.isArray(parsed.snippets)) {
								for (const snip of parsed.snippets) {
									segments.push({
										start: snip.start ?? 0,
										duration: snip.duration ?? 0,
										text: snip.text ?? "",
									});
								}
							}
							// Also support segments key (fallback for different MCP versions)
							if (parsed.segments && Array.isArray(parsed.segments)) {
								for (const seg of parsed.segments) {
									segments.push({
										start: seg.start ?? 0,
										duration: seg.duration ?? 0,
										text: seg.text ?? "",
									});
								}
							}
							// Also support flat transcript field (fallback)
							if (parsed.transcript && typeof parsed.transcript === "string") {
								segments.push({
									start: 0,
									duration: 0,
									text: parsed.transcript,
								});
							}
							nextCursor = parsed.next_cursor || null;
						} catch {
							// If not JSON, treat as plain text
							segments.push({
								start: 0,
								duration: 0,
								text: block.text,
							});
							nextCursor = null;
						}
					}
				}
			}
		} while (nextCursor);

		if (segments.length === 0) {
			throw new Error("No transcript content returned from MCP server");
		}

		// Format the transcript with timestamps if we have timing data
		const formattedTranscript = segments.some((s) => s.start > 0)
			? formatTranscriptWithTimestamps(segments, options)
			: formatTranscriptAsPlainText(segments);

		if (log) {
			log.info`MCP YouTube transcript fetched videoId=${videoId} segments=${segments.length} length=${formattedTranscript.length}`;
		}

		return {
			title,
			transcript: formattedTranscript,
		};
	} finally {
		try {
			await client.close();
		} catch {
			// Ignore close errors
		}
	}
}
