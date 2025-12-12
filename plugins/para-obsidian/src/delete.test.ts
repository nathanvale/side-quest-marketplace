import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";

import { loadConfig } from "./config";
import { deleteFile } from "./delete";
import { createTestVault, writeVaultFile } from "./test-utils";

describe("deleteFile", () => {
	it("deletes a file when confirmed", () => {
		const vault = createTestVault();
		writeVaultFile(vault, "note.md", "hi");
		process.env.PARA_VAULT = vault;
		const cfg = loadConfig({ cwd: vault });
		const result = deleteFile(cfg, { file: "note.md", confirm: true });
		expect(result.deleted).toBe(true);
		expect(fs.existsSync(path.join(vault, "note.md"))).toBe(false);
	});

	it("throws without confirm", () => {
		const vault = createTestVault();
		writeVaultFile(vault, "note.md", "hi");
		process.env.PARA_VAULT = vault;
		const cfg = loadConfig({ cwd: vault });
		expect(() =>
			deleteFile(cfg, { file: "note.md", confirm: false }),
		).toThrow();
	});
});
