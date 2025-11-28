import { describe, expect, test } from "bun:test";
import {
	BIOME_CONFIG_FILES,
	hasBiomeConfig,
	logMissingConfigHint,
} from "./biome-config";

describe("BIOME_CONFIG_FILES", () => {
	test("includes expected config file names", () => {
		expect(BIOME_CONFIG_FILES).toContain("biome.json");
		expect(BIOME_CONFIG_FILES).toContain("biome.jsonc");
	});
});

describe("hasBiomeConfig", () => {
	test("finds biome.json in current repo (side-quest-marketplace)", async () => {
		// This test runs in side-quest-marketplace which has a biome.json
		const result = await hasBiomeConfig();

		expect(result.found).toBe(true);
		expect(result.configPath).toContain("biome.json");
		expect(result.searchPath).toBeDefined();
	});

	test("returns searchPath even when config found", async () => {
		const result = await hasBiomeConfig();

		// searchPath should be the git root
		expect(result.searchPath).toBeDefined();
		expect(result.searchPath).toContain("side-quest-marketplace");
	});
});

describe("logMissingConfigHint", () => {
	test("logs message with path when provided", () => {
		const logs: string[] = [];
		const originalLog = console.log;
		console.log = (msg: string) => logs.push(msg);

		logMissingConfigHint("/path/to/repo");

		console.log = originalLog;

		expect(logs[0]).toContain("[bun-runner]");
		expect(logs[0]).toContain("No biome.json found");
		expect(logs[0]).toContain("/path/to/repo");
		expect(logs[1]).toContain("bunx @biomejs/biome init");
	});

	test("logs message without path when not provided", () => {
		const logs: string[] = [];
		const originalLog = console.log;
		console.log = (msg: string) => logs.push(msg);

		logMissingConfigHint();

		console.log = originalLog;

		expect(logs[0]).toContain("[bun-runner]");
		expect(logs[0]).toContain("No biome.json found");
		expect(logs[0]).not.toContain("in /");
	});
});
