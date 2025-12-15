import { describe, expect, test } from "bun:test";
import { generateTemplate } from "./generator";
import type { TemplateConfig } from "./types";

describe("generateTemplate", () => {
	test("generates minimal template", () => {
		const config: TemplateConfig = {
			name: "simple-note",
			displayName: "Simple Note",
			noteType: "note",
			version: 1,
			fields: [
				{
					name: "title",
					displayName: "Title",
					type: "string",
					required: true,
				},
				{
					name: "created",
					displayName: "Created",
					type: "date",
					required: true,
					autoFill: 'tp.date.now("YYYY-MM-DD")',
				},
			],
			sections: [
				{
					heading: "Notes",
					hasPrompt: true,
					promptText: "Content",
				},
			],
		};

		const result = generateTemplate(config);

		expect(result).toBe(
			`---
title: "<% tp.system.prompt("Title") %>"
created: <% tp.date.now("YYYY-MM-DD") %>
template_version: 1
---

# <% tp.system.prompt("Title") %>

## Notes

<% tp.system.prompt("Content") %>

`,
		);
	});

	test("generates rich project template", () => {
		const config: TemplateConfig = {
			name: "project",
			displayName: "Project",
			noteType: "project",
			version: 2,
			fields: [
				{
					name: "title",
					displayName: "Project Title",
					type: "string",
					required: true,
				},
				{
					name: "created",
					displayName: "Created",
					type: "date",
					required: true,
					autoFill: 'tp.date.now("YYYY-MM-DD")',
				},
				{
					name: "status",
					displayName: "Status",
					type: "enum",
					required: true,
					enumValues: ["planning", "active", "on-hold", "completed"],
					default: "planning",
				},
				{
					name: "area",
					displayName: "Area",
					type: "wikilink",
					required: true,
				},
			],
			sections: [
				{
					heading: "Why This Matters",
					hasPrompt: true,
					promptText: "What is the desired outcome?",
				},
				{
					heading: "Success Criteria",
					hasPrompt: true,
					promptText: "How will you know it's done?",
				},
				{
					heading: "Resources",
					hasPrompt: false,
				},
				{
					heading: "Next Actions",
					hasPrompt: false,
				},
			],
		};

		const result = generateTemplate(config);

		expect(result).toBe(
			`---
title: "<% tp.system.prompt("Project Title") %>"
created: <% tp.date.now("YYYY-MM-DD") %>
status: "<% tp.system.prompt("Status", "planning") %>"
area: "[[<% tp.system.prompt("Area") %>]]"
template_version: 2
---

# <% tp.system.prompt("Title") %>

## Why This Matters

<% tp.system.prompt("What is the desired outcome?") %>

## Success Criteria

<% tp.system.prompt("How will you know it's done?") %>

## Resources

## Next Actions

`,
		);
	});

	test("generates template with no sections", () => {
		const config: TemplateConfig = {
			name: "minimal",
			displayName: "Minimal",
			noteType: "minimal",
			version: 1,
			fields: [
				{
					name: "title",
					displayName: "Title",
					type: "string",
					required: true,
				},
			],
			sections: [],
		};

		const result = generateTemplate(config);

		expect(result).toBe(
			`---
title: "<% tp.system.prompt("Title") %>"
template_version: 1
---

# <% tp.system.prompt("Title") %>

`,
		);
	});

	test("generates template with all field types", () => {
		const config: TemplateConfig = {
			name: "comprehensive",
			displayName: "Comprehensive",
			noteType: "comprehensive",
			version: 1,
			fields: [
				{
					name: "title",
					displayName: "Title",
					type: "string",
					required: true,
				},
				{
					name: "count",
					displayName: "Count",
					type: "number",
					required: false,
					default: "0",
				},
				{
					name: "created",
					displayName: "Created",
					type: "date",
					required: true,
					autoFill: 'tp.date.now("YYYY-MM-DD")',
				},
				{
					name: "tags",
					displayName: "Tags",
					type: "array",
					required: false,
					default: "",
				},
				{
					name: "project",
					displayName: "Project",
					type: "wikilink",
					required: false,
				},
				{
					name: "status",
					displayName: "Status",
					type: "enum",
					required: true,
					enumValues: ["todo", "done"],
					default: "todo",
				},
			],
			sections: [
				{
					heading: "Content",
					hasPrompt: true,
					promptText: "Main content",
				},
			],
		};

		const result = generateTemplate(config);

		expect(result).toContain('title: "<% tp.system.prompt("Title") %>"');
		expect(result).toContain('count: "<% tp.system.prompt("Count", "0") %>"');
		expect(result).toContain("created: <% tp.date.now(");
		expect(result).toContain('tags: "<% tp.system.prompt("Tags", "") %>"');
		expect(result).toContain(
			'project: "[[<% tp.system.prompt("Project", "") %>]]"',
		);
		expect(result).toContain(
			'status: "<% tp.system.prompt("Status", "todo") %>"',
		);
		expect(result).toContain("## Content");
		expect(result).toContain('<% tp.system.prompt("Main content") %>');
	});
});
