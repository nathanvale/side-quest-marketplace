#!/usr/bin/env bun

/**
 * Auto-Commit Check Hook
 *
 * Stop hook that checks for uncommitted changes and prompts the user
 * to commit them before ending the session.
 *
 * Exit codes:
 * - 0: Allow stop (clean tree, unstaged only, or stop_hook_active)
 * - 2: Block stop (staged changes exist, tell Claude to commit)
 *
 * Loop prevention:
 * - Checks stop_hook_active FIRST to prevent infinite loops
 * - Only triggers on STAGED changes (explicit user intent)
 */

import type { StopHookInput } from "@anthropic-ai/claude-agent-sdk";

interface GitStatus {
	staged: number;
	modified: number;
	untracked: number;
}

function parseGitStatus(output: string): GitStatus {
	const lines = output.split("\n").filter((line) => line.trim() !== "");

	let staged = 0;
	let modified = 0;
	let untracked = 0;

	for (const line of lines) {
		if (line.startsWith("##") || !line.trim()) continue;

		const indexStatus = line[0];
		const workTreeStatus = line[1];

		// Untracked files
		if (indexStatus === "?" || line.startsWith("??")) {
			untracked++;
			continue;
		}

		// Staged changes (index has changes)
		if (indexStatus !== " " && indexStatus !== "?") {
			staged++;
		}

		// Modified in work tree (unstaged)
		if (workTreeStatus !== " " && workTreeStatus !== "?") {
			modified++;
		}
	}

	return { staged, modified, untracked };
}

async function getGitStatus(cwd: string): Promise<GitStatus | null> {
	const proc = Bun.spawn(["git", "status", "--porcelain"], {
		cwd,
		stdout: "pipe",
		stderr: "pipe",
	});

	const exitCode = await proc.exited;
	if (exitCode !== 0) {
		return null; // Not a git repo or git error
	}

	const output = await new Response(proc.stdout).text();
	return parseGitStatus(output);
}

// Main execution
if (import.meta.main) {
	const input = (await Bun.stdin.json()) as StopHookInput;

	// CRITICAL: Check stop_hook_active FIRST to prevent infinite loops
	// If we're already continuing from a stop hook, always allow stop
	if (input.stop_hook_active) {
		process.exit(0);
	}

	const status = await getGitStatus(input.cwd);

	// Not a git repo or git error - allow stop
	if (status === null) {
		process.exit(0);
	}

	// Clean working tree - allow stop
	if (status.staged === 0 && status.modified === 0 && status.untracked === 0) {
		process.exit(0);
	}

	// Only unstaged/untracked changes - allow stop
	// (User may intentionally want to leave these uncommitted)
	if (status.staged === 0) {
		process.exit(0);
	}

	// Has STAGED changes - block stop and ask for commit
	// This indicates explicit user intent to commit
	console.error(
		`There are ${status.staged} staged change(s) that should be committed. Use the smart-commit skill to create a commit before ending the session.`,
	);
	process.exit(2);
}

export { parseGitStatus, getGitStatus };
