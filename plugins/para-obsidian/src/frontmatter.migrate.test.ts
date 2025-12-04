import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { ParaObsidianConfig } from "./config";
import {
	migrateAllTemplateVersions,
	migrateTemplateVersion,
} from "./frontmatter";

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

		const result = migrateTemplateVersion(config, "note.md");
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
template_version: 2
---
Body`,
		);

		const config: ParaObsidianConfig = {
			vault,
			templateVersions: { project: 3, area: 2 },
		};

		const summary = migrateAllTemplateVersions(config);
		expect(summary.wouldUpdate).toBe(1);
		expect(summary.updated).toBe(1);
		expect(summary.skipped).toBe(1);
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

		const result = migrateTemplateVersion(config, "note.md");
		expect(result.fromVersion).toBe(1);
		expect(result.toVersion).toBe(3);
		expect(result.wouldChange).toBe(true);
		const content = fs.readFileSync(path.join(vault, "note.md"), "utf8");
		expect(content).toContain("template_version: 3");
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
