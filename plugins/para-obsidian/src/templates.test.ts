import { describe, expect, test } from "bun:test";
import { addDays, format } from "date-fns";

import {
	applyDateSubstitutions,
	convertTemplaterFormat,
	detectTitlePromptKey,
	type TemplateInfo,
} from "./templates";

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

describe("detectTitlePromptKey", () => {
	function makeTemplate(content: string): TemplateInfo {
		return {
			name: "test",
			path: "/test.md",
			version: 1,
			content,
		};
	}

	test("detects 'Resource title' prompt key", () => {
		const template = makeTemplate(`---
title: "<% tp.system.prompt("Resource title") %>"
type: resource
---
# <% tp.system.prompt("Resource title") %>`);

		expect(detectTitlePromptKey(template)).toBe("Resource title");
	});

	test("detects 'Project title' prompt key", () => {
		const template = makeTemplate(`---
title: "<% tp.system.prompt("Project title") %>"
type: project
---
Body`);

		expect(detectTitlePromptKey(template)).toBe("Project title");
	});

	test("detects 'Area title' prompt key", () => {
		const template = makeTemplate(`---
title: "<% tp.system.prompt("Area title") %>"
type: area
---
Body`);

		expect(detectTitlePromptKey(template)).toBe("Area title");
	});

	test("detects generic 'Title' prompt key", () => {
		const template = makeTemplate(`---
title: "<% tp.system.prompt("Title") %>"
type: capture
---
Body`);

		expect(detectTitlePromptKey(template)).toBe("Title");
	});

	test("is case-insensitive when matching 'title'", () => {
		const template = makeTemplate(`---
title: "<% tp.system.prompt("My TITLE Here") %>"
type: test
---
Body`);

		expect(detectTitlePromptKey(template)).toBe("My TITLE Here");
	});

	test("falls back to 'Title' when no title prompt found", () => {
		const template = makeTemplate(`---
type: test
other_field: "<% tp.system.prompt("Something else") %>"
---
Body`);

		expect(detectTitlePromptKey(template)).toBe("Title");
	});

	test("falls back to 'Title' for empty frontmatter", () => {
		const template = makeTemplate(`---
---
Body only`);

		expect(detectTitlePromptKey(template)).toBe("Title");
	});

	test("falls back to 'Title' for no frontmatter", () => {
		const template = makeTemplate(`# Just markdown
No frontmatter here`);

		expect(detectTitlePromptKey(template)).toBe("Title");
	});

	test("only matches prompts in frontmatter, not body", () => {
		const template = makeTemplate(`---
type: test
---
# <% tp.system.prompt("Body title") %>

This is body content with a title prompt.`);

		// Should fall back to "Title" since "Body title" is not in frontmatter
		expect(detectTitlePromptKey(template)).toBe("Title");
	});

	test("handles whitespace variations in prompt syntax", () => {
		const template = makeTemplate(`---
title: "<%  tp.system.prompt("Spaced title")  %>"
---
Body`);

		expect(detectTitlePromptKey(template)).toBe("Spaced title");
	});
});
