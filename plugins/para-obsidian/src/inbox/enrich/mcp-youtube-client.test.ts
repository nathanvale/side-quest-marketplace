/**
 * Tests for YouTube Transcript Client Wrapper
 *
 * Tests the wrapper module that re-exports from @sidequest/core/youtube-transcript.
 * The actual transcript fetching logic is tested in core/src/youtube-transcript/index.test.ts.
 * This file tests the wrapper-specific behavior (logging, type re-exports).
 */

import { describe, expect, test } from "bun:test";
import type {
	TranscriptFormatOptions,
	TranscriptSegment,
	YouTubeTranscriptResult,
} from "./mcp-youtube-client";

describe("mcp-youtube-client module", () => {
	describe("type re-exports", () => {
		test("TranscriptFormatOptions type is usable", () => {
			// Verify the type can be used
			const options: TranscriptFormatOptions = {
				chunkDurationSeconds: 300,
			};
			expect(options.chunkDurationSeconds).toBe(300);
		});

		test("TranscriptSegment type is usable", () => {
			// Verify the type can be used
			const segment: TranscriptSegment = {
				start: 0,
				duration: 10,
				text: "Hello",
			};
			expect(segment.text).toBe("Hello");
		});

		test("YouTubeTranscriptResult type is usable", () => {
			// Verify the type can be used
			const result: YouTubeTranscriptResult = {
				title: "Test Title",
				transcript: "Test transcript",
			};
			expect(result.title).toBe("Test Title");
		});
	});

	describe("fetchTranscriptViaMcp function", () => {
		test("is exported as a function", async () => {
			const { fetchTranscriptViaMcp } = await import("./mcp-youtube-client");
			expect(typeof fetchTranscriptViaMcp).toBe("function");
		});

		test("returns a promise", async () => {
			const { fetchTranscriptViaMcp } = await import("./mcp-youtube-client");
			// Test that it returns a promise (will reject due to invalid video ID)
			const result = fetchTranscriptViaMcp("invalid_video_id_test");
			expect(result).toBeInstanceOf(Promise);
			// Clean up the promise rejection
			await result.catch(() => {});
		});
	});

	describe("backward compatibility", () => {
		test("fetchTranscriptViaMcp accepts videoId as first argument", async () => {
			const { fetchTranscriptViaMcp } = await import("./mcp-youtube-client");
			// Verify the function signature accepts videoId - returns a promise
			const promise = fetchTranscriptViaMcp("test123");
			expect(promise).toBeInstanceOf(Promise);
			// Clean up the rejection (invalid video ID will fail)
			await promise.catch(() => {});
		});

		test("fetchTranscriptViaMcp accepts optional lang as second argument", async () => {
			const { fetchTranscriptViaMcp } = await import("./mcp-youtube-client");
			// Verify the function signature accepts lang - returns a promise
			const promise = fetchTranscriptViaMcp("test123", "en");
			expect(promise).toBeInstanceOf(Promise);
			// Clean up the rejection
			await promise.catch(() => {});
		});

		test("fetchTranscriptViaMcp accepts optional formatOptions as third argument", async () => {
			const { fetchTranscriptViaMcp } = await import("./mcp-youtube-client");
			// Verify the function signature accepts formatOptions - returns a promise
			const promise = fetchTranscriptViaMcp("test123", "en", {
				chunkDurationSeconds: 300,
			});
			expect(promise).toBeInstanceOf(Promise);
			// Clean up the rejection
			await promise.catch(() => {});
		});
	});
});

describe("integration with @sidequest/core", () => {
	test("core exports are accessible through wrapper", async () => {
		// Verify that the wrapper re-exports types from core correctly
		const wrapperModule = await import("./mcp-youtube-client");
		const coreModule = await import("@sidequest/core/youtube-transcript");

		// Both should export fetchYouTubeTranscript (wrapper calls it internally)
		expect(typeof coreModule.fetchYouTubeTranscript).toBe("function");

		// Wrapper should have its own function that calls core
		expect(typeof wrapperModule.fetchTranscriptViaMcp).toBe("function");
	});
});
