/**
 * Worktree creation logic.
 *
 * Creates a git worktree, copies configured files from the main worktree,
 * and runs the postCreate command (e.g., `bun install`).
 *
 * @module worktree/create
 */

import path from "node:path";
import { pathExistsSync } from "@sidequest/core/fs";
import { spawnAndCollect } from "@sidequest/core/spawn";
import { loadOrDetectConfig } from "./config.js";
import { copyWorktreeFiles } from "./copy-files.js";
import type { CreateResult } from "./types.js";

/**
 * Create a new git worktree with file copying and dependency installation.
 *
 * Fetches latest from remote and bases new branches off `origin/<default-branch>`
 * to ensure worktrees start from the most recent upstream state.
 *
 * @param gitRoot - Absolute path to the git repository root
 * @param branchName - Branch name for the new worktree
 * @param options - Override options
 * @returns Result of the creation
 */
export async function createWorktree(
	gitRoot: string,
	branchName: string,
	options: { noInstall?: boolean; noFetch?: boolean } = {},
): Promise<CreateResult> {
	const { config, autoDetected } = loadOrDetectConfig(gitRoot);

	const sanitizedBranch = branchName.replace(/\//g, "-");
	const worktreePath = path.join(gitRoot, config.directory, sanitizedBranch);

	if (pathExistsSync(worktreePath)) {
		throw new Error(`Worktree already exists at ${worktreePath}`);
	}

	// Fetch latest from remote (prune deleted branches)
	if (!options.noFetch) {
		await spawnAndCollect(["git", "fetch", "--prune", "--quiet"], {
			cwd: gitRoot,
		});
	}

	// Determine if we need -b (new branch) or use existing branch
	const branchExists = await checkBranchExists(gitRoot, branchName);
	const remoteBranchExists = await checkRemoteBranchExists(gitRoot, branchName);

	let addArgs: string[];
	if (branchExists) {
		// Local branch already exists -- just create worktree for it
		addArgs = ["git", "worktree", "add", worktreePath, branchName];
	} else if (remoteBranchExists) {
		// Remote branch exists -- create local tracking branch from origin
		addArgs = [
			"git",
			"worktree",
			"add",
			"-b",
			branchName,
			worktreePath,
			`origin/${branchName}`,
		];
	} else {
		// New branch -- base off origin/<default-branch> for latest upstream
		const defaultBase = await getRemoteDefaultBranch(gitRoot);
		addArgs = [
			"git",
			"worktree",
			"add",
			"-b",
			branchName,
			worktreePath,
			defaultBase,
		];
	}

	const addResult = await spawnAndCollect(addArgs, { cwd: gitRoot });
	if (addResult.exitCode !== 0) {
		throw new Error(`Failed to create worktree: ${addResult.stderr.trim()}`);
	}

	// Copy configured files
	const filesCopied = copyWorktreeFiles(
		gitRoot,
		worktreePath,
		config.copy,
		config.exclude,
	);

	// Run postCreate command
	let postCreateOutput: string | null = null;
	if (config.postCreate && !options.noInstall) {
		postCreateOutput = await runPostCreate(config.postCreate, worktreePath);
	}

	return {
		branch: branchName,
		path: worktreePath,
		filesCopied,
		postCreateOutput,
		configAutoDetected: autoDetected,
	};
}

/** Check if a local git branch exists. */
async function checkBranchExists(
	gitRoot: string,
	branchName: string,
): Promise<boolean> {
	const result = await spawnAndCollect(
		["git", "show-ref", "--verify", `refs/heads/${branchName}`],
		{ cwd: gitRoot },
	);
	return result.exitCode === 0;
}

/** Check if a remote branch exists at origin. */
async function checkRemoteBranchExists(
	gitRoot: string,
	branchName: string,
): Promise<boolean> {
	const result = await spawnAndCollect(
		["git", "show-ref", "--verify", `refs/remotes/origin/${branchName}`],
		{ cwd: gitRoot },
	);
	return result.exitCode === 0;
}

/**
 * Get the remote default branch ref (e.g., "origin/main" or "origin/master").
 *
 * Checks for origin/main first, then origin/master, then falls back
 * to whatever HEAD points to locally.
 */
async function getRemoteDefaultBranch(gitRoot: string): Promise<string> {
	const mainResult = await spawnAndCollect(
		["git", "show-ref", "--verify", "refs/remotes/origin/main"],
		{ cwd: gitRoot },
	);
	if (mainResult.exitCode === 0) return "origin/main";

	const masterResult = await spawnAndCollect(
		["git", "show-ref", "--verify", "refs/remotes/origin/master"],
		{ cwd: gitRoot },
	);
	if (masterResult.exitCode === 0) return "origin/master";

	// No remote -- fall back to local HEAD
	return "HEAD";
}

/** Run a postCreate shell command in the worktree directory. */
async function runPostCreate(command: string, cwd: string): Promise<string> {
	const parts = command.split(" ");
	const result = await spawnAndCollect(parts, { cwd });
	if (result.exitCode !== 0) {
		throw new Error(
			`postCreate command failed (${command}): ${result.stderr.trim()}`,
		);
	}
	return result.stdout.trim();
}
