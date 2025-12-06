import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadConfig, type ParaObsidianConfig } from "./config";
import { createFromTemplate } from "./create";

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
		const templatesDir = path.join(vault, "06_Metadata", "Templates");
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
		expect(written).toContain("template_version: 2");
	});

	it("throws if template missing", () => {
		const vault = makeTmpDir();
		const templatesDir = path.join(vault, "06_Metadata", "Templates");
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
		const templatesDir = path.join(vault, "06_Metadata", "Templates");
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

		expect(result.filePath).toBe("My Capture Note.md");
		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		// YAML serializer may or may not quote simple strings
		expect(written).toContain("title: My Capture Note");
		expect(written).toContain("# My Capture Note");
	});

	it("creates project with all required fields filled", () => {
		const vault = makeTmpDir();
		const templatesDir = path.join(vault, "06_Metadata", "Templates");
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

		expect(result.filePath).toBe("Build Dashboard.md");
		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		expect(written).toContain("title: Build Dashboard");
		expect(written).toContain("target_completion: 2025-12-31");
		// Wikilink gets parsed as array by YAML, check for Work
		expect(written).toContain("Work");
		expect(written).toContain("Goal: Create interactive analytics dashboard");
	});

	it("creates area with all required fields filled", () => {
		const vault = makeTmpDir();
		const templatesDir = path.join(vault, "06_Metadata", "Templates");
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

		expect(result.filePath).toBe("Engineering.md");
		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		expect(written).toContain("title: Engineering");
		expect(written).toContain(
			"Description: Technical skills and software development",
		);
	});

	it("creates resource with all required fields filled", () => {
		const vault = makeTmpDir();
		const templatesDir = path.join(vault, "06_Metadata", "Templates");
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

		expect(result.filePath).toBe("Refactoring UI.md");
		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		expect(written).toContain("title: Refactoring UI");
		expect(written).toContain("source: book");
		expect(written).toContain("Topic: User interface design");
	});

	it("creates task with all required fields filled", () => {
		const vault = makeTmpDir();
		const templatesDir = path.join(vault, "06_Metadata", "Templates");
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

		expect(result.filePath).toBe("Review PR.md");
		const written = fs.readFileSync(path.join(vault, result.filePath), "utf8");
		expect(written).toContain("title: Review PR");
		expect(written).toContain("task_type: task");
		expect(written).toContain("Effort: small");
	});
});
