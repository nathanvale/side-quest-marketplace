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

	test("renders content field after heading", () => {
		const sections: TemplateSection[] = [
			{
				heading: "Action Items",
				hasPrompt: false,
				content: "- [ ] ",
			},
		];

		const result = generateBody(sections);

		expect(result).toContain("## Action Items\n\n- [ ] \n");
	});

	test("renders multi-line content (Dataview query)", () => {
		const sections: TemplateSection[] = [
			{
				heading: "Active Projects",
				hasPrompt: false,
				content:
					'```dataview\nTABLE status\nFROM "01 Projects"\nWHERE status = "active"\n```',
			},
		];

		const result = generateBody(sections);

		expect(result).toContain("```dataview");
		expect(result).toContain('FROM "01 Projects"');
	});

	test("renders inline field table content", () => {
		const sections: TemplateSection[] = [
			{
				heading: "Overview",
				hasPrompt: false,
				content: "| | |\n|---|---|\n| **Status** | `= this.status` |",
			},
		];

		const result = generateBody(sections);

		expect(result).toContain("`= this.status`");
	});
});

describe("generateBody (native syntax)", () => {
	test("uses native title heading", () => {
		const sections: TemplateSection[] = [];

		const result = generateBody(sections, "native");

		expect(result).toBe("# {{title}}\n\n");
	});

	test("renders sections with content in native mode", () => {
		const sections: TemplateSection[] = [
			{
				heading: "Notes",
				hasPrompt: false,
				content: "- [ ]",
			},
			{
				heading: "Details",
				hasPrompt: false,
			},
		];

		const result = generateBody(sections, "native");

		expect(result).toBe(
			`# {{title}}

## Notes

- [ ]

## Details

`,
		);
	});

	test("renders comment after heading", () => {
		const sections: TemplateSection[] = [
			{
				heading: "Summary",
				hasPrompt: false,
				comment: "Key points in 2-3 sentences",
			},
		];

		const result = generateBody(sections, "native");

		expect(result).toBe(
			`# {{title}}

## Summary

<!-- Key points in 2-3 sentences -->

`,
		);
	});

	test("renders comment before content", () => {
		const sections: TemplateSection[] = [
			{
				heading: "Action Items",
				hasPrompt: false,
				content: "- [ ]",
				comment: "What will you DO with this knowledge?",
			},
		];

		const result = generateBody(sections, "native");

		expect(result).toBe(
			`# {{title}}

## Action Items

<!-- What will you DO with this knowledge? -->

- [ ]

`,
		);
	});

	test("section without comment renders normally", () => {
		const sections: TemplateSection[] = [
			{
				heading: "Notes",
				hasPrompt: false,
				content: "- [ ]",
			},
		];

		const result = generateBody(sections, "native");

		expect(result).toBe(
			`# {{title}}

## Notes

- [ ]

`,
		);
	});

	test("skips Templater prompts in native mode", () => {
		const sections: TemplateSection[] = [
			{
				heading: "Notes",
				hasPrompt: true,
				promptText: "Enter notes",
			},
		];

		const result = generateBody(sections, "native");

		expect(result).not.toContain("tp.system.prompt");
		expect(result).toContain("## Notes");
	});
});

describe("generateBody (bodyConfig)", () => {
	test("uses custom titleLine from bodyConfig", () => {
		const sections: TemplateSection[] = [
			{ heading: "Content", hasPrompt: false },
		];

		const result = generateBody(sections, "native", {
			titleLine: "# `= this.file.name`",
		});

		expect(result).toContain("# `= this.file.name`");
		expect(result).not.toContain("# {{title}}");
	});

	test("inserts preamble between title and sections", () => {
		const sections: TemplateSection[] = [
			{ heading: "Content", hasPrompt: false },
		];

		const result = generateBody(sections, "native", {
			titleLine: "# `= this.file.name`",
			preamble:
				"**Source:** `= this.source`\n**Clipped:** `= this.clipped`\n\n---",
		});

		expect(result).toBe(
			`# \`= this.file.name\`

**Source:** \`= this.source\`
**Clipped:** \`= this.clipped\`

---

## Content

`,
		);
	});

	test("footer is NOT emitted in body (Web Clipper only)", () => {
		const sections: TemplateSection[] = [
			{ heading: "Content", hasPrompt: false },
		];

		const result = generateBody(sections, "native", {
			titleLine: "# `= this.file.name`",
			footer: "<!-- highlights:{{highlights|length}} -->",
		});

		// Footer should NOT appear in vault template body
		expect(result).not.toContain("highlights");
	});

	test("bodyConfig with no titleLine falls back to syntax default", () => {
		const sections: TemplateSection[] = [];

		const result = generateBody(sections, "native", {
			preamble: "Some preamble",
		});

		expect(result).toContain("# {{title}}");
		expect(result).toContain("Some preamble");
	});
});
