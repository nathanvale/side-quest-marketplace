/**
 * Worktree listing with status enrichment.
 *
 * Parses `git worktree list --porcelain` output and enriches each entry
 * with dirty/merged status.
 *
 * @module worktree/list
 */

import { spawnAndCollect } from "@sidequest/core/spawn";
import type { WorktreeInfo } from "./types.js";

/**
 * List all git worktrees with enriched status information.
 *
 * Parses the porcelain output from `git worktree list` and checks each
 * worktree for uncommitted changes and merge status.
 *
 * @param gitRoot - Absolute path to the git repository root
 * @returns Array of worktree info objects
 */
export async function listWorktrees(gitRoot: string): Promise<WorktreeInfo[]> {
	const result = await spawnAndCollect(
		["git", "worktree", "list", "--porcelain"],
		{ cwd: gitRoot },
	);
	if (result.exitCode !== 0) {
		throw new Error(`Failed to list worktrees: ${result.stderr.trim()}`);
	}

	const entries = parsePorcelainOutput(result.stdout);

	// Determine the main branch name
	const mainBranch = await getMainBranch(gitRoot);

	// Enrich each entry with status
	const enriched = await Promise.all(
		entries.map((entry) => enrichWorktreeInfo(entry, mainBranch)),
	);

	return enriched;
}

/** A raw entry from porcelain output before enrichment. */
interface RawWorktreeEntry {
	path: string;
	head: string;
	branch: string;
	isBare: boolean;
}

/**
 * Parse `git worktree list --porcelain` output into structured entries.
 *
 * Porcelain format:
 * ```
 * worktree /path/to/main
 * HEAD abc123
 * branch refs/heads/main
 *
 * worktree /path/to/feature
 * HEAD def456
 * branch refs/heads/feat/my-feature
 * ```
 */
function parsePorcelainOutput(output: string): RawWorktreeEntry[] {
	const entries: RawWorktreeEntry[] = [];
	const blocks = output.trim().split("\n\n");

	for (const block of blocks) {
		if (!block.trim()) continue;

		const lines = block.trim().split("\n");
		let entryPath = "";
		let head = "";
		let branch = "";
		let isBare = false;

		for (const line of lines) {
			if (line.startsWith("worktree ")) {
				entryPath = line.slice("worktree ".length);
			} else if (line.startsWith("HEAD ")) {
				head = line.slice("HEAD ".length).slice(0, 7); // short SHA
			} else if (line.startsWith("branch ")) {
				branch = line.slice("branch ".length).replace("refs/heads/", "");
			} else if (line === "bare") {
				isBare = true;
			} else if (line === "detached") {
				branch = "(detached)";
			}
		}

		if (entryPath) {
			entries.push({ path: entryPath, head, branch, isBare });
		}
	}

	return entries;
}

/** Enrich a raw entry with dirty/merged status. */
async function enrichWorktreeInfo(
	entry: RawWorktreeEntry,
	mainBranch: string,
): Promise<WorktreeInfo> {
	const isMain =
		entry.isBare ||
		entry.branch === mainBranch ||
		entry.branch === "main" ||
		entry.branch === "master";

	const dirty = await isDirty(entry.path);
	const merged = isMain
		? true
		: await isMerged(entry.path, entry.branch, mainBranch);

	return {
		branch: entry.branch,
		path: entry.path,
		head: entry.head,
		dirty,
		merged,
		isMain,
	};
}

/** Check if a worktree has uncommitted changes. */
async function isDirty(worktreePath: string): Promise<boolean> {
	const result = await spawnAndCollect(["git", "status", "--porcelain"], {
		cwd: worktreePath,
	});
	return result.exitCode === 0 && result.stdout.trim().length > 0;
}

/** Check if a branch is merged into the main branch. */
async function isMerged(
	worktreePath: string,
	branch: string,
	mainBranch: string,
): Promise<boolean> {
	if (branch === "(detached)") return false;

	const result = await spawnAndCollect(
		["git", "merge-base", "--is-ancestor", branch, mainBranch],
		{ cwd: worktreePath },
	);
	return result.exitCode === 0;
}

/** Determine the main branch name (main or master). */
async function getMainBranch(gitRoot: string): Promise<string> {
	// Check for "main" first, then "master"
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

	// Fallback: use the current branch
	const headResult = await spawnAndCollect(
		["git", "rev-parse", "--abbrev-ref", "HEAD"],
		{ cwd: gitRoot },
	);
	return headResult.stdout.trim() || "main";
}
