import { describe, expect, it } from "bun:test";

import { loadConfig } from "../config/index";
import { withTempVault, writeVaultFile } from "../testing/utils";
import { filterByFrontmatter, searchText } from "./index";

describe("search", () => {
	it("finds text with ripgrep", async () => {
		await withTempVault(async (vault, cfg) => {
			// Put file in 00 Inbox (a default PARA folder) so defaultSearchDirs will find it
			writeVaultFile(vault, "00 Inbox/note.md", "hello world");

			const hits = await searchText(cfg, { query: "hello" });
			expect(hits.length).toBe(1);
			expect(hits[0]?.file).toBe("00 Inbox/note.md");
		});
	});

	it("filters by frontmatter", async () => {
		await withTempVault(async (vault) => {
			// Put files in PARA folders so defaultSearchDirs will find them
			writeVaultFile(
				vault,
				"01 Projects/match.md",
				`---
type: project
---
`,
			);
			writeVaultFile(
				vault,
				"02 Areas/skip.md",
				`---
type: area
---
`,
			);

			// Load config with explicit vault path (don't rely on process.env)
			const cfg = loadConfig({ cwd: vault });
			const matches = await filterByFrontmatter(cfg, {
				// Explicitly pass directories to search
				dir: ["01 Projects", "02 Areas"],
				frontmatter: { type: "project" },
			});
			expect(matches).toEqual(["01 Projects/match.md"]);
		});
	});
});
