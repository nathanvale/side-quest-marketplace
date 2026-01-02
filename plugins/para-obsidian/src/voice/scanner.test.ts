import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { ensureDirSync, writeTextFileSync } from "@sidequest/core/fs";
import { cleanupTestDir, createTempDir } from "@sidequest/core/testing";
import { parseVoiceMemoTimestamp, scanVoiceMemos } from "./scanner";

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
			expect(memos[0]?.filename).toBe("20251228 143045-abc123.m4a");
			expect(memos[1]?.filename).toBe("20251229 095030-def456.m4a");
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
			expect(memos[0]?.filename).toBe("20251228 143045-abc123.m4a");
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
			expect(memos[0]?.filename).toBe("20251228 143045-abc123.m4a");
		});

		test("includes full path in VoiceMemo object", () => {
			writeTextFileSync(
				join(recordingsDir, "20251228 143045-abc123.m4a"),
				"mock audio",
			);

			const memos = scanVoiceMemos(recordingsDir);

			expect(memos[0]?.path).toBe(
				join(recordingsDir, "20251228 143045-abc123.m4a"),
			);
		});

		test("includes parsed timestamp in VoiceMemo object", () => {
			writeTextFileSync(
				join(recordingsDir, "20251228 143045-abc123.m4a"),
				"mock audio",
			);

			const memos = scanVoiceMemos(recordingsDir);
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
			expect(memos[0]?.filename).toBe("20251228 143045-new.m4a");
			expect(memos[1]?.filename).toBe("20251229 095030-newer.m4a");
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
			expect(memos[0]?.filename).toBe("20251228 143045-older.m4a");
			expect(memos[1]?.filename).toBe("20251229 095030-newer.m4a");
			expect(memos[2]?.filename).toBe("20251230 120000-newest.m4a");
		});

		test("handles non-existent directory gracefully", () => {
			const nonExistentDir = join(tempDir, "does-not-exist");
			const memos = scanVoiceMemos(nonExistentDir);

			expect(memos).toHaveLength(0);
		});
	});
});
