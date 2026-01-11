/**
 * YouTube Transcript Service Tests
 *
 * Tests for the YouTube transcript fetching and formatting service.
 */

import { describe, expect, test } from "bun:test";
import { extractVideoId } from "./client";
import { YouTubeTranscriptError } from "./errors";
import {
	chunkSegments,
	formatTimestamp,
	formatTranscriptAsPlainText,
	formatTranscriptWithTimestamps,
} from "./formatter";
import type { TranscriptSegment } from "./types";

describe("formatTimestamp", () => {
	test("formats seconds under a minute", () => {
		expect(formatTimestamp(0)).toBe("0:00");
		expect(formatTimestamp(5)).toBe("0:05");
		expect(formatTimestamp(30)).toBe("0:30");
		expect(formatTimestamp(59)).toBe("0:59");
	});

	test("formats minutes and seconds", () => {
		expect(formatTimestamp(60)).toBe("1:00");
		expect(formatTimestamp(65)).toBe("1:05");
		expect(formatTimestamp(125)).toBe("2:05");
		expect(formatTimestamp(599)).toBe("9:59");
		expect(formatTimestamp(3599)).toBe("59:59");
	});

	test("formats hours, minutes and seconds", () => {
		expect(formatTimestamp(3600)).toBe("1:00:00");
		expect(formatTimestamp(3665)).toBe("1:01:05");
		expect(formatTimestamp(7325)).toBe("2:02:05");
		expect(formatTimestamp(36000)).toBe("10:00:00");
	});

	test("handles decimal seconds by flooring", () => {
		expect(formatTimestamp(5.7)).toBe("0:05");
		expect(formatTimestamp(65.9)).toBe("1:05");
	});
});

describe("chunkSegments", () => {
	test("returns empty array for empty input", () => {
		expect(chunkSegments([], 300)).toEqual([]);
	});

	test("keeps all segments in one chunk if within duration", () => {
		const segments: TranscriptSegment[] = [
			{ start: 0, duration: 10, text: "Hello" },
			{ start: 10, duration: 10, text: "World" },
			{ start: 20, duration: 10, text: "!" },
		];
		const chunks = chunkSegments(segments, 300);
		expect(chunks).toHaveLength(1);
		expect(chunks[0]).toHaveLength(3);
	});

	test("splits segments into multiple chunks", () => {
		const segments: TranscriptSegment[] = [
			{ start: 0, duration: 10, text: "Chunk 1" },
			{ start: 100, duration: 10, text: "Still chunk 1" },
			{ start: 300, duration: 10, text: "Chunk 2" },
			{ start: 400, duration: 10, text: "Still chunk 2" },
			{ start: 600, duration: 10, text: "Chunk 3" },
		];
		const chunks = chunkSegments(segments, 300);
		expect(chunks).toHaveLength(3);
		expect(chunks[0]).toHaveLength(2);
		expect(chunks[1]).toHaveLength(2);
		expect(chunks[2]).toHaveLength(1);
	});

	test("handles single segment", () => {
		const segments: TranscriptSegment[] = [
			{ start: 0, duration: 10, text: "Only one" },
		];
		const chunks = chunkSegments(segments, 300);
		expect(chunks).toHaveLength(1);
		expect(chunks[0]).toHaveLength(1);
	});
});

describe("formatTranscriptWithTimestamps", () => {
	test("formats single chunk correctly", () => {
		const segments: TranscriptSegment[] = [
			{ start: 0, duration: 30, text: "Hello world." },
			{ start: 30, duration: 30, text: "This is a test." },
		];
		const result = formatTranscriptWithTimestamps(segments, 300);

		expect(result).toContain("### 0:00 - 1:00");
		expect(result).toContain("Hello world.");
		expect(result).toContain("This is a test.");
	});

	test("formats multiple chunks with headers", () => {
		const segments: TranscriptSegment[] = [
			{ start: 0, duration: 60, text: "First chunk content." },
			{ start: 300, duration: 60, text: "Second chunk content." },
		];
		const result = formatTranscriptWithTimestamps(segments, 300);

		expect(result).toContain("### 0:00 -");
		expect(result).toContain("### 5:00 -");
		expect(result).toContain("First chunk content.");
		expect(result).toContain("Second chunk content.");
	});

	test("collapses multiple spaces", () => {
		const segments: TranscriptSegment[] = [
			{ start: 0, duration: 10, text: "Hello    world" },
		];
		const result = formatTranscriptWithTimestamps(segments, 300);

		expect(result).toContain("Hello world");
		expect(result).not.toContain("    ");
	});

	test("adds paragraph breaks at sentence boundaries", () => {
		const segments: TranscriptSegment[] = [
			{ start: 0, duration: 30, text: "First sentence. Second sentence." },
		];
		const result = formatTranscriptWithTimestamps(segments, 300);

		expect(result).toContain("First sentence.\n\nSecond sentence.");
	});

	test("handles empty segments array", () => {
		const result = formatTranscriptWithTimestamps([], 300);
		expect(result).toBe("");
	});
});

