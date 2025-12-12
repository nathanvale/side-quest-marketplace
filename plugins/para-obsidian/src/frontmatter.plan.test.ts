import { describe, expect, it } from "bun:test";
import { createTempDir, writeTestFile } from "@sidequest/core/testing";

import type { ParaObsidianConfig } from "./config";
import { planTemplateVersionBump } from "./frontmatter";

describe("planTemplateVersionBump", () => {
	it("summarizes outdated and current template versions by type", () => {
		const vault = createTempDir("para-plan-");
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
template_version: 2
---
Body`,
		);
		writeTestFile(
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
