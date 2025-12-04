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

import { isWorkspaceProject } from "@sidequest/bun-runner/mcp-servers/bun-runner/index.js";
import { hasChangedFiles } from "@sidequest/core/git";
import { spawnWithTimeout } from "@sidequest/core/spawn";
import { TSC_SUPPORTED_EXTENSIONS } from "./shared/constants";
import { createCorrelationId, initLogger, tscLogger } from "./shared/logger";
import { hasTscConfig, logMissingTscConfigHint } from "./shared/tsc-config";
import type { TscParseResult } from "./shared/types";
import { parseTscOutput } from "./tsc-check";

/** Timeout for project-wide TypeScript checks (2 minutes) */
const TSC_PROJECT_TIMEOUT_MS = 120_000;

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
	await initLogger();
	const cid = createCorrelationId();
	const startTime = Date.now();

	tscLogger.info("Hook started", { cid, hook: "tsc-ci", event: "Stop" });

	// Check for TypeScript config before doing anything else
	const configResult = await hasTscConfig();
	if (!configResult.found) {
		tscLogger.debug("Config not found, skipping", {
			cid,
			searchPath: configResult.searchPath,
		});
		logMissingTscConfigHint(configResult.searchPath);
		process.exit(0);
	}

	// Only run if TypeScript files have changed
	const hasChanges = await hasChangedFiles(TSC_SUPPORTED_EXTENSIONS);
	tscLogger.debug("TypeScript files changed", { cid, hasChanges });

	if (!hasChanges) {
		// No TypeScript files changed, nothing to check
		tscLogger.info("Hook completed", {
			cid,
			exitCode: 0,
			reason: "no changes",
			durationMs: Date.now() - startTime,
		});
		process.exit(0);
	}

	// Check if we're in a Bun workspace
	const isWorkspace = await isWorkspaceProject();

	// Run project-wide tsc --noEmit with timeout protection
	// In workspaces, run typecheck in all packages
	// Otherwise, run from git root
	const cmd = isWorkspace
		? ["bun", "--filter", "*", "typecheck"]
		: ["bunx", "tsc", "--noEmit", "--pretty", "false"];

	tscLogger.debug("Running project-wide TSC", {
		cid,
		isWorkspace,
		command: cmd.join(" "),
		timeoutMs: TSC_PROJECT_TIMEOUT_MS,
	});
	const tscStartTime = Date.now();
	const { stdout, stderr, exitCode, timedOut } = await spawnWithTimeout(
		cmd,
		TSC_PROJECT_TIMEOUT_MS,
	);

	if (timedOut) {
		tscLogger.warn("TSC project timed out", {
			cid,
			timeoutMs: TSC_PROJECT_TIMEOUT_MS,
		});
		console.error(
			`TypeScript project check timed out (${TSC_PROJECT_TIMEOUT_MS / 1000}s limit).\n` +
				"Project may have complex types or circular references.\n" +
				"To debug, run: bun typecheck",
		);
		tscLogger.info("Hook completed", {
			cid,
			exitCode: 2,
			reason: "timeout",
			durationMs: Date.now() - startTime,
		});
		process.exit(2);
	}

	const output = `${stdout}\n${stderr}`;

	if (exitCode === 0) {
		// All type checks passed
		tscLogger.info("Hook completed", {
			cid,
			exitCode: 0,
			durationMs: Date.now() - startTime,
		});
		process.exit(0);
	}

	// Parse and report ALL errors - TypeScript errors cascade across files
	const parsed = parseTscOutput(output);
	tscLogger.debug("TSC project check completed", {
		cid,
		errorCount: parsed.errorCount,
		durationMs: Date.now() - tscStartTime,
	});
	const formatted = formatErrors(parsed);

	if (formatted) {
		tscLogger.warn("Type errors found", { cid, errorCount: parsed.errorCount });
		console.error(
			`TypeScript project check:\n${formatted}\n\n` +
				"Fix these type errors manually.\n" +
				"Full project check: bun typecheck",
		);
		tscLogger.info("Hook completed", {
			cid,
			exitCode: 2,
			errorCount: parsed.errorCount,
			durationMs: Date.now() - startTime,
		});
		process.exit(2);
	}

	tscLogger.info("Hook completed", {
		cid,
		exitCode: 0,
		durationMs: Date.now() - startTime,
	});
	process.exit(0);
}

main();
