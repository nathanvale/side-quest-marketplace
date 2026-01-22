/**
 * Tests for voice memo scanner module.
 *
 * @module voice-memo/scanner.test
 */

import { describe, expect, test } from "bun:test";
import { isSafeFilename, parseVoiceMemoTimestamp } from "./scanner.ts";

describe("parseVoiceMemoTimestamp", () => {
	test("parses valid Apple Voice Memo filename", () => {
		const result = parseVoiceMemoTimestamp("20251228 143045-abc123.m4a");

		expect(result).not.toBeNull();
		expect(result?.year).toBe(2025);
		expect(result?.month).toBe(12);
		expect(result?.day).toBe(28);
		expect(result?.hour).toBe(14);
		expect(result?.minute).toBe(30);
		expect(result?.second).toBe(45);
	});

	test("returns null for invalid format", () => {
		expect(parseVoiceMemoTimestamp("not-a-voice-memo.m4a")).toBeNull();
		expect(parseVoiceMemoTimestamp("20251228143045-abc.m4a")).toBeNull();
		expect(parseVoiceMemoTimestamp("recording.mp3")).toBeNull();
	});

	test("returns null for invalid date values", () => {
		// Invalid month
		expect(parseVoiceMemoTimestamp("20251328 143045-abc123.m4a")).toBeNull();
		// Invalid day
		expect(parseVoiceMemoTimestamp("20251232 143045-abc123.m4a")).toBeNull();
		// Invalid hour
		expect(parseVoiceMemoTimestamp("20251228 243045-abc123.m4a")).toBeNull();
		// Invalid minute
		expect(parseVoiceMemoTimestamp("20251228 146045-abc123.m4a")).toBeNull();
		// Invalid second
		expect(parseVoiceMemoTimestamp("20251228 143060-abc123.m4a")).toBeNull();
	});

	test("handles midnight correctly", () => {
		const result = parseVoiceMemoTimestamp("20251228 000000-abc123.m4a");
		expect(result?.hour).toBe(0);
		expect(result?.minute).toBe(0);
		expect(result?.second).toBe(0);
	});

	test("handles end of day correctly", () => {
		const result = parseVoiceMemoTimestamp("20251228 235959-abc123.m4a");
		expect(result?.hour).toBe(23);
		expect(result?.minute).toBe(59);
		expect(result?.second).toBe(59);
	});
});

describe("isSafeFilename", () => {
	test("accepts valid Apple Voice Memo filenames", () => {
		expect(isSafeFilename("20251228 143045-abc123.m4a")).toBe(true);
		expect(isSafeFilename("20251228 143045-ABC123.m4a")).toBe(true);
	});

	test("accepts filenames with underscores and hyphens", () => {
		expect(isSafeFilename("my_voice_memo.m4a")).toBe(true);
		expect(isSafeFilename("memo-2025-01-15.m4a")).toBe(true);
	});

	test("rejects filenames with shell metacharacters", () => {
		expect(isSafeFilename("memo;rm -rf /.m4a")).toBe(false);
		expect(isSafeFilename("memo$(whoami).m4a")).toBe(false);
		expect(isSafeFilename("memo`ls`.m4a")).toBe(false);
		expect(isSafeFilename("memo|cat /etc/passwd.m4a")).toBe(false);
	});

	test("rejects non-m4a extensions", () => {
		expect(isSafeFilename("memo.mp3")).toBe(false);
		expect(isSafeFilename("memo.txt")).toBe(false);
	});
});
