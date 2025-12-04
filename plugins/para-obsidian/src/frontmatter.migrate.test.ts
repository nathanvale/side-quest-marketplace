import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { ParaObsidianConfig } from "./config";
import {
	applyVersionPlan,
	migrateAllTemplateVersions,
	migrateTemplateVersion,
	planTemplateVersionBump,
} from "./frontmatter";
import { MIGRATIONS } from "./migrations";

function makeVault(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), "para-migrate-"));
}

function writeNote(vault: string, rel: string, content: string) {
	const abs = path.join(vault, rel);
	fs.mkdirSync(path.dirname(abs), { recursive: true });
	fs.writeFileSync(abs, content, "utf8");
}

describe("migrateTemplateVersion", () => {
	it("sets missing template_version to expected", () => {
		const vault = makeVault();
		writeNote(
			vault,
			"note.md",
			`---
type: project
title: Test
---
Body`,
		);

		const config: ParaObsidianConfig = {
			vault,
			templateVersions: { project: 2 },
		};

		const result = migrateTemplateVersion(config, "note.md", {
			migrate: MIGRATIONS,
		});
		expect(result.updated).toBe(true);
		expect(result.toVersion).toBe(2);
		expect(result.wouldChange).toBe(true);
		const content = fs.readFileSync(path.join(vault, "note.md"), "utf8");
		expect(content).toContain("template_version: 2");
	});

	it("migrates all notes under a directory", () => {
		const vault = makeVault();
		writeNote(
			vault,
			"note.md",
			`---
type: project
title: Test
template_version: 1
---
Body`,
		);
		writeNote(
			vault,
			"skip.md",
			`---
type: area
title: Skip
template_version: 1
---
Body`,
		);

		const config: ParaObsidianConfig = {
			vault,
			templateVersions: { project: 3, area: 2 },
		};

		const summary = migrateAllTemplateVersions(config, { migrate: MIGRATIONS });
		expect(summary.wouldUpdate).toBe(2);
		expect(summary.updated).toBe(2);
		expect(summary.skipped).toBe(0);
		expect(summary.changes.length).toBeGreaterThanOrEqual(0);
		const migrated = fs.readFileSync(path.join(vault, "note.md"), "utf8");
		expect(migrated).toContain("template_version: 3");
	});

	it("updates outdated version", () => {
		const vault = makeVault();
		writeNote(
			vault,
			"note.md",
			`---
type: project
title: Test
template_version: 1
---
Body`,
		);

		const config: ParaObsidianConfig = {
			vault,
			templateVersions: { project: 3 },
		};

		const result = migrateTemplateVersion(config, "note.md", {
			migrate: MIGRATIONS,
		});
		expect(result.fromVersion).toBe(1);
		expect(result.toVersion).toBe(3);
		expect(result.wouldChange).toBe(true);
		expect(Array.isArray(result.changes ?? [])).toBe(true);
		const content = fs.readFileSync(path.join(vault, "note.md"), "utf8");
		expect(content).toContain("template_version: 3");
	});

	it("fills defaults for task migration", () => {
		const vault = makeVault();
		writeNote(
			vault,
			"task.md",
			`---
type: task
title: Task
template_version: 1
---
Body`,
		);

		const config: ParaObsidianConfig = {
			vault,
			templateVersions: { task: 2 },
		};

		const result = migrateTemplateVersion(config, "task.md", {
			migrate: MIGRATIONS,
		});
		expect(result.toVersion).toBe(2);
		expect((result.changes ?? []).length).toBeGreaterThan(0);
		const content = fs.readFileSync(path.join(vault, "task.md"), "utf8");
		expect(content).toContain("status:");
		expect(content).toContain("effort:");
		expect(content).toContain("task_type:");
		expect(content).toContain("template_version: 2");
	});

	it("applies a plan to migrate only outdated files", () => {
		const vault = makeVault();
		writeNote(
			vault,
			"project.md",
			`---
type: project
title: Test
template_version: 1
---
Body`,
		);
		writeNote(
			vault,
			"project-current.md",
			`---
type: project
title: Test
template_version: 2
---
Body`,
		);

		const config: ParaObsidianConfig = {
			vault,
			templateVersions: { project: 2 },
		};

		const plan = planTemplateVersionBump(config, {
			type: "project",
			toVersion: 2,
		});

		const result = applyVersionPlan(config, {
			plan,
			migrate: MIGRATIONS,
		});

		expect(result.updated).toBe(1);
		expect(result.errors).toBe(0);
		const migrated = fs.readFileSync(path.join(vault, "project.md"), "utf8");
		expect(migrated).toContain("template_version: 2");
		const untouched = fs.readFileSync(
			path.join(vault, "project-current.md"),
			"utf8",
		);
		expect(untouched).toContain("template_version: 2");
	});

	it("skips entries when status filter excludes them", () => {
		const vault = makeVault();
		writeNote(
			vault,
			"project.md",
			`---
type: project
title: Test
template_version: 1
---
Body`,
		);

		const config: ParaObsidianConfig = {
			vault,
			templateVersions: { project: 2 },
		};

		const plan = planTemplateVersionBump(config, {
			type: "project",
			toVersion: 2,
		});

		const result = applyVersionPlan(config, {
			plan,
			statuses: ["current"],
			migrate: MIGRATIONS,
		});

		expect(result.updated).toBe(0);
		expect(result.wouldUpdate).toBe(0);
		expect(result.selected.length).toBe(0);
	});

	it("throws when type missing", () => {
		const vault = makeVault();
		writeNote(
			vault,
			"note.md",
			`---
title: Test
---
Body`,
		);

		const config: ParaObsidianConfig = { vault };
		expect(() => migrateTemplateVersion(config, "note.md")).toThrow(
			"template version configured",
		);
	});
});
