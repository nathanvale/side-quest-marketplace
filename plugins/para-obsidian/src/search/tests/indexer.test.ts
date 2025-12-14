import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import { loadConfig } from "../../config/index";
import { createTestVault, writeVaultFile } from "../../testing/utils";
import { buildIndex, loadIndex, saveIndex } from "../indexer";

describe("indexer", () => {
	it("builds and loads an index", () => {
		const vault = createTestVault();
		writeVaultFile(
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
