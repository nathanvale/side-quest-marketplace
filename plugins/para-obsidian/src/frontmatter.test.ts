import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ParaObsidianConfig } from "./config";
import {
	parseFrontmatter,
	serializeFrontmatter,
	updateFrontmatterFile,
	validateFrontmatter,
	validateFrontmatterBulk,
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

describe("frontmatter update", () => {
	const makeVault = () =>
		fs.mkdtempSync(path.join(os.tmpdir(), "para-fm-update-"));

	it("sets and unsets keys while preserving body", () => {
		const vault = makeVault();
		const notePath = path.join(vault, "note.md");
		fs.writeFileSync(
			notePath,
			"---\ntitle: Start\nstatus: draft\nold: keep\n---\n\nBody text",
			"utf8",
		);

		const config: ParaObsidianConfig = { vault };

		const dryRun = updateFrontmatterFile(config, "note.md", {
			set: { status: "active" },
			unset: ["old"],
			dryRun: true,
		});

		expect(dryRun.wouldChange).toBe(true);
		expect(dryRun.updated).toBe(false);

		const result = updateFrontmatterFile(config, "note.md", {
			set: { status: "active" },
			unset: ["old"],
		});

		expect(result.updated).toBe(true);
		expect(result.changes.length).toBeGreaterThan(0);
		const content = fs.readFileSync(notePath, "utf8");
		expect(content).toContain("status: active");
		expect(content).not.toContain("old:");
		expect(content.trim().endsWith("Body text")).toBe(true);
	});
});

describe("bulk frontmatter validation", () => {
	const makeVault = () => {
		const vault = fs.mkdtempSync(path.join(os.tmpdir(), "para-fm-bulk-"));

		// Create test directory structure
		const projectsDir = path.join(vault, "01_Projects");
		const areasDir = path.join(vault, "02_Areas");
		fs.mkdirSync(projectsDir);
		fs.mkdirSync(areasDir);

		return { vault, projectsDir, areasDir };
	};

	it("validates multiple files and returns summary statistics", () => {
		const { vault, projectsDir, areasDir } = makeVault();

		// Create valid project note
		fs.writeFileSync(
			path.join(projectsDir, "Valid Project.md"),
			`---
type: project
title: Valid Project
created: 2024-01-01
status: active
tags:
  - project
template_version: 2
---
Body`,
			"utf8",
		);

		// Create invalid project note (missing required fields)
		fs.writeFileSync(
			path.join(projectsDir, "Invalid Project.md"),
			`---
type: project
title: Invalid Project
---
Body`,
			"utf8",
		);

		// Create valid area note
		fs.writeFileSync(
			path.join(areasDir, "Valid Area.md"),
			`---
type: area
title: Valid Area
created: 2024-01-01
tags:
  - area
template_version: 2
---
Body`,
			"utf8",
		);

		const config: ParaObsidianConfig = {
			vault,
			defaultSearchDirs: ["01_Projects", "02_Areas"],
			templateVersions: { project: 2, area: 2 },
			frontmatterRules: {
				project: {
					required: {
						type: { type: "enum", enum: ["project"] },
						title: { type: "string" },
						created: { type: "date" },
						status: { type: "string" },
						tags: { type: "array", includes: ["project"] },
						template_version: { type: "number" },
					},
				},
				area: {
					required: {
						type: { type: "enum", enum: ["area"] },
						title: { type: "string" },
						created: { type: "date" },
						tags: { type: "array", includes: ["area"] },
						template_version: { type: "number" },
					},
				},
			},
		};

		const result = validateFrontmatterBulk(config, {});

		expect(result.summary.total).toBe(3);
		expect(result.summary.valid).toBe(2);
		expect(result.summary.invalid).toBe(1);
		expect(result.summary.byType.project).toBeDefined();
		expect(result.summary.byType.project?.total).toBe(2);
		expect(result.summary.byType.project?.valid).toBe(1);
		expect(result.summary.byType.project?.invalid).toBe(1);
		expect(result.summary.byType.area).toBeDefined();
		expect(result.summary.byType.area?.total).toBe(1);
		expect(result.summary.byType.area?.valid).toBe(1);
		expect(result.issues).toHaveLength(3);
	});

	it("filters by note type when specified", () => {
		const { vault, projectsDir, areasDir } = makeVault();

		fs.writeFileSync(
			path.join(projectsDir, "Project.md"),
			`---
type: project
title: Project
created: 2024-01-01
status: active
tags:
  - project
template_version: 2
---
Body`,
			"utf8",
		);

		fs.writeFileSync(
			path.join(areasDir, "Area.md"),
			`---
type: area
title: Area
created: 2024-01-01
tags:
  - area
template_version: 2
---
Body`,
			"utf8",
		);

		const config: ParaObsidianConfig = {
			vault,
			defaultSearchDirs: ["01_Projects", "02_Areas"],
			templateVersions: { project: 2, area: 2 },
			frontmatterRules: {
				project: {
					required: {
						type: { type: "enum", enum: ["project"] },
						title: { type: "string" },
						created: { type: "date" },
						status: { type: "string" },
						tags: { type: "array", includes: ["project"] },
						template_version: { type: "number" },
					},
				},
			},
		};

		const result = validateFrontmatterBulk(config, { type: "project" });

		expect(result.summary.total).toBe(1);
		expect(result.issues).toHaveLength(1);
		expect(result.issues[0]?.type).toBe("project");
	});

	it("uses specified directories when provided", () => {
		const { vault, projectsDir, areasDir } = makeVault();

		fs.writeFileSync(
			path.join(projectsDir, "Project.md"),
			`---
type: project
title: Project
---
Body`,
			"utf8",
		);

		fs.writeFileSync(
			path.join(areasDir, "Area.md"),
			`---
type: area
title: Area
---
Body`,
			"utf8",
		);

		const config: ParaObsidianConfig = {
			vault,
			templateVersions: { project: 2 },
		};

		const result = validateFrontmatterBulk(config, { dirs: ["01_Projects"] });

		expect(result.summary.total).toBe(1);
		expect(result.issues[0]?.file).toContain("01_Projects");
	});

	it("handles validation errors gracefully", () => {
		const vault = fs.mkdtempSync(path.join(os.tmpdir(), "para-fm-bulk-"));

		// Create file with invalid YAML
		fs.writeFileSync(
			path.join(vault, "broken.md"),
			`---
type: project
invalid: [unclosed
---
Body`,
			"utf8",
		);

		const config: ParaObsidianConfig = {
			vault,
			defaultSearchDirs: ["."],
		};

		const result = validateFrontmatterBulk(config, {});

		expect(result.summary.total).toBe(1);
		expect(result.summary.invalid).toBe(1);
		expect(result.issues[0]?.valid).toBe(false);
		expect(result.issues[0]?.errors).toHaveLength(1);
		expect(result.issues[0]?.errors[0]?.field).toBe("_validation");
	});

	it("reports detailed errors for each invalid file", () => {
		const { vault, projectsDir } = makeVault();

		fs.writeFileSync(
			path.join(projectsDir, "Missing Fields.md"),
			`---
type: project
title: Test
---
Body`,
			"utf8",
		);

		const config: ParaObsidianConfig = {
			vault,
			defaultSearchDirs: ["01_Projects"],
			templateVersions: { project: 2 },
			frontmatterRules: {
				project: {
					required: {
						type: { type: "enum", enum: ["project"] },
						title: { type: "string" },
						created: { type: "date" },
						status: { type: "string" },
						template_version: { type: "number" },
					},
				},
			},
		};

		const result = validateFrontmatterBulk(config, {});

		expect(result.summary.invalid).toBe(1);
		const invalidFile = result.issues.find((f) => !f.valid);
		expect(invalidFile).toBeDefined();
		expect(invalidFile?.errors.length).toBeGreaterThan(0);
		expect(invalidFile?.errors.some((e) => e.field === "created")).toBe(true);
		expect(invalidFile?.errors.some((e) => e.field === "status")).toBe(true);
		expect(
			invalidFile?.errors.some((e) => e.field === "template_version"),
		).toBe(true);
	});
});
