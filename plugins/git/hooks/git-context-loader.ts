#!/usr/bin/env bun

/**
 * Git Context Loader Hook
 *
 * SessionStart hook that loads git context at the beginning of a session.
 * Outputs recent commits, status, and a skill nudge for Claude's awareness.
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
}

async function exec(
	command: string,
	cwd: string,
): Promise<{ stdout: string; exitCode: number }> {
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

export function parseGitStatus(statusOut: string) {
	const lines = statusOut.split("\n");
	const branchLine = lines.find((l) => l.startsWith("##"));
	let branch = "(detached)";
	if (branchLine) {
		const parsed = branchLine.substring(3).split("...")[0];
		if (parsed) branch = parsed.trim();
	}

	let staged = 0;
	let modified = 0;
	let untracked = 0;

	for (const line of lines) {
		if (line.startsWith("##") || !line.trim()) continue;

		const code = line.substring(0, 2);
		if (code.startsWith("?") || code === "??") {
			untracked++;
		} else {
			if (code[0] !== " " && code[0] !== "?") staged++;
			if (code[1] !== " " && code[1] !== "?") modified++;
		}
	}

	return { branch, status: { staged, modified, untracked } };
}

async function getGitContext(cwd: string): Promise<GitContext | null> {
	if (!(await isGitRepo(cwd))) {
		return null;
	}

	const { stdout: statusOut } = await exec(
		"git status --porcelain -b 2>/dev/null",
		cwd,
	);

	const { branch, status } = parseGitStatus(statusOut);

	const { stdout: commitsOut } = await exec(
		'git log --oneline -5 --format="%h %s (%ar)" 2>/dev/null',
		cwd,
	);
	const recentCommits = commitsOut
		.split("\n")
		.filter((line) => line.trim() !== "");

	return {
		branch: branch || "(detached)",
		status,
		recentCommits,
	};
}

function formatContext(context: GitContext): string {
	const { branch, status, recentCommits } = context;

	let output = "Git Context:\n";
	output += `  Branch: ${branch}\n`;
	output += `  Status: ${status.staged} staged, ${status.modified} modified, ${status.untracked} untracked\n`;
	output += "\nRecent commits:\n";

	if (recentCommits.length > 0) {
		for (const commit of recentCommits) {
			output += `  ${commit}\n`;
		}
	} else {
		output += "  (no commits yet)\n";
	}

	output +=
		"\nGit workflow: /git:commit, /git:squash, /git:checkpoint — git-expert skill active";

	return output;
}

function formatSystemMessage(context: GitContext): string {
	const { branch, status, recentCommits } = context;
	const totalChanges = status.staged + status.modified + status.untracked;
	const changesStr = totalChanges > 0 ? `, ${totalChanges} changes` : "";
	const lastCommit =
		recentCommits[0]?.split(" ").slice(1).join(" ") || "no commits";
	return `Git: ${branch}${changesStr} | Last: ${lastCommit} | /git:commit /git:squash /git:checkpoint`;
}

interface HookOutput {
	systemMessage?: string;
	hookSpecificOutput: {
		hookEventName: string;
		additionalContext: string;
	};
}

// Main execution
if (import.meta.main) {
	try {
		let input: SessionStartHookInput;
		try {
			input = (await Bun.stdin.json()) as SessionStartHookInput;
		} catch {
			// stdin parse failed — exit gracefully
			process.exit(0);
		}

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
	} catch {
		// Top-level catch — never crash the hook
	}

	process.exit(0);
}
