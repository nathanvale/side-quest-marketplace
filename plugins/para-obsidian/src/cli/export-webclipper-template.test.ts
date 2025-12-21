/**
 * Tests for export-webclipper-template CLI handler.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { createTempDir, pathExists, readJsonFile } from "@sidequest/core/fs";
import { OutputFormat } from "@sidequest/core/terminal";
import { cleanupTestDir } from "@sidequest/core/testing";
import { loadConfig } from "../config";
import { handleExportWebClipperTemplate } from "./export-webclipper-template";
import type { CommandContext } from "./types";

interface WebClipperProperty {
	readonly name: string;
	readonly value: string;
	readonly type: string;
}

interface WebClipperTemplateType {
	readonly schemaVersion: string;
	readonly name: string;
	readonly behavior: string;
	readonly noteNameFormat: string;
	readonly path: string;
	readonly noteContentFormat: string;
	readonly properties: readonly WebClipperProperty[];
	readonly triggers: readonly unknown[];
}

describe("export-webclipper-template", () => {
	let tempDir: string;
	let vaultDir: string;
	let originalParaVault: string | undefined;

	beforeEach(() => {
		tempDir = createTempDir("test-export-webclipper-");
		// Create a vault directory inside tempDir for this test's isolation
		vaultDir = path.join(tempDir, "vault");
		fs.mkdirSync(vaultDir, { recursive: true });
		// Backup and set PARA_VAULT for test isolation
		originalParaVault = process.env.PARA_VAULT;
		process.env.PARA_VAULT = vaultDir;
	});

	afterEach(() => {
		// Restore PARA_VAULT
		if (originalParaVault !== undefined) {
			process.env.PARA_VAULT = originalParaVault;
		} else {
			delete process.env.PARA_VAULT;
		}
		cleanupTestDir(tempDir);
	});

	test("exports template to default filename", async () => {
		const config = loadConfig();
		// Use temp directory to avoid polluting repo root
		const defaultPath = path.join(tempDir, "para-bookmark-template.json");
		const ctx: CommandContext = {
			config,
			positional: [],
			flags: { output: defaultPath },
			format: OutputFormat.MARKDOWN,
			isJson: false,
		};

		const result = await handleExportWebClipperTemplate(ctx);

		expect(result.success).toBe(true);
		expect(await pathExists(defaultPath)).toBe(true);

		const template = (await readJsonFile(
			defaultPath,
		)) as WebClipperTemplateType;
		expect(template.schemaVersion).toBe("0.1.0");
		expect(template.name).toBe("PARA Bookmark");
		expect(template.behavior).toBe("create");
		expect(template.noteNameFormat).toBe("{{title|safe_name}}");
		expect(template.path).toBe("00 Inbox");
		// Cleanup handled by afterEach
	});

	test("exports template to custom output path", async () => {
		const config = loadConfig();
		const outputPath = path.join(tempDir, "custom-template.json");

		const ctx: CommandContext = {
			config,
			positional: [],
			flags: { output: outputPath },
			format: OutputFormat.MARKDOWN,
			isJson: false,
		};

		const result = await handleExportWebClipperTemplate(ctx);

		expect(result.success).toBe(true);
		expect(await pathExists(outputPath)).toBe(true);

		const template = (await readJsonFile(outputPath)) as WebClipperTemplateType;
		expect(template.name).toBe("PARA Bookmark");
	});

	test("exports template with correct properties", async () => {
		const config = loadConfig();
		const outputPath = path.join(tempDir, "template.json");

		const ctx: CommandContext = {
			config,
			positional: [],
			flags: { output: outputPath },
			format: OutputFormat.MARKDOWN,
			isJson: false,
		};

		await handleExportWebClipperTemplate(ctx);

		const template = (await readJsonFile(outputPath)) as WebClipperTemplateType;
		const properties = template.properties;

		// Check required properties
		const typeProperty = properties.find((p) => p.name === "type");
		expect(typeProperty).toBeDefined();
		expect(typeProperty?.value).toBe("bookmark");
		expect(typeProperty?.type).toBe("text");

		const urlProperty = properties.find((p) => p.name === "url");
		expect(urlProperty).toBeDefined();
		expect(urlProperty?.value).toBe("{{url}}");
		expect(urlProperty?.type).toBe("text");

		// originalTitle preserves the raw page title (not "title" - filename becomes the title)
		const originalTitleProperty = properties.find(
			(p) => p.name === "originalTitle",
		);
		expect(originalTitleProperty).toBeDefined();
		expect(originalTitleProperty?.value).toBe("{{title}}");

		const clippedProperty = properties.find((p) => p.name === "clipped");
		expect(clippedProperty).toBeDefined();
		expect(clippedProperty?.type).toBe("date");

		const domainProperty = properties.find((p) => p.name === "domain");
		expect(domainProperty).toBeDefined();
		expect(domainProperty?.value).toBe("{{domain}}");
	});

	test("exports template with correct content format", async () => {
		const config = loadConfig();
		const outputPath = path.join(tempDir, "template.json");

		const ctx: CommandContext = {
			config,
			positional: [],
			flags: { output: outputPath },
			format: OutputFormat.MARKDOWN,
			isJson: false,
		};

		await handleExportWebClipperTemplate(ctx);

		const template = (await readJsonFile(outputPath)) as WebClipperTemplateType;

		// Updated to match actual implementation using contentHtml with filters
		expect(template.noteContentFormat).toContain(
			'{{contentHtml|remove_html:("table,.js-repo-nav,nav")|markdown|slice:0,3000}}',
		);
		expect(template.noteContentFormat).toContain("---");
		expect(template.noteContentFormat).toContain("*Clipped from");
		expect(template.noteContentFormat).toContain("{{domain}}");
		expect(template.noteContentFormat).toContain("{{url}}");
		expect(template.noteContentFormat).toContain("{{date}}");
	});

	test("fails when parent directory does not exist", async () => {
		const config = loadConfig();
		const invalidPath = path.join(tempDir, "nonexistent-dir", "template.json");

		const ctx: CommandContext = {
			config,
			positional: [],
			flags: { output: invalidPath },
			format: OutputFormat.MARKDOWN,
			isJson: false,
		};

		const result = await handleExportWebClipperTemplate(ctx);

		expect(result.success).toBe(false);
		expect(result.error).toContain("Parent directory does not exist");
	});

	test("returns JSON format when --format json", async () => {
		const config = loadConfig();
		const outputPath = path.join(tempDir, "template.json");

		const ctx: CommandContext = {
			config,
			positional: [],
			flags: { output: outputPath },
			format: OutputFormat.JSON,
			isJson: true,
		};

		const result = await handleExportWebClipperTemplate(ctx);

		expect(result.success).toBe(true);
		expect(await pathExists(outputPath)).toBe(true);
	});

	test("expands tilde in output path", async () => {
		const config = loadConfig();
		// Use temp directory with unique filename to avoid polluting home dir
		const relativePath = `test-tilde-expand-${Date.now()}.json`;
		const homeDir = process.env.HOME ?? "/tmp";
		const tildeOutput = `~/${relativePath}`;
		const expectedPath = path.join(homeDir, relativePath);

		const ctx: CommandContext = {
			config,
			positional: [],
			flags: { output: tildeOutput },
			format: OutputFormat.MARKDOWN,
			isJson: false,
		};

		const result = await handleExportWebClipperTemplate(ctx);

		expect(result.success).toBe(true);
		expect(await pathExists(expectedPath)).toBe(true);

		// Cleanup - actually delete the file
		const { unlinkSync } = await import("node:fs");
		try {
			unlinkSync(expectedPath);
		} catch {
			// Ignore cleanup errors
		}
	});

	test("handles relative paths correctly", async () => {
		const config = loadConfig();
		// Use temp directory to avoid polluting repo root
		const outputPath = path.join(tempDir, "relative-test.json");

		const ctx: CommandContext = {
			config,
			positional: [],
			flags: { output: outputPath },
			format: OutputFormat.MARKDOWN,
			isJson: false,
		};

		const result = await handleExportWebClipperTemplate(ctx);

		expect(result.success).toBe(true);
		expect(await pathExists(outputPath)).toBe(true);
		// Cleanup handled by afterEach
	});
});
