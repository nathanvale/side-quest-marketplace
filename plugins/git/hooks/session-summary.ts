#!/usr/bin/env bun

/**
 * Session Summary Hook
 *
 * PreCompact hook that saves a session summary before context compaction.
 * Helps maintain continuity across context windows.
 * Includes MCP performance metrics from all plugins.
 */

import { homedir } from "node:os";
import { join } from "node:path";
import type { PreCompactHookInput } from "@anthropic-ai/claude-agent-sdk";
import { ensureDir, pathExists } from "@sidequest/core/fs";
import { getGlobalMetricsCollector } from "@sidequest/core/logging";

interface SessionSummary {
	timestamp: string;
	branch: string;
	trigger: "manual" | "auto";
	sessionCommits: string[];
	uncommittedChanges: {
		staged: string;
		modified: string;
	};
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

async function getGitRoot(cwd: string): Promise<string | null> {
	const { stdout, exitCode } = await exec("git rev-parse --show-toplevel", cwd);
	return exitCode === 0 ? stdout : null;
}

async function getSessionSummary(
	cwd: string,
	trigger: "manual" | "auto",
): Promise<SessionSummary | null> {
	if (!(await isGitRepo(cwd))) {
		return null;
	}

	// Get branch
	const { stdout: branch } = await exec(
		"git branch --show-current 2>/dev/null || echo '(detached)'",
		cwd,
	);

	// Get commits from the last hour (approximate session length)
	const { stdout: commitsOut } = await exec(
		'git log --oneline --since="1 hour ago" 2>/dev/null | head -10',
		cwd,
	);
	const sessionCommits = commitsOut
		.split("\n")
		.filter((line) => line.trim() !== "");

	// Get staged changes summary
	const { stdout: stagedStat } = await exec(
		"git diff --cached --stat 2>/dev/null | tail -1",
		cwd,
	);

	// Get modified changes summary
	const { stdout: modifiedStat } = await exec(
		"git diff --stat 2>/dev/null | tail -1",
		cwd,
	);

	return {
		timestamp: new Date().toISOString(),
		branch: branch || "(detached)",
		trigger,
		sessionCommits,
		uncommittedChanges: {
			staged: stagedStat || "none",
			modified: modifiedStat || "none",
		},
	};
}

function formatSummary(summary: SessionSummary): string {
	let output = "# Claude Session Summary\n";
	output += `# Generated: ${summary.timestamp}\n`;
	output += `# Branch: ${summary.branch}\n`;
	output += `# Trigger: ${summary.trigger}\n\n`;

	output += "## Session Activity\n\n";

	if (summary.sessionCommits.length > 0) {
		output += "### Commits this session:\n";
		summary.sessionCommits.forEach((commit) => {
			output += `- ${commit}\n`;
		});
		output += "\n";
	}

	if (
		summary.uncommittedChanges.staged !== "none" ||
		summary.uncommittedChanges.modified !== "none"
	) {
		output += "### Uncommitted changes:\n";
		if (summary.uncommittedChanges.staged !== "none") {
			output += `Staged: ${summary.uncommittedChanges.staged}\n`;
		}
		if (summary.uncommittedChanges.modified !== "none") {
			output += `Modified: ${summary.uncommittedChanges.modified}\n`;
		}
		output += "\n";
	}

	return output;
}

// Main execution
const input = (await Bun.stdin.json()) as PreCompactHookInput;
const { cwd, trigger } = input;

const gitRoot = await getGitRoot(cwd);

if (gitRoot) {
	const summary = await getSessionSummary(cwd, trigger);

	if (summary) {
		// Write to ~/.claude/session-summaries/ to avoid polluting user repos
		const claudeDir = join(homedir(), ".claude", "session-summaries");
		if (!(await pathExists(claudeDir))) {
			await ensureDir(claudeDir);
		}

		// Use repo name as filename to keep summaries separate per project
		const repoName = gitRoot.split("/").pop() || "unknown";
		const summaryPath = join(claudeDir, `${repoName}.md`);
		let content = formatSummary(summary);

		// Append performance metrics
		const metricsCollector = getGlobalMetricsCollector();
		await metricsCollector.collect();
		const metrics = metricsCollector.getSummary();

		if (metrics.totalOperations > 0) {
			content += "\n\n" + metricsCollector.toMarkdown();
		}

		await Bun.write(summaryPath, content);
		console.log(`Session summary saved to ${summaryPath}`);
	}
}

process.exit(0);
