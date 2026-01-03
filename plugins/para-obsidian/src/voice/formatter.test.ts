import { describe, expect, test } from "bun:test";
import {
	dedupeConsecutiveLines,
	formatLogEntry,
	formatTimestamp,
} from "./formatter";

describe("voice/formatter", () => {
	describe("dedupeConsecutiveLines", () => {
		test("removes consecutive duplicate lines", () => {
			const input = "Line A\nLine A\nLine A\nLine B";
			expect(dedupeConsecutiveLines(input)).toBe("Line A\nLine B");
		});

		test("preserves non-consecutive duplicates", () => {
			const input = "Line A\nLine B\nLine A";
			expect(dedupeConsecutiveLines(input)).toBe("Line A\nLine B\nLine A");
		});

		test("handles empty lines between content", () => {
			const input = "Line A\n\n\nLine B";
			expect(dedupeConsecutiveLines(input)).toBe("Line A\nLine B");
		});

		test("handles whitespace variations", () => {
			const input = "  Line A  \nLine A\n  Line A";
			expect(dedupeConsecutiveLines(input)).toBe("Line A");
		});

		test("handles empty input", () => {
			expect(dedupeConsecutiveLines("")).toBe("");
		});

		test("handles single line", () => {
			expect(dedupeConsecutiveLines("Single line")).toBe("Single line");
		});

		test("handles many repeated lines (whisper hallucination)", () => {
			const repeated = Array(50).fill("We don't need to do this.").join("\n");
			expect(dedupeConsecutiveLines(repeated)).toBe(
				"We don't need to do this.",
			);
		});
	});

	describe("formatTimestamp", () => {
		test("formats morning time (12-hour, lowercase am)", () => {
			// Create date with explicit hours/minutes in local time
			const date = new Date(2025, 11, 28, 9, 30, 0); // Dec 28, 2025, 9:30 AM
			const formatted = formatTimestamp(date);

			expect(formatted).toBe("9:30 am");
		});

		test("formats afternoon time (12-hour, lowercase pm)", () => {
			const date = new Date(2025, 11, 28, 14, 45, 0); // 2:45 PM
			const formatted = formatTimestamp(date);

			expect(formatted).toBe("2:45 pm");
		});

		test("formats midnight as 12:00 am", () => {
			const date = new Date(2025, 11, 28, 0, 0, 0);
			const formatted = formatTimestamp(date);

			expect(formatted).toBe("12:00 am");
		});

		test("formats noon as 12:00 pm", () => {
			const date = new Date(2025, 11, 28, 12, 0, 0);
			const formatted = formatTimestamp(date);

			expect(formatted).toBe("12:00 pm");
		});

		test("does not include leading zero for hours", () => {
			const date = new Date(2025, 11, 28, 3, 15, 0); // 3:15 AM
			const formatted = formatTimestamp(date);

			expect(formatted).toBe("3:15 am");
			expect(formatted).not.toBe("03:15 am");
		});

		test("includes leading zero for minutes", () => {
			const date = new Date(2025, 11, 28, 14, 5, 0); // 2:05 PM
			const formatted = formatTimestamp(date);

			expect(formatted).toBe("2:05 pm");
		});

		test("handles 11:59 PM correctly", () => {
			const date = new Date(2025, 11, 28, 23, 59, 0);
			const formatted = formatTimestamp(date);

			expect(formatted).toBe("11:59 pm");
		});

		test("handles 1:00 AM correctly", () => {
			const date = new Date(2025, 11, 28, 1, 0, 0);
			const formatted = formatTimestamp(date);

			expect(formatted).toBe("1:00 am");
		});
	});

	describe("formatLogEntry", () => {
		test("formats basic log entry with emoji", () => {
			const date = new Date(2025, 11, 28, 14, 45, 0); // 2:45 PM
			const transcription = "Test transcription";

			const entry = formatLogEntry(date, transcription);

			expect(entry).toBe("- 2:45 pm - 🎤 Test transcription");
		});

		test("collapses multi-line transcriptions to single line", () => {
			const date = new Date(2025, 11, 28, 9, 30, 0); // 9:30 AM
			const transcription = "Line one\nLine two\nLine three";

			const entry = formatLogEntry(date, transcription);

			expect(entry).toBe("- 9:30 am - 🎤 Line one Line two Line three");
		});

		test("removes consecutive duplicate lines (whisper hallucination)", () => {
			const date = new Date(2025, 11, 28, 9, 30, 0); // 9:30 AM
			const transcription =
				"Real content here.\nWe don't need to do this.\nWe don't need to do this.\nWe don't need to do this.\nMore content.";

			const entry = formatLogEntry(date, transcription);

			expect(entry).toBe(
				"- 9:30 am - 🎤 Real content here. We don't need to do this. More content.",
			);
		});

		test("trims whitespace from transcription", () => {
			const date = new Date(2025, 11, 28, 14, 45, 0); // 2:45 PM
			const transcription = "  Extra spaces  ";

			const entry = formatLogEntry(date, transcription);

			expect(entry).toBe("- 2:45 pm - 🎤 Extra spaces");
		});

		test("handles empty transcription", () => {
			const date = new Date(2025, 11, 28, 14, 45, 0); // 2:45 PM
			const transcription = "";

			const entry = formatLogEntry(date, transcription);

			expect(entry).toBe("- 2:45 pm - 🎤 ");
		});

		test("preserves internal punctuation", () => {
			const date = new Date(2025, 11, 28, 14, 45, 0); // 2:45 PM
			const transcription = "Hello, world! How are you?";

			const entry = formatLogEntry(date, transcription);

			expect(entry).toBe("- 2:45 pm - 🎤 Hello, world! How are you?");
		});

		test("formats entry at midnight", () => {
			const date = new Date(2025, 11, 28, 0, 0, 0);
			const transcription = "Midnight memo";

			const entry = formatLogEntry(date, transcription);

			expect(entry).toBe("- 12:00 am - 🎤 Midnight memo");
		});

		test("formats entry at noon", () => {
			const date = new Date(2025, 11, 28, 12, 0, 0);
			const transcription = "Noon memo";

			const entry = formatLogEntry(date, transcription);

			expect(entry).toBe("- 12:00 pm - 🎤 Noon memo");
		});

		test("handles very long transcription", () => {
			const date = new Date(2025, 11, 28, 14, 45, 0); // 2:45 PM
			const transcription = "A".repeat(500);

			const entry = formatLogEntry(date, transcription);

			expect(entry).toStartWith("- 2:45 pm - 🎤 A");
			expect(entry.length).toBe(500 + "- 2:45 pm - 🎤 ".length);
		});
	});
});
