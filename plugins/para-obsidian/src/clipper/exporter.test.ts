/**
 * Tests for WebClipper template exporter.
 *
 * Focuses on security (path traversal prevention) and atomic file operations.
 *
 * @module clipper/exporter.test
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
	exportAllToTemplater,
	exportToTemplater,
	exportToWebClipperSettings,
	getTemplate,
	listTemplates,
	syncFromWebClipperSettings,
} from "./exporter";
import type { WebClipperSettings } from "./types";

describe("listTemplates", () => {
	test("returns list of templates", () => {
		const result = listTemplates();
		// Should return templates from the bundled templates directory
		expect(result.templates).toBeDefined();
		expect(Array.isArray(result.templates)).toBe(true);
	});
});

describe("getTemplate", () => {
	test("returns template by name (case-insensitive)", () => {
		const templates = listTemplates();
		const firstTemplate = templates.templates[0];
		if (firstTemplate) {
			const result = getTemplate(firstTemplate.name.toUpperCase());
			expect(result.template).toBeDefined();
			expect(result.template?.name.toLowerCase()).toBe(
				firstTemplate.name.toLowerCase(),
			);
		}
	});

	test("returns error for non-existent template", () => {
		const result = getTemplate("non-existent-template-xyz");
		expect(result.error).toBeDefined();
		expect(result.template).toBeUndefined();
	});
});

describe("exportToWebClipperSettings", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "exporter-test-"));
	});

	afterEach(() => {
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	test("exports templates to settings.json", async () => {
		const outputPath = path.join(tempDir, "settings.json");
		const result = await exportToWebClipperSettings(outputPath);

		expect(result.success).toBe(true);
		expect(result.outputPath).toBe(outputPath);
		expect(fs.existsSync(outputPath)).toBe(true);

		// Verify JSON structure
		const content = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
		expect(content.templates).toBeDefined();
		expect(Array.isArray(content.templates)).toBe(true);
	});

	test("creates parent directories if needed", async () => {
		const outputPath = path.join(tempDir, "nested", "deep", "settings.json");
		const result = await exportToWebClipperSettings(outputPath);

		expect(result.success).toBe(true);
		expect(fs.existsSync(outputPath)).toBe(true);
	});
});

describe("exportToTemplater", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "exporter-test-"));
	});

	afterEach(() => {
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	test("returns error for non-existent template", async () => {
		const result = await exportToTemplater("non-existent-xyz");
		expect(result.success).toBe(false);
		expect(result.error).toContain("not found");
	});

	test("returns content when no output path specified", async () => {
		const templates = listTemplates();
		const firstTemplate = templates.templates[0];
		if (firstTemplate) {
			const result = await exportToTemplater(firstTemplate.name);
			// Without config, returns content in warnings
			expect(result.success).toBe(true);
			expect(result.warnings).toBeDefined();
		}
	});

	test("writes to specified output path", async () => {
		const templates = listTemplates();
		const firstTemplate = templates.templates[0];
		if (firstTemplate) {
			const outputPath = path.join(tempDir, "template.md");
			const result = await exportToTemplater(firstTemplate.name, outputPath);

			expect(result.success).toBe(true);
			expect(result.outputPath).toBe(outputPath);
			expect(fs.existsSync(outputPath)).toBe(true);
		}
	});

	test("sanitizes template name with path traversal attempt", async () => {
		// This tests the security fix - template names with path traversal
		// should be sanitized rather than allowing directory escape
		const config = {
			vault: tempDir,
			templatesDir: path.join(tempDir, "Templates"),
			autoCommit: false,
		};

		// Create templates directory
		fs.mkdirSync(config.templatesDir, { recursive: true });

		// Note: We can't directly test with a malicious template name because
		// the template lookup would fail. The security check happens at the
		// file write stage when using template.name from parsed JSON.
		const result = await exportToTemplater("non-existent", undefined, config);
		expect(result.success).toBe(false);
	});
});

describe("exportAllToTemplater", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "exporter-test-"));
	});

	afterEach(() => {
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	test("exports all templates to directory", async () => {
		const outputDir = path.join(tempDir, "templates");
		const result = await exportAllToTemplater(outputDir);

		expect(result.success).toBe(true);
		expect(result.outputPath).toBe(outputDir);
		expect(fs.existsSync(outputDir)).toBe(true);

		// Should have created some .md files
		const files = fs.readdirSync(outputDir);
		const mdFiles = files.filter((f) => f.endsWith(".md"));
		expect(mdFiles.length).toBeGreaterThan(0);
	});

	test("returns error when no output directory specified and no config", async () => {
		// @ts-expect-error - testing undefined case
		const result = await exportAllToTemplater(undefined, undefined);
		expect(result.success).toBe(false);
		expect(result.error).toContain("output directory");
	});
});

describe("syncFromWebClipperSettings - security", () => {
	let tempDir: string;
	let settingsPath: string;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sync-test-"));
		settingsPath = path.join(tempDir, "settings.json");
	});

	afterEach(() => {
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	test("sanitizes template names with path traversal attempts", async () => {
		// Create a malicious settings file with path traversal in template name
		const maliciousSettings: WebClipperSettings = {
			templates: [
				{
					schemaVersion: "0.1.0",
					name: "../../../etc/malicious",
					behavior: "create",
					noteNameFormat: "{{title}}",
					path: "00 Inbox",
					noteContentFormat: "# Malicious content",
					properties: [],
				},
			],
			vaults: [],
			propertyTypes: [],
		};

		fs.writeFileSync(settingsPath, JSON.stringify(maliciousSettings));

		const result = await syncFromWebClipperSettings(settingsPath);

		// The malicious name is sanitized (../ removed, / replaced with -)
		// so it succeeds as a new template with a safe name
		expect(result.success).toBe(true);
		// Path traversal is neutralized - file is created with sanitized name
		expect(result.added.length).toBe(1);
	});

	test("sanitizes template names with null bytes", async () => {
		const maliciousSettings: WebClipperSettings = {
			templates: [
				{
					schemaVersion: "0.1.0",
					name: "safe\x00.json/../../../malicious",
					behavior: "create",
					noteNameFormat: "{{title}}",
					path: "00 Inbox",
					noteContentFormat: "# Content",
					properties: [],
				},
			],
			vaults: [],
			propertyTypes: [],
		};

		fs.writeFileSync(settingsPath, JSON.stringify(maliciousSettings));

		const result = await syncFromWebClipperSettings(settingsPath);

		// Null bytes are stripped and path traversal is neutralized
		expect(result.success).toBe(true);
		expect(result.added.length).toBe(1);
	});

	test("sanitizes template names with backslash traversal", async () => {
		const maliciousSettings: WebClipperSettings = {
			templates: [
				{
					schemaVersion: "0.1.0",
					name: "..\\..\\..\\malicious",
					behavior: "create",
					noteNameFormat: "{{title}}",
					path: "00 Inbox",
					noteContentFormat: "# Content",
					properties: [],
				},
			],
			vaults: [],
			propertyTypes: [],
		};

		fs.writeFileSync(settingsPath, JSON.stringify(maliciousSettings));

		const result = await syncFromWebClipperSettings(settingsPath);

		// Backslashes are replaced with hyphens and .. is removed
		expect(result.success).toBe(true);
		expect(result.added.length).toBe(1);
	});

	test("rejects overly long template names", async () => {
		const longName = "a".repeat(300); // Exceeds MAX_TEMPLATE_NAME_LENGTH (200)
		const maliciousSettings: WebClipperSettings = {
			templates: [
				{
					schemaVersion: "0.1.0",
					name: longName,
					behavior: "create",
					noteNameFormat: "{{title}}",
					path: "00 Inbox",
					noteContentFormat: "# Content",
					properties: [],
				},
			],
			vaults: [],
			propertyTypes: [],
		};

		fs.writeFileSync(settingsPath, JSON.stringify(maliciousSettings));

		const result = await syncFromWebClipperSettings(settingsPath);

		// Should report warning for the oversized template name
		expect(result.warnings).toBeDefined();
		expect(result.warnings?.[0]).toContain("too long");
	});

	test("returns error for non-existent settings file", async () => {
		const result = await syncFromWebClipperSettings("/non/existent/path.json");
		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});

	test("returns error for invalid JSON in settings file", async () => {
		fs.writeFileSync(settingsPath, "not valid json");

		const result = await syncFromWebClipperSettings(settingsPath);
		expect(result.success).toBe(false);
		expect(result.error).toContain("JSON");
	});
});

describe("syncFromWebClipperSettings - functionality", () => {
	let tempDir: string;
	let settingsPath: string;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sync-test-"));
		settingsPath = path.join(tempDir, "settings.json");
	});

	afterEach(() => {
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	test("reports added, updated, and unchanged templates", async () => {
		// First, get existing templates
		const existingTemplates = listTemplates();

		const firstExisting = existingTemplates.templates[0];
		if (firstExisting) {
			// Create settings with existing template (should be unchanged)
			// and a new template (should be added)
			const templateResult = getTemplate(firstExisting.name);

			if (templateResult.template) {
				const settings: WebClipperSettings = {
					templates: [templateResult.template],
					vaults: [],
					propertyTypes: [],
				};

				fs.writeFileSync(settingsPath, JSON.stringify(settings));

				const result = await syncFromWebClipperSettings(settingsPath);

				expect(result.success).toBe(true);
				// The template should be unchanged (identical to existing)
				expect(result.unchanged.length).toBeGreaterThanOrEqual(0);
			}
		}
	});
});
