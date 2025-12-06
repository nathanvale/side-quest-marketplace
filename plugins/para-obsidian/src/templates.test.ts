import { describe, expect, test } from "bun:test";
import { addDays, format } from "date-fns";

import { applyDateSubstitutions, convertTemplaterFormat } from "./templates";

describe("convertTemplaterFormat", () => {
	test("converts YYYY-MM-DD to yyyy-MM-dd", () => {
		expect(convertTemplaterFormat("YYYY-MM-DD")).toBe("yyyy-MM-dd");
	});

	test("converts YYYY-MM-DD HH:mm to yyyy-MM-dd HH:mm", () => {
		expect(convertTemplaterFormat("YYYY-MM-DD HH:mm")).toBe("yyyy-MM-dd HH:mm");
	});

	test("converts dddd, MMMM D, YYYY to EEEE, MMMM d, yyyy", () => {
		expect(convertTemplaterFormat("dddd, MMMM D, YYYY")).toBe(
			"EEEE, MMMM d, yyyy",
		);
	});

	test("converts YYYY alone", () => {
		expect(convertTemplaterFormat("YYYY")).toBe("yyyy");
	});

	test("handles mixed formats", () => {
		expect(convertTemplaterFormat("DD/MM/YYYY")).toBe("dd/MM/yyyy");
	});
});

describe("applyDateSubstitutions", () => {
	const today = new Date();
	const todayFormatted = format(today, "yyyy-MM-dd");

	test("replaces simple YYYY-MM-DD format", () => {
		const input = '<% tp.date.now("YYYY-MM-DD") %>';
		const result = applyDateSubstitutions(input);
		expect(result).toBe(todayFormatted);
	});

	test("replaces datetime format YYYY-MM-DD HH:mm", () => {
		const input = '<% tp.date.now("YYYY-MM-DD HH:mm") %>';
		const result = applyDateSubstitutions(input);
		// Just check it starts with today's date (time will vary)
		expect(result.startsWith(todayFormatted)).toBe(true);
		expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
	});

	test("replaces with positive offset (tomorrow)", () => {
		const input = '<% tp.date.now("YYYY-MM-DD", 1) %>';
		const result = applyDateSubstitutions(input);
		const expected = format(addDays(today, 1), "yyyy-MM-dd");
		expect(result).toBe(expected);
	});

	test("replaces with negative offset (yesterday)", () => {
		const input = '<% tp.date.now("YYYY-MM-DD", -1) %>';
		const result = applyDateSubstitutions(input);
		const expected = format(addDays(today, -1), "yyyy-MM-dd");
		expect(result).toBe(expected);
	});

	test("replaces full day name format", () => {
		const input = '<% tp.date.now("dddd, MMMM D, YYYY") %>';
		const result = applyDateSubstitutions(input);
		const expected = format(today, "EEEE, MMMM d, yyyy");
		expect(result).toBe(expected);
	});

	test("replaces year only format", () => {
		const input = '<% tp.date.now("YYYY") %>';
		const result = applyDateSubstitutions(input);
		expect(result).toBe(format(today, "yyyy"));
	});

	test("replaces multiple patterns in content", () => {
		const input = `---
created: <% tp.date.now("YYYY-MM-DD") %>
start_date: <% tp.date.now("YYYY-MM-DD") %>
---
# Project started on <% tp.date.now("dddd, MMMM D, YYYY") %>
Yesterday: <% tp.date.now("YYYY-MM-DD", -1) %>
Tomorrow: <% tp.date.now("YYYY-MM-DD", 1) %>`;

		const result = applyDateSubstitutions(input);

		expect(result).toContain(`created: ${todayFormatted}`);
		expect(result).toContain(`start_date: ${todayFormatted}`);
		expect(result).toContain(format(today, "EEEE, MMMM d, yyyy"));
		expect(result).toContain(format(addDays(today, -1), "yyyy-MM-dd"));
		expect(result).toContain(format(addDays(today, 1), "yyyy-MM-dd"));
	});

	test("leaves non-date Templater syntax untouched", () => {
		const input = '<% tp.system.prompt("Title") %>';
		const result = applyDateSubstitutions(input);
		expect(result).toBe(input);
	});

	test("handles whitespace variations in pattern", () => {
		const input1 = '<%tp.date.now("YYYY-MM-DD")%>';
		const input2 = '<%  tp.date.now("YYYY-MM-DD")  %>';

		expect(applyDateSubstitutions(input1)).toBe(todayFormatted);
		expect(applyDateSubstitutions(input2)).toBe(todayFormatted);
		// Note: patterns with space before ) like '<% tp.date.now("YYYY-MM-DD" ) %>'
		// don't match our regex - this is fine, we match the common patterns
	});

	test("preserves surrounding content", () => {
		const input = 'Before <% tp.date.now("YYYY-MM-DD") %> After';
		const result = applyDateSubstitutions(input);
		expect(result).toBe(`Before ${todayFormatted} After`);
	});
});
