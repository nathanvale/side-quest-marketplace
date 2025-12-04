import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ParaObsidianConfig } from "./config";
import {
	parseFrontmatter,
	serializeFrontmatter,
	validateFrontmatter,
	validateFrontmatterFile,
} from "./frontmatter";

describe("frontmatter parsing", () => {
	it("parses frontmatter and body", () => {
		const md = `---
title: Test
tags:
  - a
---

Body text`;
		const result = parseFrontmatter(md);
		expect(result.attributes.title).toBe("Test");
		expect(result.body.trim()).toBe("Body text");
	});

	it("returns empty attributes if missing", () => {
		const md = "No frontmatter";
		const result = parseFrontmatter(md);
		expect(result.attributes).toEqual({});
		expect(result.body).toBe(md);
	});

	it("serializes frontmatter and body", () => {
		const out = serializeFrontmatter({ title: "Test" }, "Body");
		expect(out.startsWith("---")).toBe(true);
		expect(out.includes("title: Test")).toBe(true);
		expect(out.endsWith("Body")).toBe(true);
	});
});

describe("frontmatter validation", () => {
	it("validates required fields", () => {
		const rules = {
			required: {
				title: { type: "string" },
				created: { type: "date" },
				type: { type: "enum", enum: ["project"] },
				tags: { type: "array", includes: ["project"] },
			},
		} as const;
		const attrs = {
			title: "My Project",
			created: "2025-01-01",
			type: "project",
			tags: ["project", "x"],
		};
		const result = validateFrontmatter(attrs, rules);
		expect(result.valid).toBe(true);
		expect(result.issues).toHaveLength(0);
	});

	it("reports missing and invalid fields", () => {
		const rules = {
			required: {
				title: { type: "string" },
				created: { type: "date" },
				type: { type: "enum", enum: ["project"] },
				tags: { type: "array", includes: ["project"] },
			},
		} as const;
		const attrs = {
			title: "My Project",
			created: "not-a-date",
			type: "wrong",
			tags: ["other"],
		};
		const result = validateFrontmatter(attrs, rules);
		expect(result.valid).toBe(false);
		expect(result.issues.length).toBeGreaterThan(0);
	});

	it("flags missing or outdated template_version", () => {
		const vault = fs.mkdtempSync(path.join(os.tmpdir(), "para-fm-"));
		const notePath = path.join(vault, "note.md");
		fs.writeFileSync(
			notePath,
			`---
type: project
title: Test
created: 2024-01-01
---
Body`,
			"utf8",
		);

		const config: ParaObsidianConfig = {
			vault,
			templateVersions: { project: 2 },
		};

		const result = validateFrontmatterFile(config, "note.md");
		expect(result.valid).toBe(false);
		expect(result.issues.some((i) => i.field === "template_version")).toBe(
			true,
		);
	});
});
