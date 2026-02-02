/**
 * Tests for enrich CLI command
 *
 * Covers router logic, target validation, observability, dry-run mode,
 * and JSON output formatting.
 *
 * @module cli/enrich.test
 */

import { afterAll, afterEach, describe, expect, mock, test } from "bun:test";
import { join } from "node:path";
import { OutputFormat } from "@side-quest/core/terminal";
import { loadConfig } from "../config/index";
import {
	createTestVault,
	useTestVaultCleanup,
	writeVaultFile,
} from "../testing/utils";
import { handleEnrich } from "./enrich";
import type { CommandContext } from "./types";

// =============================================================================
// Mock Enrichment Pipeline
// =============================================================================

const mockProcessFile = mock(async () => ({
	enriched: true,
	strategyId: "youtube",
	result: {
		type: "youtube",
		transcript: "Mocked transcript content",
		title: "Mocked Video Title",
	},
}));

mock.module("../inbox/enrich/pipeline", () => ({
	createEnrichmentPipeline: () => ({
		processFile: mockProcessFile,
	}),
	DEFAULT_ENRICHMENT_STRATEGIES: [],
}));

// =============================================================================
// Mock Session Tracking
// =============================================================================

const mockEndSession = mock(() => {});
const mockStartSession = mock(() => ({
	sessionCid: "test-session-123",
	startTime: Date.now(),
	end: mockEndSession,
}));

mock.module("./shared/session", () => ({
	startSession: mockStartSession,
}));

// =============================================================================
// Mock globFiles to avoid Bun.Glob issues in test environment
// =============================================================================

import { readdirSync } from "node:fs";
import { join as pathJoin } from "node:path";

/**
 * Mock globFiles that matches real API behavior:
 * - Accepts (pattern, options) where options can be string (cwd) or { cwd: string }
 * - Returns ABSOLUTE paths (enrich.ts expects this - see line 198: const absolutePath = file)
 * - Supports recursive **\/*.md pattern matching
 */
const mockGlobFiles = async (
	pattern: string,
	options?: string | { cwd?: string },
) => {
	// Normalize options - real impl accepts string or object
	const cwd =
		typeof options === "string" ? options : (options?.cwd ?? process.cwd());

	const files: string[] = [];

	// Recursive directory scanner
	function scanDir(dir: string) {
		try {
			const entries = readdirSync(dir, { withFileTypes: true });
			for (const entry of entries) {
				const fullPath = pathJoin(dir, entry.name);

				if (entry.isDirectory()) {
					// Recurse into subdirectories
					scanDir(fullPath);
				} else if (entry.isFile() && entry.name.endsWith(".md")) {
					// Return ABSOLUTE paths (what enrich.ts expects)
					files.push(fullPath);
				}
			}
		} catch {
			// Skip directories that can't be read
		}
	}

	try {
		scanDir(cwd);
		return files;
	} catch {
		return [];
	}
};

mock.module("@side-quest/core/glob", () => ({
	globFiles: mockGlobFiles,
}));

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create test CommandContext with defaults
 */
function createTestContext(overrides: {
	subcommand?: string;
	positional?: string[];
	flags?: Record<string, string | boolean>;
	isJson?: boolean;
}): CommandContext {
	// Ensure PARA_VAULT is set before loading config
	const vault = process.env.PARA_VAULT;
	if (!vault) {
		throw new Error(
			"PARA_VAULT environment variable must be set in beforeEach",
		);
	}

	const config = loadConfig();

	return {
		config,
		positional: overrides.positional ?? [],
		flags: overrides.flags ?? {},
		format: overrides.isJson ? OutputFormat.JSON : OutputFormat.MARKDOWN,
		isJson: overrides.isJson ?? false,
		subcommand: overrides.subcommand,
	};
}

/**
 * Capture console.log output for async functions.
 *
 * Uses try/finally to ensure console.log is always restored,
 * even if fn() throws an error.
 */
async function captureConsoleOutputAsync(
	fn: () => Promise<void>,
): Promise<string[]> {
	const logs: string[] = [];
	const originalLog = console.log;

	try {
		console.log = (...args: unknown[]) =>
			logs.push(args.map((a) => String(a)).join(" "));
		await fn();
	} finally {
		console.log = originalLog;
	}

	return logs;
}

/**
 * Find and parse JSON from console logs.
 *
 * Handles both single-line and multi-line JSON output.
 * Combines consecutive lines that appear to be part of a JSON object.
 */
