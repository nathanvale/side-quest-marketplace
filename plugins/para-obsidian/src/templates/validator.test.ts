import { describe, expect, test } from "bun:test";
import { validateTemplate } from "./validator";

describe("validateTemplate", () => {
	test("validates correct template", () => {
		const template = `---
title: "<% tp.system.prompt("Title") %>"
created: <% tp.date.now("YYYY-MM-DD") %>
template_version: 1
---

# <% tp.system.prompt("Title") %>

## Notes

<% tp.system.prompt("Content") %>
`;

		const result = validateTemplate(template);

		expect(result.isValid).toBe(true);
		expect(result.errors).toEqual([]);
	});

	test("detects missing frontmatter", () => {
		const template = `# <% tp.system.prompt("Title") %>

## Notes
`;

		const result = validateTemplate(template);

		expect(result.isValid).toBe(false);
		expect(result.errors).toContain(
			"Template must have YAML frontmatter (--- ... ---)",
		);
	});

	test("detects unclosed Templater tags", () => {
		const template = `---
title: "<% tp.system.prompt("Title") %>"
---

# <% tp.system.prompt("Title")

## Notes
`;

		const result = validateTemplate(template);

		expect(result.isValid).toBe(false);
		expect(
			result.errors.some((e) => e.includes("Unclosed Templater tags")),
		).toBe(true);
	});

	test("detects unbalanced quotes in frontmatter", () => {
		const template = `---
title: "<% tp.system.prompt("Title") %>
created: <% tp.date.now("YYYY-MM-DD") %>
---

# Title
`;

		const result = validateTemplate(template);

		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes("Unbalanced quotes"))).toBe(
			true,
		);
	});

	test("detects unbalanced wikilink brackets", () => {
		const template = `---
title: "<% tp.system.prompt("Title") %>"
area: "[[<% tp.system.prompt("Area") %>"
---

# Title
`;

		const result = validateTemplate(template);

		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.includes("Unbalanced wikilink"))).toBe(
			true,
		);
	});

	test("detects unbalanced parentheses in function calls", () => {
		const template = `---
title: "<% tp.system.prompt("Title" %>"
---

# Title
`;

		const result = validateTemplate(template);

		expect(result.isValid).toBe(false);
		expect(
			result.errors.some((e) => e.includes("Unbalanced parentheses")),
		).toBe(true);
	});

	test("warns about missing template_version", () => {
		const template = `---
title: "<% tp.system.prompt("Title") %>"
---

# <% tp.system.prompt("Title") %>
`;

		const result = validateTemplate(template);

		expect(result.isValid).toBe(true);
		expect(result.warnings.some((w) => w.includes("template_version"))).toBe(
			true,
		);
	});

	test("validates complex template with wikilinks", () => {
		const template = `---
title: "<% tp.system.prompt("Title") %>"
area: "[[<% tp.system.prompt("Area") %>]]"
project: "[[<% tp.system.prompt("Project", "") %>]]"
template_version: 1
---

# <% tp.system.prompt("Title") %>

## Notes

<% tp.system.prompt("Content") %>
`;

		const result = validateTemplate(template);

		expect(result.isValid).toBe(true);
		expect(result.errors).toEqual([]);
		expect(result.warnings).toEqual([]);
	});

	test("validates template with tp.date.now", () => {
		const template = `---
created: <% tp.date.now("YYYY-MM-DD") %>
modified: <% tp.date.now("YYYY-MM-DD HH:mm") %>
template_version: 1
---

# Title
`;

		const result = validateTemplate(template);

		expect(result.isValid).toBe(true);
		expect(result.errors).toEqual([]);
	});

	test("detects unknown Templater function", () => {
		const template = `---
title: "<% tp.unknown.function("Title") %>"
template_version: 1
---

# Title
`;

		const result = validateTemplate(template);

		expect(result.isValid).toBe(false);
		expect(
			result.errors.some((e) => e.includes("Unknown Templater function")),
		).toBe(true);
	});

	test("allows tp.file.* functions", () => {
		const template = `---
filename: <% tp.file.title %>
path: <% tp.file.path() %>
template_version: 1
---

# Title
`;

		const result = validateTemplate(template);

		expect(result.isValid).toBe(true);
	});

	test("handles template with no Templater tags", () => {
		const template = `---
title: Static Title
template_version: 1
---

# Static Title

## Static Section

Static content.
`;

		const result = validateTemplate(template);

		expect(result.isValid).toBe(true);
		expect(result.errors).toEqual([]);
	});

	test("handles empty template", () => {
		const template = "";

		const result = validateTemplate(template);

		expect(result.isValid).toBe(false);
		expect(result.errors).toContain(
			"Template must have YAML frontmatter (--- ... ---)",
		);
	});

	test("ignores comments in frontmatter when checking quotes", () => {
		const template = `---
# This is a comment with "quotes"
title: "<% tp.system.prompt("Title") %>"
template_version: 1
---

# Title
`;

		const result = validateTemplate(template);

		expect(result.isValid).toBe(true);
	});
});
