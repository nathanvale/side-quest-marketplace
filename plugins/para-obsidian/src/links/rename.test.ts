import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";

import { withTempVault, writeVaultFile } from "../testing/utils";
import { renameWithLinkRewrite } from "./index";

describe("cli rename helper", () => {
	it("renames and rewrites links", async () => {
		await withTempVault(async (vault, config) => {
			writeVaultFile(vault, "old.md", "# Old");
			writeVaultFile(vault, "other.md", "See [[old]]");

			const result = renameWithLinkRewrite(config, {
				from: "old.md",
				to: "new.md",
			});

			expect(result.moved).toBe(true);
			expect(fs.existsSync(path.join(vault, "new.md"))).toBe(true);
			const updated = fs.readFileSync(path.join(vault, "other.md"), "utf8");
			expect(updated.includes("[[new]]")).toBe(true);
		});
	});
});
