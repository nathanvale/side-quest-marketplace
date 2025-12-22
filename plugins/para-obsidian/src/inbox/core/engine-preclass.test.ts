/**
 * Inbox Engine Pre-classification Tests
 *
 * Tests for frontmatter detection and fast-path processing
 * that skips LLM calls for properly formatted markdown files.
 */

// IMPORTANT: Configure logtape BEFORE importing any modules that use logging
import { setupTestLogging } from "../../testing/logger";

await setupTestLogging();

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnAndCollect } from "@sidequest/core/spawn";
import { cleanupTestDir, createTempDir } from "@sidequest/core/testing";
import type { InboxEngineConfig } from "../types";
import { createInboxEngine } from "./engine";
import { createTestLLMClient } from "./llm/client";

/**
 * Initialize a git repository with a clean working tree.
 * Required for tests that call execute() which checks git status.
 */
async function initGitRepo(dir: string): Promise<void> {
	await spawnAndCollect(["git", "init"], { cwd: dir });
	await spawnAndCollect(["git", "config", "user.name", "Test"], { cwd: dir });
	await spawnAndCollect(["git", "config", "user.email", "test@test.com"], {
		cwd: dir,
	});
	// Create initial commit to establish clean state
	writeFileSync(join(dir, ".gitkeep"), "", "utf-8");
	await spawnAndCollect(["git", "add", "."], { cwd: dir });
	await spawnAndCollect(["git", "commit", "-m", "Initial commit"], {
		cwd: dir,
	});
}

/**
 * Create test engine with injected test LLM client for fast testing.
 * This avoids calling real LLM APIs during tests.
 */
function createTestEngine(config: Omit<InboxEngineConfig, "llmClient">) {
	return createInboxEngine({
		...config,
		llmClient: createTestLLMClient(),
	});
}

