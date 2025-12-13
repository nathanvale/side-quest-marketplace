import { describe, expect, it } from "bun:test";

import type { ParaObsidianConfig } from "../config/index";
import {
	resolvePARAFolders,
	type SemanticHit,
	type SemanticSearchOptions,
	semanticSearch,
} from "./semantic";

describe("resolvePARAFolders", () => {
	const config: ParaObsidianConfig = {
		vault: "/tmp",
		paraFolders: {
			inbox: "00 Inbox",
			projects: "01 Projects",
			areas: "02 Areas",
			resources: "03 Resources",
			archives: "04 Archives",
		},
	};

	it("resolves known PARA shortcuts to folder paths", () => {
		const result = resolvePARAFolders(config, ["projects", "areas"]);
		expect(result).toEqual(["01 Projects", "02 Areas"]);
	});

	it("handles case-insensitive shortcuts", () => {
		const result = resolvePARAFolders(config, ["PROJECTS", "Areas"]);
		expect(result).toEqual(["01 Projects", "02 Areas"]);
	});

	it("passes through unknown shortcuts as-is", () => {
		const result = resolvePARAFolders(config, ["projects", "custom-folder"]);
		expect(result).toEqual(["01 Projects", "custom-folder"]);
	});

	it("returns empty array for empty input", () => {
		const result = resolvePARAFolders(config, []);
		expect(result).toEqual([]);
	});

	it("handles all PARA folders", () => {
		const result = resolvePARAFolders(config, [
			"inbox",
			"projects",
			"areas",
			"resources",
			"archives",
		]);
		expect(result).toEqual([
			"00 Inbox",
			"01 Projects",
			"02 Areas",
			"03 Resources",
			"04 Archives",
		]);
	});
});

describe("semanticSearch", () => {
	it("delegates to runner and returns hits", async () => {
		const cfg: ParaObsidianConfig = {
			vault: "/tmp",
			paraFolders: { projects: "01 Projects" },
			defaultParaSearchFolders: ["projects"],
		};
		const hits: SemanticHit[] = [
			{ file: "note.md", score: 0.9, line: 10, snippet: "Example" },
		];
		const runner = async () => hits;
		const result = await semanticSearch(cfg, { query: "test" }, runner);
		expect(result[0]?.file).toBe("note.md");
		expect(result[0]?.dir).toBe("01 Projects");
	});

	it("throws on empty query", async () => {
		const cfg: ParaObsidianConfig = { vault: "/tmp" };
		await expect(
			semanticSearch(cfg, { query: "" }, async () => []),
		).rejects.toThrow("query is required");
	});

	it("uses explicit dir when provided", async () => {
		const cfg: ParaObsidianConfig = { vault: "/tmp" };
		let capturedDir: string | undefined;
		const runner = async (
			_config: ParaObsidianConfig,
			opts: SemanticSearchOptions,
		): Promise<readonly SemanticHit[]> => {
			capturedDir = opts.dir as string;
			return [];
		};
		await semanticSearch(cfg, { query: "test", dir: "Custom/Path" }, runner);
		expect(capturedDir).toBe("Custom/Path");
	});

	it("resolves para shortcuts to folders", async () => {
		const cfg: ParaObsidianConfig = {
			vault: "/tmp",
			paraFolders: {
				projects: "01 Projects",
				areas: "02 Areas",
			},
		};
		const capturedDirs: string[] = [];
		const runner = async (
			_config: ParaObsidianConfig,
			opts: SemanticSearchOptions,
		): Promise<readonly SemanticHit[]> => {
			if (opts.dir) capturedDirs.push(opts.dir as string);
			return [];
		};
		await semanticSearch(
			cfg,
			{ query: "test", para: "projects,areas" },
			runner,
		);
		expect(capturedDirs).toEqual(["01 Projects", "02 Areas"]);
	});

	it("uses default PARA folders when no dir or para specified", async () => {
		const cfg: ParaObsidianConfig = {
			vault: "/tmp",
			paraFolders: {
				inbox: "00 Inbox",
				projects: "01 Projects",
			},
			defaultParaSearchFolders: ["inbox", "projects"],
		};
		const capturedDirs: string[] = [];
		const runner = async (
			_config: ParaObsidianConfig,
			opts: SemanticSearchOptions,
		): Promise<readonly SemanticHit[]> => {
			if (opts.dir) capturedDirs.push(opts.dir as string);
			return [];
		};
		await semanticSearch(cfg, { query: "test" }, runner);
		expect(capturedDirs).toEqual(["00 Inbox", "01 Projects"]);
	});

	it("deduplicates results by file keeping highest score", async () => {
		const cfg: ParaObsidianConfig = {
			vault: "/tmp",
			paraFolders: { projects: "01 Projects", areas: "02 Areas" },
			defaultParaSearchFolders: ["projects", "areas"],
		};
		let callCount = 0;
		const runner = async () => {
			callCount++;
			// Return same file with different scores from different dirs
			if (callCount === 1) {
				return [{ file: "note.md", score: 0.7, snippet: "First" }];
			}
			return [{ file: "note.md", score: 0.9, snippet: "Second" }];
		};
		const result = await semanticSearch(cfg, { query: "test" }, runner);
		expect(result.length).toBe(1);
		expect(result[0]?.score).toBe(0.9); // Higher score wins
	});
});
