/**
 * Tests for voice memo note creation.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { join } from "node:path";
import { pathExistsSync, readTextFileSync } from "@sidequest/core/fs";
import { createTempDir } from "@sidequest/core/testing";

// Mock the LLM client before importing the module
mock.module("../inbox/core/llm/client.js", () => ({
	callLLMWithMetadata: mock(
		async () =>
			({
				response: JSON.stringify({
					cleanedText: "This is cleaned text.",
					summary: "Test summary",
				}),
				modelUsed: "test-model",
				isFallback: false,
			}) as any,
	),
}));

// Mock the logger before importing the module
mock.module("../shared/logger.js", () => ({
	voiceLogger: {
		info: mock(() => {}),
		debug: mock(() => {}),
		warn: mock(() => {}),
		error: mock(() => {}),
	},
	createCorrelationId: mock(() => "test-cid"),
}));

import { callLLMWithMetadata } from "../inbox/core/llm/client.js";
import { createCorrelationId, voiceLogger } from "../shared/logger.js";
import {
	basicCleanup,
	createVoiceMemoNote,
	formatFilenameTime,
	generateNoteTitle,
	processWithLLM,
} from "./note-creator.js";

describe("formatFilenameTime", () => {
	test("formats time correctly for morning", () => {
		const date = new Date("2025-01-22T09:15:00");
		expect(formatFilenameTime(date)).toBe("9-15am");
	});

	test("formats time correctly for afternoon", () => {
		const date = new Date("2025-01-22T14:30:00");
		expect(formatFilenameTime(date)).toBe("2-30pm");
	});

	test("formats time correctly for midnight", () => {
		const date = new Date("2025-01-22T00:00:00");
		expect(formatFilenameTime(date)).toBe("12-00am");
	});

	test("formats time correctly for noon", () => {
		const date = new Date("2025-01-22T12:00:00");
		expect(formatFilenameTime(date)).toBe("12-00pm");
	});
});

describe("generateNoteTitle", () => {
	test("generates correct title format", () => {
		const date = new Date("2025-01-22T14:30:00");
		const title = generateNoteTitle(date);
		expect(title).toMatch(/🎤 \d{4}-\d{2}-\d{2} \d{1,2}-\d{2}[ap]m/);
	});

	test("includes emoji prefix", () => {
		const date = new Date("2025-01-22T14:30:00");
		const title = generateNoteTitle(date);
		expect(title).toStartWith("🎤 ");
	});
});

describe("basicCleanup", () => {
	test("removes filler words", () => {
		const text = "um so like I think you know that um";
		const cleaned = basicCleanup(text);
		expect(cleaned).toBe("so I think that");
	});

	test("normalizes whitespace", () => {
		const text = "hello    world   test";
		const cleaned = basicCleanup(text);
		expect(cleaned).toBe("hello world test");
	});

	test("removes leading/trailing whitespace", () => {
		const text = "  hello world  ";
		const cleaned = basicCleanup(text);
		expect(cleaned).toBe("hello world");
	});
});

describe("processWithLLM", () => {
	afterEach(() => {
		// Clear all mocks after each test
		(callLLMWithMetadata as any).mockClear();
		(voiceLogger.info as any).mockClear();
		(voiceLogger.debug as any).mockClear();
		(voiceLogger.warn as any).mockClear();
		(voiceLogger.error as any).mockClear();
		(createCorrelationId as any).mockClear();
	});

	test("skips very short transcriptions", async () => {
		const result = await processWithLLM("hi");
		expect(result.cleanedText).toBe("hi");
		expect(result.summary).toBe("");
		expect(result.success).toBe(true);
		expect(callLLMWithMetadata).not.toHaveBeenCalled();
	});

	test("processes normal transcription with LLM", async () => {
		const transcription = "this is a test transcription that is long enough";
		const result = await processWithLLM(transcription);

		expect(result.success).toBe(true);
		expect(result.cleanedText).toBe("This is cleaned text.");
		expect(result.summary).toBe("Test summary");
		expect(callLLMWithMetadata).toHaveBeenCalledTimes(1);
	});

	test("falls back to basic cleanup on LLM error", async () => {
		(callLLMWithMetadata as any).mockRejectedValueOnce(new Error("LLM error"));

		const transcription = "um this is um a test";
		const result = await processWithLLM(transcription);

		expect(result.success).toBe(false);
		expect(result.cleanedText).toBe("this is a test");
		expect(result.error).toContain("LLM error");
	});

	test("handles VTT source flag", async () => {
		const transcription = "Speaker: this is a test transcription with speaker";
		await processWithLLM(transcription, { isVttSource: true });

		expect(callLLMWithMetadata).toHaveBeenCalledTimes(1);
		const prompt = (callLLMWithMetadata as any).mock.calls[0]?.[0];
		expect(prompt).toContain("CRITICAL: Preserve ALL speaker labels");
	});
});

describe("createVoiceMemoNote", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = createTempDir("voice-note-test-");
		// Reset mock implementation to default before each test
		(callLLMWithMetadata as any).mockImplementation(
			async () =>
				({
					response: JSON.stringify({
						cleanedText: "This is cleaned text.",
						summary: "Test summary",
					}),
					modelUsed: "test-model",
					isFallback: false,
				}) as any,
		);
	});

	afterEach(() => {
		// Clear all mocks after each test
		(callLLMWithMetadata as any).mockClear();
		(voiceLogger.info as any).mockClear();
		(voiceLogger.debug as any).mockClear();
		(voiceLogger.warn as any).mockClear();
		(voiceLogger.error as any).mockClear();
		(createCorrelationId as any).mockClear();
	});

	test("creates note in inbox folder", async () => {
		const timestamp = new Date("2025-01-22T14:30:00");
		const transcription = "this is a test voice memo transcription";

		const result = await createVoiceMemoNote({
			timestamp,
			transcription,
			vaultPath: tempDir,
		});

		expect(result.notePath).toMatch(/00 Inbox\/🎤 \d{4}-\d{2}-\d{2}/);
		expect(result.noteTitle).toMatch(/🎤 \d{4}-\d{2}-\d{2}/);
		expect(result.summary).toBe("Test summary");

		const notePath = join(tempDir, result.notePath);
		expect(pathExistsSync(notePath)).toBe(true);
	});

	test("includes frontmatter with metadata", async () => {
		const timestamp = new Date("2025-01-22T14:30:00");
		// Use a longer transcription to trigger LLM processing (>20 chars)
		const transcription =
			"this is a longer test transcription that will trigger LLM processing";

		const result = await createVoiceMemoNote({
			timestamp,
			transcription,
			vaultPath: tempDir,
		});

		const notePath = join(tempDir, result.notePath);
		const content = readTextFileSync(notePath);

		expect(content).toContain("type: transcription");
		expect(content).toContain("source: apple-voice-memos");
		expect(content).toContain("recorded:");
		expect(content).toContain("summary: Test summary");
		expect(content).toContain("template_version: 1");
		expect(content).toContain("areas: []");
		expect(content).toContain("projects: []");
	});

	test("handles filename collisions", async () => {
		const timestamp = new Date("2025-01-22T14:30:00");
		const transcription = "test transcription";

		// Create first note
		const result1 = await createVoiceMemoNote({
			timestamp,
			transcription,
			vaultPath: tempDir,
		});

		// Create second note with same timestamp
		const result2 = await createVoiceMemoNote({
			timestamp,
			transcription,
			vaultPath: tempDir,
		});

		expect(result1.notePath).not.toBe(result2.notePath);
		expect(result2.notePath).toContain(" 1.md");

		const notePath1 = join(tempDir, result1.notePath);
		const notePath2 = join(tempDir, result2.notePath);

		expect(pathExistsSync(notePath1)).toBe(true);
		expect(pathExistsSync(notePath2)).toBe(true);
	});

	test("skips LLM for VTT sources", async () => {
		const timestamp = new Date("2025-01-22T14:30:00");
		const transcription = "Speaker: This is VTT content";

		const result = await createVoiceMemoNote({
			timestamp,
			transcription,
			vaultPath: tempDir,
			isVttSource: true,
		});

		expect(result.llmResult.success).toBe(true);
		expect(callLLMWithMetadata).not.toHaveBeenCalled();

		const notePath = join(tempDir, result.notePath);
		const content = readTextFileSync(notePath);

		// VTT sources should not have 'recorded' field
		expect(content).not.toContain("recorded:");
	});

	test("uses custom inbox folder when provided", async () => {
		const timestamp = new Date("2025-01-22T14:30:00");
		const transcription = "test transcription";

		const result = await createVoiceMemoNote({
			timestamp,
			transcription,
			vaultPath: tempDir,
			inboxFolder: "Custom Inbox",
		});

		expect(result.notePath).toContain("Custom Inbox");
	});

	test("uses custom source when provided", async () => {
		const timestamp = new Date("2025-01-22T14:30:00");
		const transcription = "test transcription";

		const result = await createVoiceMemoNote({
			timestamp,
			transcription,
			vaultPath: tempDir,
			source: "custom-source",
		});

		const notePath = join(tempDir, result.notePath);
		const content = readTextFileSync(notePath);

		expect(content).toContain("source: custom-source");
	});
});
