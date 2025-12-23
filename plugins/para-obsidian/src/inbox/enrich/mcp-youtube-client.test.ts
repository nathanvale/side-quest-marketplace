/**
 * Tests for MCP YouTube Client
 *
 * Tests the MCP client wrapper for fetching YouTube transcripts via the
 * mcp-youtube-transcript server.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { YouTubeTranscriptResult } from "./mcp-youtube-client";

/**
 * Test fixture video IDs for different scenarios
 */
const TEST_VIDEO_IDS = {
	SIMPLE: "AmdLVWMdjOk",
	PAGINATED: "paginated1",
	MULTILINE: "multiline1",
	EMPTY_TITLE: "emptytitle",
	NON_JSON: "nonjson123",
	NO_TRANSCRIPT: "notranscri",
	UNAVAILABLE: "unavailable",
} as const;

/**
 * Expected call counts for different test scenarios
 * Used to make assertions self-documenting
 */
const EXPECTED_CALLS = {
	SINGLE_PAGE: 1,
	PAGINATED: 2,
} as const;

// Mock transport and client
const mockConnect = mock(async () => {});
const mockClose = mock(async () => {});
const mockCallTool = mock(
	async (params: { name: string; arguments: unknown }) => {
		const args = params.arguments as { url: string; lang?: string };
		const videoId = args.url.split("v=")[1];

		if (videoId === TEST_VIDEO_IDS.SIMPLE) {
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							title: "Test Video Title",
							transcript: "This is the transcript.",
							next_cursor: null,
						}),
					},
				],
			};
		}

		if (videoId === TEST_VIDEO_IDS.PAGINATED) {
			// Return paginated response
			const nextCursor = (args as { next_cursor?: string }).next_cursor;
			if (!nextCursor) {
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								title: "Paginated Video",
								transcript: "Part 1.",
								next_cursor: "cursor-2",
							}),
						},
					],
				};
			}
			if (nextCursor === "cursor-2") {
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								title: "Paginated Video",
								transcript: "Part 2.",
								next_cursor: null,
							}),
						},
					],
				};
			}
		}

		if (videoId === TEST_VIDEO_IDS.MULTILINE) {
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							title: "Multiline Video",
							transcript: "Line 1\nLine 2\n\nParagraph 2\nLine 3",
							next_cursor: null,
						}),
					},
				],
			};
		}

		if (videoId === TEST_VIDEO_IDS.EMPTY_TITLE) {
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							title: "",
							transcript: "Transcript without title",
							next_cursor: null,
						}),
					},
				],
			};
		}

		if (videoId === TEST_VIDEO_IDS.NON_JSON) {
			return {
				content: [
					{
						type: "text",
						text: "Non-JSON response text",
					},
				],
			};
		}

		if (videoId === TEST_VIDEO_IDS.NO_TRANSCRIPT) {
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							title: "No Transcript Video",
							transcript: "",
							next_cursor: null,
						}),
					},
				],
			};
		}

		throw new Error("Transcript unavailable");
	},
);

// Mock the MCP SDK modules
mock.module("@modelcontextprotocol/sdk/client/index.js", () => ({
	Client: class MockClient {
		connect = mockConnect;
		close = mockClose;
		callTool = mockCallTool;
	},
}));

mock.module("@modelcontextprotocol/sdk/client/stdio.js", () => ({
	StdioClientTransport: class MockTransport {
		constructor() {}
	},
}));

