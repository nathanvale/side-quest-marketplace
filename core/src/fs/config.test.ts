import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ConfigAtRootResult, NearestConfigResult } from "./config";
import { findNearestConfig, hasConfigAtRoot } from "./config";

// Tests use the real git repo - the test files are inside it
// We create temporary directories under a known location for isolation

const TEST_DIR = join(import.meta.dir, ".test-scratch-config");

function setup() {
	mkdirSync(TEST_DIR, { recursive: true });
}

function cleanup() {
	rmSync(TEST_DIR, { recursive: true, force: true });
}

describe("hasConfigAtRoot", () => {
	// This function checks at git root, so we test it against the real repo
	// The repo has tsconfig.json at root

	test("finds config that exists at repo root", async () => {
		const result: ConfigAtRootResult = await hasConfigAtRoot(["tsconfig.json"]);
		expect(result.found).toBe(true);
		expect(result.configPath).toContain("tsconfig.json");
		expect(result.searchPath).toBeDefined();
	});

	test("returns not found for non-existent config", async () => {
		const result: ConfigAtRootResult = await hasConfigAtRoot([
			"nonexistent-config-xyz.json",
		]);
		expect(result.found).toBe(false);
		expect(result.searchPath).toBeDefined();
	});

	test("checks files in order and returns first match", async () => {
		// tsconfig.json exists, biome-fake.json does not
		const result: ConfigAtRootResult = await hasConfigAtRoot([
			"biome-fake-xyz.json",
			"tsconfig.json",
		]);
		expect(result.found).toBe(true);
		expect(result.configPath).toContain("tsconfig.json");
	});

	test("returns searchPath even when not found", async () => {
		const result: ConfigAtRootResult = await hasConfigAtRoot([
			"fake-config-xyz.json",
		]);
		expect(result.found).toBe(false);
		expect(result.searchPath).toBeTruthy();
	});
});

describe("findNearestConfig", () => {
	beforeEach(setup);
	afterEach(cleanup);

	test("finds config in same directory as file", async () => {
		// Create a config file in our test dir
		writeFileSync(join(TEST_DIR, "myconfig.json"), "{}");

		const result: NearestConfigResult = await findNearestConfig(
			join(TEST_DIR, "somefile.ts"),
			["myconfig.json"],
		);
		expect(result.found).toBe(true);
		expect(result.configPath).toBe(join(TEST_DIR, "myconfig.json"));
		expect(result.configDir).toBe(TEST_DIR);
	});

	test("walks up to parent directory", async () => {
		const subDir = join(TEST_DIR, "src");
		mkdirSync(subDir, { recursive: true });
		writeFileSync(join(TEST_DIR, "myconfig.json"), "{}");

		const result: NearestConfigResult = await findNearestConfig(
			join(subDir, "index.ts"),
			["myconfig.json"],
		);
		expect(result.found).toBe(true);
		expect(result.configDir).toBe(TEST_DIR);
	});

	test("returns not found when no config exists", async () => {
		const result: NearestConfigResult = await findNearestConfig(
			join(TEST_DIR, "somefile.ts"),
			["nonexistent-config-xyz.json"],
		);
		expect(result.found).toBe(false);
	});

	test("checks multiple config names at each level", async () => {
		writeFileSync(join(TEST_DIR, "alt-config.json"), "{}");

		const result: NearestConfigResult = await findNearestConfig(
			join(TEST_DIR, "somefile.ts"),
			["primary-config.json", "alt-config.json"],
		);
		expect(result.found).toBe(true);
		expect(result.configPath).toBe(join(TEST_DIR, "alt-config.json"));
	});

	test("prefers config closer to file over parent", async () => {
		const subDir = join(TEST_DIR, "packages", "my-pkg");
		mkdirSync(subDir, { recursive: true });
		writeFileSync(join(TEST_DIR, "myconfig.json"), "{}");
		writeFileSync(join(subDir, "myconfig.json"), "{}");

		const result: NearestConfigResult = await findNearestConfig(
			join(subDir, "src", "index.ts"),
			["myconfig.json"],
		);
		expect(result.found).toBe(true);
		expect(result.configDir).toBe(subDir);
	});
});
