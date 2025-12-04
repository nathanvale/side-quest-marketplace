import { describe, expect, it } from "bun:test";

import type { ParaObsidianConfig } from "./config";
import { type SemanticHit, semanticSearch } from "./semantic";

describe("semanticSearch", () => {
	it("delegates to runner and returns hits", async () => {
		const cfg: ParaObsidianConfig = { vault: "/tmp" };
		const hits: SemanticHit[] = [
			{ file: "note.md", score: 0.9, line: 10, snippet: "Example" },
		];
		const runner = async () => hits;
		const result = await semanticSearch(cfg, { query: "test" }, runner);
		expect(result[0]?.file).toBe("note.md");
		expect(result[0]?.dir).toBe(".");
	});

	it("throws on empty query", async () => {
		const cfg: ParaObsidianConfig = { vault: "/tmp" };
		await expect(
			semanticSearch(cfg, { query: "" }, async () => []),
		).rejects.toThrow("query is required");
	});
});