describe("pre-classification (frontmatter detection)", () => {
	let testVaultPath: string;

	beforeEach(async () => {
		testVaultPath = createTempDir("pre-classify-test-");
		mkdirSync(join(testVaultPath, "00 Inbox"), { recursive: true });
		mkdirSync(join(testVaultPath, "01 Projects"), { recursive: true });
		mkdirSync(join(testVaultPath, "02 Areas"), { recursive: true });
		mkdirSync(join(testVaultPath, "Templates"), { recursive: true });

		// Create vault PARA structure with test areas/projects
		writeFileSync(
			join(testVaultPath, "02 Areas", "Health.md"),
			"# Health\n\nHealth area",
			"utf-8",
		);
		writeFileSync(
			join(testVaultPath, "01 Projects", "Vacation Planning.md"),
			"# Vacation Planning\n\nPlanning my vacation",
			"utf-8",
		);

		await initGitRepo(testVaultPath);
	});

	afterEach(() => {
		cleanupTestDir(testVaultPath);
	});

	test("should pre-classify markdown note with valid type and area (skip LLM)", async () => {
		const mdContent = `---
type: bookmark
area: "[[Health]]"
title: "My Health Journal"
---

# Health Journal Entry

This is my health journal entry for today.`;

		const mdPath = join(testVaultPath, "00 Inbox", "health-journal.md");
		writeFileSync(mdPath, mdContent, "utf-8");

		const engine = createTestEngine({ vaultPath: testVaultPath });
		const suggestions = await engine.scan();

		expect(suggestions.length).toBe(1);
		const suggestion = suggestions[0];

		if (suggestion?.action === "create-note") {
			expect(suggestion.suggestedDestination).toBe("02 Areas/Health");
			expect(suggestion.suggestedTitle).toBe("My Health Journal");
			expect(suggestion.confidence).toBe("high");
			expect(suggestion.source).toContain("health-journal.md");
		} else {
			throw new Error("Expected create-note suggestion");
		}
	});

	test("should pre-classify markdown note with valid type and project (skip LLM)", async () => {
		const mdContent = `---
type: bookmark
project: "[[Vacation Planning]]"
title: "Flight Research"
---

# Flight Research

Looking into flights for vacation.`;

		const mdPath = join(testVaultPath, "00 Inbox", "flight-research.md");
		writeFileSync(mdPath, mdContent, "utf-8");

		const engine = createTestEngine({ vaultPath: testVaultPath });
		const suggestions = await engine.scan();

		expect(suggestions.length).toBe(1);
		const suggestion = suggestions[0];

		if (suggestion?.action === "create-note") {
			expect(suggestion.suggestedDestination).toBe(
				"01 Projects/Vacation Planning",
			);
			expect(suggestion.suggestedTitle).toBe("Flight Research");
			expect(suggestion.confidence).toBe("high");
		} else {
			throw new Error("Expected create-note suggestion");
		}
	});

	test("should fall through to LLM when type is unknown", async () => {
		const mdContent = `---
type: unknown-type
area: "[[Health]]"
title: "Unknown Document"
---

# Unknown Document

This has an unknown type.`;

		const mdPath = join(testVaultPath, "00 Inbox", "unknown.md");
		writeFileSync(mdPath, mdContent, "utf-8");

		const engine = createTestEngine({ vaultPath: testVaultPath });
		const suggestions = await engine.scan();

		// Should still create suggestion via LLM fallback
		expect(suggestions.length).toBe(1);
	});

	test("should use fast-path for typed markdown even when area not found in vault", async () => {
		const mdContent = `---
type: note
area: "[[NonExistentArea]]"
title: "Note with Missing Area"
---

# Note Content`;

		const mdPath = join(testVaultPath, "00 Inbox", "missing-area.md");
		writeFileSync(mdPath, mdContent, "utf-8");

		const engine = createTestEngine({ vaultPath: testVaultPath });
		const suggestions = await engine.scan();

		expect(suggestions.length).toBe(1);
		const suggestion = suggestions[0];

		if (suggestion?.action === "create-note") {
			// Should default to Archives when area not found
			expect(suggestion.suggestedDestination).toBe("04 Archives");
			expect(suggestion.confidence).toBe("high");
		} else {
			throw new Error("Expected create-note suggestion");
		}
	});

	test("should use fast-path for typed markdown even without area/project", async () => {
		const mdContent = `---
type: note
title: "Standalone Note"
---

# Standalone Note

This note has no area or project specified.`;

		const mdPath = join(testVaultPath, "00 Inbox", "standalone.md");
		writeFileSync(mdPath, mdContent, "utf-8");

		const engine = createTestEngine({ vaultPath: testVaultPath });
		const suggestions = await engine.scan();

		expect(suggestions.length).toBe(1);
		const suggestion = suggestions[0];

		if (suggestion?.action === "create-note") {
			// Should default to Archives when no area/project
			expect(suggestion.suggestedDestination).toBe("04 Archives");
			expect(suggestion.confidence).toBe("high");
		} else {
			throw new Error("Expected create-note suggestion");
		}
	});

	test("should handle plain text area format (no wikilinks)", async () => {
		const mdContent = `---
type: note
area: Health
title: "Plain Text Area"
---

# Health Note

Area specified without wikilinks.`;

		const mdPath = join(testVaultPath, "00 Inbox", "plain-area.md");
		writeFileSync(mdPath, mdContent, "utf-8");

		const engine = createTestEngine({ vaultPath: testVaultPath });
		const suggestions = await engine.scan();

		expect(suggestions.length).toBe(1);
		const suggestion = suggestions[0];

		if (suggestion?.action === "create-note") {
			expect(suggestion.suggestedDestination).toBe("02 Areas/Health");
			expect(suggestion.suggestedTitle).toBe("Plain Text Area");
		} else {
			throw new Error("Expected create-note suggestion");
		}
	});

	test("should prioritize project over area when both are present", async () => {
		const mdContent = `---
type: note
area: "[[Health]]"
project: "[[Vacation Planning]]"
title: "Conflicting Assignment"
---

# Note with Both Area and Project

Should go to project folder.`;

		const mdPath = join(testVaultPath, "00 Inbox", "conflict.md");
		writeFileSync(mdPath, mdContent, "utf-8");

		const engine = createTestEngine({ vaultPath: testVaultPath });
		const suggestions = await engine.scan();

		expect(suggestions.length).toBe(1);
		const suggestion = suggestions[0];

		if (suggestion?.action === "create-note") {
			// Project should take priority
			expect(suggestion.suggestedDestination).toBe(
				"01 Projects/Vacation Planning",
			);
			expect(suggestion.suggestedTitle).toBe("Conflicting Assignment");
		} else {
			throw new Error("Expected create-note suggestion");
		}
	});

	test("should use filename-derived title when frontmatter title missing", async () => {
		const mdContent = `---
type: note
area: "[[Health]]"
---

# Health Note

No title in frontmatter.`;

		const mdPath = join(testVaultPath, "00 Inbox", "derived-title.md");
		writeFileSync(mdPath, mdContent, "utf-8");

		const engine = createTestEngine({ vaultPath: testVaultPath });
		const suggestions = await engine.scan();

		expect(suggestions.length).toBe(1);
		const suggestion = suggestions[0];

		if (suggestion?.action === "create-note") {
			// Should derive title from filename
			expect(suggestion.suggestedTitle).toBe("Derived Title");
		} else {
			throw new Error("Expected create-note suggestion");
		}
	});

	test("should not affect PDF files (normal LLM flow)", async () => {
		// Create a PDF file - should not trigger pre-classification
		const pdfPath = join(testVaultPath, "00 Inbox", "document.pdf");
		writeFileSync(pdfPath, "Mock PDF content", "utf-8");

		const engine = createTestEngine({ vaultPath: testVaultPath });

		// Should throw error about pdftotext not being available
		// This confirms PDF files go through normal processing, not pre-classification
		await expect(engine.scan()).rejects.toThrow(/pdftotext.*not.*available/i);
	});
});
