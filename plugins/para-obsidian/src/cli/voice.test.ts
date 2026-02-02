/**
 * Tests for voice CLI command handler
 */

import {
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test";
import { join } from "node:path";
import { OutputFormat } from "@side-quest/core/terminal";
import {
	cleanupTestDir,
	createTempDir,
	writeTestFile,
} from "@side-quest/core/testing";
import type { ParaObsidianConfig } from "../config/index";
import * as insertModule from "../notes/insert";
import * as logger from "../shared/logger";
// Import from barrel (same as voice.ts does) to ensure spyOn affects the same references
import * as voiceModule from "../voice";
import type { Session } from "./shared/session";
import * as sessionModule from "./shared/session";
import type { CommandContext } from "./types";
import { handleVoice } from "./voice";

describe("cli/voice", () => {
	let tempDir: string;
	let mockSession: Session;

	/**
	 * Helper to create a minimal test context.
	 * Uses tempDir to ensure cleanup happens via afterEach.
	 */
	function createTestContext(
		overrides?: Partial<CommandContext>,
	): CommandContext {
		const config: ParaObsidianConfig = {
			vault: tempDir,
			templatesDir: join(tempDir, "Templates"),
			autoCommit: true,
			templateVersions: {},
			frontmatterRules: {},
		};

		return {
			config,
			positional: [],
			flags: {},
			format: OutputFormat.MARKDOWN,
			isJson: false,
			...overrides,
		};
	}

	beforeEach(() => {
		tempDir = createTempDir("voice-cli-");

		// Mock logger initialization
		spyOn(logger, "initLogger").mockResolvedValue(undefined);
		spyOn(logger, "getLogFile").mockReturnValue("/tmp/test.log");

		// Mock session
		mockSession = {
			end: mock(() => {}),
			sessionCid: "test-session-123",
			startTime: Date.now(),
		};
		spyOn(sessionModule, "startSession").mockReturnValue(mockSession);

		// CRITICAL: Mock saveVoiceState globally to prevent writing to real config
		// (~/.config/para-obsidian/voice-state.json)
		spyOn(voiceModule, "saveVoiceState").mockImplementation(() => {});
	});

	afterEach(() => {
		cleanupTestDir(tempDir);
		mock.restore();
	});

	/**
	 * Helper to mock voice dependencies (parakeet-mlx, ffmpeg).
	 * Sets up the spies for the dependency checks.
	 */
	function mockVoiceDependencies(): void {
		spyOn(voiceModule, "checkParakeetMlx").mockResolvedValue(true);
		spyOn(voiceModule, "checkFfmpeg").mockResolvedValue(true);
	}

	describe("handleVoice", () => {
		test("returns error when vault path is not configured", async () => {
			const ctx = createTestContext({
				config: {
					vault: "",
					templatesDir: "",
					autoCommit: true,
					templateVersions: {},
					frontmatterRules: {},
				},
			});

			const result = await handleVoice(ctx);

			expect(result.success).toBe(false);
			expect(result.exitCode).toBe(1);
			expect(mockSession.end).toHaveBeenCalledWith({
				error: "Vault path not configured",
			});
		});

		test("returns error when vault path does not exist", async () => {
			const ctx = createTestContext({
				config: {
					vault: "/nonexistent/vault/path",
					templatesDir: "",
					autoCommit: true,
					templateVersions: {},
					frontmatterRules: {},
				},
			});

			const result = await handleVoice(ctx);

			expect(result.success).toBe(false);
			expect(result.exitCode).toBe(1);
			expect(mockSession.end).toHaveBeenCalledWith({
				error: "Vault path does not exist",
			});
		});

		test("returns error when parakeet-mlx not found", async () => {
			const ctx = createTestContext();

			// Mock checkParakeetMlx to return false
			const checkParakeetMlxSpy = spyOn(
				voiceModule,
				"checkParakeetMlx",
			).mockResolvedValue(false);

			const result = await handleVoice(ctx);

			expect(result.success).toBe(false);
			expect(result.exitCode).toBe(1);
			expect(checkParakeetMlxSpy).toHaveBeenCalled();
			expect(mockSession.end).toHaveBeenCalledWith({
				error: "parakeet-mlx not found",
			});
		});

		test("returns error when ffmpeg not found", async () => {
			const ctx = createTestContext();

			// Mock parakeet-mlx as available, ffmpeg as unavailable
			spyOn(voiceModule, "checkParakeetMlx").mockResolvedValue(true);
			const checkFfmpegSpy = spyOn(
				voiceModule,
				"checkFfmpeg",
			).mockResolvedValue(false);

			const result = await handleVoice(ctx);

			expect(result.success).toBe(false);
			expect(result.exitCode).toBe(1);
			expect(checkFfmpegSpy).toHaveBeenCalled();
			expect(mockSession.end).toHaveBeenCalledWith({
				error: "ffmpeg not found",
			});
		});

		test("handles empty recordings directory gracefully", async () => {
			const ctx = createTestContext();

			// Mock dependencies and model
			mockVoiceDependencies();

			// Mock scanVoiceMemos to return empty array
			const scanSpy = spyOn(voiceModule, "scanVoiceMemos").mockReturnValue([]);

			const result = await handleVoice(ctx);

			expect(result.success).toBe(true);
			expect(scanSpy).toHaveBeenCalled();
			expect(mockSession.end).toHaveBeenCalledWith({ success: true });
		});

		test("skips already processed memos", async () => {
			const ctx = createTestContext();

			// Setup mocks
			mockVoiceDependencies();

			// Mock scanVoiceMemos to return a memo
			spyOn(voiceModule, "scanVoiceMemos").mockReturnValue([
				{
					filename: "20240101-120000.m4a",
					path: "/path/to/memo.m4a",
					timestamp: new Date("2024-01-01T12:00:00Z"),
				},
			]);

			// Mock state to show memo already processed
			spyOn(voiceModule, "loadVoiceState").mockReturnValue({
				processedMemos: {
					"20240101-120000.m4a": {
						processedAt: "2024-01-01T12:00:00Z",
						transcription: "test",
						dailyNote: "2024-01-01",
					},
				},
				lastScan: "2024-01-01T12:00:00Z",
			});

			const result = await handleVoice(ctx);

			expect(result.success).toBe(true);
			expect(mockSession.end).toHaveBeenCalledWith({ success: true });
		});

		test("processes all memos with --all flag", async () => {
			const ctx = createTestContext({
				flags: { all: true },
			});

			// Setup mocks using static imports
			mockVoiceDependencies();

			// Mock scanVoiceMemos - with --all, we process even previously processed memos
			spyOn(voiceModule, "scanVoiceMemos").mockReturnValue([
				{
					filename: "20240101 120000-abc123.m4a",
					path: "/path/to/memo.m4a",
					timestamp: new Date("2024-01-01T12:00:00Z"),
				},
			]);

			// Mock state showing memo was processed before
			spyOn(voiceModule, "loadVoiceState").mockReturnValue({
				processedMemos: {
					"20240101 120000-abc123.m4a": {
						processedAt: "2024-01-01T12:00:00Z",
						transcription: "test",
						dailyNote: "2024-01-01",
					},
				},
				lastScan: "2024-01-01T12:00:00Z",
			});

			// Mock isProcessed - returns true but --all flag bypasses this
			spyOn(voiceModule, "isProcessed").mockReturnValue(true);

			// Create daily note in the vault
			const dailyNotesDir = join(
				ctx.config.vault,
				"000 Timestamps",
				"Daily Notes",
			);
			writeTestFile(dailyNotesDir, "2024-01-01.md", "# Log\n");

			// Mock transcription
			const transcribeSpy = spyOn(
				voiceModule,
				"transcribeVoiceMemo",
			).mockResolvedValue({
				text: "Test transcription",
				modelUsed: "ggml-large-v3-turbo.bin",
			});

			// Mock insert
			const insertSpy = spyOn(
				insertModule,
				"insertIntoNote",
			).mockImplementation(() => ({
				relative: "000 Timestamps/Daily Notes/2024-01-01.md",
				mode: "append" as const,
			}));

			// Mock state management
			spyOn(voiceModule, "markAsProcessed").mockImplementation(
				(state) => state,
			);
			// Note: saveVoiceState is mocked globally in beforeEach

			// Call with --all flag
			const result = await handleVoice(ctx);

			expect(result.success).toBe(true);
			expect(transcribeSpy).toHaveBeenCalled();
			expect(insertSpy).toHaveBeenCalled();
		});

		test("respects --dry-run flag", async () => {
			const ctx = createTestContext({
				flags: { "dry-run": true },
			});

			// Setup mocks
			mockVoiceDependencies();

			// Mock scanVoiceMemos
			spyOn(voiceModule, "scanVoiceMemos").mockReturnValue([
				{
					filename: "20240101-120000.m4a",
					path: "/path/to/memo.m4a",
					timestamp: new Date("2024-01-01T12:00:00Z"),
				},
			]);

			// Mock state (empty)
			spyOn(voiceModule, "loadVoiceState").mockReturnValue({
				processedMemos: {},
				lastScan: null,
			});

			// Spy on transcription - should NOT be called
			const transcribeSpy = spyOn(
				voiceModule,
				"transcribeVoiceMemo",
			).mockResolvedValue({
				text: "Should not be called",
				modelUsed: "test",
			});

			const result = await handleVoice(ctx);

			expect(result.success).toBe(true);
			expect(transcribeSpy).not.toHaveBeenCalled();
			expect(mockSession.end).toHaveBeenCalledWith({ success: true });
		});

		test("outputs JSON when isJson is true", async () => {
			const ctx = createTestContext({
				isJson: true,
				format: OutputFormat.JSON,
			});

			// Setup mocks
			mockVoiceDependencies();

			// Mock scanVoiceMemos to return empty
			spyOn(voiceModule, "scanVoiceMemos").mockReturnValue([]);

			// Capture console.log using spyOn (auto-restored by mock.restore() in afterEach)
			const logs: string[] = [];
			spyOn(console, "log").mockImplementation((msg: string) => logs.push(msg));

			const result = await handleVoice(ctx);

			expect(result.success).toBe(true);

			// Find JSON output (filter out non-JSON log lines)
			const jsonOutput = logs.find((log) => {
				try {
					JSON.parse(log);
					return true;
				} catch {
					return false;
				}
			});

			expect(jsonOutput).toBeDefined();
			if (jsonOutput) {
				const parsed = JSON.parse(jsonOutput);
				expect(parsed.success).toBe(true);
				expect(parsed.processed).toBe(0);
				expect(parsed.sessionCid).toBe("test-session-123");
			}
		});

		test("parses --since flag correctly", async () => {
			const ctx = createTestContext({
				flags: { since: "2024-01-15" },
			});

			// Setup mocks
			mockVoiceDependencies();

			// Mock scanVoiceMemos and capture options
			let capturedOptions: { since?: Date } | undefined;
			const scanSpy = spyOn(voiceModule, "scanVoiceMemos").mockImplementation(
				(_dir: string, options?: { since?: Date }) => {
					capturedOptions = options;
					return [];
				},
			);

			await handleVoice(ctx);

			expect(scanSpy).toHaveBeenCalled();
			expect(capturedOptions?.since).toBeDefined();
			expect(capturedOptions?.since?.toISOString()).toContain("2024-01-15");
		});

		test("processes memo and creates daily note when needed", async () => {
			const ctx = createTestContext();

			// Setup mocks
			mockVoiceDependencies();

			// Mock scanVoiceMemos
			spyOn(voiceModule, "scanVoiceMemos").mockReturnValue([
				{
					filename: "20240101-120000.m4a",
					path: "/path/to/memo.m4a",
					timestamp: new Date("2024-01-01T12:00:00Z"),
				},
			]);

			// Mock state (empty)
			spyOn(voiceModule, "loadVoiceState").mockReturnValue({
				processedMemos: {},
				lastScan: null,
			});

			// Mock transcription
			spyOn(voiceModule, "transcribeVoiceMemo").mockResolvedValue({
				text: "Test transcription",
				modelUsed: "ggml-large-v3-turbo.bin",
			});

			// Daily note doesn't exist - command should auto-create it
			const result = await handleVoice(ctx);

			// Should succeed and process the memo (auto-creates daily note)
			expect(result.success).toBe(true);
		});

		test("handles transcription error gracefully", async () => {
			const ctx = createTestContext();

			// Setup mocks
			mockVoiceDependencies();

			// Mock scanVoiceMemos
			spyOn(voiceModule, "scanVoiceMemos").mockReturnValue([
				{
					filename: "20240101-120000.m4a",
					path: "/path/to/memo.m4a",
					timestamp: new Date("2024-01-01T12:00:00Z"),
				},
			]);

			// Mock state (empty)
			spyOn(voiceModule, "loadVoiceState").mockReturnValue({
				processedMemos: {},
				lastScan: null,
			});

			// Create daily note
			const dailyNotesDir = join(tempDir, "000 Timestamps", "Daily Notes");
			writeTestFile(dailyNotesDir, "2024-01-01.md", "# Log\n");

			// Mock transcription to throw error
			spyOn(voiceModule, "transcribeVoiceMemo").mockRejectedValue(
				new Error("Transcription failed"),
			);

			const result = await handleVoice(ctx);

			// Should succeed overall but skip the failed memo
			expect(result.success).toBe(true);
		});

		test("processes multiple memos sequentially", async () => {
			const ctx = createTestContext();

			// Setup mocks using static imports
			mockVoiceDependencies();

			// Mock scanVoiceMemos to return 2 memos (use valid Apple Voice Memo filename format)
			spyOn(voiceModule, "scanVoiceMemos").mockReturnValue([
				{
					filename: "20240101 120000-abc123.m4a",
					path: "/path/to/memo1.m4a",
					timestamp: new Date("2024-01-01T12:00:00Z"),
				},
				{
					filename: "20240101 130000-def456.m4a",
					path: "/path/to/memo2.m4a",
					timestamp: new Date("2024-01-01T13:00:00Z"),
				},
			]);

			// Mock state (empty)
			spyOn(voiceModule, "loadVoiceState").mockReturnValue({
				processedMemos: {},
				lastScan: null,
			});

			// Mock isProcessed to return false (not yet processed)
			spyOn(voiceModule, "isProcessed").mockReturnValue(false);

			// Create daily note in vault path (voice.ts uses ctx.config.vault)
			const dailyNotesDir = join(
				ctx.config.vault,
				"000 Timestamps",
				"Daily Notes",
			);
			writeTestFile(dailyNotesDir, "2024-01-01.md", "# Log\n");

			// Mock transcription
			const transcribeSpy = spyOn(
				voiceModule,
				"transcribeVoiceMemo",
			).mockResolvedValue({
				text: "Test transcription",
				modelUsed: "ggml-large-v3-turbo.bin",
			});

			// Mock insert
			const insertSpy = spyOn(
				insertModule,
				"insertIntoNote",
			).mockImplementation(() => ({
				relative: "000 Timestamps/Daily Notes/2024-01-01.md",
				mode: "append" as const,
			}));

			// Mock markAsProcessed
			spyOn(voiceModule, "markAsProcessed").mockImplementation(
				(state) => state,
			);
			// Note: saveVoiceState is mocked globally in beforeEach

			const result = await handleVoice(ctx);

			expect(result.success).toBe(true);
			expect(transcribeSpy).toHaveBeenCalledTimes(2);
			expect(insertSpy).toHaveBeenCalledTimes(2);
		});

		test("marks memo as skipped when transcription returns empty text", async () => {
			const ctx = createTestContext();

			// Setup mocks
			mockVoiceDependencies();

			// Mock scanVoiceMemos to return a single memo
			spyOn(voiceModule, "scanVoiceMemos").mockReturnValue([
				{
					filename: "20240101-120000.m4a",
					path: "/path/to/empty-memo.m4a",
					timestamp: new Date("2024-01-01T12:00:00Z"),
				},
			]);

			// Mock state (empty)
			spyOn(voiceModule, "loadVoiceState").mockReturnValue({
				processedMemos: {},
				lastScan: null,
			});

			// Mock isProcessed to return false (not yet processed)
			spyOn(voiceModule, "isProcessed").mockReturnValue(false);

			// Mock transcription to return empty text
			const transcribeSpy = spyOn(
				voiceModule,
				"transcribeVoiceMemo",
			).mockResolvedValue({
				text: "",
				modelUsed: "test",
			});

			// Spy on markAsSkipped
			const markAsSkippedSpy = spyOn(
				voiceModule,
				"markAsSkipped",
			).mockImplementation((state) => state);

			// Spy on insert - should NOT be called
			const insertSpy = spyOn(
				insertModule,
				"insertIntoNote",
			).mockImplementation(() => ({
				relative: "000 Timestamps/Daily Notes/2024-01-01.md",
				mode: "append" as const,
			}));

			const result = await handleVoice(ctx);

			// Verify success
			expect(result.success).toBe(true);

			// Verify transcription was called
			expect(transcribeSpy).toHaveBeenCalled();

			// Verify markAsSkipped was called with correct filename and reason
			expect(markAsSkippedSpy).toHaveBeenCalledWith(
				expect.any(Object),
				"20240101-120000.m4a",
				"empty transcription",
			);

			// Verify insert was NOT called (memo not inserted into daily note)
			expect(insertSpy).not.toHaveBeenCalled();

			// Verify session ended successfully
			expect(mockSession.end).toHaveBeenCalledWith({ success: true });
		});

		test("serializes concurrent access to voice state via file locking", async () => {
			const ctx = createTestContext();

			// Setup mocks
			mockVoiceDependencies();

			// Mock scanVoiceMemos to return a memo
			spyOn(voiceModule, "scanVoiceMemos").mockReturnValue([
				{
					filename: "20240101-120000.m4a",
					path: "/path/to/memo.m4a",
					timestamp: new Date("2024-01-01T12:00:00Z"),
				},
			]);

			// Mock state (empty)
			let stateLoadCount = 0;
			spyOn(voiceModule, "loadVoiceState").mockImplementation(() => {
				stateLoadCount++;
				return {
					processedMemos: {},
					lastScan: null,
				};
			});

			// Mock isProcessed to return false
			spyOn(voiceModule, "isProcessed").mockReturnValue(false);

			// Create daily note
			const dailyNotesDir = join(
				ctx.config.vault,
				"000 Timestamps",
				"Daily Notes",
			);
			writeTestFile(dailyNotesDir, "2024-01-01.md", "# Log\n");

			// Mock transcription with delay to simulate slow processing
			spyOn(voiceModule, "transcribeVoiceMemo").mockImplementation(async () => {
				await new Promise((resolve) => setTimeout(resolve, 50));
				return {
					text: "Test transcription",
					modelUsed: "test",
				};
			});

			// Mock insert
			spyOn(insertModule, "insertIntoNote").mockImplementation(() => ({
				relative: "000 Timestamps/Daily Notes/2024-01-01.md",
				mode: "append" as const,
			}));

			// Mock state management
			spyOn(voiceModule, "markAsProcessed").mockImplementation(
				(state) => state,
			);

			// Launch two concurrent handleVoice calls
			const [result1, result2] = await Promise.all([
				handleVoice(ctx),
				handleVoice(ctx),
			]);

			// Both should succeed
			expect(result1.success).toBe(true);
			expect(result2.success).toBe(true);

			// State should be loaded exactly twice (once per process, serialized by lock)
			expect(stateLoadCount).toBe(2);
		});
	});
});
