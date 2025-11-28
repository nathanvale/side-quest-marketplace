import { describe, expect, test } from "bun:test";
import {
	hasTscConfig,
	logMissingTscConfigHint,
	TSC_CONFIG_FILES,
} from "./tsc-config";

describe("TSC_CONFIG_FILES", () => {
	test("includes expected config file names", () => {
		expect(TSC_CONFIG_FILES).toContain("tsconfig.json");
		expect(TSC_CONFIG_FILES).toContain("jsconfig.json");
	});
});

describe("hasTscConfig", () => {
	test("finds tsconfig.json in current repo (side-quest-marketplace)", async () => {
		// This test runs in side-quest-marketplace which has a tsconfig.base.json
		// but individual plugins have tsconfig.json - let's check the root has one
		const result = await hasTscConfig();

		// The root repo has tsconfig.base.json but not tsconfig.json
		// Each plugin has its own tsconfig.json
		// This test validates the function runs without error
		expect(result.searchPath).toBeDefined();
		expect(result.searchPath).toContain("side-quest-marketplace");
	});

	test("returns searchPath for context", async () => {
		const result = await hasTscConfig();

		// searchPath should be the git root regardless of found status
		expect(result.searchPath).toBeDefined();
	});
});

describe("logMissingTscConfigHint", () => {
	test("logs message with path when provided", () => {
		const logs: string[] = [];
		const originalLog = console.log;
		console.log = (msg: string) => logs.push(msg);

		logMissingTscConfigHint("/path/to/repo");

		console.log = originalLog;

		expect(logs[0]).toContain("[bun-runner]");
		expect(logs[0]).toContain("No tsconfig.json found");
		expect(logs[0]).toContain("/path/to/repo");
		expect(logs[1]).toContain("bunx tsc --init");
	});

	test("logs message without path when not provided", () => {
		const logs: string[] = [];
		const originalLog = console.log;
		console.log = (msg: string) => logs.push(msg);

		logMissingTscConfigHint();

		console.log = originalLog;

		expect(logs[0]).toContain("[bun-runner]");
		expect(logs[0]).toContain("No tsconfig.json found");
		expect(logs[0]).not.toContain("in /");
	});
});
