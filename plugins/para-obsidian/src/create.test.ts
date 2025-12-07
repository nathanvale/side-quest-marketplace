import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadConfig, type ParaObsidianConfig } from "./config";
import { createFromTemplate, injectSections } from "./create";

function makeTmpDir(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), "para-obsidian-"));
}

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
		const vault = makeTmpDir();
		const templatesDir = path.join(vault, "Templates");
		writeTemplate(
			templatesDir,
			"project",
			`---
title: "<% tp.system.prompt("title") %>"
type: project
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
		expect(written).toContain("template_version: 3");
	});

	it("throws if template missing", () => {
		const vault = makeTmpDir();
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
		const vault = makeTmpDir();
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

		expect(result.filePath).toBe("00_Inbox/My Capture Note.md");
		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		// YAML serializer may or may not quote simple strings
		expect(written).toContain("title: My Capture Note");
		expect(written).toContain("# My Capture Note");
	});

	it("creates project with all required fields filled", () => {
		const vault = makeTmpDir();
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

		expect(result.filePath).toBe("01_Projects/Build Dashboard.md");
		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		expect(written).toContain("title: Build Dashboard");
		expect(written).toContain("target_completion: 2025-12-31");
		// Wikilink gets parsed as array by YAML, check for Work
		expect(written).toContain("Work");
		expect(written).toContain("Goal: Create interactive analytics dashboard");
	});

	it("creates area with all required fields filled", () => {
		const vault = makeTmpDir();
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

		expect(result.filePath).toBe("02_Areas/Engineering.md");
		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		expect(written).toContain("title: Engineering");
		expect(written).toContain(
			"Description: Technical skills and software development",
		);
	});

	it("creates resource with all required fields filled", () => {
		const vault = makeTmpDir();
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

		expect(result.filePath).toBe("03_Resources/Refactoring UI.md");
		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		expect(written).toContain("title: Refactoring UI");
		expect(written).toContain("source: book");
		expect(written).toContain("Topic: User interface design");
	});

	it("creates task with all required fields filled", () => {
		const vault = makeTmpDir();
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

		expect(result.filePath).toBe("Tasks/Review PR.md");
		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		expect(written).toContain("title: Review PR");
		expect(written).toContain("task_type: task");
		expect(written).toContain("Effort: small");
	});

	it("handles optional parameters with default values", () => {
		const vault = makeTmpDir();
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

		expect(result.filePath).toBe("03_Resources/Building A Second Brain.md");
		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		expect(written).toContain("title: Building a Second Brain");
		expect(written).toContain("source: book");
		expect(written).toContain("source_url: https://example.com");
		expect(written).toContain("author: Tiago Forte");
		expect(written).toContain("URL: https://example.com");
		expect(written).toContain("Author: Tiago Forte");
	});

	it("handles optional parameters when not provided", () => {
		const vault = makeTmpDir();
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

		expect(result.filePath).toBe("03_Resources/Quick Note.md");
		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		expect(written).toContain("title: Quick Note");
		expect(written).toContain("source: article");
		// Empty strings may or may not have quotes after YAML parsing
		expect(written).toMatch(/source_url:\s*(""|''|$)/);
		expect(written).toMatch(/author:\s*(""|''|$)/);
	});

	it("creates project in 01_Projects by default", () => {
		const vault = makeTmpDir();
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

		expect(result.filePath).toBe("01_Projects/My Project.md");
		expect(
			fs.existsSync(path.join(vault, "01_Projects", "My Project.md")),
		).toBe(true);
	});

	it("creates area in 02_Areas by default", () => {
		const vault = makeTmpDir();
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

		expect(result.filePath).toBe("02_Areas/Health.md");
		expect(fs.existsSync(path.join(vault, "02_Areas", "Health.md"))).toBe(true);
	});

	it("creates resource in 03_Resources by default", () => {
		const vault = makeTmpDir();
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

		expect(result.filePath).toBe("03_Resources/Atomic Habits.md");
		expect(
			fs.existsSync(path.join(vault, "03_Resources", "Atomic Habits.md")),
		).toBe(true);
	});

	it("creates task in Tasks by default", () => {
		const vault = makeTmpDir();
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

		expect(result.filePath).toBe("Tasks/Review PR.md");
		expect(fs.existsSync(path.join(vault, "Tasks", "Review PR.md"))).toBe(true);
	});

	it("creates daily note in Daily Notes by default", () => {
		const vault = makeTmpDir();
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

		expect(result.filePath).toBe("Daily Notes/2025-12-06.md");
		expect(
			fs.existsSync(path.join(vault, "Daily Notes", "2025-12-06.md")),
		).toBe(true);
	});

	it("creates capture note in 00_Inbox by default", () => {
		const vault = makeTmpDir();
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

		expect(result.filePath).toBe("00_Inbox/Quick Thought.md");
		expect(
			fs.existsSync(path.join(vault, "00_Inbox", "Quick Thought.md")),
		).toBe(true);
	});

	it("explicit dest overrides default destination", () => {
		const vault = makeTmpDir();
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
		const vault = makeTmpDir();
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
		const vault = makeTmpDir();
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
		const vault = makeTmpDir();
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
		const vault = makeTmpDir();
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
});

describe("injectSections", () => {
	function writeFile(dir: string, name: string, content: string) {
		fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(path.join(dir, name), content, "utf8");
	}

	it("injects content into multiple sections successfully", () => {
		const vault = makeTmpDir();
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
		const vault = makeTmpDir();
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
		const vault = makeTmpDir();
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
		const vault = makeTmpDir();
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
		const vault = makeTmpDir();
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
		const vault = makeTmpDir();
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