describe("formatTranscriptAsPlainText", () => {
	test("joins segments with spaces", () => {
		const segments: TranscriptSegment[] = [
			{ start: 0, duration: 10, text: "Hello" },
			{ start: 10, duration: 10, text: "world" },
		];
		const result = formatTranscriptAsPlainText(segments);
		expect(result).toBe("Hello world");
	});

	test("trims whitespace", () => {
		const segments: TranscriptSegment[] = [
			{ start: 0, duration: 10, text: "  Hello  " },
			{ start: 10, duration: 10, text: "  world  " },
		];
		const result = formatTranscriptAsPlainText(segments);
		expect(result).toBe("Hello world");
	});

	test("collapses multiple spaces", () => {
		const segments: TranscriptSegment[] = [
			{ start: 0, duration: 10, text: "Hello    world" },
		];
		const result = formatTranscriptAsPlainText(segments);
		expect(result).toBe("Hello world");
	});

	test("handles empty array", () => {
		const result = formatTranscriptAsPlainText([]);
		expect(result).toBe("");
	});
});

describe("extractVideoId", () => {
	test("returns video ID for standard YouTube URL", () => {
		expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
			"dQw4w9WgXcQ",
		);
		expect(extractVideoId("https://youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
			"dQw4w9WgXcQ",
		);
	});

	test("returns video ID for short URL", () => {
		expect(extractVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
	});

	test("returns video ID for embed URL", () => {
		expect(extractVideoId("https://youtube.com/embed/dQw4w9WgXcQ")).toBe(
			"dQw4w9WgXcQ",
		);
	});

	test("returns video ID for shorts URL", () => {
		expect(extractVideoId("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe(
			"dQw4w9WgXcQ",
		);
	});

	test("returns video ID when passed directly", () => {
		expect(extractVideoId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
	});

	test("returns null for invalid URLs", () => {
		expect(extractVideoId("https://example.com")).toBeNull();
		expect(extractVideoId("not-a-url")).toBeNull();
		expect(extractVideoId("")).toBeNull();
	});
});

describe("YouTubeTranscriptError", () => {
	test("creates error with correct properties", () => {
		const error = new YouTubeTranscriptError("Test error", "FETCH_FAILED", {
			videoId: "abc123",
		});

		expect(error.name).toBe("YouTubeTranscriptError");
		expect(error.message).toBe("Test error");
		expect(error.code).toBe("FETCH_FAILED");
		expect(error.videoId).toBe("abc123");
	});

	test("creates error with cause", () => {
		const cause = new Error("Original error");
		const error = new YouTubeTranscriptError("Wrapped", "FETCH_FAILED", {
			cause,
		});

		expect(error.cause).toBe(cause);
	});

	test("static factory methods create correct errors", () => {
		const disabled = YouTubeTranscriptError.transcriptDisabled("vid123");
		expect(disabled.code).toBe("TRANSCRIPT_DISABLED");
		expect(disabled.videoId).toBe("vid123");

		const notFound = YouTubeTranscriptError.videoNotFound("vid123");
		expect(notFound.code).toBe("VIDEO_NOT_FOUND");

		const langError = YouTubeTranscriptError.languageNotAvailable(
			"vid123",
			"fr",
		);
		expect(langError.code).toBe("LANGUAGE_NOT_AVAILABLE");
		expect(langError.message).toContain("fr");

		const fetchError = YouTubeTranscriptError.fetchFailed("vid123");
		expect(fetchError.code).toBe("FETCH_FAILED");

		const parseError = YouTubeTranscriptError.parseFailed("vid123");
		expect(parseError.code).toBe("PARSE_FAILED");

		const timeout = YouTubeTranscriptError.timeout("vid123", 30000);
		expect(timeout.code).toBe("TIMEOUT");
		expect(timeout.message).toContain("30000");
	});

	test("error is instanceof Error", () => {
		const error = YouTubeTranscriptError.fetchFailed("vid123");
		expect(error instanceof Error).toBe(true);
		expect(error instanceof YouTubeTranscriptError).toBe(true);
	});
});