describe("fetchTranscriptViaMcp", () => {
	beforeEach(() => {
		// Clear mock call history
		mockConnect.mockClear();
		mockClose.mockClear();
		mockCallTool.mockClear();
	});

	afterEach(() => {
		// Ensure cleanup happened
		expect(mockClose).toHaveBeenCalled();

		// Clear any custom implementations set during tests
		mockConnect.mockClear();
		mockClose.mockClear();
		mockCallTool.mockClear();

		// Restore module mocks
		mock.restore();
	});

	describe("client initialization", () => {
		test("creates client and connects to transport", async () => {
			const { fetchTranscriptViaMcp } = await import("./mcp-youtube-client");

			await fetchTranscriptViaMcp(TEST_VIDEO_IDS.SIMPLE);

			expect(mockConnect).toHaveBeenCalledTimes(EXPECTED_CALLS.SINGLE_PAGE);
		});

		test("always closes client even on success", async () => {
			const { fetchTranscriptViaMcp } = await import("./mcp-youtube-client");

			await fetchTranscriptViaMcp(TEST_VIDEO_IDS.SIMPLE);

			expect(mockClose).toHaveBeenCalledTimes(EXPECTED_CALLS.SINGLE_PAGE);
		});

		test("always closes client even on error", async () => {
			const { fetchTranscriptViaMcp } = await import("./mcp-youtube-client");

			try {
				await fetchTranscriptViaMcp(TEST_VIDEO_IDS.UNAVAILABLE);
			} catch {
				// Expected
			}

			expect(mockClose).toHaveBeenCalledTimes(EXPECTED_CALLS.SINGLE_PAGE);
		});
	});

	describe("tool calling", () => {
		test("calls get_transcript tool with correct arguments", async () => {
			const { fetchTranscriptViaMcp } = await import("./mcp-youtube-client");

			await fetchTranscriptViaMcp(TEST_VIDEO_IDS.SIMPLE, "en");

			expect(mockCallTool).toHaveBeenCalledWith({
				name: "get_transcript",
				arguments: {
					url: `https://www.youtube.com/watch?v=${TEST_VIDEO_IDS.SIMPLE}`,
					lang: "en",
				},
			});
		});

		test("uses default language 'en' when not specified", async () => {
			const { fetchTranscriptViaMcp } = await import("./mcp-youtube-client");

			await fetchTranscriptViaMcp(TEST_VIDEO_IDS.SIMPLE);

			expect(mockCallTool).toHaveBeenCalledWith({
				name: "get_transcript",
				arguments: {
					url: `https://www.youtube.com/watch?v=${TEST_VIDEO_IDS.SIMPLE}`,
					lang: "en",
				},
			});
		});

		test("fetches transcript successfully", async () => {
			const { fetchTranscriptViaMcp } = await import("./mcp-youtube-client");

			const result = await fetchTranscriptViaMcp(TEST_VIDEO_IDS.SIMPLE);

			expect(result.title).toBe("Test Video Title");
			expect(result.transcript).toBe("This is the transcript.");
		});

		test("throws error for unavailable transcript", async () => {
			const { fetchTranscriptViaMcp } = await import("./mcp-youtube-client");

			await expect(
				fetchTranscriptViaMcp(TEST_VIDEO_IDS.UNAVAILABLE),
			).rejects.toThrow("Transcript unavailable");
		});
	});

	describe("pagination handling", () => {
		test("handles paginated responses", async () => {
			const { fetchTranscriptViaMcp } = await import("./mcp-youtube-client");

			const result = await fetchTranscriptViaMcp(TEST_VIDEO_IDS.PAGINATED);

			expect(result.transcript).toBe("Part 1. Part 2.");
			expect(mockCallTool).toHaveBeenCalledTimes(EXPECTED_CALLS.PAGINATED);
		});

		test("passes next_cursor in subsequent calls", async () => {
			const { fetchTranscriptViaMcp } = await import("./mcp-youtube-client");

			await fetchTranscriptViaMcp(TEST_VIDEO_IDS.PAGINATED);

			// First call should not have next_cursor
			expect(mockCallTool).toHaveBeenNthCalledWith(1, {
				name: "get_transcript",
				arguments: {
					url: `https://www.youtube.com/watch?v=${TEST_VIDEO_IDS.PAGINATED}`,
					lang: "en",
				},
			});

			// Second call should have next_cursor
			expect(mockCallTool).toHaveBeenNthCalledWith(2, {
				name: "get_transcript",
				arguments: {
					url: `https://www.youtube.com/watch?v=${TEST_VIDEO_IDS.PAGINATED}`,
					lang: "en",
					next_cursor: "cursor-2",
				},
			});
		});

		test("stops pagination when next_cursor is null", async () => {
			const { fetchTranscriptViaMcp } = await import("./mcp-youtube-client");

			await fetchTranscriptViaMcp(TEST_VIDEO_IDS.SIMPLE);

			// Should only call once since next_cursor is null (single page response)
			expect(mockCallTool).toHaveBeenCalledTimes(EXPECTED_CALLS.SINGLE_PAGE);
		});
	});

	describe("response parsing", () => {
		test("parses JSON response correctly", async () => {
			const { fetchTranscriptViaMcp } = await import("./mcp-youtube-client");

			const result = await fetchTranscriptViaMcp(TEST_VIDEO_IDS.SIMPLE);

			expect(result).toEqual({
				title: "Test Video Title",
				transcript: "This is the transcript.",
			});
		});

		test("handles empty title", async () => {
			const { fetchTranscriptViaMcp } = await import("./mcp-youtube-client");

			const result = await fetchTranscriptViaMcp(TEST_VIDEO_IDS.EMPTY_TITLE);

			expect(result.title).toBe("");
			expect(result.transcript).toBe("Transcript without title");
		});

		test("handles non-JSON response text", async () => {
			const { fetchTranscriptViaMcp } = await import("./mcp-youtube-client");

			const result = await fetchTranscriptViaMcp(TEST_VIDEO_IDS.NON_JSON);

			expect(result.transcript).toBe("Non-JSON response text");
		});

		test("throws error when transcript is empty", async () => {
			const { fetchTranscriptViaMcp } = await import("./mcp-youtube-client");

			await expect(
				fetchTranscriptViaMcp(TEST_VIDEO_IDS.NO_TRANSCRIPT),
			).rejects.toThrow("No transcript content returned from MCP server");
		});
	});

	describe("transcript formatting", () => {
		test("cleans up multiline transcript", async () => {
			const { fetchTranscriptViaMcp } = await import("./mcp-youtube-client");

			const result = await fetchTranscriptViaMcp(TEST_VIDEO_IDS.MULTILINE);

			// Single newlines should be replaced with spaces
			// Double newlines should be preserved (paragraph breaks)
			expect(result.transcript).toBe("Line 1 Line 2\n\nParagraph 2 Line 3");
		});

		test("trims whitespace from transcript", async () => {
			const { fetchTranscriptViaMcp } = await import("./mcp-youtube-client");

			const result = await fetchTranscriptViaMcp(TEST_VIDEO_IDS.SIMPLE);

			expect(result.transcript).toBe("This is the transcript.");
			expect(result.transcript.startsWith(" ")).toBe(false);
			expect(result.transcript.endsWith(" ")).toBe(false);
		});

		test("collapses multiple spaces into one", async () => {
			const { fetchTranscriptViaMcp } = await import("./mcp-youtube-client");

			const result = await fetchTranscriptViaMcp(TEST_VIDEO_IDS.MULTILINE);

			// Should not have more than 2 consecutive spaces (double newline becomes \n\n, not spaces)
			expect(result.transcript).not.toMatch(/ {3}/);
		});
	});

	describe("error handling", () => {
		test("throws error when MCP server fails", async () => {
			const { fetchTranscriptViaMcp } = await import("./mcp-youtube-client");

			await expect(
				fetchTranscriptViaMcp(TEST_VIDEO_IDS.UNAVAILABLE),
			).rejects.toThrow();
		});

		test("closes client even when callTool throws", async () => {
			const { fetchTranscriptViaMcp } = await import("./mcp-youtube-client");

			try {
				await fetchTranscriptViaMcp(TEST_VIDEO_IDS.UNAVAILABLE);
			} catch {
				// Expected
			}

			expect(mockClose).toHaveBeenCalled();
		});

		test("suppresses close errors", async () => {
			const { fetchTranscriptViaMcp } = await import("./mcp-youtube-client");

			// Mock close to throw
			mockClose.mockImplementationOnce(async () => {
				throw new Error("Close failed");
			});

			// Should not throw despite close error (close errors are suppressed)
			await expect(
				fetchTranscriptViaMcp(TEST_VIDEO_IDS.SIMPLE),
			).resolves.toBeDefined();
		});
	});

	describe("type checking", () => {
		test("returns YouTubeTranscriptResult interface", async () => {
			const { fetchTranscriptViaMcp } = await import("./mcp-youtube-client");

			const result: YouTubeTranscriptResult = await fetchTranscriptViaMcp(
				TEST_VIDEO_IDS.SIMPLE,
			);

			expect(result).toHaveProperty("title");
			expect(result).toHaveProperty("transcript");
			expect(typeof result.title).toBe("string");
			expect(typeof result.transcript).toBe("string");
		});
	});
});
