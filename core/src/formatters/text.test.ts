/**
 * Tests for text formatting utilities.
 *
 * @module formatters/text.test
 */

import { describe, expect, test } from "bun:test";
import { dedupeConsecutiveLines } from "./text.ts";

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

	test("handles many repeated lines (transcription hallucination)", () => {
		const repeated = Array(50).fill("We don't need to do this.").join("\n");
		expect(dedupeConsecutiveLines(repeated)).toBe("We don't need to do this.");
	});

	test("handles only whitespace lines", () => {
		const input = "   \n\t\n  \n";
		expect(dedupeConsecutiveLines(input)).toBe("");
	});

	test("preserves single non-empty line", () => {
		const input = "  Content with spaces  ";
		expect(dedupeConsecutiveLines(input)).toBe("Content with spaces");
	});
});
