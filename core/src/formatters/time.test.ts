import { describe, expect, test } from "bun:test";
import {
	formatDateWithSpaces,
	formatDuration,
	formatFilenameTime,
	formatTime12Hour,
} from "./time";

describe("formatTime12Hour", () => {
	test("formats morning time (single-digit hour)", () => {
		const date = new Date("2024-12-10T09:30:00");
		expect(formatTime12Hour(date)).toBe("9:30 am");
	});

	test("formats afternoon time", () => {
		const date = new Date("2024-12-10T14:45:00");
		expect(formatTime12Hour(date)).toBe("2:45 pm");
	});

	test("formats midnight as 12:00 am", () => {
		const date = new Date("2024-12-10T00:00:00");
		expect(formatTime12Hour(date)).toBe("12:00 am");
	});

	test("formats noon as 12:00 pm", () => {
		const date = new Date("2024-12-10T12:00:00");
		expect(formatTime12Hour(date)).toBe("12:00 pm");
	});

	test("pads minutes with leading zero", () => {
		const date = new Date("2024-12-10T09:05:00");
		expect(formatTime12Hour(date)).toBe("9:05 am");
	});

	test("formats 11:59 pm correctly", () => {
		const date = new Date("2024-12-10T23:59:00");
		expect(formatTime12Hour(date)).toBe("11:59 pm");
	});

	test("formats 1:00 am correctly", () => {
		const date = new Date("2024-12-10T01:00:00");
		expect(formatTime12Hour(date)).toBe("1:00 am");
	});

	test("formats 1:00 pm correctly", () => {
		const date = new Date("2024-12-10T13:00:00");
		expect(formatTime12Hour(date)).toBe("1:00 pm");
	});
});

describe("formatFilenameTime", () => {
	test("formats morning time for filename", () => {
		const date = new Date("2024-12-10T09:30:00");
		expect(formatFilenameTime(date)).toBe("9-30am");
	});

	test("formats afternoon time for filename", () => {
		const date = new Date("2024-12-10T14:45:00");
		expect(formatFilenameTime(date)).toBe("2-45pm");
	});

	test("formats midnight for filename", () => {
		const date = new Date("2024-12-10T00:00:00");
		expect(formatFilenameTime(date)).toBe("12-00am");
	});

	test("formats noon for filename", () => {
		const date = new Date("2024-12-10T12:00:00");
		expect(formatFilenameTime(date)).toBe("12-00pm");
	});

	test("pads minutes with leading zero", () => {
		const date = new Date("2024-12-10T09:05:00");
		expect(formatFilenameTime(date)).toBe("9-05am");
	});

	test("has no spaces or colons", () => {
		const date = new Date("2024-12-10T14:30:00");
		const result = formatFilenameTime(date);
		expect(result).not.toContain(":");
		expect(result).not.toContain(" ");
	});

	test("formats 11:59 pm correctly", () => {
		const date = new Date("2024-12-10T23:59:00");
		expect(formatFilenameTime(date)).toBe("11-59pm");
	});
});

describe("formatDuration", () => {
	test("formats zero seconds", () => {
		expect(formatDuration(0)).toBe("0:00");
	});

	test("formats seconds only (under 1 minute)", () => {
		expect(formatDuration(45)).toBe("0:45");
	});

	test("formats minutes and seconds (under 1 hour)", () => {
		expect(formatDuration(65)).toBe("1:05");
		expect(formatDuration(125)).toBe("2:05");
	});

	test("formats exact minutes", () => {
		expect(formatDuration(60)).toBe("1:00");
		expect(formatDuration(180)).toBe("3:00");
	});

	test("formats hours, minutes, and seconds", () => {
		expect(formatDuration(3665)).toBe("1:01:05");
		expect(formatDuration(7325)).toBe("2:02:05");
	});

	test("formats exact hours", () => {
		expect(formatDuration(3600)).toBe("1:00:00");
		expect(formatDuration(7200)).toBe("2:00:00");
	});

	test("pads minutes and seconds with leading zeros for hours", () => {
		expect(formatDuration(3605)).toBe("1:00:05");
		expect(formatDuration(3660)).toBe("1:01:00");
	});

	test("handles large durations", () => {
		expect(formatDuration(36000)).toBe("10:00:00"); // 10 hours
		expect(formatDuration(86400)).toBe("24:00:00"); // 24 hours
	});

	test("treats negative as zero", () => {
		expect(formatDuration(-10)).toBe("0:00");
		expect(formatDuration(-100)).toBe("0:00");
	});

	test("handles fractional seconds (floors them)", () => {
		expect(formatDuration(65.7)).toBe("1:05");
		expect(formatDuration(3665.9)).toBe("1:01:05");
	});
});

describe("formatDateWithSpaces", () => {
	test("replaces hyphens with spaces", () => {
		expect(formatDateWithSpaces("2024-12-10")).toBe("2024 12 10");
	});

	test("handles year-month-day format", () => {
		expect(formatDateWithSpaces("2025-01-01")).toBe("2025 01 01");
	});

	test("handles dates with single-digit components", () => {
		expect(formatDateWithSpaces("2024-01-05")).toBe("2024 01 05");
	});

	test("handles dates at year boundaries", () => {
		expect(formatDateWithSpaces("2024-12-31")).toBe("2024 12 31");
		expect(formatDateWithSpaces("2025-01-01")).toBe("2025 01 01");
	});
});
