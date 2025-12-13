import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";

import { loadConfig } from "./config/index";
import { renameWithLinkRewrite } from "./links/index";
import { createTestVault, writeVaultFile } from "./test-utils";

describe("cli rename helper", () => {
	it("renames and rewrites links", () => {
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
		expect(fs.existsSync(path.join(vault, "new.md"))).toBe(true);
		const updated = fs.readFileSync(path.join(vault, "other.md"), "utf8");
		expect(updated.includes("[[new]]")).toBe(true);
	});
});
