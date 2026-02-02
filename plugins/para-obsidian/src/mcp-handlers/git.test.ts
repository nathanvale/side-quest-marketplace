/**
 * Tests for git MCP tools.
 *
 * @module mcp-handlers/git.test
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { spawnAndCollect } from "@side-quest/core/spawn";
import { cleanupTestDir, createTempDir } from "@side-quest/core/testing";
import type { ParaObsidianConfig } from "../config";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Initialize a git repository for testing.
 */
async function initGitRepo(dir: string): Promise<void> {
	await spawnAndCollect(["git", "init"], { cwd: dir });
	await spawnAndCollect(["git", "config", "user.name", "Test User"], {
		cwd: dir,
	});
	await spawnAndCollect(["git", "config", "user.email", "test@example.com"], {
		cwd: dir,
	});

	// Create initial commit to establish branch
	const readmePath = path.join(dir, "README.md");
	fs.writeFileSync(readmePath, "# Test Vault\n");
	await spawnAndCollect(["git", "add", "README.md"], { cwd: dir });
	await spawnAndCollect(["git", "commit", "-m", "Initial commit"], {
		cwd: dir,
	});
}

/**
 * Create a test vault with PARA folders.
 */
function createTestVault(baseDir: string): string {
	const vault = path.join(baseDir, "vault");
	fs.mkdirSync(vault, { recursive: true });

	// Create PARA folders
	fs.mkdirSync(path.join(vault, "00 Inbox"), { recursive: true });
	fs.mkdirSync(path.join(vault, "01 Projects"), { recursive: true });
	fs.mkdirSync(path.join(vault, "02 Areas"), { recursive: true });
	fs.mkdirSync(path.join(vault, "03 Resources"), { recursive: true });
	fs.mkdirSync(path.join(vault, "04 Archives"), { recursive: true });

	return vault;
}

/**
 * Create test notes with uncommitted changes.
 */
function createUncommittedNotes(
	vault: string,
	notes: Array<{ path: string; content: string }>,
): void {
	for (const note of notes) {
		const notePath = path.join(vault, note.path);
		fs.mkdirSync(path.dirname(notePath), { recursive: true });
		fs.writeFileSync(notePath, note.content);
	}
}

/**
 * Get git status.
 */
async function getGitStatus(dir: string): Promise<string> {
	const { stdout } = await spawnAndCollect(["git", "status", "--porcelain"], {
		cwd: dir,
	});
	return stdout;
}

/**
 * Get most recent commit message.
 */
async function getLastCommitMessage(dir: string): Promise<string> {
	const { stdout } = await spawnAndCollect(
		["git", "log", "-1", "--pretty=%B"],
		{ cwd: dir },
	);
	return stdout.trim();
}

// ============================================================================
// Tests
// ============================================================================

