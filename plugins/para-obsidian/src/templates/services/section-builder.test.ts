import { describe, expect, test } from "bun:test";
import type { TemplateSection } from "../types";
import { generateBody } from "./section-builder";

describe("generateBody", () => {
	test("generates body with title only", () => {
		const sections: TemplateSection[] = [];

		const result = generateBody(sections);

		expect(result).toBe('# <% tp.system.prompt("Title") %>\n\n');
	});

	test("generates body with single section and prompt", () => {
		const sections: TemplateSection[] = [
			{
				heading: "Notes",
				hasPrompt: true,
				promptText: "Content",
			},
		];

		const result = generateBody(sections);

		expect(result).toBe(
			`# <% tp.system.prompt("Title") %>

## Notes

<% tp.system.prompt("Content") %>

`,
		);
	});

	test("generates body with section without prompt", () => {
		const sections: TemplateSection[] = [
			{
				heading: "Static Section",
				hasPrompt: false,
			},
		];

		const result = generateBody(sections);

		expect(result).toBe(
			`# <% tp.system.prompt("Title") %>

## Static Section

`,
		);
	});

	test("generates body with multiple sections", () => {
		const sections: TemplateSection[] = [
			{
				heading: "Why This Matters",
				hasPrompt: true,
				promptText: "What is the goal?",
			},
			{
				heading: "Success Criteria",
				hasPrompt: true,
				promptText: "How will you know it's done?",
			},
			{
				heading: "Next Actions",
				hasPrompt: false,
			},
		];

		const result = generateBody(sections);

		expect(result).toBe(
			`# <% tp.system.prompt("Title") %>

## Why This Matters

<% tp.system.prompt("What is the goal?") %>

## Success Criteria

<% tp.system.prompt("How will you know it's done?") %>

## Next Actions

`,
		);
	});

	test("handles mixed sections with and without prompts", () => {
		const sections: TemplateSection[] = [
			{
				heading: "Overview",
				hasPrompt: true,
				promptText: "Brief description",
			},
			{
				heading: "Resources",
				hasPrompt: false,
			},
			{
				heading: "Notes",
				hasPrompt: true,
				promptText: "Additional notes",
			},
		];

		const result = generateBody(sections);

		expect(result).toBe(
			`# <% tp.system.prompt("Title") %>

## Overview

<% tp.system.prompt("Brief description") %>

## Resources

## Notes

<% tp.system.prompt("Additional notes") %>

`,
		);
	});

	test("handles section with complex heading", () => {
		const sections: TemplateSection[] = [
			{
				heading: "Questions & Answers",
				hasPrompt: true,
				promptText: "What questions came up?",
			},
		];

		const result = generateBody(sections);

		expect(result).toBe(
			`# <% tp.system.prompt("Title") %>

## Questions & Answers

<% tp.system.prompt("What questions came up?") %>

`,
		);
	});
});
