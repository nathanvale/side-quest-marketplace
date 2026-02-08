#!/usr/bin/env bun

/**
 * Git Safety Hook
 *
 * PreToolUse hook that blocks destructive git commands.
 * Returns exit code 2 with permissionDecision: "deny" for blocked commands.
 * Matcher: Bash only.
 */

import type {
	PreToolUseHookInput,
	PreToolUseHookSpecificOutput,
} from "@anthropic-ai/claude-agent-sdk";
import { spawnAndCollect } from "@side-quest/core/spawn";

/** Branches where direct commits are blocked (WIP checkpoints still allowed) */
const PROTECTED_BRANCHES = ["main", "master"];

/** Protected file patterns -- blocks Write/Edit to sensitive files */
const PROTECTED_FILE_PATTERNS: { pattern: RegExp; reason: string }[] = [
	{
		pattern: /\.env($|\.)/,
		reason: ".env files may contain secrets.",
	},
	{
		pattern: /credentials/,
		reason: "Credential files should not be modified by agents.",
	},
	{
		pattern: /\.git\//,
		reason: "Direct .git directory modifications are dangerous.",
	},
];

/** Destructive patterns that should be blocked */
const BLOCKED_PATTERNS: { pattern: RegExp; reason: string }[] = [
	{
		pattern: /git\s+push\s+.*(?:--force|-f)(?:\s|$)/,
		reason:
			"Force push can destroy remote history. Use --force-with-lease if you must.",
	},
	{
		pattern: /git\s+reset\s+--hard/,
		reason: "Hard reset destroys uncommitted changes permanently.",
	},
	{
		pattern: /git\s+clean\s+.*-f/,
		reason: "git clean -f permanently deletes untracked files.",
	},
	{
		pattern: /git\s+checkout\s+\.\s*$/,
		reason: "git checkout . discards all unstaged changes permanently.",
	},
	{
		pattern: /git\s+restore\s+\.\s*$/,
		reason: "git restore . discards all unstaged changes permanently.",
	},
	{
		pattern: /git\s+branch\s+.*-D\s/,
		reason: "git branch -D force-deletes a branch even if not merged.",
	},
];

/**
 * Check if a command matches any blocked pattern
 */
export function checkCommand(command: string): {
	blocked: boolean;
	reason?: string;
} {
	for (const { pattern, reason } of BLOCKED_PATTERNS) {
		if (pattern.test(command)) {
			return { blocked: true, reason };
		}
	}
	return { blocked: false };
}

/**
 * Check if a file path matches any protected pattern
 */
export function checkFileEdit(filePath: string): {
	blocked: boolean;
	reason?: string;
} {
	for (const { pattern, reason } of PROTECTED_FILE_PATTERNS) {
		if (pattern.test(filePath)) {
			return { blocked: true, reason };
		}
	}
	return { blocked: false };
}

/**
 * Detect `git commit` commands and whether they're WIP (--no-verify).
 * Does NOT match `git commit-tree` or quoted/echoed strings.
 */
export function isCommitCommand(command: string): {
	isCommit: boolean;
	isWip: boolean;
} {
	// Match `git commit` but not `git commit-tree` etc.
	// Must appear as a command (not inside quotes at the start)
	const commitPattern = /(?:^|&&\s*|;\s*)git\s+commit(?:\s|$)/;
	const isCommit = commitPattern.test(command);

	if (!isCommit) {
		return { isCommit: false, isWip: false };
	}

	const isWip = command.includes("--no-verify");
	return { isCommit: true, isWip };
}

/**
 * Get the current git branch name.
 * Returns null for detached HEAD, non-repo directories, or errors.
 * Never throws -- returns null on any failure.
 */
export async function getCurrentBranch(): Promise<string | null> {
	try {
		const result = await spawnAndCollect(["git", "branch", "--show-current"]);
		if (result.exitCode !== 0) {
			return null;
		}
		const branch = result.stdout.trim();
		return branch || null;
	} catch {
		return null;
	}
}

// Main execution
if (import.meta.main) {
	try {
		let input: PreToolUseHookInput;
		try {
			input = (await Bun.stdin.json()) as PreToolUseHookInput;
		} catch {
			process.exit(0);
		}

		const toolInput = input.tool_input as Record<string, unknown> | undefined;

		// Check Write/Edit tools against protected file patterns
		if (input.tool_name === "Write" || input.tool_name === "Edit") {
			const filePath = toolInput?.file_path;
			if (typeof filePath !== "string") {
				process.exit(0);
			}
			const fileResult = checkFileEdit(filePath);
			if (fileResult.blocked) {
				const hookSpecificOutput: PreToolUseHookSpecificOutput = {
					hookEventName: "PreToolUse",
					permissionDecision: "deny",
					permissionDecisionReason: fileResult.reason,
				};
				console.log(JSON.stringify({ hookSpecificOutput }));
				process.exit(2);
			}
			process.exit(0);
		}

		// Only check Bash tool for destructive git commands
		if (input.tool_name !== "Bash") {
			process.exit(0);
		}

		const command = toolInput?.command;
		if (typeof command !== "string") {
			process.exit(0);
		}

		const result = checkCommand(command);

		if (result.blocked) {
			const hookSpecificOutput: PreToolUseHookSpecificOutput = {
				hookEventName: "PreToolUse",
				permissionDecision: "deny",
				permissionDecisionReason: result.reason,
			};
			console.log(JSON.stringify({ hookSpecificOutput }));
			process.exit(2);
		}

		// Block non-WIP commits on protected branches (main/master)
		const commitCheck = isCommitCommand(command);
		if (commitCheck.isCommit && !commitCheck.isWip) {
			const branch = await getCurrentBranch();
			if (branch && PROTECTED_BRANCHES.includes(branch)) {
				const hookSpecificOutput: PreToolUseHookSpecificOutput = {
					hookEventName: "PreToolUse",
					permissionDecision: "deny",
					permissionDecisionReason: [
						`BLOCKED: Cannot commit directly to ${branch}.`,
						"",
						"Create a feature branch first:",
						"  git checkout -b <type>/<description>",
						"",
						"Then commit on the new branch.",
						"WIP checkpoints (--no-verify) are still allowed as a safety net.",
					].join("\n"),
				};
				console.log(JSON.stringify({ hookSpecificOutput }));
				process.exit(2);
			}
		}
	} catch {
		// Top-level catch -- never crash the hook
	}

	// Allow through
	process.exit(0);
}
