import { afterEach, describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";

import { loadConfig } from "../config/index";
import { parseFrontmatter } from "../frontmatter/index";
import { createTestVault, useTestVaultCleanup } from "../testing/utils";
import { createFromTemplate, injectSections } from "./create";

function writeTemplate(dir: string, name: string, content: string) {
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(path.join(dir, `${name}.md`), content, "utf8");
}

describe("createFromTemplate", () => {
	const { trackVault, getAfterEachHook } = useTestVaultCleanup();
	afterEach(getAfterEachHook());

	function setupTest(): string {
		const vault = createTestVault();
		trackVault(vault);
		return vault;
	}

	it("creates a file from template with args", () => {
		const vault = setupTest();
		writeTemplate(
			path.join(vault, "Templates"),
			"project",
			`---
type: project
template_version: 4
---
# My Project

Body`,
		);
		process.env.PARA_VAULT = vault;

		const result = createFromTemplate(loadConfig({ cwd: vault }), {
			template: "project",
			title: "My Project",
		});

		expect(result.filePath.endsWith(".md")).toBe(true);
		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		// Title should NOT be in frontmatter (filename IS the title)
		expect(written).not.toMatch(/^title:/m);
		expect(written).toContain("template_version: 4");
	});

	it("throws if template missing", () => {
		const vault = setupTest();
		process.env.PARA_VAULT = vault;
		expect(() =>
			createFromTemplate(loadConfig({ cwd: vault }), {
				template: "missing",
				title: "X",
			}),
		).toThrow("Template not found");
	});

	it("auto-injects Title arg from title option for uppercase Title prompts", () => {
		const vault = setupTest();
		// Template uses uppercase "Title" which matches real templates
		writeTemplate(
			path.join(vault, "Templates"),
			"capture",
			`---
type: capture
---
# <% tp.system.prompt("Title") %>`,
		);
		process.env.PARA_VAULT = vault;

		// Only pass title option, not args - Title should be auto-injected
		const result = createFromTemplate(loadConfig({ cwd: vault }), {
			template: "capture",
			title: "My Capture Note",
		});

		expect(result.filePath).toBe("00 Inbox/My Capture Note.md");
		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		// Title should NOT be in frontmatter (filename IS the title)
		expect(written).not.toMatch(/^title:/m);
		// But title SHOULD be in H1 heading
		expect(written).toContain("# My Capture Note");
	});

	it("creates project with all required fields filled", () => {
		const vault = setupTest();
		writeTemplate(
			path.join(vault, "Templates"),
			"project",
			`---
type: project
status: active
start_date: <% tp.date.now("YYYY-MM-DD") %>
target_completion: <% tp.system.prompt("Target completion date (YYYY-MM-DD)") %>
area: <% tp.system.prompt("Area") %>
tags:
  - project
---
# <% tp.system.prompt("Title") %>

Goal: <% tp.system.prompt("Project goal") %>

Area: <% tp.system.prompt("Area") %>`,
		);
		process.env.PARA_VAULT = vault;

		const result = createFromTemplate(loadConfig({ cwd: vault }), {
			template: "project",
			title: "Build Dashboard",
			args: {
				"Target completion date (YYYY-MM-DD)": "2025-12-31",
				Area: "[[Work]]",
				"Project goal": "Create interactive analytics dashboard",
			},
		});

		expect(result.filePath).toBe("00 Inbox/🎯 Build Dashboard.md");
		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		// Title should NOT be in frontmatter
		expect(written).not.toMatch(/^title:/m);
		expect(written).toContain("target_completion: 2025-12-31");
		// Wikilink gets parsed as array by YAML, check for Work
		expect(written).toContain("Work");
		expect(written).toContain("Goal: Create interactive analytics dashboard");
	});

	it("creates area with all required fields filled", () => {
		const vault = setupTest();
		writeTemplate(
			path.join(vault, "Templates"),
			"area",
			`---
type: area
status: active
tags:
  - area
---
# <% tp.system.prompt("Title") %>

Description: <% tp.system.prompt("Description") %>`,
		);
		process.env.PARA_VAULT = vault;

		const result = createFromTemplate(loadConfig({ cwd: vault }), {
			template: "area",
			title: "Engineering",
			args: {
				Description: "Technical skills and software development",
			},
		});

		expect(result.filePath).toBe("00 Inbox/🌱 Engineering.md");
		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		// Title should NOT be in frontmatter
		expect(written).not.toMatch(/^title:/m);
		expect(written).toContain(
			"Description: Technical skills and software development",
		);
	});

	it("creates resource with all required fields filled", () => {
		const vault = setupTest();
		writeTemplate(
			path.join(vault, "Templates"),
			"resource",
			`---
type: resource
source: <% tp.system.prompt("Source type (book/article/video/course/podcast/etc.)") %>
topic: <% tp.system.prompt("Main topic") %>
tags:
  - resource
---
# <% tp.system.prompt("Title") %>

Source: <% tp.system.prompt("Source type (book/article/video/course/podcast/etc.)") %>
Topic: <% tp.system.prompt("Main topic") %>`,
		);
		process.env.PARA_VAULT = vault;

		const result = createFromTemplate(loadConfig({ cwd: vault }), {
			template: "resource",
			title: "Refactoring UI",
			args: {
				"Source type (book/article/video/course/podcast/etc.)": "book",
				"Main topic": "User interface design",
			},
		});

		expect(result.filePath).toBe("00 Inbox/📚 Refactoring UI.md");
		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		// Title should NOT be in frontmatter
		expect(written).not.toMatch(/^title:/m);
		expect(written).toContain("source: book");
		expect(written).toContain("Topic: User interface design");
	});

	it("creates task with all required fields filled", () => {
		const vault = setupTest();
		writeTemplate(
			path.join(vault, "Templates"),
			"task",
			`---
type: task
task_type: <% tp.system.prompt("Task type (task/reminder/habit/chore)") %>
status: not-started
priority: high
tags:
  - task
---
# <% tp.system.prompt("Title") %>

Type: <% tp.system.prompt("Task type (task/reminder/habit/chore)") %>
Effort: <% tp.system.prompt("Effort (small/medium/large)") %>`,
		);
		process.env.PARA_VAULT = vault;

		const result = createFromTemplate(loadConfig({ cwd: vault }), {
			template: "task",
			title: "Review PR",
			args: {
				"Task type (task/reminder/habit/chore)": "task",
				"Effort (small/medium/large)": "small",
			},
		});

		expect(result.filePath).toBe("00 Inbox/Review PR.md");
		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		// Title should NOT be in frontmatter
		expect(written).not.toMatch(/^title:/m);
		expect(written).toContain("task_type: task");
		expect(written).toContain("Effort: small");
	});

	it("handles optional parameters with default values", () => {
		const vault = setupTest();
		writeTemplate(
			path.join(vault, "Templates"),
			"resource",
			`---
type: resource
source: <% tp.system.prompt("Source type") %>
source_url: "<% tp.system.prompt("Source URL (optional)", "") %>"
author: "<% tp.system.prompt("Author (optional)", "") %>"
tags:
  - resource
---
# <% tp.system.prompt("Title") %>

Source: <% tp.system.prompt("Source type") %>
URL: <% tp.system.prompt("Source URL (optional)", "") %>
Author: <% tp.system.prompt("Author (optional)", "") %>`,
		);
		process.env.PARA_VAULT = vault;

		const result = createFromTemplate(loadConfig({ cwd: vault }), {
			template: "resource",
			title: "Building a Second Brain",
			args: {
				"Source type": "book",
				"Source URL (optional)": "https://example.com",
				"Author (optional)": "Tiago Forte",
			},
		});

		expect(result.filePath).toBe("00 Inbox/📚 Building A Second Brain.md");
		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		// Title should NOT be in frontmatter
		expect(written).not.toMatch(/^title:/m);
		expect(written).toContain("source: book");
		expect(written).toContain("source_url: https://example.com");
		expect(written).toContain("author: Tiago Forte");
		expect(written).toContain("URL: https://example.com");
		expect(written).toContain("Author: Tiago Forte");
	});

	it("handles optional parameters when not provided", () => {
		const vault = setupTest();
		writeTemplate(
			path.join(vault, "Templates"),
			"resource",
			`---
type: resource
source: <% tp.system.prompt("Source type") %>
source_url: "<% tp.system.prompt("Source URL (optional)", "") %>"
author: "<% tp.system.prompt("Author (optional)", "") %>"
tags:
  - resource
---
# <% tp.system.prompt("Title") %>

Source: <% tp.system.prompt("Source type") %>`,
		);
		process.env.PARA_VAULT = vault;

		const result = createFromTemplate(loadConfig({ cwd: vault }), {
			template: "resource",
			title: "Quick Note",
			args: {
				"Source type": "article",
				"Source URL (optional)": "",
				"Author (optional)": "",
			},
		});

		expect(result.filePath).toBe("00 Inbox/📚 Quick Note.md");
		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		// Title should NOT be in frontmatter
		expect(written).not.toMatch(/^title:/m);
		expect(written).toContain("source: article");
		// Empty strings may or may not have quotes after YAML parsing
		expect(written).toMatch(/source_url:\s*(""|''|$)/);
		expect(written).toMatch(/author:\s*(""|''|$)/);
	});

	describe.each([
		{
			template: "project",
			title: "My Project",
			type: "project",
			prefix: "🎯 ",
		},
		{ template: "area", title: "Health", type: "area", prefix: "🌱 " },
		{
			template: "resource",
			title: "Atomic Habits",
			type: "resource",
			prefix: "📚 ",
		},
		{ template: "task", title: "Review PR", type: "task", prefix: "" },
		{ template: "daily", title: "2025-12-06", type: "daily", prefix: "" },
		{
			template: "capture",
			title: "Quick Thought",
			type: "capture",
			prefix: "",
		},
	])("creates $type in 00 Inbox by default (PARA method)", ({
		template,
		title,
		type,
		prefix,
	}) => {
		it(`creates ${template}`, () => {
			const vault = setupTest();
			writeTemplate(
				path.join(vault, "Templates"),
				template,
				`---
title: "<% tp.system.prompt("Title") %>"
type: ${type}
---
Body`,
			);
			process.env.PARA_VAULT = vault;

			const result = createFromTemplate(loadConfig({ cwd: vault }), {
				template,
				title,
			});

			expect(result.filePath).toBe(`00 Inbox/${prefix}${title}.md`);
			expect(
				fs.existsSync(path.join(vault, "00 Inbox", `${prefix}${title}.md`)),
			).toBe(true);
		});
	});

	it("explicit dest overrides default destination", () => {
		const vault = setupTest();
		writeTemplate(
			path.join(vault, "Templates"),
			"project",
			`---
title: "<% tp.system.prompt("Title") %>"
type: project
---
Body`,
		);
		process.env.PARA_VAULT = vault;

		const result = createFromTemplate(loadConfig({ cwd: vault }), {
			template: "project",
			title: "Custom Location",
			dest: "Custom/Subfolder",
		});

		expect(result.filePath).toBe("Custom/Subfolder/🎯 Custom Location.md");
		expect(
			fs.existsSync(
				path.join(vault, "Custom", "Subfolder", "🎯 Custom Location.md"),
			),
		).toBe(true);
	});

	// Regression tests: real-world prompt keys (not just "Title")
	it("auto-detects 'Resource title' prompt key from real templates", () => {
		const vault = setupTest();
		// Use the exact pattern from real vault templates
		writeTemplate(
			path.join(vault, "Templates"),
			"resource",
			`---
type: resource
source: <% tp.system.prompt("Source type (book/article/video/course/podcast/etc.)") %>
tags:
  - resource
  - <% tp.system.prompt("Main topic") %>
---
# <% tp.system.prompt("Resource title") %>

Source: <% tp.system.prompt("Source type (book/article/video/course/podcast/etc.)") %>`,
		);
		process.env.PARA_VAULT = vault;

		// Only pass title option - "Resource title" should be auto-detected
		const result = createFromTemplate(loadConfig({ cwd: vault }), {
			template: "resource",
			title: "Melbourne Coffee Guide",
			args: {
				"Source type (book/article/video/course/podcast/etc.)": "web",
				"Main topic": "coffee",
			},
		});

		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		// Title should NOT be in frontmatter (filename IS the title)
		expect(written).not.toMatch(/^title:/m);
		// But title SHOULD be in H1 heading
		expect(written).toContain("# 📚 Melbourne Coffee Guide");
		// No unsubstituted prompts should remain for title
		expect(written).not.toContain('tp.system.prompt("Resource title")');
	});

	it("auto-detects 'Project title' prompt key from real templates", () => {
		const vault = setupTest();
		writeTemplate(
			path.join(vault, "Templates"),
			"project",
			`---
type: project
start_date: <% tp.date.now("YYYY-MM-DD") %>
target_completion: <% tp.system.prompt("Target completion date (YYYY-MM-DD)") %>
area: "[[<% tp.system.prompt("Area") %>]]"
tags:
  - project
---
# <% tp.system.prompt("Project title") %>`,
		);
		process.env.PARA_VAULT = vault;

		const result = createFromTemplate(loadConfig({ cwd: vault }), {
			template: "project",
			title: "Launch Dark Mode",
			args: {
				"Target completion date (YYYY-MM-DD)": "2025-12-31",
				Area: "Development",
			},
		});

		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		// Title should NOT be in frontmatter
		expect(written).not.toMatch(/^title:/m);
		// But title SHOULD be in H1 heading
		expect(written).toContain("# 🎯 Launch Dark Mode");
		expect(written).not.toContain('tp.system.prompt("Project title")');
	});

	it("auto-detects 'Area title' prompt key from real templates", () => {
		const vault = setupTest();
		writeTemplate(
			path.join(vault, "Templates"),
			"area",
			`---
type: area
status: active
tags:
  - area
---
# <% tp.system.prompt("Area title") %>`,
		);
		process.env.PARA_VAULT = vault;

		const result = createFromTemplate(loadConfig({ cwd: vault }), {
			template: "area",
			title: "Health & Fitness",
		});

		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		// Title should NOT be in frontmatter
		expect(written).not.toMatch(/^title:/m);
		// But title SHOULD be in H1 heading
		expect(written).toContain("# 🌱 Health & Fitness");
		expect(written).not.toContain('tp.system.prompt("Area title")');
	});

	it("backward compatible with 'Title' prompt key", () => {
		const vault = setupTest();
		// This is the old pattern that should still work
		writeTemplate(
			path.join(vault, "Templates"),
			"capture",
			`---
type: capture
---
# <% tp.system.prompt("Title") %>`,
		);
		process.env.PARA_VAULT = vault;

		const result = createFromTemplate(loadConfig({ cwd: vault }), {
			template: "capture",
			title: "Quick Note",
		});

		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		// Title should NOT be in frontmatter
		expect(written).not.toMatch(/^title:/m);
		// But title SHOULD be in H1 heading
		expect(written).toContain("# Quick Note");
		expect(written).not.toContain('tp.system.prompt("Title")');
	});

	it("strips wikilinks from value when template already wraps prompt in [[...]]", () => {
		const vault = setupTest();
		// Template wraps Area prompt in [[...]]
		writeTemplate(
			path.join(vault, "Templates"),
			"project",
			`---
title: "<% tp.system.prompt("Project title") %>"
type: project
area: "[[<% tp.system.prompt("Area") %>]]"
tags:
  - project
---
# <% tp.system.prompt("Project title") %>`,
		);
		process.env.PARA_VAULT = vault;

		// Pass value WITH wikilinks - should strip them to prevent [[[[Home]]]]
		const result = createFromTemplate(loadConfig({ cwd: vault }), {
			template: "project",
			title: "Test Wikilink Normalization",
			args: {
				Area: "[[Home]]",
			},
		});

		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		// Should be [[Home]], NOT [[[[Home]]]]
		expect(written).toContain('area: "[[Home]]"');
		expect(written).not.toContain("[[[[");
	});

	it("preserves wikilinks in value when template does not wrap prompt", () => {
		const vault = setupTest();
		// Template does NOT wrap Area prompt in [[...]] but quotes the value
		writeTemplate(
			path.join(vault, "Templates"),
			"project",
			`---
title: "<% tp.system.prompt("Project title") %>"
type: project
area: "<% tp.system.prompt("Area") %>"
tags:
  - project
---
# <% tp.system.prompt("Project title") %>`,
		);
		process.env.PARA_VAULT = vault;

		// Pass value WITH wikilinks - should preserve them since template doesn't wrap
		const result = createFromTemplate(loadConfig({ cwd: vault }), {
			template: "project",
			title: "Test Wikilink Preserved",
			args: {
				Area: "[[Home]]",
			},
		});

		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		// Should keep [[Home]] as provided (YAML will quote the brackets)
		expect(written).toContain("[[Home]]");
		// Should NOT double-wrap
		expect(written).not.toContain("[[[[");
	});

	it("works with plain values when template wraps prompt in [[...]]", () => {
		const vault = setupTest();
		// Template wraps Area prompt in [[...]]
		writeTemplate(
			path.join(vault, "Templates"),
			"project",
			`---
title: "<% tp.system.prompt("Project title") %>"
type: project
area: "[[<% tp.system.prompt("Area") %>]]"
tags:
  - project
---
# <% tp.system.prompt("Project title") %>`,
		);
		process.env.PARA_VAULT = vault;

		// Pass plain value WITHOUT wikilinks - template adds them
		const result = createFromTemplate(loadConfig({ cwd: vault }), {
			template: "project",
			title: "Test Plain Value",
			args: {
				Area: "Work",
			},
		});

		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		// Should be [[Work]] from template wrapping
		expect(written).toContain('area: "[[Work]]"');
	});

	it("handles missing required args gracefully (replaces with empty string)", () => {
		const vault = setupTest();
		// Template with required prompt that won't have a value
		writeTemplate(
			path.join(vault, "Templates"),
			"project",
			`---
type: project
target_completion: <% tp.system.prompt("Target date") %>
area: "[[<% tp.system.prompt("Area") %>]]"
---
# <% tp.system.prompt("Project title") %>`,
		);
		process.env.PARA_VAULT = vault;

		// Only pass title, not Target date or Area
		const result = createFromTemplate(loadConfig({ cwd: vault }), {
			template: "project",
			title: "No Args Test",
		});

		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
<<<<<<< HEAD
		// Title should NOT be in frontmatter
		expect(written).not.toMatch(/^title:/m);
		// But title SHOULD be in H1 heading
		expect(written).toContain("# 🎯 No Args Test");
		// Null values are now omitted following Obsidian best practices
		// (prevents Dataview issues and keeps frontmatter clean)
		expect(written).not.toContain("target_completion");
||||||| parent of 2be77fe (fix(para-obsidian): preserve template frontmatter fields and prioritize argOverrides)
		// Unsubstituted prompts should be replaced with empty strings
		// preventing YAML parse errors from nested quotes
		expect(written).toContain("title: 🎯 No Args Test");
		// Null values are now omitted following Obsidian best practices
		// (prevents Dataview issues and keeps frontmatter clean)
		expect(written).not.toContain("target_completion");
=======
		// Unsubstituted prompts should be replaced with empty strings
		// preventing YAML parse errors from nested quotes
		expect(written).toContain("title: 🎯 No Args Test");
		// Null placeholders are preserved as empty strings to maintain template structure
		// This ensures fields like `project:` appear in the output even without values
		expect(written).toContain('target_completion: ""');
>>>>>>> 2be77fe (fix(para-obsidian): preserve template frontmatter fields and prioritize argOverrides)
		expect(written).toContain('area: "[[]]"'); // empty wikilink
		// Should NOT contain raw Templater patterns
		expect(written).not.toContain("tp.system.prompt");
	});

	it("wraps wikilink values in quotes for unquoted YAML prompts", () => {
		const vault = setupTest();
		// Template with unquoted prompt (like resource.md)
		writeTemplate(
			path.join(vault, "Templates"),
			"resource",
			`---
title: "<% tp.system.prompt("Resource title") %>"
type: resource
area: <% tp.system.prompt("Area (wikilink or empty)", "") %>
---
# <% tp.system.prompt("Resource title") %>`,
		);
		process.env.PARA_VAULT = vault;

		// Pass wikilink value - should be wrapped in quotes for valid YAML
		const result = createFromTemplate(loadConfig({ cwd: vault }), {
			template: "resource",
			title: "Test Resource",
			args: {
				"Area (wikilink or empty)": "[[Test Area]]",
			},
		});

		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");

		// Should wrap in quotes to produce valid YAML
		expect(written).toContain('area: "[[Test Area]]"');

		// Parse the frontmatter to ensure it's not a nested array
		const { attributes } = parseFrontmatter(written);
		expect(attributes.area).toBe("[[Test Area]]");
		expect(Array.isArray(attributes.area)).toBe(false);
	});

	it("strips wikilinks from values for double-arg prompts wrapped in wikilinks", () => {
		const vault = setupTest();
		// Template with double-arg prompt (with default) wrapped in wikilinks
		// This is the pattern used by task.md for project/area fields
		writeTemplate(
			path.join(vault, "Templates"),
			"task",
			`---
title: "<% tp.system.prompt("Task title") %>"
type: task
project: "[[<% tp.system.prompt("Project (optional)", "") %>]]"
---
# <% tp.system.prompt("Task title") %>`,
		);
		process.env.PARA_VAULT = vault;

		// Pass value with wikilinks - should be stripped to prevent [[[[...]]]]
		const result = createFromTemplate(loadConfig({ cwd: vault }), {
			template: "task",
			title: "Test Task",
			args: {
				"Project (optional)": "[[My Project]]",
			},
		});

		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		// Should be [[My Project]] not [[[[My Project]]]]
		expect(written).toContain('project: "[[My Project]]"');
		expect(written).not.toContain("[[[[");
	});

	it("replaces null placeholder in frontmatter with arg value", () => {
		const vault = setupTest();
		writeTemplate(
			path.join(vault, "Templates"),
			"trip",
			`---
status: null
start_date: null
area: "[[null]]"
---
# null

Body content`,
		);
		process.env.PARA_VAULT = vault;

		const result = createFromTemplate(loadConfig({ cwd: vault }), {
			template: "trip",
			title: "My Trip",
			args: {
				status: "active",
				start_date: "2025-12-26",
				area: "[[Travel]]",
			},
		});

		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		// Title should NOT be in frontmatter
		expect(written).not.toMatch(/^title:/m);
		expect(written).toContain("status: active");
		expect(written).toContain("start_date: 2025-12-26");
		expect(written).toContain('area: "[[Travel]]"');
		// H1 heading gets replaced with title (null → title)
		expect(written).toContain("# ✈️ My Trip");
		expect(written).not.toMatch(/: null\b/);
		expect(written).not.toContain("[[null]]");
	});

	it("preserves null placeholder fields as empty strings when no arg provided", () => {
		const vault = setupTest();
		writeTemplate(
			path.join(vault, "Templates"),
			"meeting",
			`---
title: null
type: meeting
area: "[[null]]"
project:
summary: ""
---
# Meeting

Notes here`,
		);
		process.env.PARA_VAULT = vault;

		// Only pass area, not project or summary
		const result = createFromTemplate(loadConfig({ cwd: vault }), {
			template: "meeting",
			title: "Team Standup",
			args: {
				area: "[[Work]]",
			},
		});

		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		// area should be set from arg
		expect(written).toContain('area: "[[Work]]"');
		// project should be preserved as empty string (not filtered out)
		expect(written).toContain('project: ""');
		// summary should remain empty string
		expect(written).toContain('summary: ""');
		// Should NOT have raw null values
		expect(written).not.toMatch(/: null\b/);
		expect(written).not.toContain("[[null]]");
	});

	it("replaces YAML null (unquoted) placeholder in frontmatter", () => {
		const vault = setupTest();
		writeTemplate(
			path.join(vault, "Templates"),
			"test",
			`---
target_completion: null
---
Body`,
		);
		process.env.PARA_VAULT = vault;

		const result = createFromTemplate(loadConfig({ cwd: vault }), {
			template: "test",
			title: "Test Note",
			args: {
				target_completion: "2026-01-01",
			},
		});

		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		// Title should NOT be in frontmatter
		expect(written).not.toMatch(/^title:/m);
		expect(written).toContain("target_completion: 2026-01-01");
	});

	it("args override non-null frontmatter values (except protected fields)", () => {
		const vault = setupTest();
		writeTemplate(
			path.join(vault, "Templates"),
			"test",
			`---
title: "null"
type: test
status: planning
priority: high
---
Body`,
		);
		process.env.PARA_VAULT = vault;

		const result = createFromTemplate(loadConfig({ cwd: vault }), {
			template: "test",
			title: "Test Note",
			args: {
				status: "active", // Should override "planning"
				priority: "low", // Should override "high"
				type: "project", // Should NOT override (protected field)
			},
		});

		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		const { attributes } = parseFrontmatter(written);

		// Args should override existing non-null values
		expect(attributes.status).toBe("active");
		expect(attributes.priority).toBe("low");

		// Protected field should not be overridden
		expect(attributes.type).toBe("test");
	});

	it("creates note from template with native placeholders", () => {
		const vault = setupTest();
		writeTemplate(
			path.join(vault, "Templates"),
			"native-test",
			`---
type: project
status: "{{status:planning}}"
template_version: 1
---
# {{title}}

Created on {{date:YYYY-MM-DD}}.`,
		);
		process.env.PARA_VAULT = vault;

		const result = createFromTemplate(loadConfig({ cwd: vault }), {
			template: "native-test",
			title: "My Native Project",
			args: { status: "active" },
		});

		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		// Title should NOT be in frontmatter
		expect(written).not.toMatch(/^title:/m);
		// Status should be replaced (YAML may or may not keep quotes)
		expect(written).toMatch(/status:\s*"?active"?/);
		// But title SHOULD be in H1 heading
		expect(written).toContain("# My Native Project");
		// Date should be replaced with actual date (not {{date:...}})
		expect(written).not.toContain("{{date:");
		expect(written).toMatch(/Created on \d{4}-\d{2}-\d{2}/);
	});

	it("applies emoji_prefix from template frontmatter", () => {
		const vault = setupTest();
		writeTemplate(
			path.join(vault, "Templates"),
			"emoji-test",
			`---
emoji_prefix: "🎯 "
type: project
template_version: 1
---
# {{title}}`,
		);
		process.env.PARA_VAULT = vault;

		const result = createFromTemplate(loadConfig({ cwd: vault }), {
			template: "emoji-test",
			title: "My Goal",
		});

		// Filename should include emoji prefix
		expect(result.filePath).toContain("🎯 My Goal.md");

		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		// Title should NOT be in frontmatter
		expect(written).not.toMatch(/^title:/m);
		// H1 should have emoji
		expect(written).toContain("# 🎯 My Goal");
		// emoji_prefix should be removed from output frontmatter
		expect(written).not.toContain("emoji_prefix:");
	});

	it("does not double-prefix when title already has emoji", () => {
		const vault = setupTest();
		writeTemplate(
			path.join(vault, "Templates"),
			"emoji-test",
			`---
emoji_prefix: "🎯 "
title: null
type: project
template_version: 1
---
# {{title}}`,
		);
		process.env.PARA_VAULT = vault;

		const result = createFromTemplate(loadConfig({ cwd: vault }), {
			template: "emoji-test",
			title: "🎯 Already Prefixed",
		});

		// Should not double-prefix
		expect(result.filePath).toContain("🎯 Already Prefixed.md");
		expect(result.filePath).not.toContain("🎯 🎯");

		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		expect(written).toContain("# 🎯 Already Prefixed");
		expect(written).not.toContain("🎯 🎯");
	});
});

describe("injectSections", () => {
	const { trackVault, getAfterEachHook } = useTestVaultCleanup();
	afterEach(getAfterEachHook());

	function setupTest(): string {
		const vault = createTestVault();
		trackVault(vault);
		return vault;
	}

	it("injects content into multiple sections successfully", () => {
		const vault = setupTest();
		writeTemplate(
			vault,
			"Test Note",
			`---
title: Test Note
---
# Test Note

## Why This Matters

## Success Criteria

## Next Actions
`,
		);
		process.env.PARA_VAULT = vault;

		const config = loadConfig({ cwd: vault });
		const result = injectSections(config, "Test Note.md", {
			"Why This Matters": "This project addresses a critical need.",
			"Success Criteria": "- [ ] Feature complete\n- [ ] Tests pass",
			"Next Actions": "- [ ] Design mockups",
		});

		expect(result.injected).toEqual([
			"Why This Matters",
			"Success Criteria",
			"Next Actions",
		]);
		expect(result.skipped).toEqual([]);

		const written = fs.readFileSync(path.join(vault, "Test Note.md"), "utf8");
		expect(written).toContain("This project addresses a critical need.");
		expect(written).toContain("- [ ] Feature complete");
		expect(written).toContain("- [ ] Design mockups");
	});

	it("skips sections with empty content", () => {
		const vault = setupTest();
		writeTemplate(
			vault,
			"Test Note",
			`---
title: Test Note
---
# Test Note

## Section One

## Section Two
`,
		);
		process.env.PARA_VAULT = vault;

		const config = loadConfig({ cwd: vault });
		const result = injectSections(config, "Test Note.md", {
			"Section One": "Has content",
			"Section Two": "",
			"Section Three": "   ",
		});

		expect(result.injected).toEqual(["Section One"]);
		expect(result.skipped).toHaveLength(2);
		expect(result.skipped[0]).toEqual({
			heading: "Section Two",
			reason: "Empty content",
		});
		expect(result.skipped[1]).toEqual({
			heading: "Section Three",
			reason: "Empty content",
		});
	});

	it("skips sections with missing headings gracefully", () => {
		const vault = setupTest();
		writeTemplate(
			vault,
			"Test Note",
			`---
title: Test Note
---
# Test Note

## Existing Section
`,
		);
		process.env.PARA_VAULT = vault;

		const config = loadConfig({ cwd: vault });
		const result = injectSections(config, "Test Note.md", {
			"Existing Section": "This will be injected",
			"Missing Section": "This will be skipped",
		});

		expect(result.injected).toEqual(["Existing Section"]);
		expect(result.skipped).toHaveLength(1);
		expect(result.skipped[0]?.heading).toBe("Missing Section");
		expect(result.skipped[0]?.reason).toContain("Heading not found");

		const written = fs.readFileSync(path.join(vault, "Test Note.md"), "utf8");
		expect(written).toContain("This will be injected");
		expect(written).not.toContain("This will be skipped");
	});

	it("handles multiline content correctly", () => {
		const vault = setupTest();
		writeTemplate(
			vault,
			"Test Note",
			`---
title: Test Note
---
# Test Note

## Tasks
`,
		);
		process.env.PARA_VAULT = vault;

		const config = loadConfig({ cwd: vault });
		const multilineContent = `- [ ] First task
- [ ] Second task
- [ ] Third task

Some additional notes here.`;

		const result = injectSections(config, "Test Note.md", {
			Tasks: multilineContent,
		});

		expect(result.injected).toEqual(["Tasks"]);
		expect(result.skipped).toEqual([]);

		const written = fs.readFileSync(path.join(vault, "Test Note.md"), "utf8");
		expect(written).toContain("- [ ] First task");
		expect(written).toContain("- [ ] Second task");
		expect(written).toContain("- [ ] Third task");
		expect(written).toContain("Some additional notes here.");
	});

	it("reports all errors with details", () => {
		const vault = setupTest();
		writeTemplate(
			vault,
			"Test Note",
			`---
title: Test Note
---
# Test Note

## Only Section
`,
		);
		process.env.PARA_VAULT = vault;

		const config = loadConfig({ cwd: vault });
		const result = injectSections(config, "Test Note.md", {
			"Only Section": "Good content",
			"Missing One": "Will fail",
			"Missing Two": "Will also fail",
			"Empty Section": "",
		});

		expect(result.injected).toEqual(["Only Section"]);
		expect(result.skipped).toHaveLength(3);

		const skipReasons = result.skipped.map((s) => s.heading);
		expect(skipReasons).toContain("Missing One");
		expect(skipReasons).toContain("Missing Two");
		expect(skipReasons).toContain("Empty Section");
	});

	it("returns empty arrays when no sections provided", () => {
		const vault = setupTest();
		writeTemplate(
			vault,
			"Test Note",
			`---
title: Test Note
---
# Test Note
`,
		);
		process.env.PARA_VAULT = vault;

		const config = loadConfig({ cwd: vault });
		const result = injectSections(config, "Test Note.md", {});

		expect(result.injected).toEqual([]);
		expect(result.skipped).toEqual([]);
	});

	it("preserves Dataview syntax in H1 heading when using replaceSections", () => {
		const vault = setupTest();
		const templateContent = `---
title: "<% tp.system.prompt(\\"Title\\") %>"
type: capture
---
# \`= this.file.name\`

## Notes

Empty section.

## Other Section

More content.
`;
		writeTemplate(vault, "Test Template", templateContent);
		process.env.PARA_VAULT = vault;

		const config = loadConfig({ cwd: vault });

		// replaceSections should NOT match the H1 Dataview syntax
		const { replaceSections } = require("./create");
		replaceSections(config, "Test Template.md", {
			Notes: "Some notes content",
		});

		// Read back the file
		const written = fs.readFileSync(
			path.join(vault, "Test Template.md"),
			"utf8",
		);

		// Dataview syntax should be preserved in H1
		expect(written).toContain("# `= this.file.name`");
		// Our injection should work
		expect(written).toContain("## Notes");
		expect(written).toContain("Some notes content");
		// Other sections should be preserved
		expect(written).toContain("## Other Section");
		expect(written).toContain("More content");
	});

	it("preserves Dataview syntax in H1 when using injectSections", () => {
		const vault = setupTest();
		const templateContent = `---
title: "<% tp.system.prompt(\\"Title\\") %>"
type: capture
---
# \`= this.file.name\`

## Notes

Empty section.
`;
		writeTemplate(vault, "Test Template", templateContent);
		process.env.PARA_VAULT = vault;

		const config = loadConfig({ cwd: vault });

		// injectSections should NOT match the H1 Dataview syntax
		const result = injectSections(config, "Test Template.md", {
			Notes: "Appended content",
		});

		// Read back the file
		const written = fs.readFileSync(
			path.join(vault, "Test Template.md"),
			"utf8",
		);

		// Dataview syntax should be preserved in H1
		expect(written).toContain("# `= this.file.name`");
		// Our injection should work
		expect(result.injected).toContain("Notes");
		expect(written).toContain("Appended content");
	});

	it("still replaces H1 with '# null' pattern", () => {
		const vault = setupTest();
		writeTemplate(
			path.join(vault, "Templates"),
			"test",
			`---
title: "<% tp.system.prompt(\\"Title\\") %>"
type: test
---
# null

## Body

Content here.
`,
		);
		process.env.PARA_VAULT = vault;

		const result = createFromTemplate(loadConfig({ cwd: vault }), {
			template: "test",
			title: "My Test",
			args: { Title: "My Test" },
		});

		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");

		// '# null' should be replaced with actual title
		expect(written).toContain("# My Test");
		expect(written).not.toContain("# null");
	});
});

describe("applyTemplateSubstitutions", () => {
	const {
		applyTemplateSubstitutions,
	}: {
		applyTemplateSubstitutions: typeof import("./create").applyTemplateSubstitutions;
	} = require("./create");

	it("handles native placeholder syntax", () => {
		const template = `---
created: {{date:YYYY-MM-DD}}
status: "{{status:planning}}"
---
# {{title}}`;

		const result = applyTemplateSubstitutions(
			template,
			{ status: "active" },
			{ title: "My Note", baseDate: new Date("2025-01-16") },
		);

		expect(result).toContain("created: 2025-01-16");
		expect(result).toContain('status: "active"');
		expect(result).toContain("# My Note");
	});

	it("handles Templater syntax with deprecation (backward compat)", () => {
		const template = `---
created: <% tp.date.now("YYYY-MM-DD") %>
status: "<% tp.system.prompt("Status", "planning") %>"
---
Body`;

		const result = applyTemplateSubstitutions(
			template,
			{ Status: "active" },
			{ baseDate: new Date("2025-01-16") },
		);

		expect(result).toContain("created: 2025-01-16");
		expect(result).toContain('status: "active"');
	});

	it("uses default values for unspecified native fields", () => {
		const template = "Status: {{status:planning}}";
		const result = applyTemplateSubstitutions(template, {});
		expect(result).toBe("Status: planning");
	});

	it("returns content unchanged when no placeholders present", () => {
		const template = "Just plain text";
		const result = applyTemplateSubstitutions(template, {});
		expect(result).toBe("Just plain text");
	});
});

describe("extractEmojiPrefix", () => {
	const {
		extractEmojiPrefix,
	}: { extractEmojiPrefix: typeof import("./create").extractEmojiPrefix } =
		require("./create");

	it("extracts emoji prefix from frontmatter", () => {
		const content = `---
emoji_prefix: "🎯 "
type: project
---
# Title`;

		const result = extractEmojiPrefix(content);
		expect(result).toBe("🎯 ");
	});

	it("returns undefined when no emoji_prefix present", () => {
		const content = `---
type: project
---
# Title`;

		const result = extractEmojiPrefix(content);
		expect(result).toBeUndefined();
	});

	it("returns undefined for invalid frontmatter (Templater syntax)", () => {
		const content = `---
title: "<% tp.system.prompt("Title") %>"
type: project
---
# Title`;

		// Should not throw, just return undefined
		const result = extractEmojiPrefix(content);
		expect(result).toBeUndefined();
	});

	it("returns undefined for empty emoji_prefix", () => {
		const content = `---
emoji_prefix: ""
type: project
---
# Title`;

		const result = extractEmojiPrefix(content);
		expect(result).toBeUndefined();
	});

	it("returns undefined for whitespace-only emoji_prefix", () => {
		const content = `---
emoji_prefix: "   "
type: project
---
# Title`;

		const result = extractEmojiPrefix(content);
		expect(result).toBeUndefined();
	});
});

describe("Bug Fixes", () => {
	const { trackVault, getAfterEachHook } = useTestVaultCleanup();
	afterEach(getAfterEachHook());

	function setupTest(): string {
		const vault = createTestVault();
		trackVault(vault);
		return vault;
	}

	it("handles Templater prompts with array options (4-arg form)", () => {
		const vault = setupTest();
		writeTemplate(
			path.join(vault, "Templates"),
			"resource",
			`---
type: resource
source: <% tp.system.prompt("Source type", "article", false, ["book", "article", "video", "course"]) %>
tags:
  - resource
---
# <% tp.system.prompt("Title") %>

Source: <% tp.system.prompt("Source type", "article", false, ["book", "article", "video", "course"]) %>`,
		);
		process.env.PARA_VAULT = vault;

		const result = createFromTemplate(loadConfig({ cwd: vault }), {
			template: "resource",
			title: "My Resource",
			args: {
				"Source type": "book",
			},
		});

		expect(result.filePath).toBe("00 Inbox/📚 My Resource.md");
		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		// Title should NOT be in frontmatter
		expect(written).not.toMatch(/^title:/m);
		expect(written).toContain("source: book");
		expect(written).toContain("Source: book");
		// Should not contain unprocessed Templater syntax
		expect(written).not.toContain("<% tp.system.prompt");
	});

	it("handles Templater prompts with array options (default value when not provided)", () => {
		const vault = setupTest();
		writeTemplate(
			path.join(vault, "Templates"),
			"resource",
			`---
type: resource
source: <% tp.system.prompt("Source type", "article", false, ["book", "article", "video"]) %>
tags:
  - resource
---
# <% tp.system.prompt("Title") %>`,
		);
		process.env.PARA_VAULT = vault;

		// Don't provide "Source type" arg - should use default "article"
		const result = createFromTemplate(loadConfig({ cwd: vault }), {
			template: "resource",
			title: "Default Resource",
		});

		expect(result.filePath).toBe("00 Inbox/📚 Default Resource.md");
		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		// Title should NOT be in frontmatter
		expect(written).not.toMatch(/^title:/m);
		expect(written).toContain("source: article"); // Default value
		// Should not contain unprocessed Templater syntax
		expect(written).not.toContain("<% tp.system.prompt");
	});

	it("adds args to frontmatter even when field doesn't exist in template", () => {
		const vault = setupTest();
		writeTemplate(
			path.join(vault, "Templates"),
			"resource",
			`---
title: "<% tp.system.prompt("Title") %>"
type: resource
tags:
  - resource
---
# <% tp.system.prompt("Title") %>`,
		);
		process.env.PARA_VAULT = vault;

		const result = createFromTemplate(loadConfig({ cwd: vault }), {
			template: "resource",
			title: "My Note",
			args: {
				source: "book",
				author: "John Doe",
				year: "2025",
			},
		});

		expect(result.filePath).toBe("00 Inbox/📚 My Note.md");
		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		const { attributes } = parseFrontmatter(written);
		// All args should be added to frontmatter even though template doesn't have these fields
		expect(attributes.source).toBe("book");
		expect(attributes.author).toBe("John Doe");
		expect(attributes.year).toBe("2025");
	});
});

describe("applyArgsToFrontmatter", () => {
	const {
		applyArgsToFrontmatter,
	}: {
		applyArgsToFrontmatter: typeof import("./create").applyArgsToFrontmatter;
	} = require("./create");

	it("overrides template default values with args", () => {
		const attributes = {
			title: "Test",
			resource_type: "reference", // From template default
			status: "active",
			type: "resource",
		};

		const result = applyArgsToFrontmatter(attributes, {
			resource_type: "meeting", // Should override template default
			status: "completed", // Should override existing value
		});

		expect(result.resource_type).toBe("meeting");
		expect(result.status).toBe("completed");
	});

	it("adds new fields that don't exist in template", () => {
		const attributes = {
			title: "Test",
			type: "resource",
		};

		const result = applyArgsToFrontmatter(attributes, {
			author: "John Doe",
			year: "2025",
			source: "book",
		});

		expect(result.author).toBe("John Doe");
		expect(result.year).toBe("2025");
		expect(result.source).toBe("book");
	});

	it("protects 'created' field from being overridden", () => {
		const attributes = {
			created: "2025-01-01",
			type: "resource",
		};

		const result = applyArgsToFrontmatter(attributes, {
			created: "2025-12-31", // Should be ignored
			status: "active", // Should be applied
		});

		expect(result.created).toBe("2025-01-01"); // Protected
		expect(result.status).toBe("active"); // Not protected
	});

	it("protects 'type' field from being overridden", () => {
		const attributes = {
			type: "resource",
		};

		const result = applyArgsToFrontmatter(attributes, {
			type: "project", // Should be ignored
			status: "active", // Should be applied
		});

		expect(result.type).toBe("resource"); // Protected
		expect(result.status).toBe("active"); // Not protected
	});

	it("protects 'template_version' field from being overridden", () => {
		const attributes = {
			type: "resource",
			template_version: 4,
		};

		const result = applyArgsToFrontmatter(attributes, {
			template_version: "999", // Should be ignored
			status: "active", // Should be applied
		});

		expect(result.template_version).toBe(4); // Protected
		expect(result.status).toBe("active"); // Not protected
	});

	it("protects 'title' field from being overridden", () => {
		const attributes = {
			title: "Old Title",
			type: "resource",
		};

		const result = applyArgsToFrontmatter(attributes, {
			title: "New Title", // Should be ignored - filename IS the title
			status: "active", // Should be applied
		});

		expect(result.title).toBe("Old Title"); // Protected
		expect(result.status).toBe("active"); // Not protected
	});

	it("handles multiple overrides and additions at once", () => {
		const attributes = {
			title: "Old Title", // Protected
			resource_type: "reference", // Template default
			status: "active",
			type: "resource", // Protected
			created: "2025-01-01", // Protected
		};

		const result = applyArgsToFrontmatter(attributes, {
			title: "New Title", // Try to override protected (should fail)
			resource_type: "meeting", // Override template default
			status: "completed", // Override
			author: "Jane Doe", // Add new
			year: "2025", // Add new
			type: "project", // Try to override protected (should fail)
			created: "2025-12-31", // Try to override protected (should fail)
		});

		// Overridden fields
		expect(result.resource_type).toBe("meeting");
		expect(result.status).toBe("completed");

		// New fields
		expect(result.author).toBe("Jane Doe");
		expect(result.year).toBe("2025");

		// Protected fields (unchanged) - includes title now
		expect(result.title).toBe("Old Title");
		expect(result.type).toBe("resource");
		expect(result.created).toBe("2025-01-01");
	});

	it("preserves fields not mentioned in args", () => {
		const attributes = {
			title: "Test",
			status: "active",
			priority: "high",
			tags: ["resource"],
		};

		const result = applyArgsToFrontmatter(attributes, {
			status: "completed",
		});

		expect(result.status).toBe("completed"); // Overridden
		expect(result.title).toBe("Test"); // Preserved
		expect(result.priority).toBe("high"); // Preserved
		expect(result.tags).toEqual(["resource"]); // Preserved
	});

	it("handles empty args object", () => {
		const attributes = {
			title: "Test",
			status: "active",
		};

		const result = applyArgsToFrontmatter(attributes, {});

		expect(result).toEqual(attributes); // No changes
	});

	it("parses JSON array strings into actual arrays", () => {
		const attributes = {
			title: "Test",
			projects: [],
			areas: [],
		};

		const result = applyArgsToFrontmatter(attributes, {
			projects: '["[[🎯 Project A]]", "[[🎯 Project B]]"]',
			areas: '["[[🌱 Work]]"]',
		});

		// Should be parsed as arrays, not strings
		expect(Array.isArray(result.projects)).toBe(true);
		expect(Array.isArray(result.areas)).toBe(true);
		expect(result.projects).toEqual(["[[🎯 Project A]]", "[[🎯 Project B]]"]);
		expect(result.areas).toEqual(["[[🌱 Work]]"]);
	});

	it("keeps non-JSON strings as strings", () => {
		const attributes = {
			title: "Test",
			source: "",
		};

		const result = applyArgsToFrontmatter(attributes, {
			source: "[[🎤 2026-01-22 1-33pm]]", // Wikilink, not JSON array
			description: "A regular string",
		});

		expect(result.source).toBe("[[🎤 2026-01-22 1-33pm]]");
		expect(result.description).toBe("A regular string");
	});

	it("handles malformed JSON array strings gracefully", () => {
		const attributes = {
			title: "Test",
		};

		const result = applyArgsToFrontmatter(attributes, {
			notArray: "[invalid json",
			alsoNotArray: "[]extra",
		});

		// Should remain as strings since they're not valid JSON arrays
		expect(result.notArray).toBe("[invalid json");
		expect(result.alsoNotArray).toBe("[]extra");
	});

	describe("integration with createFromTemplate", () => {
		const { trackVault, getAfterEachHook } = useTestVaultCleanup();
		afterEach(getAfterEachHook());

		function setupTest(): string {
			const vault = createTestVault();
			trackVault(vault);
			return vault;
		}

		it("args override Templater prompt defaults", () => {
			const vault = setupTest();
			// Template with a prompt that has a default value
			writeTemplate(
				path.join(vault, "Templates"),
				"resource",
				`---
title: "<% tp.system.prompt("Title") %>"
type: resource
resource_type: <% tp.system.prompt("Resource type", "reference", false, ["reference", "meeting", "document"]) %>
---
# <% tp.system.prompt("Title") %>`,
			);
			process.env.PARA_VAULT = vault;

			// Pass arg that should override the default "reference"
			const result = createFromTemplate(loadConfig({ cwd: vault }), {
				template: "resource",
				title: "Team Sync Notes",
				args: {
					resource_type: "meeting", // Should override "reference" default
				},
			});

			const written = fs.readFileSync(
				path.join(vault, result.filePath),
				"utf8",
			);
			const { attributes } = parseFrontmatter(written);

			// resource_type should be "meeting" (from args), not "reference" (template default)
			expect(attributes.resource_type).toBe("meeting");
			expect(attributes.resource_type).not.toBe("reference");
		});

		it("args override native placeholder defaults", () => {
			const vault = setupTest();
			// Template with native placeholders with defaults
			writeTemplate(
				path.join(vault, "Templates"),
				"project",
				`---
title: null
type: project
status: "{{status:planning}}"
priority: "{{priority:medium}}"
---
# {{title}}`,
			);
			process.env.PARA_VAULT = vault;

			// Pass args that should override defaults
			const result = createFromTemplate(loadConfig({ cwd: vault }), {
				template: "project",
				title: "Launch Feature",
				args: {
					status: "active", // Should override "planning" default
					priority: "high", // Should override "medium" default
				},
			});

			const written = fs.readFileSync(
				path.join(vault, result.filePath),
				"utf8",
			);
			const { attributes } = parseFrontmatter(written);

			expect(attributes.status).toBe("active");
			expect(attributes.priority).toBe("high");
		});

		it("protected fields are not overridden even when passed in args", () => {
			const vault = setupTest();
			writeTemplate(
				path.join(vault, "Templates"),
				"resource",
				`---
title: null
type: resource
created: {{date:YYYY-MM-DD}}
template_version: 2
---
# {{title}}`,
			);
			process.env.PARA_VAULT = vault;

			// Try to override protected fields via args
			const result = createFromTemplate(loadConfig({ cwd: vault }), {
				template: "resource",
				title: "Test Resource",
				args: {
					type: "project", // Should be ignored (protected)
					created: "1999-01-01", // Should be ignored (protected)
					template_version: "999", // Should be ignored (protected)
					custom_field: "allowed", // Should be added (not protected)
				},
			});

			const written = fs.readFileSync(
				path.join(vault, result.filePath),
				"utf8",
			);
			const { attributes } = parseFrontmatter(written);

			// Protected fields remain unchanged
			expect(attributes.type).toBe("resource");
			expect(attributes.created).toMatch(/^\d{4}-\d{2}-\d{2}$/); // Today's date
			expect(attributes.created).not.toBe("1999-01-01");
			expect(attributes.template_version).toBe(2);

			// Non-protected field is added
			expect(attributes.custom_field).toBe("allowed");
		});
	});
});
