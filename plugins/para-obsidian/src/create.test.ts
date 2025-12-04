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
		expect(written).toContain("template_version: 1");
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
});
