import { describe, expect, it } from "bun:test";

import { loadConfig } from "./config";
import { filterByFrontmatter, searchText } from "./search";
import { createTestVault, writeVaultFile } from "./test-utils";

describe("search", () => {
	it("finds text with ripgrep", async () => {
		const vault = createTestVault();
		// Put file in 00 Inbox (a default PARA folder) so defaultSearchDirs will find it
		writeVaultFile(vault, "00 Inbox/note.md", "hello world");
		process.env.PARA_VAULT = vault;

		const cfg = loadConfig({ cwd: vault });
		const hits = await searchText(cfg, { query: "hello" });
		expect(hits.length).toBe(1);
		expect(hits[0]?.file).toBe("00 Inbox/note.md");
	});

	it("filters by frontmatter and tag", async () => {
		const vault = createTestVault();
		// Put files in PARA folders so defaultSearchDirs will find them
		writeVaultFile(
			vault,
			"01 Projects/match.md",
			`---
type: project
tags: [project, x]
---
`,
		);
		writeVaultFile(
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
