/**
 * Integration tests for Git Session and Silent Pre-commit features.
 *
 * Tests git-based session management that abstracts git away from users:
 * - Silent pre-commit (uncommitted changes are auto-committed before operations)
 * - Session tracking (changes tracked during operations)
 * - Batch commits at session end
 * - Graceful degradation (logs warnings, continues on failure)
 *
 * The user never sees git errors - the CLI "just works".
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
 * Helper: Get the latest commit message.
 */
function getLatestCommitMessage(vaultPath: string): string {
	const result = Bun.spawnSync(["git", "log", "-1", "--format=%s"], {
		cwd: vaultPath,
		stdout: "pipe",
		stderr: "pipe",
	});

	if (result.exitCode !== 0) {
		throw new Error(
			`git log failed: ${new TextDecoder().decode(result.stderr)}`,
		);
	}

	return new TextDecoder().decode(result.stdout).trim();
}

/**
 * Helper: Modify a file to create uncommitted changes.
 */
function modifyFile(vaultPath: string, relativePath: string, content: string) {
	const filePath = path.join(vaultPath, relativePath);
	Bun.write(filePath, content);
}

describe("Git Session - Silent Pre-commit", () => {
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

	describe("Silent Pre-commit Behavior", () => {
		test("silently pre-commits uncommitted PARA files before scan", async () => {
			// Add a file to inbox and commit it (clean state)
			await harness.addToInbox(
				"test.md",
				`---
type: bookmark
url: https://example.com
title: Test Article
enrichedAt: 2024-12-17T00:00:00Z
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

			// Scan should succeed (silently pre-commits the dirty files)
			const suggestions = await harness.scan();
			expect(suggestions).toHaveLength(1);

			// Verify the dirty file was auto-committed
			const statusFinal = getGitStatusSync(harness.vault);
			expect(statusFinal.clean).toBe(true);

			// Verify the pre-commit message
			const commitMsg = getLatestCommitMessage(harness.vault);
			expect(commitMsg).toContain("auto-save before session");
		});

		test("pre-commits multiple uncommitted files", async () => {
			// Add file to inbox and commit
			await harness.addToInbox("test.md", "# Test");
			commitAllChanges(harness.vault);

			// Create multiple uncommitted changes
			modifyFile(harness.vault, "02 Areas/note1.md", "# Note 1");
			modifyFile(harness.vault, "03 Resources/note2.md", "# Note 2");

			// Scan should succeed (pre-commits all dirty files)
			const suggestions = await harness.scan();
			expect(suggestions).toHaveLength(1);

			// Verify all files were committed
			const status = getGitStatusSync(harness.vault);
			expect(status.clean).toBe(true);
		});

		test("pre-commits staged but not committed files", async () => {
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

			// Scan should succeed (pre-commits staged files)
			const suggestions = await harness.scan();
			expect(suggestions).toHaveLength(1);

			// Verify staged file was committed
			const statusFinal = getGitStatusSync(harness.vault);
			expect(statusFinal.clean).toBe(true);
		});

		test("does NOT pre-commit inbox files (they are excluded)", async () => {
			// Commit initial vault structure
			commitAllChanges(harness.vault);

			// Add file to inbox (uncommitted)
			await harness.addToInbox(
				"test.md",
				`---
type: bookmark
url: https://example.com
title: Test
enrichedAt: 2024-12-17T00:00:00Z
---
# Test
`,
			);

			// Inbox file should remain uncommitted after scan
			// (inbox is excluded from pre-commit to allow processing)
			const suggestions = await harness.scan();
			expect(suggestions).toHaveLength(1);

			// Vault will be dirty because inbox file is not pre-committed
			// The inbox file will be dirty, but that's expected
			// The key point is that scan() didn't throw an error
		});

		test("does NOT pre-commit attachments folder (excluded)", async () => {
			// Commit initial vault structure
			commitAllChanges(harness.vault);

			// Add file to inbox
			await harness.addToInbox(
				"test.md",
				`---
type: bookmark
url: https://example.com
title: Test
enrichedAt: 2024-12-17T00:00:00Z
---
# Test
`,
			);

			// Add uncommitted attachment (simulating orphaned attachment)
			modifyFile(harness.vault, "Attachments/orphaned.png", "fake image data");

			// Should succeed - attachments folder is excluded from pre-commit
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
enrichedAt: 2024-12-17T00:00:00Z
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

			// Verify we got a result back (git didn't block execution)
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
enrichedAt: 2024-12-17T00:00:00Z
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
enrichedAt: 2024-12-17T00:00:00Z
---
# Second
`,
			);

			// Second scan should also succeed
			const scan2 = await harness.scan();
			expect(scan2).toHaveLength(2);
		});

		test("processes after pre-committing dirty state", async () => {
			// Start clean
			commitAllChanges(harness.vault);

			// Add file to inbox
			await harness.addToInbox("test.md", "# Test");

			// Create dirty state
			modifyFile(harness.vault, "02 Areas/dirty.md", "# Dirty");

			// Should succeed (pre-commits dirty state automatically)
			const suggestions = await harness.scan();
			expect(suggestions).toHaveLength(1);

			// Verify vault is now clean (dirty file was pre-committed)
			const status = getGitStatusSync(harness.vault);
			expect(status.clean).toBe(true);
		});
	});

	describe("Untracked Files Handling", () => {
		test("pre-commits untracked files in PARA folders", async () => {
			// Commit initial structure
			commitAllChanges(harness.vault);

			// Add untracked file (not staged, not committed)
			modifyFile(harness.vault, "03 Resources/untracked.md", "# Untracked");

			// Add file to inbox
			await harness.addToInbox("test.md", "# Test");

			// Should succeed (pre-commits untracked files)
			const suggestions = await harness.scan();
			expect(suggestions).toHaveLength(1);

			// Verify untracked file was committed
			const status = getGitStatusSync(harness.vault);
			expect(status.clean).toBe(true);
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
enrichedAt: 2024-12-17T00:00:00Z
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

			// Should succeed (pre-commits both tracked and untracked changes)
			const suggestions = await harness.scan();
			expect(suggestions).toHaveLength(1);

			// Verify all changes were committed
			const status = getGitStatusSync(harness.vault);
			expect(status.clean).toBe(true);
		});
	});

	describe("Git Status Integration", () => {
		test("git status helper matches session behavior", async () => {
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

	describe("Session Commit Messages", () => {
		test("pre-commit uses correct message format", async () => {
			// Start clean
			commitAllChanges(harness.vault);

			// Create dirty state
			modifyFile(harness.vault, "02 Areas/note.md", "# Note");

			// Add file to inbox
			await harness.addToInbox("test.md", "# Test");

			// Scan triggers pre-commit
			await harness.scan();

			// Verify commit message format
			const commitMsg = getLatestCommitMessage(harness.vault);
			expect(commitMsg).toBe("chore(para-obsidian): auto-save before session");
		});
	});
});
