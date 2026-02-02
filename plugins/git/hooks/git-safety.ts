#!/usr/bin/env bun

/**
 * Git Safety Hook
 *
 * PreToolUse hook that blocks destructive git commands.
 * Returns exit code 2 with permissionDecision: "deny" for blocked commands.
 * Matcher: Bash only.
 */

import type { PreToolUseHookInput } from "@anthropic-ai/claude-agent-sdk";

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

// Main execution
if (import.meta.main) {
	try {
		let input: PreToolUseHookInput;
		try {
			input = (await Bun.stdin.json()) as PreToolUseHookInput;
		} catch {
			process.exit(0);
		}

		// Only check Bash tool
		if (input.tool_name !== "Bash") {
			process.exit(0);
		}

		const toolInput = input.tool_input as Record<string, unknown> | undefined;
		const command = toolInput?.command;
		if (typeof command !== "string") {
			process.exit(0);
		}

		const result = checkCommand(command);

		if (result.blocked) {
			const output = {
				hookSpecificOutput: {
					hookEventName: "PreToolUse",
					permissionDecision: "deny",
					reason: result.reason,
				},
			};
			console.log(JSON.stringify(output));
			process.exit(2);
		}
	} catch {
		// Top-level catch — never crash the hook
	}

	// Allow through
	process.exit(0);
}
