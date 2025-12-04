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

describe("renameWithLinkRewrite", () => {
	it("renames file and rewrites wikilinks", () => {
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
		expect(result.rewrites[0]?.changes).toBe(1);
		const updated = fs.readFileSync(path.join(vault, "other.md"), "utf8");
		expect(updated.includes("[[new]]")).toBe(true);
		expect(fs.existsSync(path.join(vault, "new.md"))).toBe(true);
	});

	it("supports dry-run", () => {
		const vault = makeTmpDir();
		writeFile(vault, "old.md", "# Old");
		writeFile(vault, "other.md", "See [[old]]");
		process.env.PARA_VAULT = vault;
		const cfg = loadConfig({ cwd: vault });

		const result = renameWithLinkRewrite(cfg, {
			from: "old.md",
			to: "new.md",
			dryRun: true,
		});

		expect(result.moved).toBe(false);
		expect(fs.existsSync(path.join(vault, "old.md"))).toBe(true);
	});
});
