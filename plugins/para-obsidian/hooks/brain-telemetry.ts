#!/usr/bin/env bun

/**
 * PostToolUse hook: Brain Telemetry (async)
 *
 * Fires after Skill tool calls to capture brain routing decisions.
 * Appends JSONL entries to ~/.claude/logs/brain-telemetry.jsonl.
 * Runs with async: true — non-blocking, never stalls the agent loop.
 */

import { existsSync, mkdirSync } from "node:fs";
import { appendFile } from "node:fs/promises";
import { dirname, join } from "node:path";

interface TelemetryEntry {
	timestamp: string;
	type: "route" | "heal";
	input?: string;
	routedTo: string;
	skillResult?: string;
	corrected?: boolean;
}

const LOG_DIR = join(process.env.HOME ?? "~", ".claude", "logs");
const LOG_FILE = join(LOG_DIR, "brain-telemetry.jsonl");

async function main(): Promise<void> {
	// Read hook context from environment
	const toolName = process.env.CLAUDE_TOOL_NAME ?? "";
	const toolInput = process.env.CLAUDE_TOOL_INPUT ?? "{}";

	// Only process Skill tool calls
	if (toolName !== "Skill") {
		return;
	}

	let input: { skill?: string; args?: string };
	try {
		input = JSON.parse(toolInput);
	} catch {
		return;
	}

	// Only track para-obsidian skill invocations (brain routing)
	const skill = input.skill ?? "";
	if (!skill.startsWith("para-obsidian:")) {
		return;
	}

	const skillName = skill.replace("para-obsidian:", "");
	const toolOutput = process.env.CLAUDE_TOOL_OUTPUT ?? "";

	// Extract SKILL_RESULT if present in output
	let skillResult: string | undefined;
	const resultMatch = toolOutput.match(/SKILL_RESULT:(\{[^}]+\})/);
	if (resultMatch?.[1]) {
		try {
			const parsed = JSON.parse(resultMatch[1]);
			skillResult = parsed.status;
		} catch {
			// Ignore parse errors
		}
	}

	// Detect if this is a healing intervention
	const isHeal = skillName === "triage" && input.args?.includes("heal");

	const entry: TelemetryEntry = {
		timestamp: new Date().toISOString(),
		type: isHeal ? "heal" : "route",
		input: input.args?.slice(0, 200), // Truncate long inputs
		routedTo: skillName,
		...(skillResult && { skillResult }),
		...(skillName === "reflect" && { corrected: true }),
	};

	// Ensure log directory exists
	if (!existsSync(LOG_DIR)) {
		mkdirSync(LOG_DIR, { recursive: true });
	}

	// Append JSONL entry
	await appendFile(LOG_FILE, `${JSON.stringify(entry)}\n`);
}

main().catch(() => {
	// Silent failure — telemetry should never block the agent
});
