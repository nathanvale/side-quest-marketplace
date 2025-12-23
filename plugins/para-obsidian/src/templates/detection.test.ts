/**
 * Tests for template detection service
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { writeTextFile } from "@sidequest/core/fs";
import { createTestVault, useTestVaultCleanup } from "../testing/utils";
import { detectTemplate } from "./detection";

describe("detectTemplate", () => {
	const { trackVault, getAfterEachHook } = useTestVaultCleanup();
	let tempDir: string;

	beforeEach(() => {
		tempDir = createTestVault();
		trackVault(tempDir);
	});

	afterEach(getAfterEachHook());

	test("returns exists: true when template exists", async () => {
		// Setup - create template
		const templatesDir = join(tempDir, "Templates");
		const templatePath = join(templatesDir, "invoice.md");
		const content = "---\ntype: invoice\n---\n# Invoice";

		await writeTextFile(templatePath, content);

		// Execute
		const result = await detectTemplate(tempDir, "invoice");

		// Verify - discriminated union pattern matching
		if (result.exists) {
			expect(result.path).toBe(templatePath);
			expect(result.content).toBe(content);
		} else {
			throw new Error("Expected template to exist");
		}
	});

	test("returns exists: false when template does not exist", async () => {
		// Execute - no template created
		const result = await detectTemplate(tempDir, "nonexistent");

		// Verify - discriminated union pattern matching
		if (!result.exists) {
			expect(result.suggestedPath).toBe(
				join(tempDir, "Templates", "nonexistent.md"),
			);
		} else {
			throw new Error("Expected template to not exist");
		}
	});

	test("handles kebab-case template names", async () => {
		// Setup
		const templatesDir = join(tempDir, "Templates");
		const templatePath = join(templatesDir, "medical-bill.md");
		const content = "---\ntype: medical-bill\n---\n# Medical Bill";

		await writeTextFile(templatePath, content);

		// Execute
		const result = await detectTemplate(tempDir, "medical-bill");

		// Verify
		if (result.exists) {
			expect(result.path).toBe(templatePath);
			expect(result.content).toBe(content);
		} else {
			throw new Error("Expected template to exist");
		}
	});

	test("returns full content for existing templates", async () => {
		// Setup - create multi-line template
		const templatesDir = join(tempDir, "Templates");
		const templatePath = join(templatesDir, "project.md");
		const content = `---
type: project
created: <% tp.date.now("YYYY-MM-DD") %>
status: active
---

# <% tp.system.prompt("Project Name") %>

## Goals

<% tp.system.prompt("What are the goals?") %>
`;

		await writeTextFile(templatePath, content);

		// Execute
		const result = await detectTemplate(tempDir, "project");

		// Verify
		if (result.exists) {
			expect(result.content).toBe(content);
		} else {
			throw new Error("Expected template to exist");
		}
	});
});
