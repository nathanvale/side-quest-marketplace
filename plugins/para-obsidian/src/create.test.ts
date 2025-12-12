import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";

import { loadConfig, type ParaObsidianConfig } from "./config";
import { createFromTemplate, injectSections } from "./create";
import { parseFrontmatter } from "./frontmatter";
import { createTestVault } from "./test-utils";

function writeTemplate(dir: string, name: string, content: string) {
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(path.join(dir, `${name}.md`), content, "utf8");
}

function makeConfig(vault: string, templatesDir: string): ParaObsidianConfig {
	return loadConfig({
		cwd: vault,
	});
}

describe("createFromTemplate", () => {
	it("creates a file from template with args", () => {
		const vault = createTestVault();
		const templatesDir = path.join(vault, "Templates");
		writeTemplate(
			templatesDir,
			"project",
			`---
title: "<% tp.system.prompt("title") %>"
type: project
template_version: 4
---
Body`,
		);
		process.env.PARA_VAULT = vault;

		const result = createFromTemplate(makeConfig(vault, templatesDir), {
			template: "project",
			title: "My Project",
			args: { title: "My Project" },
		});

		expect(result.filePath.endsWith(".md")).toBe(true);
		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		expect(written.includes("My Project")).toBe(true);
		expect(written).toContain("template_version: 4");
	});

	it("throws if template missing", () => {
		const vault = createTestVault();
		const templatesDir = path.join(vault, "Templates");
		process.env.PARA_VAULT = vault;
		expect(() =>
			createFromTemplate(makeConfig(vault, templatesDir), {
				template: "missing",
				title: "X",
			}),
		).toThrow("Template not found");
	});

	it("auto-injects Title arg from title option for uppercase Title prompts", () => {
		const vault = createTestVault();
		const templatesDir = path.join(vault, "Templates");
		// Template uses uppercase "Title" which matches real templates
		writeTemplate(
			templatesDir,
			"capture",
			`---
title: "<% tp.system.prompt("Title") %>"
type: capture
---
# <% tp.system.prompt("Title") %>`,
		);
		process.env.PARA_VAULT = vault;

		// Only pass title option, not args - Title should be auto-injected
		const result = createFromTemplate(makeConfig(vault, templatesDir), {
			template: "capture",
			title: "My Capture Note",
		});

		expect(result.filePath).toBe("00 Inbox/My Capture Note.md");
		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		// YAML serializer may or may not quote simple strings
		expect(written).toContain("title: My Capture Note");
		expect(written).toContain("# My Capture Note");
	});

	it("creates project with all required fields filled", () => {
		const vault = createTestVault();
		const templatesDir = path.join(vault, "Templates");
		writeTemplate(
			templatesDir,
			"project",
			`---
title: "<% tp.system.prompt("Title") %>"
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

		const result = createFromTemplate(makeConfig(vault, templatesDir), {
			template: "project",
			title: "Build Dashboard",
			args: {
				"Target completion date (YYYY-MM-DD)": "2025-12-31",
				Area: "[[Work]]",
				"Project goal": "Create interactive analytics dashboard",
			},
		});

		expect(result.filePath).toBe("00 Inbox/Build Dashboard.md");
		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		expect(written).toContain("title: Build Dashboard");
		expect(written).toContain("target_completion: 2025-12-31");
		// Wikilink gets parsed as array by YAML, check for Work
		expect(written).toContain("Work");
		expect(written).toContain("Goal: Create interactive analytics dashboard");
	});

	it("creates area with all required fields filled", () => {
		const vault = createTestVault();
		const templatesDir = path.join(vault, "Templates");
		writeTemplate(
			templatesDir,
			"area",
			`---
title: "<% tp.system.prompt("Title") %>"
type: area
status: active
tags:
  - area
---
# <% tp.system.prompt("Title") %>

Description: <% tp.system.prompt("Description") %>`,
		);
		process.env.PARA_VAULT = vault;

		const result = createFromTemplate(makeConfig(vault, templatesDir), {
			template: "area",
			title: "Engineering",
			args: {
				Description: "Technical skills and software development",
			},
		});

		expect(result.filePath).toBe("00 Inbox/Engineering.md");
		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		expect(written).toContain("title: Engineering");
		expect(written).toContain(
			"Description: Technical skills and software development",
		);
	});

	it("creates resource with all required fields filled", () => {
		const vault = createTestVault();
		const templatesDir = path.join(vault, "Templates");
		writeTemplate(
			templatesDir,
			"resource",
			`---
title: "<% tp.system.prompt("Title") %>"
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

		const result = createFromTemplate(makeConfig(vault, templatesDir), {
			template: "resource",
			title: "Refactoring UI",
			args: {
				"Source type (book/article/video/course/podcast/etc.)": "book",
				"Main topic": "User interface design",
			},
		});

		expect(result.filePath).toBe("00 Inbox/Refactoring UI.md");
		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		expect(written).toContain("title: Refactoring UI");
		expect(written).toContain("source: book");
		expect(written).toContain("Topic: User interface design");
	});

	it("creates task with all required fields filled", () => {
		const vault = createTestVault();
		const templatesDir = path.join(vault, "Templates");
		writeTemplate(
			templatesDir,
			"task",
			`---
title: "<% tp.system.prompt("Title") %>"
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

		const result = createFromTemplate(makeConfig(vault, templatesDir), {
			template: "task",
			title: "Review PR",
			args: {
				"Task type (task/reminder/habit/chore)": "task",
				"Effort (small/medium/large)": "small",
			},
		});

		expect(result.filePath).toBe("00 Inbox/Review PR.md");
		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		expect(written).toContain("title: Review PR");
		expect(written).toContain("task_type: task");
		expect(written).toContain("Effort: small");
	});

	it("handles optional parameters with default values", () => {
		const vault = createTestVault();
		const templatesDir = path.join(vault, "Templates");
		writeTemplate(
			templatesDir,
			"resource",
			`---
title: "<% tp.system.prompt("Title") %>"
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

		const result = createFromTemplate(makeConfig(vault, templatesDir), {
			template: "resource",
			title: "Building a Second Brain",
			args: {
				"Source type": "book",
				"Source URL (optional)": "https://example.com",
				"Author (optional)": "Tiago Forte",
			},
		});

		expect(result.filePath).toBe("00 Inbox/Building A Second Brain.md");
		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		expect(written).toContain("title: Building a Second Brain");
		expect(written).toContain("source: book");
		expect(written).toContain("source_url: https://example.com");
		expect(written).toContain("author: Tiago Forte");
		expect(written).toContain("URL: https://example.com");
		expect(written).toContain("Author: Tiago Forte");
	});

	it("handles optional parameters when not provided", () => {
		const vault = createTestVault();
		const templatesDir = path.join(vault, "Templates");
		writeTemplate(
			templatesDir,
			"resource",
			`---
title: "<% tp.system.prompt("Title") %>"
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

		const result = createFromTemplate(makeConfig(vault, templatesDir), {
			template: "resource",
			title: "Quick Note",
			args: {
				"Source type": "article",
				"Source URL (optional)": "",
				"Author (optional)": "",
			},
		});

		expect(result.filePath).toBe("00 Inbox/Quick Note.md");
		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		expect(written).toContain("title: Quick Note");
		expect(written).toContain("source: article");
		// Empty strings may or may not have quotes after YAML parsing
		expect(written).toMatch(/source_url:\s*(""|''|$)/);
		expect(written).toMatch(/author:\s*(""|''|$)/);
	});

	it("creates project in 00 Inbox by default (PARA method)", () => {
		const vault = createTestVault();
		const templatesDir = path.join(vault, "Templates");
		writeTemplate(
			templatesDir,
			"project",
			`---
title: "<% tp.system.prompt("Title") %>"
type: project
---
Body`,
		);
		process.env.PARA_VAULT = vault;

		const result = createFromTemplate(makeConfig(vault, templatesDir), {
			template: "project",
			title: "My Project",
		});

		expect(result.filePath).toBe("00 Inbox/My Project.md");
		expect(fs.existsSync(path.join(vault, "00 Inbox", "My Project.md"))).toBe(
			true,
		);
	});

	it("creates area in 00 Inbox by default (PARA method)", () => {
		const vault = createTestVault();
		const templatesDir = path.join(vault, "Templates");
		writeTemplate(
			templatesDir,
			"area",
			`---
title: "<% tp.system.prompt("Title") %>"
type: area
---
Body`,
		);
		process.env.PARA_VAULT = vault;

		const result = createFromTemplate(makeConfig(vault, templatesDir), {
			template: "area",
			title: "Health",
		});

		expect(result.filePath).toBe("00 Inbox/Health.md");
		expect(fs.existsSync(path.join(vault, "00 Inbox", "Health.md"))).toBe(true);
	});

	it("creates resource in 00 Inbox by default (PARA method)", () => {
		const vault = createTestVault();
		const templatesDir = path.join(vault, "Templates");
		writeTemplate(
			templatesDir,
			"resource",
			`---
title: "<% tp.system.prompt("Title") %>"
type: resource
---
Body`,
		);
		process.env.PARA_VAULT = vault;

		const result = createFromTemplate(makeConfig(vault, templatesDir), {
			template: "resource",
			title: "Atomic Habits",
		});

		expect(result.filePath).toBe("00 Inbox/Atomic Habits.md");
		expect(
			fs.existsSync(path.join(vault, "00 Inbox", "Atomic Habits.md")),
		).toBe(true);
	});

	it("creates task in 00 Inbox by default (PARA method)", () => {
		const vault = createTestVault();
		const templatesDir = path.join(vault, "Templates");
		writeTemplate(
			templatesDir,
			"task",
			`---
title: "<% tp.system.prompt("Title") %>"
type: task
---
Body`,
		);
		process.env.PARA_VAULT = vault;

		const result = createFromTemplate(makeConfig(vault, templatesDir), {
			template: "task",
			title: "Review PR",
		});

		expect(result.filePath).toBe("00 Inbox/Review PR.md");
		expect(fs.existsSync(path.join(vault, "00 Inbox", "Review PR.md"))).toBe(
			true,
		);
	});

	it("creates daily note in 00 Inbox by default (PARA method)", () => {
		const vault = createTestVault();
		const templatesDir = path.join(vault, "Templates");
		writeTemplate(
			templatesDir,
			"daily",
			`---
title: "<% tp.system.prompt("Title") %>"
type: daily
---
Body`,
		);
		process.env.PARA_VAULT = vault;

		const result = createFromTemplate(makeConfig(vault, templatesDir), {
			template: "daily",
			title: "2025-12-06",
		});

		expect(result.filePath).toBe("00 Inbox/2025-12-06.md");
		expect(fs.existsSync(path.join(vault, "00 Inbox", "2025-12-06.md"))).toBe(
			true,
		);
	});

	it("creates capture note in 00_Inbox by default", () => {
		const vault = createTestVault();
		const templatesDir = path.join(vault, "Templates");
		writeTemplate(
			templatesDir,
			"capture",
			`---
title: "<% tp.system.prompt("Title") %>"
type: capture
---
Body`,
		);
		process.env.PARA_VAULT = vault;

		const result = createFromTemplate(makeConfig(vault, templatesDir), {
			template: "capture",
			title: "Quick Thought",
		});

		expect(result.filePath).toBe("00 Inbox/Quick Thought.md");
		expect(
			fs.existsSync(path.join(vault, "00 Inbox", "Quick Thought.md")),
		).toBe(true);
	});

	it("explicit dest overrides default destination", () => {
		const vault = createTestVault();
		const templatesDir = path.join(vault, "Templates");
		writeTemplate(
			templatesDir,
			"project",
			`---
title: "<% tp.system.prompt("Title") %>"
type: project
---
Body`,
		);
		process.env.PARA_VAULT = vault;

		const result = createFromTemplate(makeConfig(vault, templatesDir), {
			template: "project",
			title: "Custom Location",
			dest: "Custom/Subfolder",
		});

		expect(result.filePath).toBe("Custom/Subfolder/Custom Location.md");
		expect(
			fs.existsSync(
				path.join(vault, "Custom", "Subfolder", "Custom Location.md"),
			),
		).toBe(true);
	});

	// Regression tests: real-world prompt keys (not just "Title")
	it("auto-detects 'Resource title' prompt key from real templates", () => {
		const vault = createTestVault();
		const templatesDir = path.join(vault, "Templates");
		// Use the exact pattern from real vault templates
		writeTemplate(
			templatesDir,
			"resource",
			`---
title: "<% tp.system.prompt("Resource title") %>"
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
		const result = createFromTemplate(makeConfig(vault, templatesDir), {
			template: "resource",
			title: "Melbourne Coffee Guide",
			args: {
				"Source type (book/article/video/course/podcast/etc.)": "web",
				"Main topic": "coffee",
			},
		});

		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		// Title should be substituted in both frontmatter and body
		expect(written).toContain("title: Melbourne Coffee Guide");
		expect(written).toContain("# Melbourne Coffee Guide");
		// No unsubstituted prompts should remain for title
		expect(written).not.toContain('tp.system.prompt("Resource title")');
	});

	it("auto-detects 'Project title' prompt key from real templates", () => {
		const vault = createTestVault();
		const templatesDir = path.join(vault, "Templates");
		writeTemplate(
			templatesDir,
			"project",
			`---
title: "<% tp.system.prompt("Project title") %>"
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

		const result = createFromTemplate(makeConfig(vault, templatesDir), {
			template: "project",
			title: "Launch Dark Mode",
			args: {
				"Target completion date (YYYY-MM-DD)": "2025-12-31",
				Area: "Development",
			},
		});

		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		expect(written).toContain("title: Launch Dark Mode");
		expect(written).toContain("# Launch Dark Mode");
		expect(written).not.toContain('tp.system.prompt("Project title")');
	});

	it("auto-detects 'Area title' prompt key from real templates", () => {
		const vault = createTestVault();
		const templatesDir = path.join(vault, "Templates");
		writeTemplate(
			templatesDir,
			"area",
			`---
title: "<% tp.system.prompt("Area title") %>"
type: area
status: active
tags:
  - area
---
# <% tp.system.prompt("Area title") %>`,
		);
		process.env.PARA_VAULT = vault;

		const result = createFromTemplate(makeConfig(vault, templatesDir), {
			template: "area",
			title: "Health & Fitness",
		});

		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		expect(written).toContain("title: Health & Fitness");
		expect(written).toContain("# Health & Fitness");
		expect(written).not.toContain('tp.system.prompt("Area title")');
	});

	it("backward compatible with 'Title' prompt key", () => {
		const vault = createTestVault();
		const templatesDir = path.join(vault, "Templates");
		// This is the old pattern that should still work
		writeTemplate(
			templatesDir,
			"capture",
			`---
title: "<% tp.system.prompt("Title") %>"
type: capture
---
# <% tp.system.prompt("Title") %>`,
		);
		process.env.PARA_VAULT = vault;

		const result = createFromTemplate(makeConfig(vault, templatesDir), {
			template: "capture",
			title: "Quick Note",
		});

		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		expect(written).toContain("title: Quick Note");
		expect(written).toContain("# Quick Note");
		expect(written).not.toContain('tp.system.prompt("Title")');
	});

	it("strips wikilinks from value when template already wraps prompt in [[...]]", () => {
		const vault = createTestVault();
		const templatesDir = path.join(vault, "Templates");
		// Template wraps Area prompt in [[...]]
		writeTemplate(
			templatesDir,
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
		const result = createFromTemplate(makeConfig(vault, templatesDir), {
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
		const vault = createTestVault();
		const templatesDir = path.join(vault, "Templates");
		// Template does NOT wrap Area prompt in [[...]] but quotes the value
		writeTemplate(
			templatesDir,
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
		const result = createFromTemplate(makeConfig(vault, templatesDir), {
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
		const vault = createTestVault();
		const templatesDir = path.join(vault, "Templates");
		// Template wraps Area prompt in [[...]]
		writeTemplate(
			templatesDir,
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
		const result = createFromTemplate(makeConfig(vault, templatesDir), {
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
		const vault = createTestVault();
		const templatesDir = path.join(vault, "Templates");
		// Template with required prompt that won't have a value
		writeTemplate(
			templatesDir,
			"project",
			`---
title: "<% tp.system.prompt("Project title") %>"
type: project
target_completion: <% tp.system.prompt("Target date") %>
area: "[[<% tp.system.prompt("Area") %>]]"
---
# <% tp.system.prompt("Project title") %>`,
		);
		process.env.PARA_VAULT = vault;

		// Only pass title, not Target date or Area
		const result = createFromTemplate(makeConfig(vault, templatesDir), {
			template: "project",
			title: "No Args Test",
		});

		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		// Unsubstituted prompts should be replaced with empty strings
		// preventing YAML parse errors from nested quotes
		expect(written).toContain("title: No Args Test");
		expect(written).toContain("target_completion: null"); // empty becomes null in YAML
		expect(written).toContain('area: "[[]]"'); // empty wikilink
		// Should NOT contain raw Templater patterns
		expect(written).not.toContain("tp.system.prompt");
	});

	it("wraps wikilink values in quotes for unquoted YAML prompts", () => {
		const vault = createTestVault();
		const templatesDir = path.join(vault, "Templates");
		// Template with unquoted prompt (like resource.md)
		writeTemplate(
			templatesDir,
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
		const result = createFromTemplate(makeConfig(vault, templatesDir), {
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
		const vault = createTestVault();
		const templatesDir = path.join(vault, "Templates");
		// Template with double-arg prompt (with default) wrapped in wikilinks
		// This is the pattern used by task.md for project/area fields
		writeTemplate(
			templatesDir,
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
		const result = createFromTemplate(makeConfig(vault, templatesDir), {
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
		const vault = createTestVault();
		const templatesDir = path.join(vault, "Templates");
		writeTemplate(
			templatesDir,
			"trip",
			`---
title: "null"
status: null
start_date: null
area: "[[null]]"
---
# null

Body content`,
		);
		process.env.PARA_VAULT = vault;

		const result = createFromTemplate(makeConfig(vault, templatesDir), {
			template: "trip",
			title: "My Trip",
			args: {
				status: "active",
				start_date: "2025-12-26",
				area: "[[Travel]]",
			},
		});

		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		// Title gets "✈️ " prefix (emoji + double space) and may or may not be quoted depending on YAML serialization
		expect(written).toMatch(/title: "?✈️ {2}My Trip"?/);
		expect(written).toContain("status: active");
		expect(written).toContain("start_date: 2025-12-26");
		expect(written).toContain('area: "[[Travel]]"');
		expect(written).toContain("# ✈️  My Trip");
		expect(written).not.toMatch(/: null\b/);
		expect(written).not.toContain("[[null]]");
	});

	it("replaces YAML null (unquoted) placeholder in frontmatter", () => {
		const vault = createTestVault();
		const templatesDir = path.join(vault, "Templates");
		writeTemplate(
			templatesDir,
			"test",
			`---
title: null
target_completion: null
---
Body`,
		);
		process.env.PARA_VAULT = vault;

		const result = createFromTemplate(makeConfig(vault, templatesDir), {
			template: "test",
			title: "Test Note",
			args: {
				target_completion: "2026-01-01",
			},
		});

		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		// Title may or may not be quoted depending on YAML serialization
		expect(written).toMatch(/title: "?Test Note"?/);
		expect(written).toContain("target_completion: 2026-01-01");
	});

	it("does not replace non-null frontmatter values with args", () => {
		const vault = createTestVault();
		const templatesDir = path.join(vault, "Templates");
		writeTemplate(
			templatesDir,
			"test",
			`---
title: "null"
status: planning
priority: high
---
Body`,
		);
		process.env.PARA_VAULT = vault;

		const result = createFromTemplate(makeConfig(vault, templatesDir), {
			template: "test",
			title: "Test Note",
			args: {
				status: "active",
				priority: "low",
			},
		});

		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		// status and priority should NOT be replaced since they weren't null
		expect(written).toContain("status: planning");
		expect(written).toContain("priority: high");
	});
});

describe("injectSections", () => {
	function writeFile(dir: string, name: string, content: string) {
		fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(path.join(dir, name), content, "utf8");
	}

	it("injects content into multiple sections successfully", () => {
		const vault = createTestVault();
		writeFile(
			vault,
			"Test Note.md",
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
		const vault = createTestVault();
		writeFile(
			vault,
			"Test Note.md",
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
		const vault = createTestVault();
		writeFile(
			vault,
			"Test Note.md",
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
		const vault = createTestVault();
		writeFile(
			vault,
			"Test Note.md",
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
		const vault = createTestVault();
		writeFile(
			vault,
			"Test Note.md",
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
		const vault = createTestVault();
		writeFile(
			vault,
			"Test Note.md",
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
});
