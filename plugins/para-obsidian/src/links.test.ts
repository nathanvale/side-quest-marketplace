import { describe, expect, it } from "bun:test";
import os from "node:os";
import path from "node:path";
import {
	ensureDirSync,
	pathExistsSync,
	readTextFileSync,
	writeTextFileSync,
} from "@sidequest/core/fs";

import { loadConfig } from "./config";
import { renameWithLinkRewrite } from "./links";

function makeTmpDir(): string {
	const dir = path.join(os.tmpdir(), `para-obsidian-${crypto.randomUUID()}`);
	ensureDirSync(dir);
	return dir;
}

function writeFile(vault: string, rel: string, content: string) {
	const full = path.join(vault, rel);
	ensureDirSync(path.dirname(full));
	writeTextFileSync(full, content);
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
		const updated = readTextFileSync(path.join(vault, "other.md"));
		expect(updated.includes("[[new]]")).toBe(true);
		expect(pathExistsSync(path.join(vault, "new.md"))).toBe(true);
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
		expect(pathExistsSync(path.join(vault, "old.md"))).toBe(true);
	});
});
