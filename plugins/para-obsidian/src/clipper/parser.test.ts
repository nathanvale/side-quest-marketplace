/**
 * Tests for WebClipper template parser.
 *
 * @module clipper/parser.test
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
	getTemplatesDirectory,
	loadTemplatesFromDirectory,
	parseSettings,
	parseTemplate,
} from "./parser";
import type { WebClipperSettings, WebClipperTemplate } from "./types";

describe("parseTemplate", () => {
	test("parses valid template", () => {
		const template: WebClipperTemplate = {
			schemaVersion: "0.1.0",
			name: "Test Template",
			behavior: "create",
			noteNameFormat: "{{title}}",
			path: "00 Inbox",
			noteContentFormat: "# {{title}}",
			properties: [
				{ name: "type", value: "test", type: "text" },
				{ name: "created", value: "{{date}}", type: "date" },
			],
		};

		const json = JSON.stringify(template);
		const result = parseTemplate(json);

		expect(result.success).toBe(true);
		expect(result.data).toEqual(template);
	});

	test("parses template with triggers", () => {
		const template: WebClipperTemplate = {
			schemaVersion: "0.1.0",
			name: "YouTube Video",
			behavior: "create",
			noteNameFormat: "{{title}}",
			path: "00 Inbox",
			noteContentFormat: "# {{title}}",
			properties: [],
			triggers: ["https://youtube.com/watch", "https://youtu.be/"],
		};

		const result = parseTemplate(JSON.stringify(template));

		expect(result.success).toBe(true);
		expect(result.data?.triggers).toEqual([
			"https://youtube.com/watch",
			"https://youtu.be/",
		]);
	});

	test("fails on invalid JSON", () => {
		const result = parseTemplate("not valid json");

		expect(result.success).toBe(false);
		expect(result.error).toContain("JSON");
	});

	test("fails on missing required fields", () => {
		const template = {
			schemaVersion: "0.1.0",
			name: "Test",
			// Missing behavior, noteNameFormat, etc.
		};

		const result = parseTemplate(JSON.stringify(template));

		expect(result.success).toBe(false);
		expect(result.error).toContain("Missing");
	});

	test("fails on invalid behavior value", () => {
		const template = {
			schemaVersion: "0.1.0",
			name: "Test",
			behavior: "invalid", // Should be "create" or "append"
			noteNameFormat: "{{title}}",
			path: "00 Inbox",
			noteContentFormat: "# {{title}}",
			properties: [],
		};

		const result = parseTemplate(JSON.stringify(template));

		expect(result.success).toBe(false);
		expect(result.error).toContain("behavior");
	});
});

describe("parseSettings", () => {
	test("parses valid settings", () => {
		const settings: WebClipperSettings = {
			templates: [
				{
					schemaVersion: "0.1.0",
					name: "Test",
					behavior: "create",
					noteNameFormat: "{{title}}",
					path: "00 Inbox",
					noteContentFormat: "# {{title}}",
					properties: [],
				},
			],
			vaults: [{ name: "My Vault", isActive: true }],
			propertyTypes: [],
		};

		const result = parseSettings(JSON.stringify(settings));

		expect(result.success).toBe(true);
		expect(result.data?.templates).toHaveLength(1);
		expect(result.data?.vaults).toHaveLength(1);
	});

	test("fails on missing templates array", () => {
		const settings = {
			vaults: [],
			propertyTypes: [],
		};

		const result = parseSettings(JSON.stringify(settings));

		expect(result.success).toBe(false);
		expect(result.error).toContain("templates");
	});
});

describe("getTemplatesDirectory", () => {
	test("returns path ending with templates/webclipper", () => {
		const dir = getTemplatesDirectory();
		expect(dir).toContain("templates");
		expect(dir).toContain("webclipper");
	});
});

describe("loadTemplatesFromDirectory", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "clipper-test-"));
	});

	afterEach(() => {
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	test("loads templates from directory", () => {
		const template: WebClipperTemplate = {
			schemaVersion: "0.1.0",
			name: "Test Template",
			behavior: "create",
			noteNameFormat: "{{title}}",
			path: "00 Inbox",
			noteContentFormat: "# {{title}}",
			properties: [],
		};

		fs.writeFileSync(path.join(tempDir, "test.json"), JSON.stringify(template));

		const result = loadTemplatesFromDirectory(tempDir);

		expect(result.success).toBe(true);
		expect(result.data).toHaveLength(1);
		const firstTemplate = result.data?.[0];
		expect(firstTemplate).toBeDefined();
		expect(firstTemplate?.name).toBe("Test Template");
	});

	test("loads multiple templates", () => {
		const template1: WebClipperTemplate = {
			schemaVersion: "0.1.0",
			name: "Template One",
			behavior: "create",
			noteNameFormat: "{{title}}",
			path: "00 Inbox",
			noteContentFormat: "# One",
			properties: [],
		};

		const template2: WebClipperTemplate = {
			schemaVersion: "0.1.0",
			name: "Template Two",
			behavior: "create",
			noteNameFormat: "{{title}}",
			path: "00 Inbox",
			noteContentFormat: "# Two",
			properties: [],
		};

		fs.writeFileSync(path.join(tempDir, "one.json"), JSON.stringify(template1));
		fs.writeFileSync(path.join(tempDir, "two.json"), JSON.stringify(template2));

		const result = loadTemplatesFromDirectory(tempDir);

		expect(result.success).toBe(true);
		expect(result.data).toHaveLength(2);
	});

	test("skips invalid JSON files with warning", () => {
		const validTemplate: WebClipperTemplate = {
			schemaVersion: "0.1.0",
			name: "Valid",
			behavior: "create",
			noteNameFormat: "{{title}}",
			path: "00 Inbox",
			noteContentFormat: "# Valid",
			properties: [],
		};

		fs.writeFileSync(
			path.join(tempDir, "valid.json"),
			JSON.stringify(validTemplate),
		);
		fs.writeFileSync(path.join(tempDir, "invalid.json"), "not valid json");

		const result = loadTemplatesFromDirectory(tempDir);

		expect(result.success).toBe(true);
		expect(result.data).toHaveLength(1);
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings?.[0]).toContain("invalid.json");
	});

	test("returns error for non-existent directory", () => {
		const result = loadTemplatesFromDirectory("/non/existent/path");

		expect(result.success).toBe(false);
		expect(result.error).toContain("not found");
	});

	test("ignores non-JSON files", () => {
		const template: WebClipperTemplate = {
			schemaVersion: "0.1.0",
			name: "Test",
			behavior: "create",
			noteNameFormat: "{{title}}",
			path: "00 Inbox",
			noteContentFormat: "# Test",
			properties: [],
		};

		fs.writeFileSync(
			path.join(tempDir, "template.json"),
			JSON.stringify(template),
		);
		fs.writeFileSync(path.join(tempDir, "readme.md"), "# README");
		fs.writeFileSync(path.join(tempDir, ".DS_Store"), "");

		const result = loadTemplatesFromDirectory(tempDir);

		expect(result.success).toBe(true);
		expect(result.data).toHaveLength(1);
	});
});
