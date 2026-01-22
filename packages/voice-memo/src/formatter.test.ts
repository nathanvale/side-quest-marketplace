/**
 * Tests for voice memo formatter module.
 *
 * @module voice-memo/formatter.test
 */

import { describe, expect, test } from "bun:test";
import {
	dedupeConsecutiveLines,
	formatFilenameTime,
	formatTimestamp,
} from "./formatter.ts";

describe("voice-memo/formatter", () => {
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

	describe("formatFilenameTime", () => {
		test("formats afternoon time", () => {
			const date = new Date(2026, 0, 15, 14, 45);
			expect(formatFilenameTime(date)).toBe("2-45pm");
		});

		test("formats morning time", () => {
			const date = new Date(2026, 0, 15, 10, 30);
			expect(formatFilenameTime(date)).toBe("10-30am");
		});

		test("formats midnight as 12am", () => {
			const date = new Date(2026, 0, 15, 0, 0);
			expect(formatFilenameTime(date)).toBe("12-00am");
		});

		test("formats noon as 12pm", () => {
			const date = new Date(2026, 0, 15, 12, 0);
			expect(formatFilenameTime(date)).toBe("12-00pm");
		});

		test("formats single digit hour without padding", () => {
			const date = new Date(2026, 0, 15, 9, 5);
			expect(formatFilenameTime(date)).toBe("9-05am");
		});
	});
});