function findJsonOutput(logs: string[]): unknown {
	// First try: parse each log line individually
	for (const log of logs) {
		try {
			if (log.trim().startsWith("{")) {
				return JSON.parse(log);
			}
		} catch {
			// Not single-line JSON, continue
		}
	}

	// Second try: combine all logs and parse as multi-line JSON
	try {
		const combined = logs.join("\n");
		if (combined.trim().startsWith("{")) {
			return JSON.parse(combined);
		}
	} catch {
		// Not multi-line JSON either
	}

	throw new Error("No JSON output found in logs");
}

// =============================================================================
// Tests
// =============================================================================

describe("handleEnrich", () => {
	const { trackVault, getAfterEachHook } = useTestVaultCleanup();

	/**
	 * Helper to create and track a vault for the current test
	 */
	function setupVault(): string {
		const vault = createTestVault();
		trackVault(vault);
		return vault;
	}

	afterEach(() => {
		getAfterEachHook()();
		mockProcessFile.mockClear();
		mockStartSession.mockClear();
		mockEndSession.mockClear();
	});

	afterAll(() => {
		// Restore all module mocks to prevent global state pollution
		mock.restore();
		// Also clear individual mock functions
		mockProcessFile.mockClear();
		mockStartSession.mockClear();
		mockEndSession.mockClear();
	});

	describe("router", () => {
		test("shows usage when no action specified (markdown)", async () => {
			setupVault();
			const ctx = createTestContext({ isJson: false });

			const logs = await captureConsoleOutputAsync(async () => {
				await handleEnrich(ctx);
			});

			const output = logs.join("\n");
			expect(output).toContain("No action specified");
			expect(output).toContain("Available actions:");
			expect(output).toContain("youtube");
		});

		test("shows usage when no action specified (JSON)", async () => {
			setupVault();
			const ctx = createTestContext({ isJson: true });

			const logs = await captureConsoleOutputAsync(async () => {
				await handleEnrich(ctx);
			});

			const jsonOutput = findJsonOutput(logs) as Record<string, unknown>;
			expect(jsonOutput.success).toBe(false);
			expect(jsonOutput.error).toContain("No action specified");
			expect(jsonOutput.availableActions).toContain("youtube");
		});

		test("returns error for unknown action", async () => {
			setupVault();
			const ctx = createTestContext({
				subcommand: "invalid-action",
				isJson: false,
			});

			const result = await handleEnrich(ctx);

			expect(result.success).toBe(false);
			expect(result.error).toContain("Unknown enrich action");
			expect(result.error).toContain("invalid-action");
		});

		test("routes to youtube handler", async () => {
			setupVault();
			const ctx = createTestContext({
				subcommand: "youtube",
				flags: { all: true },
				isJson: true,
			});

			const result = await handleEnrich(ctx);

			expect(result.success).toBe(true);
			expect(mockStartSession).toHaveBeenCalledWith(
				"para enrich youtube",
				expect.objectContaining({ silent: true }),
			);
		});
	});

	describe("target validation", () => {
		test("requires explicit target or --all flag", async () => {
			setupVault();
			const ctx = createTestContext({
				subcommand: "youtube",
				flags: {},
				isJson: false,
			});

			const result = await handleEnrich(ctx);

			expect(result.success).toBe(false);
			expect(result.error).toContain("Specify a file path or use --all");
		});

		test("accepts file path as target", async () => {
			const vault = setupVault();
			// Create test file with YouTube frontmatter
			writeVaultFile(
				vault,
				"00 Inbox/test-video.md",
				`---
type: youtube
video_id: AmdLVWMdjOk
title: Test Video
transcript_status: pending
created: 2024-01-01T00:00:00Z
---
# Test Video`,
			);

			const ctx = createTestContext({
				subcommand: "youtube",
				positional: ["00 Inbox/test-video.md"],
				flags: { dryRun: true },
				isJson: true,
			});

			const logs = await captureConsoleOutputAsync(async () => {
				await handleEnrich(ctx);
			});

			const jsonOutput = findJsonOutput(logs) as Record<string, unknown>;
			expect(jsonOutput.candidates).toBeDefined();
			expect(jsonOutput.count).toBe(1);
		});

		test("rejects file with wrong type", async () => {
			const vault = setupVault();
			writeVaultFile(
				vault,
				"00 Inbox/not-youtube.md",
				`---
type: bookmark
url: https://example.com
---
# Bookmark`,
			);

			const ctx = createTestContext({
				subcommand: "youtube",
				positional: ["00 Inbox/not-youtube.md"],
				isJson: false,
			});

			const result = await handleEnrich(ctx);

			expect(result.success).toBe(false);
			expect(result.error).toContain("not a YouTube note");
		});

		test("rejects already enriched file", async () => {
			const vault = setupVault();
			writeVaultFile(
				vault,
				"00 Inbox/enriched.md",
				`---
type: youtube
video_id: AmdLVWMdjOk
enrichedAt: 2024-01-01T00:00:00Z
---
# Already Enriched`,
			);

			const ctx = createTestContext({
				subcommand: "youtube",
				positional: ["00 Inbox/enriched.md"],
				isJson: true,
			});

			const logs = await captureConsoleOutputAsync(async () => {
				await handleEnrich(ctx);
			});

			const jsonOutput = findJsonOutput(logs) as Record<string, unknown>;
			expect(jsonOutput.success).toBe(true);
			expect(jsonOutput.enriched).toBe(false);
			expect(jsonOutput.message).toContain("Already enriched");
		});

		test("accepts --all flag", async () => {
			setupVault();
			const ctx = createTestContext({
				subcommand: "youtube",
				flags: { all: true },
				isJson: true,
			});

			const result = await handleEnrich(ctx);

			expect(result.success).toBe(true);
		});
	});

	describe("candidate discovery", () => {
		test("finds YouTube notes without enrichedAt", async () => {
			const vault = setupVault();
			writeVaultFile(
				vault,
				"00 Inbox/video1.md",
				`---
type: youtube
video_id: video1
transcript_status: pending
---`,
			);
			writeVaultFile(
				vault,
				"00 Inbox/video2.md",
				`---
type: youtube
video_id: video2
transcript_status: pending
---`,
			);
			writeVaultFile(
				vault,
				"00 Inbox/other.md",
				`---
type: bookmark
---`,
			);

			const ctx = createTestContext({
				subcommand: "youtube",
				flags: { all: true, dryRun: true },
				isJson: true,
			});

			const logs = await captureConsoleOutputAsync(async () => {
				await handleEnrich(ctx);
			});

			const jsonOutput = findJsonOutput(logs) as Record<string, unknown>;
			expect(jsonOutput.count).toBe(2);
			expect(Array.isArray(jsonOutput.candidates)).toBe(true);
			expect((jsonOutput.candidates as unknown[]).length).toBe(2);
		});

		test("skips YouTube notes with enrichedAt", async () => {
			const vault = setupVault();
			writeVaultFile(
				vault,
				"00 Inbox/new.md",
				`---
type: youtube
video_id: new
transcript_status: pending
---`,
			);
			writeVaultFile(
				vault,
				"00 Inbox/enriched.md",
				`---
type: youtube
video_id: old
enrichedAt: 2024-01-01T00:00:00Z
---`,
			);

			const ctx = createTestContext({
				subcommand: "youtube",
				flags: { all: true, dryRun: true },
				isJson: true,
			});

			const logs = await captureConsoleOutputAsync(async () => {
				await handleEnrich(ctx);
			});

			const jsonOutput = findJsonOutput(logs) as Record<string, unknown>;
			expect(jsonOutput.count).toBe(1);
			const candidates = jsonOutput.candidates as Array<{ path: string }>;
			expect(candidates[0]?.path).toContain("new.md");
		});

		test("handles empty inbox gracefully", async () => {
			const vault = setupVault();
			writeVaultFile(vault, "00 Inbox/.gitkeep", "");

			const ctx = createTestContext({
				subcommand: "youtube",
				flags: { all: true },
				isJson: true,
			});

			const logs = await captureConsoleOutputAsync(async () => {
				await handleEnrich(ctx);
			});

			const jsonOutput = findJsonOutput(logs) as Record<string, unknown>;
			expect(jsonOutput.success).toBe(true);
			expect(jsonOutput.enriched).toBe(0);
			expect(jsonOutput.message).toContain("No YouTube notes");
		});
	});

	describe("observability", () => {
		test("creates session with correlation ID", async () => {
			setupVault();
			const ctx = createTestContext({
				subcommand: "youtube",
				flags: { all: true },
				isJson: true,
			});

			await handleEnrich(ctx);

			expect(mockStartSession).toHaveBeenCalledWith(
				"para enrich youtube",
				expect.objectContaining({ silent: true }),
			);
		});

		test("ends session on completion", async () => {
			setupVault();
			const ctx = createTestContext({
				subcommand: "youtube",
				flags: { all: true },
				isJson: true,
			});

			await handleEnrich(ctx);

			expect(mockEndSession).toHaveBeenCalledWith(
				expect.objectContaining({ success: true }),
			);
		});

		test("ends session on error", async () => {
			setupVault();
			const ctx = createTestContext({
				subcommand: "youtube",
				flags: {},
				isJson: false,
			});

			await handleEnrich(ctx);

			expect(mockEndSession).toHaveBeenCalledWith(
				expect.objectContaining({
					error: expect.stringContaining("Specify a file path"),
				}),
			);
		});

		test("includes sessionCid in JSON output", async () => {
			setupVault();
			const ctx = createTestContext({
				subcommand: "youtube",
				flags: { all: true },
				isJson: true,
			});

			const logs = await captureConsoleOutputAsync(async () => {
				await handleEnrich(ctx);
			});

			const jsonOutput = findJsonOutput(logs) as Record<string, unknown>;
			expect(jsonOutput.sessionCid).toBe("test-session-123");
		});
	});

	describe("JSON output format", () => {
		test("returns structured JSON with metrics", async () => {
			const vault = setupVault();
			writeVaultFile(
				vault,
				"00 Inbox/video.md",
				`---
type: youtube
video_id: test
transcript_status: pending
---`,
			);

			const ctx = createTestContext({
				subcommand: "youtube",
				flags: { all: true, dryRun: true },
				isJson: true,
			});

			const logs = await captureConsoleOutputAsync(async () => {
				await handleEnrich(ctx);
			});

			const jsonOutput = findJsonOutput(logs) as Record<string, unknown>;
			expect(jsonOutput).toHaveProperty("candidates");
			expect(jsonOutput).toHaveProperty("count");
			expect(jsonOutput).toHaveProperty("sessionCid");
			expect(Array.isArray(jsonOutput.candidates)).toBe(true);
		});

		test("includes candidate paths in preview", async () => {
			const vault = setupVault();
			writeVaultFile(
				vault,
				"00 Inbox/video1.md",
				`---
type: youtube
transcript_status: pending
---`,
			);
			writeVaultFile(
				vault,
				"00 Inbox/video2.md",
				`---
type: youtube
transcript_status: pending
---`,
			);

			const ctx = createTestContext({
				subcommand: "youtube",
				flags: { all: true, dryRun: true },
				isJson: true,
			});

			const logs = await captureConsoleOutputAsync(async () => {
				await handleEnrich(ctx);
			});

			const jsonOutput = findJsonOutput(logs) as Record<string, unknown>;
			const candidates = jsonOutput.candidates as Array<{ path: string }>;
			expect(candidates).toHaveLength(2);
			expect(candidates[0]).toHaveProperty("path");
			expect(candidates[0]?.path).toContain("video");
		});
	});

	describe("file reading errors", () => {
		test("handles missing target file", async () => {
			setupVault();
			const ctx = createTestContext({
				subcommand: "youtube",
				positional: ["00 Inbox/nonexistent.md"],
				isJson: false,
			});

			const result = await handleEnrich(ctx);

			expect(result.success).toBe(false);
			expect(result.error).toContain("Failed to read target file");
		});

		test("handles invalid frontmatter gracefully", async () => {
			const vault = setupVault();
			writeVaultFile(
				vault,
				"00 Inbox/invalid.md",
				`---
invalid yaml: [
---
# Bad YAML`,
			);

			const ctx = createTestContext({
				subcommand: "youtube",
				flags: { all: true },
				isJson: true,
			});

			// Should skip invalid files and continue
			const logs = await captureConsoleOutputAsync(async () => {
				await handleEnrich(ctx);
			});

			const jsonOutput = findJsonOutput(logs) as Record<string, unknown>;
			expect(jsonOutput.success).toBe(true);
			expect(jsonOutput.enriched).toBe(0);
		});
	});

	describe("path handling", () => {
		test("handles absolute paths", async () => {
			const vault = setupVault();
			const absolutePath = join(vault, "00 Inbox", "video.md");
			writeVaultFile(
				vault,
				"00 Inbox/video.md",
				`---
type: youtube
video_id: test
transcript_status: pending
---`,
			);

			const ctx = createTestContext({
				subcommand: "youtube",
				positional: [absolutePath],
				flags: { dryRun: true },
				isJson: true,
			});

			const logs = await captureConsoleOutputAsync(async () => {
				await handleEnrich(ctx);
			});

			const jsonOutput = findJsonOutput(logs) as Record<string, unknown>;
			expect(jsonOutput.count).toBe(1);
		});

		test("handles relative paths", async () => {
			const vault = setupVault();
			writeVaultFile(
				vault,
				"00 Inbox/video.md",
				`---
type: youtube
video_id: test
transcript_status: pending
---`,
			);

			const ctx = createTestContext({
				subcommand: "youtube",
				positional: ["00 Inbox/video.md"],
				flags: { dryRun: true },
				isJson: true,
			});

			const logs = await captureConsoleOutputAsync(async () => {
				await handleEnrich(ctx);
			});

			const jsonOutput = findJsonOutput(logs) as Record<string, unknown>;
			expect(jsonOutput.count).toBe(1);
		});
	});
});
