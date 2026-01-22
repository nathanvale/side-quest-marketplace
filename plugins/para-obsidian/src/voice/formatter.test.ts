/**
 * Tests for Obsidian-specific voice memo formatters.
 */

import { describe, expect, test } from "bun:test";
import { formatLogEntry, formatWikilinkLogEntry } from "./formatter.js";

describe("formatLogEntry", () => {
	test("formats basic transcription", () => {
		const date = new Date("2025-01-22T14:30:00");
		const transcription = "This is a test transcription";
		const entry = formatLogEntry(date, transcription);

		expect(entry).toMatch(
			/- \d{1,2}:\d{2} [ap]m - 🎤 This is a test transcription/,
		);
	});

	test("converts multiline transcription to single line", () => {
		const date = new Date("2025-01-22T14:30:00");
		const transcription = "Line one\nLine two\nLine three";
		const entry = formatLogEntry(date, transcription);

		expect(entry).not.toContain("\n");
		expect(entry).toContain("Line one Line two Line three");
	});

	test("deduplicates consecutive identical lines", () => {
		const date = new Date("2025-01-22T14:30:00");
		const transcription = "Same line\nSame line\nDifferent line";
		const entry = formatLogEntry(date, transcription);

		// After deduplication: "Same line\nDifferent line"
		// After single-line: "Same line Different line"
		expect(entry).toContain("Same line Different line");
	});

	test("includes emoji prefix", () => {
		const date = new Date("2025-01-22T14:30:00");
		const transcription = "Test";
		const entry = formatLogEntry(date, transcription);

		expect(entry).toContain("🎤");
	});

	test("formats time in 12-hour format", () => {
		const morning = new Date("2025-01-22T09:15:00");
		const afternoon = new Date("2025-01-22T14:30:00");

		const morningEntry = formatLogEntry(morning, "Morning test");
		const afternoonEntry = formatLogEntry(afternoon, "Afternoon test");

		expect(morningEntry).toMatch(/9:\d{2} am/);
		expect(afternoonEntry).toMatch(/2:\d{2} pm/);
	});

	test("trims whitespace", () => {
		const date = new Date("2025-01-22T14:30:00");
		const transcription = "  Test with spaces  ";
		const entry = formatLogEntry(date, transcription);

		expect(entry).toContain("🎤 Test with spaces");
		expect(entry).not.toMatch(/ {2}/); // No double spaces
	});
});

describe("formatWikilinkLogEntry", () => {
	test("formats wikilink with timestamp", () => {
		const date = new Date("2025-01-22T14:30:00");
		const noteTitle = "🎤 2025-01-22 2-30pm";
		const entry = formatWikilinkLogEntry(date, noteTitle);

		expect(entry).toMatch(
			/- \d{1,2}:\d{2} [ap]m - 🎤 \[\[🎤 2025-01-22 2-30pm\]\]/,
		);
	});

	test("includes emoji prefix", () => {
		const date = new Date("2025-01-22T14:30:00");
		const noteTitle = "Test Note";
		const entry = formatWikilinkLogEntry(date, noteTitle);

		expect(entry).toContain("🎤");
	});

	test("wraps note title in double brackets", () => {
		const date = new Date("2025-01-22T14:30:00");
		const noteTitle = "Test Note Title";
		const entry = formatWikilinkLogEntry(date, noteTitle);

		expect(entry).toContain("[[Test Note Title]]");
	});

	test("formats time in 12-hour format", () => {
		const morning = new Date("2025-01-22T09:15:00");
		const afternoon = new Date("2025-01-22T14:30:00");

		const morningEntry = formatWikilinkLogEntry(morning, "Note 1");
		const afternoonEntry = formatWikilinkLogEntry(afternoon, "Note 2");

		expect(morningEntry).toMatch(/9:\d{2} am/);
		expect(afternoonEntry).toMatch(/2:\d{2} pm/);
	});

	test("handles special characters in note title", () => {
		const date = new Date("2025-01-22T14:30:00");
		const noteTitle = "Meeting: Project Alpha (Draft #2)";
		const entry = formatWikilinkLogEntry(date, noteTitle);

		expect(entry).toContain("[[Meeting: Project Alpha (Draft #2)]]");
	});
});
