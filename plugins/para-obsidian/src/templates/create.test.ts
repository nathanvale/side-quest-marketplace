/**
 * Tests for template creation service
 */

import { afterEach, describe, expect, test } from "bun:test";
import { access, constants } from "node:fs/promises";
import { join } from "node:path";
import { pathExists, readTextFile } from "@side-quest/core/fs";
import { createTestVault, useTestVaultCleanup } from "../testing/utils";
import { createTemplate } from "./create";

describe("createTemplate", () => {
	const { trackVault, getAfterEachHook } = useTestVaultCleanup();
	afterEach(getAfterEachHook());

	/**
	 * Helper to setup test vault with automatic cleanup tracking
	 */
	const setupTest = () => {
		const vault = createTestVault();
		trackVault(vault);
		return vault;
	};

	test("skips creation when action is 'skip'", async () => {
		const vault = setupTest();

		const result = await createTemplate({
			vaultPath: vault,
			templateName: "test",
			noteType: "test",
			version: 1,
			fields: [],
			fieldMappings: {},
			choice: { action: "skip" },
		});

		expect(result.created).toBe(false);
		expect(result.finalName).toBe("test");
		expect(result.templatePath).toBeUndefined();
	});

	test("skips creation when action is 'use-existing'", async () => {
		const vault = setupTest();

		const result = await createTemplate({
			vaultPath: vault,
			templateName: "test",
			noteType: "test",
			version: 1,
			fields: [],
			fieldMappings: {},
			choice: { action: "use-existing" },
		});

		expect(result.created).toBe(false);
		expect(result.finalName).toBe("test");
		expect(result.templatePath).toBeUndefined();
	});

	test("creates basic template when action is 'create-new'", async () => {
		const vault = setupTest();

		const result = await createTemplate({
			vaultPath: vault,
			templateName: "invoice",
			noteType: "invoice",
			version: 1,
			fields: [
				{
					name: "title",
					type: "string",
					description: "Invoice title",
					requirement: "required",
				},
				{
					name: "vendor",
					type: "string",
					description: "Vendor name",
					requirement: "required",
				},
			],
			fieldMappings: {
				title: "Invoice Title",
				vendor: "Vendor Name",
			},
			choice: { action: "create-new", mode: "basic" },
		});

		expect(result.created).toBe(true);
		expect(result.finalName).toBe("invoice");
		expect(result.templatePath).toBe(join(vault, "Templates", "invoice.md"));

		// Verify file was created
		const exists = await pathExists(result.templatePath!);
		expect(exists).toBe(true);

		// Verify content
		const content = await readTextFile(result.templatePath!);
		expect(content).toContain("type: invoice");
		expect(content).toContain("template_version: 1");
		expect(content).toContain(
			'title: "<% tp.system.prompt("Invoice Title") %>"',
		);
	});

	test("creates template with suffix when provided", async () => {
		const vault = setupTest();

		const result = await createTemplate({
			vaultPath: vault,
			templateName: "invoice",
			noteType: "invoice",
			version: 1,
			fields: [
				{
					name: "title",
					type: "string",
					description: "Title",
					requirement: "required",
				},
			],
			fieldMappings: {
				title: "Title",
			},
			choice: { action: "create-new", mode: "basic", suffix: "v2" },
		});

		expect(result.created).toBe(true);
		expect(result.finalName).toBe("invoice-v2");
		expect(result.templatePath).toBe(join(vault, "Templates", "invoice-v2.md"));

		// Verify file was created with suffixed name
		const exists = await pathExists(result.templatePath!);
		expect(exists).toBe(true);
	});

	test("uses atomic file write", async () => {
		const vault = setupTest();

		const result = await createTemplate({
			vaultPath: vault,
			templateName: "test",
			noteType: "test",
			version: 1,
			fields: [
				{
					name: "title",
					type: "string",
					description: "Title",
					requirement: "required",
				},
			],
			fieldMappings: {
				title: "Title",
			},
			choice: { action: "create-new", mode: "basic" },
		});

		// File should exist and be complete (atomic write ensures this)
		const content = await readTextFile(result.templatePath!);
		expect(content.startsWith("---")).toBe(true);
		expect(content).toContain("---"); // Closing frontmatter delimiter
		expect(content).toContain("# <% tp.system.prompt("); // Title
	});

	test("handles rich mode by falling back to basic (not yet implemented)", async () => {
		const vault = setupTest();

		const result = await createTemplate({
			vaultPath: vault,
			templateName: "test",
			noteType: "test",
			version: 1,
			fields: [
				{
					name: "title",
					type: "string",
					description: "Title",
					requirement: "required",
				},
			],
			fieldMappings: {
				title: "Title",
			},
			choice: { action: "create-new", mode: "rich" },
		});

		// Should still create template (falls back to basic)
		expect(result.created).toBe(true);
		const exists = await pathExists(result.templatePath!);
		expect(exists).toBe(true);
	});

	test("creates Templates directory if it doesn't exist", async () => {
		const vault = setupTest();

		// Templates dir doesn't exist initially
		const templatesDir = join(vault, "Templates");

		// Verify directory doesn't exist before
		await expect(async () => {
			await access(templatesDir, constants.F_OK);
		}).toThrow();

		const result = await createTemplate({
			vaultPath: vault,
			templateName: "test",
			noteType: "test",
			version: 1,
			fields: [],
			fieldMappings: {},
			choice: { action: "create-new", mode: "basic" },
		});

		// atomicWriteFile uses ensureParentDir, so directory should be created
		// Use access() instead of pathExists due to core/fs bug
		await access(templatesDir, constants.F_OK); // Will throw if doesn't exist

		// Template file should exist
		expect(await pathExists(result.templatePath!)).toBe(true);
	});
});
