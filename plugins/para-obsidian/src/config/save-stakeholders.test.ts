/**
 * Tests for saveStakeholders config write helper.
 *
 * @module config/save-stakeholders.test
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { cleanupTestDir, createTempDir } from "@side-quest/core/testing";
import type { Stakeholder } from "./index";

// ============================================================================
// Test Setup
// ============================================================================

let tempDir: string;
let configDir: string;
let configPath: string;
let originalHome: string | undefined;

beforeEach(() => {
	tempDir = createTempDir("save-stakeholders-test-");
	configDir = path.join(tempDir, ".config", "para-obsidian");
	configPath = path.join(configDir, "config.json");

	// Override HOME so resolveUserRc() points to our temp dir
	originalHome = process.env.HOME;
	process.env.HOME = tempDir;
});

afterEach(() => {
	process.env.HOME = originalHome;
	cleanupTestDir(tempDir);
});

// ============================================================================
// Tests
// ============================================================================

describe("saveStakeholders", () => {
	test("creates config file if missing", async () => {
		const { saveStakeholders } = await import("./index");
		const stakeholders: Stakeholder[] = [
			{ name: "June Xu", role: "Developer" },
		];

		await saveStakeholders(stakeholders);

		expect(fs.existsSync(configPath)).toBe(true);
		const written = JSON.parse(fs.readFileSync(configPath, "utf-8"));
		expect(written.stakeholders).toEqual([
			{ name: "June Xu", role: "Developer" },
		]);
	});

	test("preserves existing config keys when writing stakeholders", async () => {
		const { saveStakeholders } = await import("./index");

		// Create existing config with other keys
		fs.mkdirSync(configDir, { recursive: true });
		fs.writeFileSync(
			configPath,
			JSON.stringify({
				autoCommit: false,
				suggestedTags: ["work", "personal"],
				stakeholders: [{ name: "Old Person" }],
			}),
		);

		await saveStakeholders([{ name: "New Person", role: "PM" }]);

		const written = JSON.parse(fs.readFileSync(configPath, "utf-8"));
		expect(written.autoCommit).toBe(false);
		expect(written.suggestedTags).toEqual(["work", "personal"]);
		expect(written.stakeholders).toEqual([{ name: "New Person", role: "PM" }]);
	});

	test("creates parent directories if they don't exist", async () => {
		const { saveStakeholders } = await import("./index");

		// Ensure config dir does NOT exist
		expect(fs.existsSync(configDir)).toBe(false);

		await saveStakeholders([{ name: "Test" }]);

		expect(fs.existsSync(configPath)).toBe(true);
	});

	test("handles empty stakeholders array", async () => {
		const { saveStakeholders } = await import("./index");

		await saveStakeholders([]);

		const written = JSON.parse(fs.readFileSync(configPath, "utf-8"));
		expect(written.stakeholders).toEqual([]);
	});

	test("overwrites corrupt config gracefully", async () => {
		const { saveStakeholders } = await import("./index");

		// Write corrupt JSON
		fs.mkdirSync(configDir, { recursive: true });
		fs.writeFileSync(configPath, "NOT VALID JSON{{{");

		await saveStakeholders([{ name: "Recovery" }]);

		const written = JSON.parse(fs.readFileSync(configPath, "utf-8"));
		expect(written.stakeholders).toEqual([{ name: "Recovery" }]);
	});
});
