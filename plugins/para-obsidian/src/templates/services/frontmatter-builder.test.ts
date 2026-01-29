import { describe, expect, test } from "bun:test";
import type { TemplateField } from "../types";
import { generateFrontmatter } from "./frontmatter-builder";

describe("generateFrontmatter", () => {
	test("generates basic frontmatter with required string field", () => {
		const fields: TemplateField[] = [
			{
				name: "title",
				displayName: "Title",
				type: "string",
				required: true,
			},
		];

		const result = generateFrontmatter(fields, 1);

		expect(result).toBe(
			`---
title: "<% tp.system.prompt("Title") %>"
template_version: 1
---`,
		);
	});

	test("generates frontmatter with auto-fill date field", () => {
		const fields: TemplateField[] = [
			{
				name: "created",
				displayName: "Created",
				type: "date",
				required: true,
				autoFill: 'tp.date.now("YYYY-MM-DD")',
			},
		];

		const result = generateFrontmatter(fields, 1);

		expect(result).toBe(
			`---
created: <% tp.date.now("YYYY-MM-DD") %>
template_version: 1
---`,
		);
	});

	test("generates frontmatter with enum field and default", () => {
		const fields: TemplateField[] = [
			{
				name: "status",
				displayName: "Status",
				type: "enum",
				required: true,
				enumValues: ["active", "on-hold", "completed"],
				default: "active",
			},
		];

		const result = generateFrontmatter(fields, 1);

		expect(result).toBe(
			`---
status: "<% tp.system.prompt("Status", "active") %>"
template_version: 1
---`,
		);
	});

	test("generates frontmatter with wikilink field", () => {
		const fields: TemplateField[] = [
			{
				name: "area",
				displayName: "Area",
				type: "wikilink",
				required: true,
			},
		];

		const result = generateFrontmatter(fields, 1);

		expect(result).toBe(
			`---
area: "[[<% tp.system.prompt("Area") %>]]"
template_version: 1
---`,
		);
	});

	test("generates frontmatter with optional field and default", () => {
		const fields: TemplateField[] = [
			{
				name: "tags",
				displayName: "Tags",
				type: "array",
				required: false,
				default: "",
			},
		];

		const result = generateFrontmatter(fields, 1);

		expect(result).toBe(
			`---
tags: "<% tp.system.prompt("Tags", "") %>"
template_version: 1
---`,
		);
	});

	test("generates complex frontmatter with multiple field types", () => {
		const fields: TemplateField[] = [
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
				enumValues: ["planning", "active"],
				default: "planning",
			},
			{
				name: "area",
				displayName: "Area",
				type: "wikilink",
				required: true,
			},
			{
				name: "priority",
				displayName: "Priority",
				type: "number",
				required: false,
				default: "3",
			},
		];

		const result = generateFrontmatter(fields, 2);

		expect(result).toBe(
			`---
title: "<% tp.system.prompt("Project Title") %>"
created: <% tp.date.now("YYYY-MM-DD") %>
status: "<% tp.system.prompt("Status", "planning") %>"
area: "[[<% tp.system.prompt("Area") %>]]"
priority: "<% tp.system.prompt("Priority", "3") %>"
template_version: 2
---`,
		);
	});

	test("generates frontmatter with optional wikilink", () => {
		const fields: TemplateField[] = [
			{
				name: "parent",
				displayName: "Parent Project",
				type: "wikilink",
				required: false,
				default: "",
			},
		];

		const result = generateFrontmatter(fields, 1);

		expect(result).toBe(
			`---
parent: "[[<% tp.system.prompt("Parent Project", "") %>]]"
template_version: 1
---`,
		);
	});

	test("handles enum with first value as default when no default specified", () => {
		const fields: TemplateField[] = [
			{
				name: "status",
				displayName: "Status",
				type: "enum",
				required: true,
				enumValues: ["todo", "in-progress", "done"],
			},
		];

		const result = generateFrontmatter(fields, 1);

		expect(result).toBe(
			`---
status: "<% tp.system.prompt("Status", "todo") %>"
template_version: 1
---`,
		);
	});

	test("handles empty enum values gracefully", () => {
		const fields: TemplateField[] = [
			{
				name: "status",
				displayName: "Status",
				type: "enum",
				required: true,
				enumValues: [],
			},
		];

		const result = generateFrontmatter(fields, 1);

		expect(result).toBe(
			`---
status: "<% tp.system.prompt("Status", "") %>"
template_version: 1
---`,
		);
	});
});

describe("generateFrontmatter (native syntax)", () => {
	test("generates native string field", () => {
		const fields: TemplateField[] = [
			{
				name: "title",
				displayName: "Title",
				type: "string",
				required: true,
			},
		];

		const result = generateFrontmatter(fields, 1, "native");

		expect(result).toBe(
			`---
title: "{{Title}}"
template_version: 1
---`,
		);
	});

	test("generates native auto-fill date field", () => {
		const fields: TemplateField[] = [
			{
				name: "created",
				displayName: "Created",
				type: "date",
				required: true,
				autoFill: 'tp.date.now("YYYY-MM-DDTHH:mm:ss")',
			},
		];

		const result = generateFrontmatter(fields, 1, "native");

		expect(result).toBe(
			`---
created: "{{date:YYYY-MM-DDTHH:mm:ss}}"
template_version: 1
---`,
		);
	});

	test("generates native enum field with default", () => {
		const fields: TemplateField[] = [
			{
				name: "status",
				displayName: "Status",
				type: "enum",
				required: true,
				enumValues: ["active", "on-hold"],
				default: "active",
			},
		];

		const result = generateFrontmatter(fields, 1, "native");

		expect(result).toBe(
			`---
status: "{{Status:active}}"
template_version: 1
---`,
		);
	});

	test("generates native wikilink field", () => {
		const fields: TemplateField[] = [
			{
				name: "area",
				displayName: "Area",
				type: "wikilink",
				required: true,
			},
		];

		const result = generateFrontmatter(fields, 1, "native");

		expect(result).toBe(
			`---
area: "[[{{Area}}]]"
template_version: 1
---`,
		);
	});

	test("generates native array field as empty array", () => {
		const fields: TemplateField[] = [
			{
				name: "depends_on",
				displayName: "Depends On",
				type: "array",
				required: false,
				default: "[]",
			},
		];

		const result = generateFrontmatter(fields, 1, "native");

		expect(result).toBe(
			`---
depends_on: []
template_version: 1
---`,
		);
	});

	test("generates native complex frontmatter", () => {
		const fields: TemplateField[] = [
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
				autoFill: 'tp.date.now("YYYY-MM-DDTHH:mm:ss")',
			},
			{
				name: "status",
				displayName: "Status",
				type: "enum",
				required: true,
				enumValues: ["active", "on-hold"],
				default: "active",
			},
			{
				name: "area",
				displayName: "Area",
				type: "wikilink",
				required: true,
			},
		];

		const result = generateFrontmatter(fields, 1, "native");

		expect(result).toBe(
			`---
title: "{{Title}}"
created: "{{date:YYYY-MM-DDTHH:mm:ss}}"
status: "{{Status:active}}"
area: "[[{{Area}}]]"
template_version: 1
---`,
		);
	});
});
