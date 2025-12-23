import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "../config/index";
import {
	createTestVault,
	useTestVaultCleanup,
	writeVaultFile,
} from "../testing/utils";
import { validateFrontmatterFile } from "./index";

describe("frontmatter file validation", () => {
	const { trackVault, getAfterEachHook } = useTestVaultCleanup();
	let originalEnv: NodeJS.ProcessEnv;

	/**
	 * Helper function to set up a test vault and track it for cleanup.
	 * Combines createTestVault() and trackVault() operations.
	 */
	const setupTest = () => {
		const vault = createTestVault();
		trackVault(vault);
		return vault;
	};

	beforeEach(() => {
		originalEnv = { ...process.env };
	});

	afterEach(() => {
		process.env = originalEnv;
		getAfterEachHook()();
	});

	it("validates a project frontmatter", () => {
		const vault = setupTest();
		const templatesDir = path.join(vault, "Templates");
		fs.mkdirSync(templatesDir, { recursive: true });
		process.env.PARA_VAULT = vault;

		writeVaultFile(
			vault,
			"01_Projects/Test.md",
			`---
title: Test
created: 2025-01-01
type: project
status: active
start_date: 2025-01-01
target_completion: 2025-12-31
area: "[[Health]]"
template_version: 4
---
Body`,
		);

		const cfg = loadConfig({ cwd: vault });
		const result = validateFrontmatterFile(cfg, "01_Projects/Test.md");
		expect(result.valid).toBe(true);
		expect(result.issues).toHaveLength(0);
	});

	it("reports issues for missing required fields", () => {
		const vault = setupTest();
		const templatesDir = path.join(vault, "Templates");
		fs.mkdirSync(templatesDir, { recursive: true });
		process.env.PARA_VAULT = vault;

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
