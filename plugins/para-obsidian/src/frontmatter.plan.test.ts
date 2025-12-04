import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { ParaObsidianConfig } from "./config";
import { planTemplateVersionBump } from "./frontmatter";

function makeVault(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), "para-plan-"));
}

function writeNote(vault: string, rel: string, content: string) {
	const abs = path.join(vault, rel);
	fs.mkdirSync(path.dirname(abs), { recursive: true });
	fs.writeFileSync(abs, content, "utf8");
}

describe("planTemplateVersionBump", () => {
	it("summarizes outdated and current template versions by type", () => {
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
		writeNote(
			vault,
			"missing.md",
			`---
title: No Type
---
Body`,
		);

		const config: ParaObsidianConfig = {
			vault,
			templateVersions: { project: 2, area: 2 },
		};

		const plan = planTemplateVersionBump(config, {
			type: "project",
			toVersion: 2,
		});

		expect(plan.type).toBe("project");
		expect(plan.targetVersion).toBe(2);
		expect(plan.outdated).toBe(1);
		expect(plan.missingType).toBe(1);
		expect(plan.typeMismatch).toBe(1);
		expect(plan.entries.length).toBe(3);
	});
});
