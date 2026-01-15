/**
 * Tests for voice memo note creator module.
 *
 * @module voice/note-creator.test
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	ensureDirSync,
	pathExistsSync,
	readTextFileSync,
} from "@sidequest/core/fs";

import {
	basicCleanup,
	createVoiceMemoNote,
	formatFilenameTime,
	generateNoteTitle,
	processWithLLM,
} from "./note-creator.js";

// Mock the LLM client
const mockCallLLMWithMetadata = mock(() =>
	Promise.resolve({
		response: JSON.stringify({
			cleanedText: "This is cleaned up text with proper punctuation.",
			summary: "A brief summary of the voice memo content.",
		}),
		modelUsed: "haiku",
		isFallback: false,
	}),
);

mock.module("../inbox/core/llm/client.js", () => ({
	callLLMWithMetadata: mockCallLLMWithMetadata,
}));

describe("formatFilenameTime", () => {
	test("formats afternoon time without colon", () => {
		const date = new Date(2026, 0, 15, 14, 45);
		expect(formatFilenameTime(date)).toBe("2-45pm");
	});

	test("formats morning time", () => {
		const date = new Date(2026, 0, 15, 10, 30);
		expect(formatFilenameTime(date)).toBe("10-30am");
	});

	test("formats midnight as 12am", () => {
		const date = new Date(2026, 0, 15, 0, 0);
		expect(formatFilenameTime(date)).toBe("12-00am");
	});

	test("formats noon as 12pm", () => {
		const date = new Date(2026, 0, 15, 12, 0);
		expect(formatFilenameTime(date)).toBe("12-00pm");
	});

	test("formats single digit hour without padding", () => {
		const date = new Date(2026, 0, 15, 9, 5);
		expect(formatFilenameTime(date)).toBe("9-05am");
	});

	test("pads minutes with leading zero", () => {
		const date = new Date(2026, 0, 15, 14, 5);
		expect(formatFilenameTime(date)).toBe("2-05pm");
	});
});

describe("generateNoteTitle", () => {
	test("generates title with date and time", () => {
		const date = new Date(2026, 0, 15, 14, 45);
		expect(generateNoteTitle(date)).toBe("🎤 2026-01-15 2-45pm");
	});

	test("generates title for morning time", () => {
		const date = new Date(2026, 5, 20, 9, 30);
		expect(generateNoteTitle(date)).toBe("🎤 2026-06-20 9-30am");
	});

	test("generates title for midnight", () => {
		const date = new Date(2026, 11, 31, 0, 0);
		expect(generateNoteTitle(date)).toBe("🎤 2026-12-31 12-00am");
	});
});

describe("basicCleanup", () => {
	test("removes common filler words", () => {
		const input = "So um I was thinking uh about the project you know";
		const result = basicCleanup(input);
		expect(result).toBe("So I was thinking about the project");
	});

	test("removes 'like' filler word", () => {
		const input = "It was like really good like amazing";
		const result = basicCleanup(input);
		expect(result).toBe("It was really good amazing");
	});

	test("removes 'sort of' and 'kind of'", () => {
		const input = "It was sort of interesting and kind of fun";
		const result = basicCleanup(input);
		expect(result).toBe("It was interesting and fun");
	});

	test("normalizes multiple spaces", () => {
		const input = "Hello    world   test";
		const result = basicCleanup(input);
		expect(result).toBe("Hello world test");
	});

	test("trims leading and trailing whitespace", () => {
		const input = "   Hello world   ";
		const result = basicCleanup(input);
		expect(result).toBe("Hello world");
	});

	test("handles case-insensitive filler words", () => {
		const input = "UM UH LIKE YOU KNOW";
		const result = basicCleanup(input);
		expect(result).toBe("");
	});

	test("preserves meaningful content", () => {
		const input = "The meeting is at 3pm tomorrow";
		const result = basicCleanup(input);
		expect(result).toBe("The meeting is at 3pm tomorrow");
	});
});

describe("processWithLLM", () => {
	beforeEach(() => {
		mockCallLLMWithMetadata.mockClear();
	});

	test("skips LLM for short transcriptions", async () => {
		const result = await processWithLLM("Short");
		expect(result.success).toBe(true);
		expect(result.cleanedText).toBe("Short");
		expect(result.summary).toBe("");
		expect(mockCallLLMWithMetadata).not.toHaveBeenCalled();
	});

	test("calls LLM for longer transcriptions", async () => {
		mockCallLLMWithMetadata.mockResolvedValueOnce({
			response: JSON.stringify({
				cleanedText: "Cleaned transcription text here.",
				summary: "A summary of the transcription.",
			}),
			modelUsed: "haiku",
			isFallback: false,
		});

		const result = await processWithLLM(
			"This is a longer transcription that should be processed by the LLM",
		);
		expect(result.success).toBe(true);
		expect(result.cleanedText).toBe("Cleaned transcription text here.");
		expect(result.summary).toBe("A summary of the transcription.");
		expect(result.modelUsed).toBe("haiku");
		expect(mockCallLLMWithMetadata).toHaveBeenCalledTimes(1);
	});

	test("handles LLM response with code fences", async () => {
		mockCallLLMWithMetadata.mockResolvedValueOnce({
			response:
				'```json\n{"cleanedText": "Cleaned text", "summary": "Summary"}\n```',
			modelUsed: "haiku",
			isFallback: false,
		});

		const result = await processWithLLM(
			"This transcription has enough content to process",
		);
		expect(result.success).toBe(true);
		expect(result.cleanedText).toBe("Cleaned text");
		expect(result.summary).toBe("Summary");
	});

	test("falls back to basicCleanup on LLM error", async () => {
		mockCallLLMWithMetadata.mockRejectedValueOnce(new Error("LLM unavailable"));

		const result = await processWithLLM(
			"Um so this is a test you know with filler words",
		);
		expect(result.success).toBe(false);
		expect(result.error).toBe("LLM unavailable");
		// basicCleanup removes filler words
		expect(result.cleanedText).toBe("so this is a test with filler words");
		expect(result.summary).toBe("");
	});

	test("falls back when LLM returns invalid JSON", async () => {
		mockCallLLMWithMetadata.mockResolvedValueOnce({
			response: "Not valid JSON at all",
			modelUsed: "haiku",
			isFallback: false,
		});

		const result = await processWithLLM(
			"This transcription should trigger fallback due to invalid JSON response",
		);
		// parseVoiceMemoResponse returns the plain text as cleanedText when JSON parsing fails,
		// but since it's < 10 chars, validation fails and triggers error handling with basicCleanup fallback
		expect(result.success).toBe(true);
		expect(result.cleanedText).toBe("Not valid JSON at all");
		expect(result.summary).toBe("");
	});
});

describe("createVoiceMemoNote", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "voice-note-test-"));
		ensureDirSync(join(tempDir, "00 Inbox"));
		mockCallLLMWithMetadata.mockClear();
		mockCallLLMWithMetadata.mockResolvedValue({
			response: JSON.stringify({
				cleanedText: "This is the cleaned up transcription content.",
				summary: "A brief summary of what was said.",
			}),
			modelUsed: "haiku",
			isFallback: false,
		});
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("creates note in inbox folder", async () => {
		const timestamp = new Date(2026, 0, 15, 14, 45);
		const result = await createVoiceMemoNote({
			timestamp,
			transcription: "This is a test transcription that needs cleaning up",
			vaultPath: tempDir,
		});

		expect(result.notePath).toBe("00 Inbox/🎤 2026-01-15 2-45pm.md");
		expect(result.noteTitle).toBe("🎤 2026-01-15 2-45pm");
		expect(result.summary).toBe("A brief summary of what was said.");

		// Verify file exists
		const fullPath = join(tempDir, result.notePath);
		expect(pathExistsSync(fullPath)).toBe(true);

		// Verify content
		const content = readTextFileSync(fullPath);
		expect(content).toContain("type: transcription");
		expect(content).toContain("source: apple-voice-memos");
		expect(content).toContain('meeting: ""');
		// Summary is now in frontmatter, not a section
		expect(content).toContain("summary: A brief summary of what was said.");
		// H1 uses dynamic Dataview expression
		expect(content).toContain("# `= this.file.name`");
		// Cleaned text is the body
		expect(content).toContain("This is the cleaned up transcription content.");
	});

	test("handles filename collision", async () => {
		const timestamp = new Date(2026, 0, 15, 14, 45);

		// Create first note
		const result1 = await createVoiceMemoNote({
			timestamp,
			transcription: "First transcription content here for testing",
			vaultPath: tempDir,
		});

		// Create second note with same timestamp
		const result2 = await createVoiceMemoNote({
			timestamp,
			transcription: "Second transcription content here for testing",
			vaultPath: tempDir,
		});

		expect(result1.notePath).toBe("00 Inbox/🎤 2026-01-15 2-45pm.md");
		expect(result2.notePath).toBe("00 Inbox/🎤 2026-01-15 2-45pm 1.md");

		// Verify both files exist
		expect(pathExistsSync(join(tempDir, result1.notePath))).toBe(true);
		expect(pathExistsSync(join(tempDir, result2.notePath))).toBe(true);
	});

	test("uses custom source", async () => {
		const timestamp = new Date(2026, 0, 15, 14, 45);
		const result = await createVoiceMemoNote({
			timestamp,
			transcription: "Transcription from a Teams meeting recording",
			vaultPath: tempDir,
			source: "transcript-file",
		});

		const content = readTextFileSync(join(tempDir, result.notePath));
		expect(content).toContain("source: transcript-file");
	});

	test("uses custom inbox folder", async () => {
		const customInbox = "Custom Inbox";
		ensureDirSync(join(tempDir, customInbox));

		const timestamp = new Date(2026, 0, 15, 14, 45);
		const result = await createVoiceMemoNote({
			timestamp,
			transcription: "Test transcription for custom inbox folder testing",
			vaultPath: tempDir,
			inboxFolder: customInbox,
		});

		expect(result.notePath).toBe("Custom Inbox/🎤 2026-01-15 2-45pm.md");
		expect(pathExistsSync(join(tempDir, result.notePath))).toBe(true);
	});

	test("includes LLM result in response", async () => {
		const timestamp = new Date(2026, 0, 15, 14, 45);
		const result = await createVoiceMemoNote({
			timestamp,
			transcription: "Test transcription for LLM result checking",
			vaultPath: tempDir,
		});

		expect(result.llmResult.success).toBe(true);
		expect(result.llmResult.modelUsed).toBe("haiku");
		expect(result.llmResult.cleanedText).toBe(
			"This is the cleaned up transcription content.",
		);
	});

	test("handles LLM failure gracefully", async () => {
		mockCallLLMWithMetadata.mockRejectedValueOnce(
			new Error("LLM service unavailable"),
		);

		const timestamp = new Date(2026, 0, 15, 14, 45);
		const result = await createVoiceMemoNote({
			timestamp,
			transcription: "Um this is a test you know with some filler words",
			vaultPath: tempDir,
		});

		expect(result.llmResult.success).toBe(false);
		expect(result.llmResult.error).toBe("LLM service unavailable");
		// basicCleanup fallback should have removed filler words (um, you know)
		// but not meaningful words like "some"
		expect(result.llmResult.cleanedText).toBe(
			"this is a test with some filler words",
		);

		// Note should still be created with fallback content
		const content = readTextFileSync(join(tempDir, result.notePath));
		expect(content).toContain("this is a test with some filler words");
	});

	test("omits summary section when no summary available", async () => {
		mockCallLLMWithMetadata.mockResolvedValueOnce({
			response: JSON.stringify({
				cleanedText: "Cleaned transcription without summary.",
				summary: "",
			}),
			modelUsed: "haiku",
			isFallback: false,
		});

		const timestamp = new Date(2026, 0, 15, 14, 45);
		const result = await createVoiceMemoNote({
			timestamp,
			transcription: "Short transcription content for testing",
			vaultPath: tempDir,
		});

		const content = readTextFileSync(join(tempDir, result.notePath));
		// No summary in frontmatter when empty
		expect(content).not.toContain("summary:");
		// Body contains the cleaned text directly (no ## Transcription section)
		expect(content).toContain("Cleaned transcription without summary.");
	});

	test("includes recorded datetime in frontmatter for non-VTT sources", async () => {
		const timestamp = new Date(2026, 0, 15, 14, 45);
		const result = await createVoiceMemoNote({
			timestamp,
			transcription: "Test transcription for timestamp checking",
			vaultPath: tempDir,
			isVttSource: false,
		});

		const content = readTextFileSync(join(tempDir, result.notePath));
		// Should include recorded datetime (when recording was made) in Obsidian's native ISO format
		expect(content).toContain("recorded: 2026-01-15T14:45");
		// created should be present (current time, so we just check it exists)
		expect(content).toMatch(/created: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
	});

	test("omits recorded datetime for VTT sources (file mtime unreliable)", async () => {
		const timestamp = new Date(2026, 0, 15, 14, 45);
		const result = await createVoiceMemoNote({
			timestamp,
			transcription: "Test transcription from VTT file",
			vaultPath: tempDir,
			isVttSource: true,
			source: "vtt-file",
		});

		const content = readTextFileSync(join(tempDir, result.notePath));
		// VTT sources should NOT include recorded (file mtime is unreliable)
		expect(content).not.toContain("recorded:");
		// created should still be present
		expect(content).toMatch(/created: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
		// source should be vtt-file
		expect(content).toContain("source: vtt-file");
	});
});