describe("para_commit tool", () => {
	let tempDir: string;
	let vault: string;
	let config: ParaObsidianConfig;

	beforeEach(async () => {
		tempDir = createTempDir("para-commit-test-");
		vault = createTestVault(tempDir);
		await initGitRepo(vault);

		config = {
			vault,
			autoCommit: false,
			frontmatterRules: {},
			templateVersions: {},
		};
	});

	afterEach(() => {
		cleanupTestDir(tempDir);
	});

	describe("commit all uncommitted notes", () => {
		test("commits all uncommitted .md files in PARA folders", async () => {
			// Arrange
			createUncommittedNotes(vault, [
				{
					path: "01 Projects/Project A.md",
					content: "# Project A\n\nProject content",
				},
				{
					path: "02 Areas/Work.md",
					content: "# Work\n\nArea content",
				},
				{
					path: "03 Resources/Reference.md",
					content: "# Reference\n\nResource content",
				},
			]);

			// Verify uncommitted changes exist
			const statusBefore = await getGitStatus(vault);
			// Git shows files as untracked when not in subdirectories
			expect(statusBefore.length).toBeGreaterThan(0);

			// Act
			const { commitAllNotes } = await import("../git/index");
			const result = await commitAllNotes(config);

			// Assert
			expect(result.total).toBe(3);
			expect(result.committed).toBe(3);
			expect(result.results).toHaveLength(3);

			// Verify all notes are now committed
			const statusAfter = await getGitStatus(vault);
			expect(statusAfter).toBe("");

			// Verify commit messages
			const commits = await spawnAndCollect(
				["git", "log", "--oneline", "--no-decorate"],
				{ cwd: vault },
			);
			expect(commits.stdout).toContain("docs: Project A");
			expect(commits.stdout).toContain("docs: Work");
			expect(commits.stdout).toContain("docs: Reference");
		});

		test("skips non-PARA folders", async () => {
			// Arrange
			fs.mkdirSync(path.join(vault, "Templates"), { recursive: true });
			createUncommittedNotes(vault, [
				{
					path: "01 Projects/Project A.md",
					content: "# Project A",
				},
				{
					path: "Templates/template.md",
					content: "# Template",
				},
			]);

			// Act
			const { commitAllNotes } = await import("../git/index");
			const result = await commitAllNotes(config);

			// Assert
			expect(result.total).toBe(1); // Only PARA folder note
			expect(result.committed).toBe(1);

			// Verify Templates file is still uncommitted by checking it still exists
			const status = await getGitStatus(vault);
			expect(status.length).toBeGreaterThan(0); // Still has uncommitted files

			// Verify the template file wasn't committed by checking it exists on disk but not in git
			const templatePath = path.join(vault, "Templates/template.md");
			expect(fs.existsSync(templatePath)).toBe(true);

			// Check git log doesn't contain template commit
			const commits = await spawnAndCollect(
				["git", "log", "--oneline", "--no-decorate"],
				{ cwd: vault },
			);
			expect(commits.stdout).not.toContain("template");
		});

		test("returns empty result when no uncommitted notes", async () => {
			// Act - No uncommitted notes
			const { commitAllNotes } = await import("../git/index");
			const result = await commitAllNotes(config);

			// Assert
			expect(result.total).toBe(0);
			expect(result.committed).toBe(0);
			expect(result.results).toHaveLength(0);
		});
	});

	describe("commit single note", () => {
		test("commits specified note with attachments", async () => {
			// Arrange - Create note with embedded attachment
			const notePath = "01 Projects/Project A.md";
			const attachmentPath = "01 Projects/assets/diagram.png";

			fs.mkdirSync(path.join(vault, "01 Projects", "assets"), {
				recursive: true,
			});
			fs.writeFileSync(
				path.join(vault, notePath),
				"# Project A\n\n![[diagram.png]]",
			);
			fs.writeFileSync(path.join(vault, attachmentPath), "fake-image-data");

			// Act
			const { commitNote } = await import("../git/index");
			const result = await commitNote(config, notePath);

			// Assert
			expect(result.committed).toBe(true);
			expect(result.message).toBe("docs: Project A");
			expect(result.files).toContain("01 Projects/Project A.md");

			// Verify committed
			const status = await getGitStatus(vault);
			expect(status).toBe("");
			const lastMessage = await getLastCommitMessage(vault);
			expect(lastMessage).toBe("docs: Project A");
		});

		test("commits only the specified note when multiple uncommitted", async () => {
			// Arrange
			createUncommittedNotes(vault, [
				{
					path: "01 Projects/Project A.md",
					content: "# Project A",
				},
				{
					path: "01 Projects/Project B.md",
					content: "# Project B",
				},
			]);

			// Act - Commit only Project A
			const { commitNote } = await import("../git/index");
			const result = await commitNote(config, "01 Projects/Project A.md");

			// Assert
			expect(result.committed).toBe(true);
			expect(result.message).toBe("docs: Project A");

			// Verify only Project A is committed
			const status = await getGitStatus(vault);
			expect(status).not.toContain("Project A.md");
			expect(status).toContain("Project B.md"); // Still uncommitted
		});

		test("throws error for non-existent note", async () => {
			// Act & Assert
			const { commitNote } = await import("../git/index");
			await expect(
				commitNote(config, "01 Projects/NonExistent.md"),
			).rejects.toThrow();
		});
	});

	describe("MCP tool para_commit", () => {
		test("handler module loads successfully", async () => {
			// Verify the handler module can be imported
			// This ensures the tool is registered with MCP
			const handler = await import("./git");
			expect(handler).toBeDefined();

			// Note: Full MCP tool integration testing requires an MCP test harness.
			// The underlying functions (commitNote, commitAllNotes) are tested above.
			// This test verifies the handler module loads and registers the tool.
		});

		// Integration tests for the actual MCP tool invocation would go here
		// when we have an MCP test harness available. For now, we test the
		// underlying functions which the tool delegates to.
	});
});
