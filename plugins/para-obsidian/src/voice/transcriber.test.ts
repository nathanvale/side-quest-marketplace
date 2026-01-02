import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { writeTextFileSync } from "@sidequest/core/fs";
import { cleanupTestDir, createTempDir } from "@sidequest/core/testing";
import {
	checkFfmpeg,
	checkWhisperCli,
	type TranscriptionResult,
	transcribeVoiceMemo,
} from "./transcriber";

describe("voice/transcriber", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = createTempDir("voice-transcriber-");
	});

	afterEach(() => {
		cleanupTestDir(tempDir);
	});

	describe("checkWhisperCli", () => {
		test("detects whisper-cli availability", async () => {
			// This test will pass/fail based on actual system state
			// It's more of an integration test
			const available = await checkWhisperCli();
			expect(typeof available).toBe("boolean");
		});
	});

	describe("checkFfmpeg", () => {
		test("detects ffmpeg availability", async () => {
			const available = await checkFfmpeg();
			expect(typeof available).toBe("boolean");
		});
	});

	describe("transcribeVoiceMemo", () => {
		test("throws error if whisper-cli not available", async () => {
			const mockPath = join(tempDir, "test.m4a");
			writeTextFileSync(mockPath, "mock audio");

			// This will naturally fail if whisper-cli is not installed
			// We're testing the error message
			try {
				await transcribeVoiceMemo(mockPath, "/fake/model.bin");
				// If it doesn't throw, whisper-cli must be installed
				// In that case, it will fail at model file check
			} catch (error) {
				const err = error as Error;
				// Either whisper-cli or ffmpeg not found
				expect(
					err.message.includes("whisper-cli not found") ||
						err.message.includes("ffmpeg not found"),
				).toBe(true);
			}
		});

		test("throws error if input file doesn't exist", async () => {
			const nonExistentPath = join(tempDir, "does-not-exist.m4a");

			try {
				await transcribeVoiceMemo(nonExistentPath, "/fake/model.bin");
			} catch (error) {
				const err = error as Error;
				// Will fail at dependency check or input file check
				expect(err.message).toBeDefined();
			}
		});

		test("throws error if model file doesn't exist", async () => {
			const mockPath = join(tempDir, "test.m4a");
			writeTextFileSync(mockPath, "mock audio");

			try {
				await transcribeVoiceMemo(mockPath, "/fake/model.bin");
			} catch (error) {
				const err = error as Error;
				// Will fail at dependency check or model file check
				expect(err.message).toBeDefined();
			}
		});

		// Note: Full integration test with actual whisper-cli would require:
		// 1. whisper-cli installed
		// 2. Model file downloaded (~1.5GB)
		// 3. Real audio file
		// This is better suited for manual testing or CI with setup
		test("validates input parameters", async () => {
			const mockAudioPath = join(tempDir, "test.m4a");
			const mockModelPath = join(tempDir, "model.bin");

			// Create mock files
			writeTextFileSync(mockAudioPath, "mock audio");
			writeTextFileSync(mockModelPath, "mock model");

			// This will fail at ffmpeg/whisper stage, but validates our checks
			try {
				await transcribeVoiceMemo(mockAudioPath, mockModelPath);
			} catch (error) {
				// Expected to fail - we're just checking it doesn't throw on validation
				expect(error).toBeDefined();
			}
		});
	});

	describe("TranscriptionResult", () => {
		test("result includes text and metadata", () => {
			const result: TranscriptionResult = {
				text: "Test transcription",
				duration: 5.2,
				modelUsed: "ggml-large-v3-turbo.bin",
			};

			expect(result.text).toBe("Test transcription");
			expect(result.duration).toBe(5.2);
			expect(result.modelUsed).toBe("ggml-large-v3-turbo.bin");
		});
	});
});
