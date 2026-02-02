/**
 * Tests for create CLI handler.
 *
 * Tests the --no-autocommit and --skip-guard flags for batch mode triage.
 *
 * @module cli/create.test
 */

import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { OutputFormat } from "@side-quest/core/terminal";
import {
	createTestVault,
	initGitRepo,
	useTestVaultCleanup,
	writeVaultFile,
} from "../testing/utils";
import { handleCreate } from "./create";
import type { CommandContext } from "./types";

const RESOURCE_TEMPLATE = `---
type: resource
template_version: 4
resource_type: article
areas: ""
projects: ""
source_format: article
---

# {{title}}

## Layer 1: Captured Notes

<!-- Layer 1 content goes here -->
`;

function createContext(
	vault: string,
	overrides: Partial<CommandContext> = {},
): CommandContext {
	const { loadConfig } = require("../config/index");
	process.env.PARA_VAULT = vault;
	return {
		config: loadConfig({ cwd: vault }),
		positional: [],
		flags: {},
		format: OutputFormat.JSON,
		isJson: true,
		subcommand: undefined,
		...overrides,
	};
}

describe("handleCreate --no-autocommit", () => {
	const { trackVault, getAfterEachHook } = useTestVaultCleanup();
	afterEach(getAfterEachHook());

	test("skips autocommit when --no-autocommit is set", async () => {
		const vault = createTestVault({ gitInit: true });
		trackVault(vault);

		// Create initial commit so git is fully initialized
		await initGitRepo(vault);

		writeVaultFile(vault, "Templates/resource.md", RESOURCE_TEMPLATE);
		writeVaultFile(vault, "03 Resources/.gitkeep", "");

		// Stage and commit template
		await Bun.$`git add . && git commit -m "add template"`.cwd(vault).quiet();

		const ctx = createContext(vault, {
			flags: {
				template: "resource",
				title: "Test Article",
				"no-autocommit": true,
			},
		});

		const result = await handleCreate(ctx);
		expect(result.success).toBe(true);

		// File should exist on disk
		const files = fs.readdirSync(path.join(vault, "03 Resources"));
		const noteFiles = files.filter(
			(f) => f.endsWith(".md") && f !== ".gitkeep",
		);
		expect(noteFiles.length).toBe(1);

		// Git status should show uncommitted changes (file is untracked/staged but not committed)
		const status = Bun.spawnSync(["git", "status", "--porcelain"], {
			cwd: vault,
		});
		const statusOutput = new TextDecoder().decode(status.stdout).trim();
		expect(statusOutput.length).toBeGreaterThan(0); // There should be uncommitted changes
	});

	test("commits normally when --no-autocommit is not set", async () => {
		const vault = createTestVault({ gitInit: true });
		trackVault(vault);

		await initGitRepo(vault);

		writeVaultFile(vault, "Templates/resource.md", RESOURCE_TEMPLATE);
		writeVaultFile(vault, "03 Resources/.gitkeep", "");

		await Bun.$`git add . && git commit -m "add template"`.cwd(vault).quiet();

		const ctx = createContext(vault, {
			flags: {
				template: "resource",
				title: "Test Article Normal",
			},
		});

		const result = await handleCreate(ctx);
		expect(result.success).toBe(true);

		// Git status should be clean (auto-committed)
		const status = Bun.spawnSync(["git", "status", "--porcelain"], {
			cwd: vault,
		});
		const statusOutput = new TextDecoder().decode(status.stdout).trim();
		expect(statusOutput).toBe(""); // Clean working tree
	});
});

describe("handleCreate --skip-guard", () => {
	const { trackVault, getAfterEachHook } = useTestVaultCleanup();
	afterEach(getAfterEachHook());

	test("skips git guard when --skip-guard is set", async () => {
		const vault = createTestVault({ gitInit: true });
		trackVault(vault);

		await initGitRepo(vault);

		writeVaultFile(vault, "Templates/resource.md", RESOURCE_TEMPLATE);
		writeVaultFile(vault, "03 Resources/.gitkeep", "");

		await Bun.$`git add . && git commit -m "add template"`.cwd(vault).quiet();

		// Create a dirty working tree (uncommitted file)
		writeVaultFile(vault, "dirty-file.md", "uncommitted content");

		const ctx = createContext(vault, {
			flags: {
				template: "resource",
				title: "Test With Dirty Tree",
				"skip-guard": true,
				"no-autocommit": true, // Also skip commit so we don't commit the dirty file
			},
		});

		// Should succeed despite dirty working tree
		const result = await handleCreate(ctx);
		expect(result.success).toBe(true);
	});

	test("succeeds with dirty .md file when --skip-guard is set", async () => {
		const vault = createTestVault({ gitInit: true });
		trackVault(vault);

		await initGitRepo(vault);

		writeVaultFile(vault, "Templates/resource.md", RESOURCE_TEMPLATE);
		writeVaultFile(vault, "03 Resources/.gitkeep", "");

		await Bun.$`git add . && git commit -m "add template"`.cwd(vault).quiet();

		// Create uncommitted .md file in a managed folder (triggers git guard)
		writeVaultFile(
			vault,
			"03 Resources/Dirty Note.md",
			"---\ntype: resource\n---\nuncommitted",
		);
		await Bun.$`git add "03 Resources/Dirty Note.md"`.cwd(vault).quiet();

		const ctx = createContext(vault, {
			flags: {
				template: "resource",
				title: "Test With Skip Guard and Dirty MD",
				"skip-guard": true,
				"no-autocommit": true,
			},
		});

		// Should succeed because --skip-guard bypasses the check
		const result = await handleCreate(ctx);
		expect(result.success).toBe(true);
	});
});
