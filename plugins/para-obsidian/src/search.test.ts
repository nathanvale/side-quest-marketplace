import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadConfig } from "./config";
import { filterByFrontmatter, searchText } from "./search";

function makeTmpDir(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), "para-obsidian-"));
}

function writeFile(vault: string, rel: string, content: string) {
	const full = path.join(vault, rel);
	fs.mkdirSync(path.dirname(full), { recursive: true });
	fs.writeFileSync(full, content, "utf8");
}

describe("search", () => {
	it("finds text with ripgrep", async () => {
		const vault = makeTmpDir();
		// Put file in 00 Inbox (a default PARA folder) so defaultSearchDirs will find it
		writeFile(vault, "00 Inbox/note.md", "hello world");
		process.env.PARA_VAULT = vault;

		const cfg = loadConfig({ cwd: vault });
		const hits = await searchText(cfg, { query: "hello" });
		expect(hits.length).toBe(1);
		expect(hits[0]?.file).toBe("00 Inbox/note.md");
	});

	it("filters by frontmatter and tag", async () => {
		const vault = makeTmpDir();
		// Put files in PARA folders so defaultSearchDirs will find them
		writeFile(
			vault,
			"01 Projects/match.md",
			`---
type: project
tags: [project, x]
---
`,
		);
		writeFile(
			vault,
			"02 Areas/skip.md",
			`---
type: area
tags: [area]
---
`,
		);
		process.env.PARA_VAULT = vault;
		const cfg = loadConfig({ cwd: vault });
		const matches = await filterByFrontmatter(cfg, {
			frontmatter: { type: "project" },
			tag: "project",
		});
		expect(matches).toEqual(["01 Projects/match.md"]);
	});
});
