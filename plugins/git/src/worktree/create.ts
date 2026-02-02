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
 * @param gitRoot - Absolute path to the git repository root
 * @param branchName - Branch name for the new worktree
 * @param options - Override options
 * @returns Result of the creation
 */
export async function createWorktree(
	gitRoot: string,
	branchName: string,
	options: { noInstall?: boolean } = {},
): Promise<CreateResult> {
	const { config, autoDetected } = loadOrDetectConfig(gitRoot);

	const sanitizedBranch = branchName.replace(/\//g, "-");
	const worktreePath = path.join(gitRoot, config.directory, sanitizedBranch);

	if (pathExistsSync(worktreePath)) {
		throw new Error(`Worktree already exists at ${worktreePath}`);
	}

	// Determine if we need -b (new branch) or use existing branch
	const branchExists = await checkBranchExists(gitRoot, branchName);

	const addArgs = branchExists
		? ["git", "worktree", "add", worktreePath, branchName]
		: ["git", "worktree", "add", "-b", branchName, worktreePath];

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

/** Check if a git branch already exists (local or remote). */
async function checkBranchExists(
	gitRoot: string,
	branchName: string,
): Promise<boolean> {
	const result = await spawnAndCollect(
		["git", "rev-parse", "--verify", branchName],
		{ cwd: gitRoot },
	);
	return result.exitCode === 0;
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
