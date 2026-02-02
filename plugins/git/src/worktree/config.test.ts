import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import {
	autoDetectConfig,
	CONFIG_FILENAME,
	loadConfig,
	loadOrDetectConfig,
	writeConfig,
} from "./config.js";
import type { WorktreeConfig } from "./types.js";

describe("config", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(import.meta.dir, ".test-scratch-"));
	});

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	describe("loadConfig", () => {
		test("returns null when no config file exists", () => {
			expect(loadConfig(tmpDir)).toBeNull();
		});

		test("loads a valid config file", () => {
			const config: WorktreeConfig = {
				directory: ".wt",
				copy: [".env", ".claude"],
				exclude: ["node_modules"],
				postCreate: "npm install",
				preDelete: null,
				branchTemplate: "{type}/{description}",
			};
			fs.writeFileSync(
				path.join(tmpDir, CONFIG_FILENAME),
				JSON.stringify(config),
			);

			const loaded = loadConfig(tmpDir);
			expect(loaded).toEqual(config);
		});

		test("merges partial config with defaults", () => {
			fs.writeFileSync(
				path.join(tmpDir, CONFIG_FILENAME),
				JSON.stringify({ copy: [".env"] }),
			);

			const loaded = loadConfig(tmpDir);
			expect(loaded).not.toBeNull();
			expect(loaded!.directory).toBe(".worktrees");
			expect(loaded!.copy).toEqual([".env"]);
			expect(loaded!.postCreate).toBeNull();
			expect(loaded!.branchTemplate).toBe("{type}/{description}");
		});
	});

	describe("autoDetectConfig", () => {
		test("detects .env file", () => {
			fs.writeFileSync(path.join(tmpDir, ".env"), "SECRET=abc");

			const config = autoDetectConfig(tmpDir);
			expect(config.copy).toContain(".env");
		});

		test("detects .claude directory", () => {
			fs.mkdirSync(path.join(tmpDir, ".claude"));

			const config = autoDetectConfig(tmpDir);
			expect(config.copy).toContain(".claude");
		});

		test("detects CLAUDE.md and adds recursive pattern", () => {
			fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "# Project");

			const config = autoDetectConfig(tmpDir);
			expect(config.copy).toContain("**/CLAUDE.md");
		});

		test("does not include patterns for files that do not exist", () => {
			const config = autoDetectConfig(tmpDir);
			expect(config.copy).not.toContain(".nvmrc");
			expect(config.copy).not.toContain(".tool-versions");
		});

		test("always includes glob patterns like .env.*", () => {
			const config = autoDetectConfig(tmpDir);
			expect(config.copy).toContain(".env.*");
		});

		test("detects bun lockfile for postCreate", () => {
			fs.writeFileSync(path.join(tmpDir, "bun.lock"), "");

			const config = autoDetectConfig(tmpDir);
			expect(config.postCreate).toBe("bun install");
		});

		test("sets postCreate to null when no lockfile", () => {
			const config = autoDetectConfig(tmpDir);
			expect(config.postCreate).toBeNull();
		});

		test("uses default excludes", () => {
			const config = autoDetectConfig(tmpDir);
			expect(config.exclude).toContain("node_modules");
			expect(config.exclude).toContain(".git");
			expect(config.exclude).toContain(".worktrees");
		});
	});

	describe("loadOrDetectConfig", () => {
		test("returns file config when it exists", () => {
			fs.writeFileSync(
				path.join(tmpDir, CONFIG_FILENAME),
				JSON.stringify({ copy: [".env"], postCreate: "yarn install" }),
			);

			const { config, autoDetected } = loadOrDetectConfig(tmpDir);
			expect(autoDetected).toBe(false);
			expect(config.copy).toEqual([".env"]);
			expect(config.postCreate).toBe("yarn install");
		});

		test("returns auto-detected config when no file", () => {
			fs.writeFileSync(path.join(tmpDir, ".env"), "SECRET=abc");

			const { config, autoDetected } = loadOrDetectConfig(tmpDir);
			expect(autoDetected).toBe(true);
			expect(config.copy).toContain(".env");
		});
	});

	describe("writeConfig", () => {
		test("writes config to .worktrees.json", () => {
			const config: WorktreeConfig = {
				directory: ".worktrees",
				copy: [".env"],
				exclude: ["node_modules"],
				postCreate: "bun install",
				preDelete: null,
				branchTemplate: "{type}/{description}",
			};

			writeConfig(tmpDir, config);

			const raw = fs.readFileSync(path.join(tmpDir, CONFIG_FILENAME), "utf-8");
			expect(JSON.parse(raw)).toEqual(config);
		});
	});
});
