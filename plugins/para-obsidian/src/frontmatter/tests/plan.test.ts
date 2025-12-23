import { afterEach, describe, expect, it } from "bun:test";
import type { ParaObsidianConfig } from "../../config/index";
import { setupTestVault, useTestVaultCleanup } from "../../testing/utils";
import { planTemplateVersionBump } from "../index";

describe("planTemplateVersionBump", () => {
	const { trackVault, getAfterEachHook } = useTestVaultCleanup();
	afterEach(getAfterEachHook());

	it("summarizes outdated and current template versions by type", () => {
		const vault = setupTestVault({
			"note.md": `---
type: project
title: Test
template_version: 1
---
Body`,
			"skip.md": `---
type: area
title: Skip
template_version: 2
---
Body`,
			"missing.md": `---
title: No Type
---
Body`,
		});
		trackVault(vault);

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
