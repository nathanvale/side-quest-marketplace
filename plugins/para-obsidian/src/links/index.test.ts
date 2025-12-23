import { afterEach, describe, expect, it } from "bun:test";
import path from "node:path";
import { pathExistsSync, readTextFileSync } from "@sidequest/core/fs";

import { loadConfig } from "../config/index";
import {
	createTestVault,
	useTestVaultCleanup,
	writeVaultFile,
} from "../testing/utils";
import { renameWithLinkRewrite } from "./index";

describe("renameWithLinkRewrite", () => {
	const { trackVault, getAfterEachHook } = useTestVaultCleanup();
	afterEach(getAfterEachHook());

	/**
	 * Helper function to set up test vault with automatic cleanup tracking
	 */
	function setupTest(): string {
		const vault = createTestVault();
		trackVault(vault);
		return vault;
	}

	it("renames file and rewrites wikilinks", () => {
		const vault = setupTest();
		writeVaultFile(vault, "old.md", "# Old");
		writeVaultFile(vault, "other.md", "See [[old]]");
		const cfg = loadConfig({ cwd: vault });

		const result = renameWithLinkRewrite(cfg, {
			from: "old.md",
			to: "new.md",
		});

		expect(result.moved).toBe(true);
		expect(result.rewrites[0]?.changes).toBe(1);
		const updated = readTextFileSync(path.join(vault, "other.md"));
		expect(updated.includes("[[new]]")).toBe(true);
		expect(pathExistsSync(path.join(vault, "new.md"))).toBe(true);
	});

	it("supports dry-run", () => {
		const vault = setupTest();
		writeVaultFile(vault, "old.md", "# Old");
		writeVaultFile(vault, "other.md", "See [[old]]");
		const cfg = loadConfig({ cwd: vault });

		const result = renameWithLinkRewrite(cfg, {
			from: "old.md",
			to: "new.md",
			dryRun: true,
		});

		expect(result.moved).toBe(false);
		expect(pathExistsSync(path.join(vault, "old.md"))).toBe(true);
	});
});
