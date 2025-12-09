import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "./config";
import { buildIndex, loadIndex, saveIndex } from "./indexer";

function makeTmpDir(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), "para-obsidian-"));
}

function writeFile(vault: string, rel: string, content: string) {
	const full = path.join(vault, rel);
	fs.mkdirSync(path.dirname(full), { recursive: true });
	fs.writeFileSync(full, content, "utf8");
}

describe("indexer", () => {
	it("builds and loads an index", () => {
		const vault = makeTmpDir();
		writeFile(
			vault,
			"note.md",
			`---
title: Note
tags: [a, b]
---

# Heading
`,
		);
		process.env.PARA_VAULT = vault;
		const cfg = loadConfig({ cwd: vault });
		// Pass explicit directory since temp vault doesn't have PARA folders
		const idx = buildIndex(cfg, ".");
		const indexPath = saveIndex(cfg, idx);
		expect(fs.existsSync(indexPath)).toBe(true);

		const loaded = loadIndex(cfg);
		expect(loaded?.entries.length).toBe(1);
		expect(loaded?.entries[0]?.headings[0]).toBe("Heading");
	});
});
