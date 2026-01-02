import { afterEach, describe, expect, it } from "bun:test";
import { loadConfig } from "../../config/index";
import { validateFrontmatterFile } from "../../frontmatter/index";
import {
	setupTestVault,
	useTestVaultCleanup,
	writeVaultFile,
} from "../../testing/utils";

describe("frontmatter file validation", () => {
	const { trackVault, getAfterEachHook } = useTestVaultCleanup();
	afterEach(getAfterEachHook());

	it("validates a project frontmatter", () => {
		const vault = setupTestVault({}, { createTemplatesDir: true });
		trackVault(vault);

		writeVaultFile(
			vault,
			"01_Projects/🎯 Test.md",
			`---
title: 🎯 Test
created: 2025-01-01
type: project
status: active
start_date: 2025-01-01
target_completion: 2025-12-31
area: "[[Health]]"
template_version: 4
tags: [project]
---
Body`,
		);

		const cfg = loadConfig({ cwd: vault });
		const result = validateFrontmatterFile(cfg, "01_Projects/🎯 Test.md");
		expect(result.valid).toBe(true);
		expect(result.issues).toHaveLength(0);
	});

	it("reports issues for missing required fields", () => {
		const vault = setupTestVault({}, { createTemplatesDir: true });
		trackVault(vault);

		writeVaultFile(
			vault,
			"01_Projects/Bad.md",
			`---
title: Bad
type: project
---
Body`,
		);

		const cfg = loadConfig({ cwd: vault });
		const result = validateFrontmatterFile(cfg, "01_Projects/Bad.md");
		expect(result.valid).toBe(false);
		expect(result.issues.length).toBeGreaterThan(0);
	});
});
