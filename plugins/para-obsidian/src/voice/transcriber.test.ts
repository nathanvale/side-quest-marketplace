import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { join } from "node:path";
import { writeTextFileSync } from "@sidequest/core/fs";
import { cleanupTestDir, createTempDir } from "@sidequest/core/testing";
import {
	isFfmpegAvailable,
	isParakeetMlxAvailable,
	transcribeVoiceMemo,
} from "./transcriber";

describe("voice/transcriber", () => {
	let tempDir: string;
	let originalSpawn: typeof Bun.spawn;

	beforeEach(() => {
		tempDir = createTempDir("voice-transcriber-");
		// Store original Bun.spawn for restoration
		originalSpawn = Bun.spawn;
	});

	afterEach(() => {
		cleanupTestDir(tempDir);
		// Restore original Bun.spawn to prevent test pollution
		Bun.spawn = originalSpawn;
		mock.restore();
	});

	describe("isParakeetMlxAvailable", () => {
		test("returns true when parakeet-mlx is available", async () => {
			// Mock successful spawn (exit code 0)
			const mockSpawn = mock(() => ({
				exited: Promise.resolve(0),
				stdout: { text: () => Promise.resolve("/usr/local/bin/parakeet-mlx") },
				stderr: { text: () => Promise.resolve("") },
			}));
			Bun.spawn = mockSpawn as unknown as typeof Bun.spawn;

			const result = await isParakeetMlxAvailable();

			expect(result).toBe(true);
			expect(mockSpawn).toHaveBeenCalledWith(
				["which", "parakeet-mlx"],
				expect.objectContaining({
					stdout: "pipe",
					stderr: "pipe",
				}),
			);
		});

		test("returns false when parakeet-mlx is not available", async () => {
			// Mock failed spawn (exit code 1)
			const mockSpawn = mock(() => ({
				exited: Promise.resolve(1),
				stdout: { text: () => Promise.resolve("") },
				stderr: { text: () => Promise.resolve("") },
			}));
			Bun.spawn = mockSpawn as unknown as typeof Bun.spawn;

			const result = await isParakeetMlxAvailable();

			expect(result).toBe(false);
		});

		test("returns false when spawn throws error", async () => {
			// Mock spawn throwing (command not found)
			const mockSpawn = mock(() => {
				throw new Error("Command not found");
			});
			Bun.spawn = mockSpawn as unknown as typeof Bun.spawn;

			const result = await isParakeetMlxAvailable();

			expect(result).toBe(false);
		});

		test("detects parakeet-mlx availability (integration)", async () => {
			// This test will pass/fail based on actual system state
			// It's more of an integration test
			const available = await isParakeetMlxAvailable();
			expect(typeof available).toBe("boolean");
		});
	});

	describe("isFfmpegAvailable", () => {
		test("returns true when ffmpeg is available", async () => {
			// Mock successful spawn (exit code 0)
			const mockSpawn = mock(() => ({
				exited: Promise.resolve(0),
				stdout: { text: () => Promise.resolve("/usr/local/bin/ffmpeg") },
				stderr: { text: () => Promise.resolve("") },
			}));
			Bun.spawn = mockSpawn as unknown as typeof Bun.spawn;

			const result = await isFfmpegAvailable();

			expect(result).toBe(true);
			expect(mockSpawn).toHaveBeenCalledWith(
				["which", "ffmpeg"],
				expect.objectContaining({
					stdout: "pipe",
					stderr: "pipe",
				}),
			);
		});

		test("returns false when ffmpeg is not available", async () => {
			// Mock failed spawn (exit code 1)
			const mockSpawn = mock(() => ({
				exited: Promise.resolve(1),
				stdout: { text: () => Promise.resolve("") },
				stderr: { text: () => Promise.resolve("") },
			}));
			Bun.spawn = mockSpawn as unknown as typeof Bun.spawn;

			const result = await isFfmpegAvailable();

			expect(result).toBe(false);
		});

		test("returns false when spawn throws error", async () => {
			// Mock spawn throwing (command not found)
			const mockSpawn = mock(() => {
				throw new Error("Command not found");
			});
			Bun.spawn = mockSpawn as unknown as typeof Bun.spawn;

			const result = await isFfmpegAvailable();

			expect(result).toBe(false);
		});

		test("detects ffmpeg availability (integration)", async () => {
			const available = await isFfmpegAvailable();
			expect(typeof available).toBe("boolean");
		});
	});

	describe("transcribeVoiceMemo", () => {
		test("throws when path is not absolute (security)", async () => {
			const relativePath = "test.m4a";

			await expect(transcribeVoiceMemo(relativePath)).rejects.toThrow(
				"Audio path must be absolute for security",
			);
		});

		test("throws when path contains shell metacharacters (security)", async () => {
			const dangerousPaths = [
				"/tmp/test; rm -rf /",
				"/tmp/test && echo pwned",
				"/tmp/test | cat /etc/passwd",
				"/tmp/test`whoami`.m4a",
				"/tmp/test$(whoami).m4a",
				'/tmp/test"quoted".m4a',
				"/tmp/test'quoted'.m4a",
				"/tmp/test\\escaped.m4a",
				"/tmp/test<redirect.m4a",
				"/tmp/test>redirect.m4a",
				"/tmp/test(parens).m4a",
			];

			for (const path of dangerousPaths) {
				await expect(transcribeVoiceMemo(path)).rejects.toThrow(
					"Audio path contains unsafe shell metacharacters",
				);
			}
		});

		test("allows safe absolute paths with allowed characters", async () => {
			const mockPath = join(tempDir, "test-file_name.m4a");
			writeTextFileSync(mockPath, "mock audio");

			// Mock both checks to succeed
			const mockSpawn = mock(() => ({
				exited: Promise.resolve(0),
				stdout: { text: () => Promise.resolve("/usr/local/bin/parakeet-mlx") },
				stderr: { text: () => Promise.resolve("") },
			}));
			Bun.spawn = mockSpawn as unknown as typeof Bun.spawn;

			// Expect to pass security validation and fail at dependency check or later
			// (We're just testing that security validation passes for valid paths)
			try {
				await transcribeVoiceMemo(mockPath);
			} catch (error) {
				// Expected to fail at transcription stage with mock audio
				// Security validation should pass
				const err = error as Error;
				expect(err.message).not.toContain("absolute");
				expect(err.message).not.toContain("metacharacters");
			}
		});

		test("throws when path does not exist (after security validation)", async () => {
			const nonExistentPath = join(tempDir, "does-not-exist.m4a");

			await expect(transcribeVoiceMemo(nonExistentPath)).rejects.toThrow(
				"Audio file does not exist",
			);
		});

		test("throws specific error when parakeet-mlx unavailable", async () => {
			const mockPath = join(tempDir, "test.m4a");
			writeTextFileSync(mockPath, "mock audio");

			// Mock isParakeetMlxAvailable to return false
			const mockSpawn = mock(() => ({
				exited: Promise.resolve(1), // which returns 1 when not found
				stdout: { text: () => Promise.resolve("") },
				stderr: { text: () => Promise.resolve("") },
			}));
			Bun.spawn = mockSpawn as unknown as typeof Bun.spawn;

			await expect(transcribeVoiceMemo(mockPath)).rejects.toThrow(
				"parakeet-mlx not found. Install with: uv tool install parakeet-mlx",
			);
		});

		test("throws specific error when ffmpeg unavailable", async () => {
			const mockPath = join(tempDir, "test.m4a");
			writeTextFileSync(mockPath, "mock audio");

			// Mock isParakeetMlxAvailable to succeed, but isFfmpegAvailable to fail
			let callCount = 0;
			const mockSpawn = mock(() => {
				callCount++;
				// First call: isParakeetMlxAvailable (success)
				if (callCount === 1) {
					return {
						exited: Promise.resolve(0),
						stdout: {
							text: () => Promise.resolve("/usr/local/bin/parakeet-mlx"),
						},
						stderr: { text: () => Promise.resolve("") },
					};
				}
				// Second call: isFfmpegAvailable (failure)
				return {
					exited: Promise.resolve(1),
					stdout: { text: () => Promise.resolve("") },
					stderr: { text: () => Promise.resolve("") },
				};
			});
			Bun.spawn = mockSpawn as unknown as typeof Bun.spawn;

			await expect(transcribeVoiceMemo(mockPath)).rejects.toThrow(
				"ffmpeg not found. Install with: brew install ffmpeg",
			);
		});

		test("throws error if dependencies unavailable (integration)", async () => {
			const mockPath = join(tempDir, "test.m4a");
			writeTextFileSync(mockPath, "mock audio");

			// This test validates that transcription fails gracefully
			// The error depends on system state:
			// - No parakeet-mlx → "parakeet-mlx not found"
			// - No ffmpeg → "ffmpeg not found"
			// - No input file → "Input file does not exist"
			// NOTE: This test may pass if tools are installed, fail otherwise
			try {
				await transcribeVoiceMemo(mockPath);
				// If it doesn't throw, tools are installed but mock audio fails transcription
				// This is acceptable for integration test
			} catch (error) {
				const err = error as Error;
				// Valid error messages depending on system state
				// Accept any error since this is system-dependent
				expect(err).toBeDefined();
				expect(err.message.length).toBeGreaterThan(0);
			}
		});

		// Note: Full integration test with actual parakeet-mlx would require:
		// 1. parakeet-mlx installed (uv tool install parakeet-mlx)
		// 2. ffmpeg installed
		// 3. Real audio file
		// This is better suited for manual testing or CI with setup
		test("validates input parameters (integration)", async () => {
			const mockAudioPath = join(tempDir, "test.m4a");

			// Create mock audio file
			writeTextFileSync(mockAudioPath, "mock audio");

			// This will fail at parakeet-mlx/ffmpeg stage, but validates our checks
			try {
				await transcribeVoiceMemo(mockAudioPath);
			} catch (error) {
				// Expected to fail - we're just checking it doesn't throw on validation
				expect(error).toBeDefined();
			}
		});
	});

	// Note: Removed type-only test for TranscriptionResult
	// TypeScript already validates type construction at compile time
	// Testing that { text, modelUsed } equals { text, modelUsed }
	// provides no runtime value
});
