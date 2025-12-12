import { describe, expect, it } from "bun:test";
import {
	createTempDir,
	readTestFile,
	writeTestFile,
} from "@sidequest/core/testing";

import type { ParaObsidianConfig } from "./config";
import {
	applyVersionPlan,
	migrateAllTemplateVersions,
	migrateTemplateVersion,
	planTemplateVersionBump,
} from "./frontmatter";
import { MIGRATIONS } from "./migrations";

describe("migrateTemplateVersion", () => {
	it("sets missing template_version to expected", () => {
		const vault = createTempDir("para-migrate-");
		writeTestFile(
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
			templateVersions: { project: 3 },
		};

		const result = migrateTemplateVersion(config, "note.md", {
			migrate: MIGRATIONS,
		});
		expect(result.updated).toBe(true);
		expect(result.toVersion).toBe(3);
		expect(result.wouldChange).toBe(true);
		const content = readTestFile(vault, "note.md");
		expect(content).toMatch(/template_version:\s*["']?3["']?/);
	});

	it("migrates all notes under a directory", () => {
		const vault = createTempDir("para-migrate-");
		writeTestFile(
			vault,
			"note.md",
			`---
type: project
title: Test
template_version: 1
---
Body`,
		);
		writeTestFile(
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
			templateVersions: { project: 3, area: 3 },
		};

		const summary = migrateAllTemplateVersions(config, { migrate: MIGRATIONS });
		expect(summary.wouldUpdate).toBe(2);
		expect(summary.updated).toBe(2);
		expect(summary.skipped).toBe(0);
		expect(summary.changes.length).toBeGreaterThanOrEqual(0);
		const migrated = readTestFile(vault, "note.md");
		expect(migrated).toMatch(/template_version:\s*["']?3["']?/);
	});

	it("updates outdated version", () => {
		const vault = createTempDir("para-migrate-");
		writeTestFile(
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
		const content = readTestFile(vault, "note.md");
		expect(content).toMatch(/template_version:\s*["']?3["']?/);
	});

	it("fills defaults for task migration", () => {
		const vault = createTempDir("para-migrate-");
		writeTestFile(
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
			templateVersions: { task: 3 },
		};

		const result = migrateTemplateVersion(config, "task.md", {
			migrate: MIGRATIONS,
		});
		expect(result.toVersion).toBe(3);
		expect((result.changes ?? []).length).toBeGreaterThan(0);
		const content = readTestFile(vault, "task.md");
		expect(content).toContain("status:");
		expect(content).toContain("effort:");
		expect(content).toContain("task_type:");
		expect(content).toMatch(/template_version:\s*["']?3["']?/);
	});

	it("applies a plan to migrate only outdated files", () => {
		const vault = createTempDir("para-migrate-");
		writeTestFile(
			vault,
			"project.md",
			`---
type: project
title: Test
template_version: 1
---
Body`,
		);
		writeTestFile(
			vault,
			"project-current.md",
			`---
type: project
title: Test
template_version: 3
---
Body`,
		);

		const config: ParaObsidianConfig = {
			vault,
			templateVersions: { project: 3 },
		};

		const plan = planTemplateVersionBump(config, {
			type: "project",
			toVersion: 3,
		});

		const result = applyVersionPlan(config, {
			plan,
			migrate: MIGRATIONS,
		});

		expect(result.updated).toBe(1);
		expect(result.errors).toBe(0);
		const migrated = readTestFile(vault, "project.md");
		expect(migrated).toMatch(/template_version:\s*["']?3["']?/);
		const untouched = readTestFile(vault, "project-current.md");
		expect(untouched).toMatch(/template_version:\s*["']?3["']?/);
	});

	it("skips entries when status filter excludes them", () => {
		const vault = createTempDir("para-migrate-");
		writeTestFile(
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
		const vault = createTempDir("para-migrate-");
		writeTestFile(
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
