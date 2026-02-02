#!/usr/bin/env bun

/**
 * Command Logger Hook
 *
 * PostToolUse hook that logs Bash commands to an audit trail.
 * Appends JSONL to ~/.claude/logs/git-command-log.jsonl.
 * Fire-and-forget: always exit 0, never block.
 */

import { homedir } from "node:os";
import { join } from "node:path";
import type { PostToolUseHookInput } from "@anthropic-ai/claude-agent-sdk";

export interface CommandLogEntry {
	timestamp: string;
	session_id: string;
	cwd: string;
	command: string;
}

/**
 * Create a log entry from hook input
 */
export function createLogEntry(
	input: PostToolUseHookInput,
): CommandLogEntry | null {
	if (input.tool_name !== "Bash") return null;

	const toolInput = input.tool_input as Record<string, unknown> | undefined;
	const command = toolInput?.command;
	if (typeof command !== "string") return null;

	return {
		timestamp: new Date().toISOString(),
		session_id: input.session_id || "unknown",
		cwd: input.cwd || "unknown",
		command,
	};
}

// Main execution
if (import.meta.main) {
	try {
		let input: PostToolUseHookInput;
		try {
			input = (await Bun.stdin.json()) as PostToolUseHookInput;
		} catch {
			process.exit(0);
		}

		const entry = createLogEntry(input);
		if (!entry) {
			process.exit(0);
		}

		const logDir = join(homedir(), ".claude", "logs");
		const logPath = join(logDir, "git-command-log.jsonl");

		// Ensure directory exists
		const mkdirProc = Bun.spawn(["mkdir", "-p", logDir], {
			stdout: "pipe",
			stderr: "pipe",
		});
		await mkdirProc.exited;

		// Append entry
		const file = Bun.file(logPath);
		const existing = (await file.exists()) ? await file.text() : "";
		const separator = existing.endsWith("\n") || existing === "" ? "" : "\n";
		await Bun.write(
			logPath,
			`${existing}${separator}${JSON.stringify(entry)}\n`,
		);
	} catch {
		// Fire-and-forget — never crash
	}

	process.exit(0);
}
