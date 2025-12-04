import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "./config";
import { validateFrontmatterFile } from "./frontmatter";

function makeTmpDir(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), "para-obsidian-"));
}

function writeFile(relPath: string, content: string, vault: string) {
	const full = path.join(vault, relPath);
	fs.mkdirSync(path.dirname(full), { recursive: true });
	fs.writeFileSync(full, content, "utf8");
}

describe("frontmatter file validation", () => {
	it("validates a project frontmatter", () => {
		const vault = makeTmpDir();
		const templatesDir = path.join(vault, "06_Metadata", "Templates");
		fs.mkdirSync(templatesDir, { recursive: true });
		process.env.PARA_VAULT = vault;

		writeFile(
			"01_Projects/Test.md",
			`---
title: Test
created: 2025-01-01
type: project
status: active
start_date: 2025-01-01
target_completion: 2025-12-31
area: "[[Health]]"
reviewed: 2025-01-01
review_period: 7d
template_version: 2
tags: [project]
---
Body`,
			vault,
		);

		const cfg = loadConfig({ cwd: vault });
		const result = validateFrontmatterFile(cfg, "01_Projects/Test.md");
		expect(result.valid).toBe(true);
		expect(result.issues).toHaveLength(0);
	});

	it("reports issues for missing required fields", () => {
		const vault = makeTmpDir();
		const templatesDir = path.join(vault, "06_Metadata", "Templates");
		fs.mkdirSync(templatesDir, { recursive: true });
		process.env.PARA_VAULT = vault;

		writeFile(
			"01_Projects/Bad.md",
			`---
title: Bad
type: project
---
Body`,
			vault,
		);

		const cfg = loadConfig({ cwd: vault });
		const result = validateFrontmatterFile(cfg, "01_Projects/Bad.md");
		expect(result.valid).toBe(false);
		expect(result.issues.length).toBeGreaterThan(0);
	});
});
