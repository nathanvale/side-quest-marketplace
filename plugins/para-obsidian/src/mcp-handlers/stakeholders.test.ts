/**
 * Tests for stakeholder MCP tools.
 *
 * Tests the underlying stakeholder operations (load, save, match)
 * since MCP tools delegate to config functions.
 *
 * @module mcp-handlers/stakeholders.test
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { cleanupTestDir, createTempDir } from "@side-quest/core/testing";
import type { Stakeholder } from "../config";

// ============================================================================
// Test Setup
// ============================================================================

let tempDir: string;
let configDir: string;
let configPath: string;
let vaultDir: string;
let originalHome: string | undefined;
let originalVault: string | undefined;

beforeEach(() => {
	tempDir = createTempDir("stakeholder-tools-test-");
	configDir = path.join(tempDir, ".config", "para-obsidian");
	configPath = path.join(configDir, "config.json");
	vaultDir = path.join(tempDir, "vault");

	fs.mkdirSync(configDir, { recursive: true });
	fs.mkdirSync(vaultDir, { recursive: true });

	// Override environment for loadConfig
	originalHome = process.env.HOME;
	originalVault = process.env.PARA_VAULT;
	process.env.HOME = tempDir;
	process.env.PARA_VAULT = vaultDir;
});

afterEach(() => {
	process.env.HOME = originalHome;
	process.env.PARA_VAULT = originalVault;
	cleanupTestDir(tempDir);
});

/** Write stakeholders to config file. */
function writeConfig(stakeholders: Stakeholder[]): void {
	fs.writeFileSync(configPath, JSON.stringify({ stakeholders }));
}

/** Read stakeholders from config file. */
function readStakeholders(): Stakeholder[] {
	const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
	return raw.stakeholders ?? [];
}

// ============================================================================
// Stakeholder list tests
// ============================================================================

describe("para_stakeholder_list logic", () => {
	test("empty config returns empty array", () => {
		fs.writeFileSync(configPath, "{}");
		const { loadConfig } = require("../config/index");
		const config = loadConfig();
		expect(config.stakeholders ?? []).toEqual([]);
	});

	test("populated config returns all stakeholders", () => {
		writeConfig([
			{ name: "June Xu", role: "Developer" },
			{ name: "Mustafa Jalil", alias: "MJ", role: "Backend Dev" },
		]);
		const { loadConfig } = require("../config/index");
		const config = loadConfig();
		expect(config.stakeholders).toHaveLength(2);
		expect(config.stakeholders![0]!.name).toBe("June Xu");
		expect(config.stakeholders![1]!.alias).toBe("MJ");
	});
});

// ============================================================================
// Stakeholder add tests
// ============================================================================

describe("para_stakeholder_add logic", () => {
	test("adds single stakeholder to empty config", async () => {
		fs.writeFileSync(configPath, "{}");

		const { loadConfig, saveStakeholders } = await import("../config/index");
		const config = loadConfig();
		const existing = [...(config.stakeholders ?? [])];
		existing.push({
			name: "June Xu",
			role: "Developer",
			email: "JXu3@bunnings.com.au",
		});
		await saveStakeholders(existing);

		const saved = readStakeholders();
		expect(saved).toHaveLength(1);
		expect(saved[0]!.name).toBe("June Xu");
	});

	test("adds bulk stakeholders", async () => {
		fs.writeFileSync(configPath, "{}");

		const { saveStakeholders } = await import("../config/index");
		const bulk: Stakeholder[] = [
			{ name: "June Xu", role: "Developer" },
			{ name: "Mustafa Jalil", alias: "MJ", role: "Backend Dev" },
			{ name: "Sarah Lee", company: "Bunnings" },
		];
		await saveStakeholders(bulk);

		const saved = readStakeholders();
		expect(saved).toHaveLength(3);
	});

	test("deduplicates by name (updates existing)", async () => {
		writeConfig([
			{ name: "June Xu", role: "Developer" },
			{ name: "Mustafa Jalil", role: "Backend Dev" },
		]);

		const { loadConfig, saveStakeholders } = await import("../config/index");
		const config = loadConfig();
		const existing = [...(config.stakeholders ?? [])];

		// Update June's role
		const incoming: Stakeholder = {
			name: "June Xu",
			role: "Senior Developer",
			squad: "GMS",
		};
		const idx = existing.findIndex(
			(e) => e.name.toLowerCase() === incoming.name.toLowerCase(),
		);
		if (idx >= 0 && existing[idx]) {
			existing[idx] = { ...existing[idx], ...incoming };
		}

		await saveStakeholders(existing);

		const saved = readStakeholders();
		expect(saved).toHaveLength(2);
		expect(saved[0]!.role).toBe("Senior Developer");
		expect(saved[0]!.squad).toBe("GMS");
	});
});

