#!/usr/bin/env bun

/**
 * Auto-Commit On Stop Hook
 *
 * Stop hook that automatically creates WIP commits when Claude stops.
 *
 * Exit codes:
 * - 0: Always allow stop (creates commit if needed, or exits gracefully)
 *
 * Loop prevention:
 * - Checks stop_hook_active FIRST to prevent infinite loops
 *
 * Behavior:
 * - Triggers on ANY uncommitted changes (staged, modified, or untracked)
 * - Stages all changes with `git add -A`
 * - Creates commit: "chore(wip): <last user prompt>"
 * - Prints user notification suggesting /git:commit for cleanup
 */

import { readFile } from "node:fs/promises";
import type { StopHookInput } from "@anthropic-ai/claude-agent-sdk";

interface GitStatus {
	staged: number;
	modified: number;
	untracked: number;
}

/**
 * Parse git status --porcelain output into structured counts
 */
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

/**
 * Get git status for a directory
 * Returns null if not a git repo or git error
 */
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

/**
 * Extract last user prompt from transcript JSONL file
 * Returns null if no user messages found or file errors
 */
async function getLastUserPrompt(
	transcriptPath: string,
): Promise<string | null> {
	try {
		const content = await readFile(transcriptPath, "utf-8");
		const lines = content.split("\n").filter((line) => line.trim() !== "");

		let lastUserPrompt: string | null = null;

		for (const line of lines) {
			try {
				const parsed = JSON.parse(line);
				if (parsed.type === "user" && parsed.message?.content) {
					lastUserPrompt = parsed.message.content;
				}
			} catch {}
		}

		return lastUserPrompt;
	} catch {
		return null;
	}
}

/**
 * Truncate text to fit within max length, adding ellipsis if needed
 */
function truncateForSubject(text: string, maxLen: number): string {
	if (text.length <= maxLen) {
		return text;
	}
	// Account for ellipsis length (3 chars)
	return `${text.slice(0, maxLen - 3)}...`;
}

/**
 * Generate commit message from user prompt
 * Uses fallback if prompt is null or empty
 */
function generateCommitMessage(prompt: string | null): string {
	const subjectMaxLen = 50; // Max chars for subject after "chore(wip): " prefix
	const effectivePrompt =
		typeof prompt === "string" && prompt.trim() !== ""
			? prompt
			: "session checkpoint";
	const truncatedPrompt = truncateForSubject(effectivePrompt, subjectMaxLen);

	return `chore(wip): ${truncatedPrompt}

Session work in progress - run /git:commit to squash.`;
}

/**
 * Stage all changes and create commit
 * Returns true if commit succeeded, false otherwise
 */
async function createAutoCommit(
	cwd: string,
	message: string,
): Promise<boolean> {
	try {
		// Stage all changes (including untracked)
		const addProc = Bun.spawn(["git", "add", "-A"], {
			cwd,
			stdout: "pipe",
			stderr: "pipe",
		});

		const addExitCode = await addProc.exited;
		if (addExitCode !== 0) {
			return false;
		}

		// Create commit
		const commitProc = Bun.spawn(["git", "commit", "-m", message], {
			cwd,
			stdout: "pipe",
			stderr: "pipe",
		});

		const commitExitCode = await commitProc.exited;
		return commitExitCode === 0;
	} catch {
		return false;
	}
}

/**
 * Print user notification about WIP commit
 * Extracts subject line from full commit message
 */
function printUserNotification(commitMessage: string): void {
	const subjectLine = commitMessage.split("\n")[0];
	console.log(`✓ WIP checkpoint saved: ${subjectLine}`);
	console.log("  Run /git:commit when ready to finalize");
}

// Main execution
if (import.meta.main) {
	const input = (await Bun.stdin.json()) as StopHookInput;

	// CRITICAL: Check stop_hook_active FIRST to prevent infinite loops
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

	// Has changes - create WIP commit
	const lastPrompt = await getLastUserPrompt(input.transcript_path);
	const commitMessage = generateCommitMessage(lastPrompt);
	const success = await createAutoCommit(input.cwd, commitMessage);

	if (success) {
		printUserNotification(commitMessage);
	} else {
		// Failed to commit - log warning but don't block stop
		console.error(
			"Warning: Failed to create WIP commit. Changes remain uncommitted.",
		);
	}

	// Always exit 0 to allow stop
	process.exit(0);
}

export {
	parseGitStatus,
	getGitStatus,
	getLastUserPrompt,
	truncateForSubject,
	generateCommitMessage,
	createAutoCommit,
	printUserNotification,
};
