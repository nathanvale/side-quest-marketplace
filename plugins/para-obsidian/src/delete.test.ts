import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadConfig } from "./config";
import { deleteFile } from "./delete";

function makeTmpDir(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), "para-obsidian-"));
}

function writeFile(vault: string, rel: string, content: string) {
	const full = path.join(vault, rel);
	fs.mkdirSync(path.dirname(full), { recursive: true });
	fs.writeFileSync(full, content, "utf8");
}

describe("deleteFile", () => {
	it("deletes a file when confirmed", () => {
		const vault = makeTmpDir();
		writeFile(vault, "note.md", "hi");
		process.env.PARA_VAULT = vault;
		const cfg = loadConfig({ cwd: vault });
		const result = deleteFile(cfg, { file: "note.md", confirm: true });
		expect(result.deleted).toBe(true);
		expect(fs.existsSync(path.join(vault, "note.md"))).toBe(false);
	});

	it("throws without confirm", () => {
		const vault = makeTmpDir();
		writeFile(vault, "note.md", "hi");
		process.env.PARA_VAULT = vault;
		const cfg = loadConfig({ cwd: vault });
		expect(() =>
			deleteFile(cfg, { file: "note.md", confirm: false }),
		).toThrow();
	});
});
