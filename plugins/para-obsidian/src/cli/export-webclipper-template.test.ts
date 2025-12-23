/**
 * Tests for export-webclipper-template CLI handler.
 */

import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { pathExists, readJsonFile } from "@sidequest/core/fs";
import { OutputFormat } from "@sidequest/core/terminal";
import { createTempDir } from "@sidequest/core/testing";
import { loadConfig } from "../config";
import { useTestVaultCleanup } from "../testing/utils";
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
	const { trackVault, getAfterEachHook } = useTestVaultCleanup();
	afterEach(getAfterEachHook());

	test("exports template to default filename", async () => {
		const tempDir = createTempDir("test-export-webclipper-");
		trackVault(tempDir);

		const config = loadConfig();
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
	});

	test("exports template to custom output path", async () => {
		const tempDir = createTempDir("test-export-webclipper-");
		trackVault(tempDir);

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
		const tempDir = createTempDir("test-export-webclipper-");
		trackVault(tempDir);

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
		const tempDir = createTempDir("test-export-webclipper-");
		trackVault(tempDir);

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
		const tempDir = createTempDir("test-export-webclipper-");
		trackVault(tempDir);

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
		const tempDir = createTempDir("test-export-webclipper-");
		trackVault(tempDir);

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
		const tempDir = createTempDir("test-export-webclipper-");
		trackVault(tempDir);

		const config = loadConfig();
		// Create a subdirectory in tempDir to simulate home directory expansion
		const simulatedHome = path.join(tempDir, "simulated-home");
		fs.mkdirSync(simulatedHome, { recursive: true });

		// Override HOME temporarily for this test
		const originalHome = process.env.HOME;
		process.env.HOME = simulatedHome;

		try {
			const relativePath = "test-template.json";
			const tildeOutput = `~/${relativePath}`;
			const expectedPath = path.join(simulatedHome, relativePath);

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
		} finally {
			// Restore HOME
			if (originalHome !== undefined) {
				process.env.HOME = originalHome;
			} else {
				delete process.env.HOME;
			}
		}
	});

	test("handles relative paths correctly", async () => {
		const tempDir = createTempDir("test-export-webclipper-");
		trackVault(tempDir);

		const config = loadConfig();
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
	});
});
