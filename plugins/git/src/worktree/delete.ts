/**
 * Worktree deletion with safety checks.
 *
 * Removes a git worktree directory and optionally deletes the branch.
 * Checks for uncommitted changes and unmerged status before proceeding.
 *
 * @module worktree/delete
 */

import { spawnAndCollect } from "@sidequest/core/spawn";
import { loadOrDetectConfig } from "./config.js";
import type { DeleteResult } from "./types.js";

/** Pre-deletion status check result. */
export interface DeleteCheck {
	/** Absolute path to the worktree. */
	readonly path: string;
	/** Branch name. */
	readonly branch: string;
	/** Whether the worktree has uncommitted changes. */
	readonly dirty: boolean;
	/** Whether the branch is merged into main. */
	readonly merged: boolean;
	/** Whether the worktree exists at the expected path. */
	readonly exists: boolean;
}

/**
 * Check the status of a worktree before deletion.
 *
 * Returns information about whether the worktree is dirty or unmerged,
 * so the caller (skill/CLI) can warn the user.
 *
 * @param gitRoot - Absolute path to the git repository root
 * @param branchName - Branch name of the worktree to check
 * @returns Pre-deletion status info
 */
export async function checkBeforeDelete(
	gitRoot: string,
	branchName: string,
): Promise<DeleteCheck> {
	const { config } = loadOrDetectConfig(gitRoot);
	const sanitizedBranch = branchName.replace(/\//g, "-");
	const worktreePath = `${gitRoot}/${config.directory}/${sanitizedBranch}`;

	// Check existence
	const existsResult = await spawnAndCollect(
		["git", "worktree", "list", "--porcelain"],
		{ cwd: gitRoot },
	);
	const exists = existsResult.stdout.includes(worktreePath);

	if (!exists) {
		return {
			path: worktreePath,
			branch: branchName,
			dirty: false,
			merged: false,
			exists: false,
		};
	}

	// Check dirty status
	const statusResult = await spawnAndCollect(["git", "status", "--porcelain"], {
		cwd: worktreePath,
	});
	const dirty =
		statusResult.exitCode === 0 && statusResult.stdout.trim().length > 0;

	// Check merged status
	const mainBranch = await getMainBranch(gitRoot);
	const mergeResult = await spawnAndCollect(
		["git", "merge-base", "--is-ancestor", branchName, mainBranch],
		{ cwd: gitRoot },
	);
	const merged = mergeResult.exitCode === 0;

	return { path: worktreePath, branch: branchName, dirty, merged, exists };
}

/**
 * Delete a git worktree and optionally its branch.
 *
 * @param gitRoot - Absolute path to the git repository root
 * @param branchName - Branch name of the worktree to delete
 * @param options - Deletion options
 * @returns Result of the deletion
 */
export async function deleteWorktree(
	gitRoot: string,
	branchName: string,
	options: { force?: boolean; deleteBranch?: boolean } = {},
): Promise<DeleteResult> {
	const { config } = loadOrDetectConfig(gitRoot);
	const sanitizedBranch = branchName.replace(/\//g, "-");
	const worktreePath = `${gitRoot}/${config.directory}/${sanitizedBranch}`;

	// Run preDelete hook if configured
	if (config.preDelete) {
		const parts = config.preDelete.split(" ");
		await spawnAndCollect(parts, { cwd: worktreePath });
	}

	// Remove the worktree
	const removeArgs = ["git", "worktree", "remove", worktreePath];
	if (options.force) {
		removeArgs.push("--force");
	}

	const removeResult = await spawnAndCollect(removeArgs, { cwd: gitRoot });
	if (removeResult.exitCode !== 0) {
		throw new Error(`Failed to remove worktree: ${removeResult.stderr.trim()}`);
	}

	// Prune worktree references
	await spawnAndCollect(["git", "worktree", "prune"], { cwd: gitRoot });

	// Optionally delete the branch
	let branchDeleted = false;
	if (options.deleteBranch) {
		const deleteFlag = options.force ? "-D" : "-d";
		const branchResult = await spawnAndCollect(
			["git", "branch", deleteFlag, branchName],
			{ cwd: gitRoot },
		);
		branchDeleted = branchResult.exitCode === 0;
	}

	return {
		branch: branchName,
		path: worktreePath,
		branchDeleted,
	};
}

/** Determine the main branch name. */
async function getMainBranch(gitRoot: string): Promise<string> {
	const result = await spawnAndCollect(
		["git", "rev-parse", "--verify", "main"],
		{ cwd: gitRoot },
	);
	if (result.exitCode === 0) return "main";

	const masterResult = await spawnAndCollect(
		["git", "rev-parse", "--verify", "master"],
		{ cwd: gitRoot },
	);
	if (masterResult.exitCode === 0) return "master";

	const headResult = await spawnAndCollect(
		["git", "rev-parse", "--abbrev-ref", "HEAD"],
		{ cwd: gitRoot },
	);
	return headResult.stdout.trim() || "main";
}
