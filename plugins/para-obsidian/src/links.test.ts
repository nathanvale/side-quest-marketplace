import { describe, expect, it } from "bun:test";
import path from "node:path";
import { pathExistsSync, readTextFileSync } from "@sidequest/core/fs";

import { loadConfig } from "./config";
import { renameWithLinkRewrite } from "./links";
import { createTestVault, writeVaultFile } from "./test-utils";

describe("renameWithLinkRewrite", () => {
	it("renames file and rewrites wikilinks", () => {
		const vault = createTestVault();
		writeVaultFile(vault, "old.md", "# Old");
		writeVaultFile(vault, "other.md", "See [[old]]");
		process.env.PARA_VAULT = vault;
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
		const vault = createTestVault();
		writeVaultFile(vault, "old.md", "# Old");
		writeVaultFile(vault, "other.md", "See [[old]]");
		process.env.PARA_VAULT = vault;
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
