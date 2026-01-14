/**
 * Tests for WebClipper CLI handler.
 *
 * Tests the CLI subcommands for listing, exporting, syncing, and converting templates.
 *
 * @module cli/clipper.test
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { OutputFormat } from "@sidequest/core/terminal";
import { handleClipper } from "./clipper";
import type { CommandContext } from "./types";

/**
 * Create a minimal command context for testing.
 */
function createContext(
	overrides: Partial<CommandContext> = {},
): CommandContext {
	return {
		config: {
			vault: "/tmp/test-vault",
			templatesDir: "/tmp/test-vault/Templates",
			autoCommit: false,
			indexPath: ".para-obsidian-index.json",
			frontmatterRules: {},
		},
		positional: [],
		flags: {},
		format: OutputFormat.JSON,
		isJson: true,
		subcommand: undefined,
		...overrides,
	};
}

describe("handleClipper", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "clipper-cli-test-"));
	});

	afterEach(() => {
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	describe("list subcommand", () => {
		test("returns success with templates", async () => {
			const ctx = createContext({ subcommand: "list" });
			const result = await handleClipper(ctx);

			expect(result.success).toBe(true);
		});

		test("defaults to list when no subcommand", async () => {
			const ctx = createContext({ subcommand: undefined });
			const result = await handleClipper(ctx);

			// Should default to list and succeed
			expect(result.success).toBe(true);
		});
	});

	describe("export subcommand", () => {
		test("exports to specified output path", async () => {
			const outputPath = path.join(tempDir, "settings.json");
			const ctx = createContext({
				subcommand: "export",
				flags: { out: outputPath },
			});

			const result = await handleClipper(ctx);

			expect(result.success).toBe(true);
			expect(fs.existsSync(outputPath)).toBe(true);

			// Verify JSON structure
			const content = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
			expect(content.templates).toBeDefined();
			expect(Array.isArray(content.templates)).toBe(true);
		});

		test("creates nested directories if needed", async () => {
			const outputPath = path.join(tempDir, "nested", "deep", "settings.json");
			const ctx = createContext({
				subcommand: "export",
				flags: { out: outputPath },
			});

			const result = await handleClipper(ctx);

			expect(result.success).toBe(true);
			expect(fs.existsSync(outputPath)).toBe(true);
		});
	});

	describe("sync subcommand", () => {
		test("returns error when settings path not provided", async () => {
			const ctx = createContext({
				subcommand: "sync",
				positional: [],
			});

			const result = await handleClipper(ctx);

			expect(result.success).toBe(false);
			expect(result.error).toContain("Missing settings file path");
		});

		test("H8: rejects settings path with null bytes", async () => {
			const ctx = createContext({
				subcommand: "sync",
				positional: ["/path/with\0null/settings.json"],
			});

			const result = await handleClipper(ctx);

			expect(result.success).toBe(false);
			expect(result.exitCode).toBe(1);
			expect(result.error).toContain("null bytes");
		});

		test("returns error for non-existent settings file", async () => {
			const ctx = createContext({
				subcommand: "sync",
				positional: ["/non/existent/settings.json"],
			});

			const result = await handleClipper(ctx);

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
		});

		test("syncs from valid settings file", async () => {
			// Create a valid settings file
			const settingsPath = path.join(tempDir, "settings.json");
			const settings = {
				templates: [],
				vaults: [],
				propertyTypes: [],
			};
			fs.writeFileSync(settingsPath, JSON.stringify(settings));

			const ctx = createContext({
				subcommand: "sync",
				positional: [settingsPath],
			});

			const result = await handleClipper(ctx);

			expect(result.success).toBe(true);
		});
	});

	describe("convert subcommand", () => {
		test("returns error when template name not provided", async () => {
			const ctx = createContext({
				subcommand: "convert",
				positional: [],
			});

			const result = await handleClipper(ctx);

			expect(result.success).toBe(false);
			expect(result.error).toContain("Missing template name");
		});

		test("H8: rejects template name with null bytes", async () => {
			const ctx = createContext({
				subcommand: "convert",
				positional: ["template\0name"],
			});

			const result = await handleClipper(ctx);

			expect(result.success).toBe(false);
			expect(result.exitCode).toBe(1);
			expect(result.error).toContain("null bytes");
		});

		test("returns error for non-existent template", async () => {
			const ctx = createContext({
				subcommand: "convert",
				positional: ["non-existent-template-xyz"],
			});

			const result = await handleClipper(ctx);

			expect(result.success).toBe(false);
			expect(result.error).toContain("not found");
		});

		test("converts existing template successfully", async () => {
			// First get list of available templates
			const listCtx = createContext({ subcommand: "list" });
			const listResult = await handleClipper(listCtx);
			expect(listResult.success).toBe(true);

			// Use "capture" template which should exist in the templates directory
			const outputPath = path.join(tempDir, "capture-converted.md");
			const ctx = createContext({
				subcommand: "convert",
				positional: ["capture"],
				flags: { out: outputPath },
			});

			const result = await handleClipper(ctx);

			expect(result.success).toBe(true);
			expect(fs.existsSync(outputPath)).toBe(true);

			// Verify the output contains Templater format
			const content = fs.readFileSync(outputPath, "utf-8");
			expect(content).toContain("---"); // Frontmatter delimiter
			expect(content).toMatch(/<% tp\./); // Templater syntax
		});

		test("outputs to stdout when no --out flag", async () => {
			const ctx = createContext({
				subcommand: "convert",
				positional: ["capture"],
			});

			const result = await handleClipper(ctx);

			// Should succeed even without --out (outputs to stdout)
			expect(result.success).toBe(true);
		});
	});

	describe("convert-all subcommand", () => {
		test("exports all templates to specified directory", async () => {
			const outputDir = path.join(tempDir, "templates");
			const ctx = createContext({
				subcommand: "convert-all",
				flags: { out: outputDir },
			});

			const result = await handleClipper(ctx);

			expect(result.success).toBe(true);
			expect(fs.existsSync(outputDir)).toBe(true);

			// Should have created some .md files
			const files = fs.readdirSync(outputDir);
			const mdFiles = files.filter((f) => f.endsWith(".md"));
			expect(mdFiles.length).toBeGreaterThan(0);
		});
	});

	describe("error handling", () => {
		test("handles unknown subcommand gracefully", async () => {
			const ctx = createContext({
				subcommand: "unknown-subcommand",
			});

			// Unknown subcommands default to list
			const result = await handleClipper(ctx);
			expect(result.success).toBe(true);
		});

		test("sets exitCode to 1 on sync error (missing path)", async () => {
			const ctx = createContext({
				subcommand: "sync",
				positional: [],
			});

			const result = await handleClipper(ctx);

			expect(result.success).toBe(false);
			expect(result.exitCode).toBe(1);
			expect(result.error).toContain("Missing settings file path");
		});

		test("sets exitCode to 1 on sync error (non-existent file)", async () => {
			const ctx = createContext({
				subcommand: "sync",
				positional: ["/non/existent/settings.json"],
			});

			const result = await handleClipper(ctx);

			expect(result.success).toBe(false);
			expect(result.exitCode).toBe(1);
		});

		test("sets exitCode to 1 on convert error (missing template name)", async () => {
			const ctx = createContext({
				subcommand: "convert",
				positional: [],
			});

			const result = await handleClipper(ctx);

			expect(result.success).toBe(false);
			expect(result.exitCode).toBe(1);
			expect(result.error).toContain("Missing template name");
		});

		test("sets exitCode to 1 on convert error (non-existent template)", async () => {
			const ctx = createContext({
				subcommand: "convert",
				positional: ["non-existent-template-xyz"],
			});

			const result = await handleClipper(ctx);

			expect(result.success).toBe(false);
			expect(result.exitCode).toBe(1);
		});
	});
});
