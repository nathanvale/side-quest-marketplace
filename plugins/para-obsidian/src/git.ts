/**
 * Git integration for vault operations.
 *
 * This module provides:
 * - Git repository validation (vault must be in a git repo for writes)
 * - Status checking (clean/dirty working tree)
 * - Automatic commit after write operations
 *
 * Git integration is optional but recommended for version control
 * of vault content.
 *
 * @module git
 */
import fs from "node:fs";
import path from "node:path";

import { spawnAndCollect } from "../../../core/src/spawn/index.js";
import type { ParaObsidianConfig } from "./config";
import { resolveVaultPath } from "./fs";

/**
 * Gets the git repository root for a given directory.
 *
 * @param dir - Directory to check
 * @returns Absolute path to git root, or null if not in a git repo
 */
async function getGitRootForDir(dir: string): Promise<string | null> {
	const { stdout, exitCode } = await spawnAndCollect(
		["git", "rev-parse", "--show-toplevel"],
		{ cwd: dir },
	);
	if (exitCode !== 0) return null;
	return stdout.trim() || null;
}

/**
 * Asserts that a directory is inside a git repository.
 *
 * This is a safety guard to ensure write operations are version
 * controlled. Throws if the directory is not in a git repo.
 *
 * @param dir - Directory to check
 * @throws Error if directory is not inside a git repository
 *
 * @example
 * ```typescript
 * await assertGitRepo(config.vault);
 * // Proceed with write operations...
 * ```
 */
export async function assertGitRepo(dir: string): Promise<void> {
	const root = await getGitRootForDir(dir);
	if (!root) {
		throw new Error("Vault must be inside a git repository for writes.");
	}

	// Verify the directory is actually under the git root (handles symlinks)
	const realRoot = fs.existsSync(root)
		? fs.realpathSync(root)
		: path.resolve(root);
	const realDir = fs.existsSync(dir) ? fs.realpathSync(dir) : path.resolve(dir);
	if (!realDir.startsWith(realRoot)) {
		throw new Error("Vault must be inside a git repository for writes.");
	}
}

/**
 * Checks the git status of a directory.
 *
 * @param dir - Directory to check
 * @returns Object with clean status (true if no uncommitted changes)
 * @throws Error if git status command fails
 *
 * @example
 * ```typescript
 * const { clean } = await gitStatus(config.vault);
 * if (!clean) {
 *   console.warn('Warning: uncommitted changes in vault');
 * }
 * ```
 */
export async function gitStatus(dir: string): Promise<{ clean: boolean }> {
	const { stdout, exitCode } = await spawnAndCollect(
		["git", "status", "--porcelain"],
		{ cwd: dir },
	);
	if (exitCode !== 0) throw new Error("git status failed");
	const output = stdout.trim();
	return { clean: output.length === 0 };
}

/**
 * Stages files for commit.
 *
 * @param dir - Git repository directory
 * @param paths - Paths to stage (relative to git root)
 * @throws Error if git add fails
 */
export async function gitAdd(dir: string, paths: string[]): Promise<void> {
	const { exitCode, stderr } = await spawnAndCollect(["git", "add", ...paths], {
		cwd: dir,
	});
	if (exitCode !== 0) {
		throw new Error(`git add failed: ${stderr}`);
	}
}

/**
 * Creates a git commit with the staged changes.
 *
 * @param dir - Git repository directory
 * @param message - Commit message
 * @returns Object with committed status (false if nothing to commit)
 */
export async function gitCommit(
	dir: string,
	message: string,
): Promise<{ committed: boolean }> {
	const { exitCode } = await spawnAndCollect(["git", "commit", "-m", message], {
		cwd: dir,
	});
	// Non-zero exit code when nothing to commit is expected
	return { committed: exitCode === 0 };
}

/**
 * Automatically commits changes to specified files.
 *
 * This function is used by write operations when autoCommit is enabled.
 * It stages the specified files and creates a commit using the
 * configured commit message template.
 *
 * @param config - Para-obsidian configuration with autoCommit settings
 * @param paths - Vault-relative paths to commit
 * @param summary - Short description for commit message (default: "update")
 * @returns Commit result with status and details
 *
 * @example
 * ```typescript
 * const result = await autoCommitChanges(
 *   config,
 *   ['Projects/Note.md'],
 *   'create project note'
 * );
 * if (result.committed) {
 *   console.log(`Committed: ${result.message}`);
 * }
 * ```
 */
export async function autoCommitChanges(
	config: ParaObsidianConfig,
	paths: ReadonlyArray<string>,
	summary = "update",
): Promise<{
	committed: boolean;
	skipped: boolean;
	message: string;
	paths: ReadonlyArray<string>;
}> {
	// Skip if auto-commit is disabled
	if (!config.autoCommit) {
		return { committed: false, skipped: true, message: "", paths: [] };
	}

	// Verify vault is in a git repo
	await assertGitRepo(config.vault);
	const gitRoot = await getGitRootForDir(config.vault);
	if (!gitRoot) {
		throw new Error("Vault must be inside a git repository for auto-commit.");
	}

	const realGitRoot = fs.realpathSync(gitRoot);

	// Normalize paths relative to git root (handles vault subdir case)
	const normalizedPaths = Array.from(
		new Set(
			paths.map((p) => {
				const resolved = resolveVaultPath(config.vault, p);
				const absolute = fs.realpathSync(resolved.absolute);
				return path.relative(realGitRoot, absolute);
			}),
		),
	).filter(Boolean);

	if (normalizedPaths.length === 0) {
		return { committed: false, skipped: false, message: "", paths: [] };
	}

	// Stage files and commit
	await gitAdd(gitRoot, normalizedPaths);

	// Build commit message from template
	const template =
		config.gitCommitMessageTemplate ?? "chore: para-obsidian {summary}";
	const message = template
		.replace("{summary}", summary)
		.replace("{files}", normalizedPaths.join(", "));

	const { committed } = await gitCommit(gitRoot, message);
	return { committed, skipped: false, message, paths: normalizedPaths };
}
