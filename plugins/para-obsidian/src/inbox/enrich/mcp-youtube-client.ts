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
 * Result from the YouTube transcript MCP tool.
 */
export interface YouTubeTranscriptResult {
	title: string;
	transcript: string;
	nextCursor?: string | null;
}

/**
 * Fetches a YouTube transcript using the MCP youtube-transcript server.
 *
 * @param videoId - YouTube video ID (11 characters)
 * @param lang - Preferred language for transcript (default: "en")
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
): Promise<YouTubeTranscriptResult> {
	const url = `https://www.youtube.com/watch?v=${videoId}`;

	if (log) {
		log.debug`MCP YouTube client starting videoId=${videoId}`;
	}

	// Create transport to spawn the MCP server
	// Suppress Python logging by setting PYTHONWARNINGS and stderr to ignore
	const transport = new StdioClientTransport({
		command: "uvx",
		args: [
			"--from",
			"git+https://github.com/jkawamoto/mcp-youtube-transcript",
			"mcp-youtube-transcript",
		],
		env: {
			...process.env,
			// Suppress Python logging output
			PYTHONWARNINGS: "ignore",
			// Set log level to ERROR to suppress INFO messages
			LOG_LEVEL: "ERROR",
		},
		stderr: "ignore",
	});

	// Create MCP client
	const client = new Client(
		{ name: "para-obsidian", version: "1.0.0" },
		{ capabilities: {} },
	);

	try {
		// Connect to the server
		await client.connect(transport);

		if (log) {
			log.debug`MCP YouTube client connected`;
		}

		// Fetch full transcript (may require pagination)
		let fullTranscript = "";
		let title = "";
		let nextCursor: string | null = null;

		do {
			const args: Record<string, unknown> = { url, lang };
			if (nextCursor) {
				args.next_cursor = nextCursor;
			}

			const result = await client.callTool({
				name: "get_transcript",
				arguments: args,
			});

			if (log) {
				log.debug`MCP YouTube tool response received`;
			}

			// Parse response - content is an array of content blocks
			if (result.content && Array.isArray(result.content)) {
				for (const block of result.content) {
					if (block.type === "text" && typeof block.text === "string") {
						// Parse the JSON response
						try {
							const parsed = JSON.parse(block.text);
							if (parsed.title && !title) {
								title = parsed.title;
							}
							if (parsed.transcript) {
								fullTranscript +=
									(fullTranscript ? " " : "") + parsed.transcript;
							}
							nextCursor = parsed.next_cursor || null;
						} catch {
							// If not JSON, append raw text
							fullTranscript += (fullTranscript ? " " : "") + block.text;
							nextCursor = null;
						}
					}
				}
			}
		} while (nextCursor);

		if (!fullTranscript) {
			throw new Error("No transcript content returned from MCP server");
		}

		// Clean up transcript formatting:
		// YouTube captions have hard line breaks every ~40 chars for video display.
		// Join lines into proper paragraphs while preserving intentional breaks.
		const cleanedTranscript = fullTranscript
			// Normalize line endings
			.replace(/\r\n/g, "\n")
			// Replace single newlines with spaces (these are just caption line wraps)
			.replace(/(?<!\n)\n(?!\n)/g, " ")
			// Collapse multiple spaces into one
			.replace(/ +/g, " ")
			// Trim whitespace
			.trim();

		if (log) {
			log.info`MCP YouTube transcript fetched videoId=${videoId} length=${cleanedTranscript.length}`;
		}

		return {
			title,
			transcript: cleanedTranscript,
		};
	} finally {
		// Always close the client
		try {
			await client.close();
		} catch {
			// Ignore close errors
		}
	}
}
