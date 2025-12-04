import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadConfig } from "./config";
import { renameWithLinkRewrite } from "./links";

function makeTmpDir(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), "para-obsidian-"));
}

function writeFile(vault: string, rel: string, content: string) {
	const full = path.join(vault, rel);
	fs.mkdirSync(path.dirname(full), { recursive: true });
	fs.writeFileSync(full, content, "utf8");
}

describe("cli rename helper", () => {
	it("renames and rewrites links", () => {
		const vault = makeTmpDir();
		writeFile(vault, "old.md", "# Old");
		writeFile(vault, "other.md", "See [[old]]");
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