// ============================================================================
// Stakeholder remove tests
// ============================================================================

describe("para_stakeholder_remove logic", () => {
	test("removes by exact name", async () => {
		writeConfig([
			{ name: "June Xu", role: "Developer" },
			{ name: "Mustafa Jalil", role: "Backend Dev" },
		]);

		const { loadConfig, saveStakeholders } = await import("../config/index");
		const config = loadConfig();
		const existing = [...(config.stakeholders ?? [])];
		const idx = existing.findIndex((s) => s.name.toLowerCase() === "june xu");
		expect(idx).toBeGreaterThanOrEqual(0);
		existing.splice(idx, 1);
		await saveStakeholders(existing);

		const saved = readStakeholders();
		expect(saved).toHaveLength(1);
		expect(saved[0]!.name).toBe("Mustafa Jalil");
	});

	test("removes by alias (case-insensitive)", async () => {
		writeConfig([
			{ name: "Mustafa Jalil", alias: "MJ", role: "Backend Dev" },
			{ name: "June Xu", role: "Developer" },
		]);

		const { loadConfig, saveStakeholders } = await import("../config/index");
		const config = loadConfig();
		const existing = [...(config.stakeholders ?? [])];
		const query = "mj";
		const idx = existing.findIndex(
			(s) =>
				s.name.toLowerCase() === query ||
				(s.alias && s.alias.toLowerCase() === query),
		);
		expect(idx).toBe(0);
		existing.splice(idx, 1);
		await saveStakeholders(existing);

		const saved = readStakeholders();
		expect(saved).toHaveLength(1);
		expect(saved[0]!.name).toBe("June Xu");
	});

	test("returns -1 index for unknown name", () => {
		writeConfig([{ name: "June Xu", role: "Developer" }]);

		const { loadConfig } = require("../config/index");
		const config = loadConfig();
		const existing = config.stakeholders ?? [];
		const query = "nonexistent";
		const idx = existing.findIndex(
			(s: Stakeholder) =>
				s.name.toLowerCase() === query ||
				(s.alias && s.alias.toLowerCase() === query),
		);
		expect(idx).toBe(-1);
	});
});

// ============================================================================
// Stakeholder lookup tests
// ============================================================================

describe("para_stakeholder_lookup logic", () => {
	const stakeholders: Stakeholder[] = [
		{
			name: "June Xu",
			role: "Developer",
			email: "JXu3@bunnings.com.au",
			company: "Bunnings",
		},
		{
			name: "Mustafa Jalil",
			alias: "MJ",
			role: "Backend Dev",
			email: "MJalil@bunnings.com.au",
		},
		{
			name: "Sarah Lee",
			company: "Acme",
			email: "slee@acme.com",
		},
	];

	function lookup(query: string): Stakeholder[] {
		const q = query.toLowerCase();
		return stakeholders.filter((s) => {
			if (s.name.toLowerCase().includes(q)) return true;
			if (s.alias?.toLowerCase().includes(q)) return true;
			if (s.email) {
				const prefix = s.email.split("@")[0]?.toLowerCase() ?? "";
				if (prefix.includes(q)) return true;
			}
			return false;
		});
	}

	test("matches by name (partial)", () => {
		const results = lookup("june");
		expect(results).toHaveLength(1);
		expect(results[0]!.name).toBe("June Xu");
	});

	test("matches by alias", () => {
		const results = lookup("mj");
		expect(results).toHaveLength(1);
		expect(results[0]!.name).toBe("Mustafa Jalil");
	});

	test("matches by email prefix", () => {
		const results = lookup("jxu3");
		expect(results).toHaveLength(1);
		expect(results[0]!.name).toBe("June Xu");
	});

	test("no match returns empty", () => {
		const results = lookup("zzz");
		expect(results).toHaveLength(0);
	});

	test("case-insensitive matching", () => {
		const results = lookup("JUNE");
		expect(results).toHaveLength(1);
		expect(results[0]!.name).toBe("June Xu");
	});
});

// ============================================================================
// Module load test
// ============================================================================

describe("stakeholder MCP handler", () => {
	test("handler module loads successfully", async () => {
		const handler = await import("./stakeholders");
		expect(handler).toBeDefined();
	});
});
