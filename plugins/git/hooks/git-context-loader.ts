#!/usr/bin/env bun

/**
 * Git Context Loader Hook
 *
 * SessionStart hook that loads git context at the beginning of a session.
 * Outputs recent commits, status, and open issues for Claude's awareness.
 */

import type { SessionStartHookInput } from "@anthropic-ai/claude-agent-sdk";

interface GitContext {
	branch: string;
	status: {
		staged: number;
		modified: number;
		untracked: number;
	};
	recentCommits: string[];
	openIssues?: string[];
}

async function exec(command: string, cwd: string): Promise<{ stdout: string; exitCode: number }> {
	const proc = Bun.spawn(["sh", "-c", command], {
		cwd,
		stdout: "pipe",
		stderr: "pipe",
	});

	const stdout = await new Response(proc.stdout).text();
	const exitCode = await proc.exited;

	return { stdout: stdout.trim(), exitCode };
}

async function isGitRepo(cwd: string): Promise<boolean> {
	const { exitCode } = await exec("git rev-parse --git-dir", cwd);
	return exitCode === 0;
}

async function getGitContext(cwd: string): Promise<GitContext | null> {
	if (!(await isGitRepo(cwd))) {
		return null;
	}

	// Get branch
	const { stdout: branch } = await exec(
		"git branch --show-current 2>/dev/null || echo '(detached)'",
		cwd
	);

	// Get status counts
	const { stdout: stagedOut } = await exec(
		"git diff --cached --name-only 2>/dev/null | wc -l",
		cwd
	);
	const { stdout: modifiedOut } = await exec("git diff --name-only 2>/dev/null | wc -l", cwd);
	const { stdout: untrackedOut } = await exec(
		"git ls-files --others --exclude-standard 2>/dev/null | wc -l",
		cwd
	);

	// Get recent commits
	const { stdout: commitsOut } = await exec(
		'git log --oneline -5 --format="%h %s (%ar)" 2>/dev/null',
		cwd
	);
	const recentCommits = commitsOut.split("\n").filter((line) => line.trim() !== "");

	const context: GitContext = {
		branch: branch || "(detached)",
		status: {
			staged: Number.parseInt(stagedOut.trim(), 10) || 0,
			modified: Number.parseInt(modifiedOut.trim(), 10) || 0,
			untracked: Number.parseInt(untrackedOut.trim(), 10) || 0,
		},
		recentCommits,
	};

	// Check for open issues if gh is available and authenticated
	const { exitCode: ghAuthCheck } = await exec("gh auth status", cwd);
	if (ghAuthCheck === 0) {
		const { stdout: issuesOut, exitCode: issuesCode } = await exec(
			"gh issue list --limit 3 --state open 2>/dev/null",
			cwd
		);
		if (issuesCode === 0 && issuesOut.trim()) {
			context.openIssues = issuesOut.split("\n").filter((line) => line.trim() !== "");
		}
	}

	return context;
}

function formatContext(context: GitContext): string {
	const { branch, status, recentCommits, openIssues } = context;

	let output = "Git Context:\n";
	output += `  Branch: ${branch}\n`;
	output += `  Status: ${status.staged} staged, ${status.modified} modified, ${status.untracked} untracked\n`;
	output += "\nRecent commits:\n";

	if (recentCommits.length > 0) {
		recentCommits.forEach((commit) => {
			output += `  ${commit}\n`;
		});
	} else {
		output += "  (no commits yet)\n";
	}

	if (openIssues && openIssues.length > 0) {
		output += "\nOpen issues (top 3):\n";
		openIssues.forEach((issue) => {
			output += `  ${issue}\n`;
		});
	}

	return output;
}

function formatSystemMessage(context: GitContext): string {
	const { branch, status, recentCommits } = context;
	const totalChanges = status.staged + status.modified + status.untracked;
	const changesStr = totalChanges > 0 ? `, ${totalChanges} changes` : "";
	const lastCommit = recentCommits[0]?.split(" ").slice(1).join(" ") || "no commits";
	return `Git: ${branch}${changesStr} | Last: ${lastCommit}`;
}

interface HookOutput {
	systemMessage?: string;
	hookSpecificOutput: {
		hookEventName: string;
		additionalContext: string;
	};
}

// Main execution
const input = (await Bun.stdin.json()) as SessionStartHookInput;
const { cwd, source } = input;

// Only run on startup, not on resume/clear/compact
if (source === "startup") {
	const context = await getGitContext(cwd);

	if (context) {
		const output: HookOutput = {
			systemMessage: formatSystemMessage(context),
			hookSpecificOutput: {
				hookEventName: "SessionStart",
				additionalContext: formatContext(context),
			},
		};
		console.log(JSON.stringify(output));
	}
}

process.exit(0);
