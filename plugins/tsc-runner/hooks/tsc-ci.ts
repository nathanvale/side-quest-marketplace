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
import { parseTscOutput } from "./tsc-check";

/** Timeout for project-wide TypeScript checks (2 minutes) */
const TSC_PROJECT_TIMEOUT_MS = 120_000;

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

		// Output token-efficient JSON for Claude
		console.error(
			JSON.stringify({
				tool: "tsc",
				status: "timeout",
				timeout_ms: TSC_PROJECT_TIMEOUT_MS,
				hint: "TypeScript check timed out - project may have complex types or circular references",
			}),
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

	// Log each TypeScript error for LLM training
	for (const error of parsed.errors) {
		tscLogger.error("TypeScript error", {
			cid,
			file: error.file,
			line: error.line,
			col: error.col,
			message: error.message,
		});
	}

	if (parsed.errorCount > 0) {
		tscLogger.warn("Type errors found", { cid, errorCount: parsed.errorCount });

		// Output token-efficient JSON for Claude
		console.error(
			JSON.stringify({
				tool: "tsc",
				status: "error",
				error_count: parsed.errorCount,
				errors: parsed.errors.map((e) => ({
					file: e.file,
					line: e.line,
					col: e.col,
					message: e.message,
				})),
				hint: "Fix the TypeScript type errors in the affected files",
			}),
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
