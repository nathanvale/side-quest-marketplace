#!/usr/bin/env bun

/**
 * Stop hook that runs project-wide TypeScript type checking at end of turn.
 * Catches cross-file type errors that single-file checks might miss.
 *
 * IMPORTANT: Unlike Biome, TypeScript errors can cascade across files.
 * A change in file A can cause type errors in file B. Therefore, this hook
 * blocks on ANY type error in the project, not just in changed files.
 *
 * Git-aware: Only runs if TypeScript files have been modified or staged.
 *
 * Exit codes:
 * - 0: Success (no type errors, or no TS files changed)
 * - 2: Blocking error (any type errors found, shown to Claude for follow-up)
 */

import { spawn } from "bun";
import { TSC_SUPPORTED_EXTENSIONS } from "./shared/constants";
import { hasChangedFiles } from "./shared/git-utils";
import type { TscParseResult } from "./shared/types";
import { parseTscOutput } from "./tsc-check";

/**
 * Format errors for Claude-friendly output.
 *
 * @param parsed - Parsed TSC output
 * @returns Formatted error string
 */
function formatErrors(parsed: TscParseResult): string {
	if (parsed.errorCount === 0) return "";

	const lines: string[] = [`${parsed.errorCount} type error(s) found:`];

	for (const e of parsed.errors) {
		lines.push(`  ${e.file}:${e.line}:${e.col} - ${e.message}`);
	}

	return lines.join("\n");
}

async function main() {
	// Only run if TypeScript files have changed
	const hasChanges = await hasChangedFiles(TSC_SUPPORTED_EXTENSIONS);

	if (!hasChanges) {
		// No TypeScript files changed, nothing to check
		process.exit(0);
	}

	// Run project-wide tsc --noEmit
	const proc = spawn({
		cmd: ["bunx", "tsc", "--noEmit", "--pretty", "false"],
		stdout: "pipe",
		stderr: "pipe",
	});

	const exitCode = await proc.exited;
	const stdout = await new Response(proc.stdout).text();
	const stderr = await new Response(proc.stderr).text();
	const output = `${stdout}\n${stderr}`;

	if (exitCode === 0) {
		// All type checks passed
		process.exit(0);
	}

	// Parse and report ALL errors - TypeScript errors cascade across files
	const parsed = parseTscOutput(output);
	const formatted = formatErrors(parsed);

	if (formatted) {
		console.error(`TypeScript project check:\n${formatted}`);
		process.exit(2);
	}

	process.exit(0);
}

main();
