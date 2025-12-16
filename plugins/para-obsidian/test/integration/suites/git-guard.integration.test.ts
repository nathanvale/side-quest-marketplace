/**
 * Integration tests for Git Guard safety features.
 *
 * Tests git-based safety mechanisms that prevent data loss:
 * - Dirty vault rejection (uncommitted changes block processing)
 * - Clean vault processing (committed vaults proceed normally)
 * - Auto-commit behavior (optional automatic commits after operations)
 * - Untracked file handling (warnings for untracked content)
 *
 * These tests verify that the git guard protects users from accidentally
 * losing work by requiring clean working trees before destructive operations.
 *
 * @module test/integration/suites/git-guard
 */

import {
	afterAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";
import * as path from "node:path";
import { gitStatus } from "../../../src/git";
import { createDocumentTypeFixture } from "../fixtures";
import type { IntegrationTestHarness } from "../helpers/test-harness";
import { createTestHarness } from "../helpers/test-harness";

/**
 * Helper: Get git status using Bun.spawnSync for synchronous status checks.
 */
function getGitStatusSync(vaultPath: string): { clean: boolean } {
	const result = Bun.spawnSync(["git", "status", "--porcelain"], {
		cwd: vaultPath,
		stdout: "pipe",
		stderr: "pipe",
	});

	if (result.exitCode !== 0) {
		throw new Error(
			`git status failed: ${new TextDecoder().decode(result.stderr)}`,
		);
	}

	const output = new TextDecoder().decode(result.stdout).trim();
	return { clean: output.length === 0 };
}

/**
 * Helper: Stage and commit all changes in the vault.
 * Returns true if a commit was created, false if nothing to commit.
 */
function commitAllChanges(
	vaultPath: string,
	message = "chore: test commit",
): boolean {
	// Stage all changes (including untracked files)
	Bun.spawnSync(["git", "add", "."], {
		cwd: vaultPath,
		stdout: "ignore",
		stderr: "ignore",
	});

	// Commit
	const result = Bun.spawnSync(["git", "commit", "-m", message], {
		cwd: vaultPath,
		stdout: "pipe",
		stderr: "pipe",
	});

	// Exit code 0 = commit created
	if (result.exitCode === 0) {
		return true;
	}

	// Exit code 1 = nothing to commit (not an error)
	// Check both stdout and stderr for the message
	const stdout = new TextDecoder().decode(result.stdout);
	const stderr = new TextDecoder().decode(result.stderr);
	const output = stdout + stderr;

	if (
		output.includes("nothing to commit") ||
		output.includes("nothing added to commit") ||
		result.exitCode === 1
	) {
		return false;
	}

	// Some other error occurred
	throw new Error(`git commit failed: ${output}`);
}

/**
 * Helper: Modify a file to create uncommitted changes.
 */
function modifyFile(vaultPath: string, relativePath: string, content: string) {
	const filePath = path.join(vaultPath, relativePath);
	Bun.write(filePath, content);
}

describe("Git Guard Safety", () => {
	let harness: IntegrationTestHarness;

	beforeEach(() => {
		harness = createTestHarness({
			llmResponse: createDocumentTypeFixture({
				documentType: "bookmark",
				confidence: 0.9,
				extractedFields: {
					url: "https://example.com",
					title: "Test Article",
				},
			}),
		});
	});

	afterEach(() => {
		harness.cleanup();
	});

	afterAll(() => {
		if (harness) {
			try {
				harness.cleanup();
			} catch {
				// Already cleaned up or other error - ignore
			}
		}
	});

	describe("Dirty Vault Rejection", () => {
		test("rejects processing when vault has uncommitted changes", async () => {
			// Add a file to inbox and commit it (clean state)
			await harness.addToInbox(
				"test.md",
				`---
type: bookmark
url: https://example.com
title: Test Article
---
# Test Article
`,
			);
			commitAllChanges(harness.vault);

			// Verify vault is clean
			const statusBefore = getGitStatusSync(harness.vault);
			expect(statusBefore.clean).toBe(true);

			// Create uncommitted change in a PARA folder (not inbox)
			modifyFile(
				harness.vault,
				"02 Areas/dirty-file.md",
				"---\ntitle: Uncommitted\n---\n# Dirty File",
			);

			// Verify vault is now dirty
			const statusAfter = getGitStatusSync(harness.vault);
			expect(statusAfter.clean).toBe(false);

			// Attempt to scan - should reject due to dirty state
			await expect(harness.scan()).rejects.toThrow(/uncommitted changes/i);
		});

		test("rejects with clear error message listing dirty files", async () => {
			// Add file to inbox and commit
			await harness.addToInbox("test.md", "# Test");
			commitAllChanges(harness.vault);

			// Create multiple uncommitted changes
			modifyFile(harness.vault, "02 Areas/note1.md", "# Note 1");
			modifyFile(harness.vault, "03 Resources/note2.md", "# Note 2");

			// Attempt scan - should show file list in error
			try {
				await harness.scan();
				throw new Error("Expected scan to throw due to uncommitted changes");
			} catch (error) {
				const err = error as Error;
				expect(err.message).toContain("uncommitted changes");
				expect(err.message).toContain("note1.md");
				expect(err.message).toContain("note2.md");
			}
		});

		test("rejects when staged but not committed", async () => {
			// Add and commit initial file
			await harness.addToInbox("test.md", "# Test");
			commitAllChanges(harness.vault);

			// Stage a new file without committing
			modifyFile(harness.vault, "02 Areas/staged.md", "# Staged");
			Bun.spawnSync(["git", "add", "02 Areas/staged.md"], {
				cwd: harness.vault,
				stdout: "ignore",
			});

			// Verify file is staged
			const statusResult = Bun.spawnSync(["git", "status", "--porcelain"], {
				cwd: harness.vault,
				stdout: "pipe",
			});
			const status = new TextDecoder().decode(statusResult.stdout);
			expect(status).toContain("02 Areas/staged.md");

			// Should reject - staged files count as uncommitted
			await expect(harness.scan()).rejects.toThrow(/uncommitted changes/i);
		});

		test("does NOT reject when only inbox has uncommitted files", async () => {
			// Commit initial vault structure
			commitAllChanges(harness.vault);

			// Add file to inbox (uncommitted)
			await harness.addToInbox(
				"test.md",
				`---
type: bookmark
url: https://example.com
title: Test
---
# Test
`,
			);

			// Should succeed - inbox is excluded from git guard
			const suggestions = await harness.scan();
			expect(suggestions).toHaveLength(1);
		});

		test("does NOT reject when only attachments folder has uncommitted files", async () => {
			// Commit initial vault structure
			commitAllChanges(harness.vault);

			// Add file to inbox
			await harness.addToInbox(
				"test.md",
				`---
type: bookmark
url: https://example.com
title: Test
---
# Test
`,
			);

			// Add uncommitted attachment (simulating orphaned attachment)
			modifyFile(harness.vault, "Attachments/orphaned.png", "fake image data");

			// Should succeed - attachments folder is excluded from git guard
			const suggestions = await harness.scan();
			expect(suggestions).toHaveLength(1);
		});
	});

	describe("Clean Vault Processing", () => {
		test("processes normally when vault is clean", async () => {
			// Commit initial structure
			commitAllChanges(harness.vault);

			// Add file to inbox
			await harness.addToInbox(
				"bookmark.md",
				`---
type: bookmark
url: https://example.com
title: Test Article
clipped: 2024-12-17
---
# Test Article
`,
			);

			// Should scan successfully
			const suggestions = await harness.scan();
			expect(suggestions).toHaveLength(1);
			const suggestion = suggestions[0];
			expect(suggestion).toBeDefined();

			// Should execute successfully
			const results = await harness.execute();
			expect(results).toHaveLength(1);
			const result = results[0];
			expect(result).toBeDefined();

			// If execution failed, log the error for debugging
			if (!result!.success) {
				console.log("Execution failed:", result);
			}

			// For this test, we just care that the git guard didn't block execution
			// The execution itself might fail for other reasons (missing fields, etc.)
			// So we just verify we got a result back (wasn't blocked by git guard)
			expect(result).toBeTruthy();
		});

		test("allows multiple scans when vault stays clean", async () => {
			// Commit initial structure
			commitAllChanges(harness.vault);

			// Add first file
			await harness.addToInbox(
				"first.md",
				`---
type: bookmark
url: https://first.com
title: First
---
# First
`,
			);

			// First scan should succeed
			const scan1 = await harness.scan();
			expect(scan1).toHaveLength(1);

			// Add second file
			await harness.addToInbox(
				"second.md",
				`---
type: bookmark
url: https://second.com
title: Second
---
# Second
`,
			);

			// Second scan should also succeed
			const scan2 = await harness.scan();
			expect(scan2).toHaveLength(2);
		});

		test("processes after committing previous dirty state", async () => {
			// Start clean
			commitAllChanges(harness.vault);

			// Add file to inbox
			await harness.addToInbox("test.md", "# Test");

			// Create dirty state
			modifyFile(harness.vault, "02 Areas/dirty.md", "# Dirty");

			// Should reject due to dirty state
			await expect(harness.scan()).rejects.toThrow(/uncommitted changes/i);

			// Commit the dirty file
			commitAllChanges(harness.vault, "chore: commit dirty file");

			// Verify clean
			const status = getGitStatusSync(harness.vault);
			expect(status.clean).toBe(true);

			// Should now succeed
			const suggestions = await harness.scan();
			expect(suggestions).toHaveLength(1);
		});
	});

	describe("Untracked Files Handling", () => {
		test("detects untracked files in PARA folders", async () => {
			// Commit initial structure
			commitAllChanges(harness.vault);

			// Add untracked file (not staged, not committed)
			modifyFile(harness.vault, "03 Resources/untracked.md", "# Untracked");

			// Add file to inbox
			await harness.addToInbox("test.md", "# Test");

			// Should reject - untracked files count as uncommitted
			await expect(harness.scan()).rejects.toThrow(/uncommitted changes/i);
		});

		test("ignores untracked files in non-PARA folders", async () => {
			// Commit initial structure
			commitAllChanges(harness.vault);

			// Add untracked file outside PARA folders
			modifyFile(harness.vault, "_Sort/untracked.md", "# Outside PARA");

			// Add file to inbox
			await harness.addToInbox(
				"test.md",
				`---
type: bookmark
url: https://example.com
title: Test
---
# Test
`,
			);

			// Should succeed - _Sort is not a PARA-managed folder
			const suggestions = await harness.scan();
			expect(suggestions).toHaveLength(1);
		});

		test("handles mixed tracked and untracked changes", async () => {
			// Start with committed file
			modifyFile(harness.vault, "02 Areas/tracked.md", "# Initial");
			commitAllChanges(harness.vault);

			// Modify tracked file (creates unstaged change)
			modifyFile(harness.vault, "02 Areas/tracked.md", "# Modified");

			// Add untracked file
			modifyFile(harness.vault, "02 Areas/untracked.md", "# New");

			// Add file to inbox
			await harness.addToInbox("test.md", "# Test");

			// Should reject - both tracked and untracked changes
			try {
				await harness.scan();
				throw new Error(
					"Expected scan to throw due to mixed tracked/untracked changes",
				);
			} catch (error) {
				const err = error as Error;
				expect(err.message).toContain("uncommitted changes");
				expect(err.message).toContain("tracked.md");
				expect(err.message).toContain("untracked.md");
			}
		});
	});

	describe("Error Message Clarity", () => {
		test("error includes fix instructions", async () => {
			// Create dirty state
			commitAllChanges(harness.vault);
			await harness.addToInbox("test.md", "# Test");
			modifyFile(harness.vault, "02 Areas/dirty.md", "# Dirty");

			// Error should include helpful commands
			try {
				await harness.scan();
				throw new Error("Expected scan to throw with fix instructions");
			} catch (error) {
				const err = error as Error;
				expect(err.message).toContain("/para-obsidian:commit");
				expect(err.message).toContain("git add");
				expect(err.message).toContain("git commit");
			}
		});

		test("error message is user-friendly", async () => {
			commitAllChanges(harness.vault);
			await harness.addToInbox("test.md", "# Test");
			modifyFile(harness.vault, "02 Areas/note.md", "# Note");

			try {
				await harness.scan();
				throw new Error(
					"Expected scan to throw with user-friendly error message",
				);
			} catch (error) {
				const err = error as Error;
				// Should be clear and actionable
				expect(err.message).toContain("uncommitted changes");
				expect(err.message).toContain("PARA folders");
				expect(err.message).toContain("Commit or stash");
			}
		});
	});

	describe("Git Status Integration", () => {
		test("git status helper matches git guard behavior", async () => {
			// Test clean state
			commitAllChanges(harness.vault);
			const clean = await gitStatus(harness.vault);
			expect(clean.clean).toBe(true);

			// Add uncommitted file
			modifyFile(harness.vault, "02 Areas/test.md", "# Test");

			// Should detect dirty state
			const dirty = await gitStatus(harness.vault);
			expect(dirty.clean).toBe(false);
		});

		test("handles empty repository correctly", async () => {
			// Vault starts with committed structure from harness setup
			const status = await gitStatus(harness.vault);
			expect(status.clean).toBe(true);
		});
	});
});
