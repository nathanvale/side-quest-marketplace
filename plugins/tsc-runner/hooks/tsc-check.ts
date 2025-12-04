#!/usr/bin/env bun

/**
 * PostToolUse hook that runs TypeScript type checking on edited files.
 * Performs single-file type checking for fast feedback during implementation.
 *
 * Git-aware: Only processes files that are tracked by git or staged.
 *
 * Exit codes:
 * - 0: Success (no type errors, or unsupported file type)
 * - 2: Blocking error (type errors found, shown to Claude)
 */

import { isFileInRepo } from "@sidequest/core/git";
import { spawnWithTimeout } from "@sidequest/core/spawn";
import { TSC_SUPPORTED_EXTENSIONS } from "./shared/constants";
import { createCorrelationId, initLogger, tscLogger } from "./shared/logger";
import { hasTscConfig, logMissingTscConfigHint } from "./shared/tsc-config";
import {
	extractFilePaths,
	parseHookInput,
	type TscError,
	type TscParseResult,
} from "./shared/types";

/** Timeout for single-file TypeScript checks (10 seconds) */
const TSC_TIMEOUT_MS = 10_000;

/**
 * Parse TypeScript compiler output into structured format.
 *
 * @param output - Raw stdout/stderr from tsc command
 * @returns Structured error data with count and detailed error array
 */
export function parseTscOutput(output: string): TscParseResult {
	const errors: TscError[] = [];

	// TSC output format: file(line,col): error TS1234: message
	const errorPattern = /^(.+?)\((\d+),(\d+)\):\s*error\s+TS\d+:\s*(.+)$/gm;
	const matches = output.matchAll(errorPattern);

	for (const match of matches) {
		const [, file, line, col, message] = match;
		if (file && line && col && message) {
			errors.push({
				file,
				line: Number.parseInt(line, 10),
				col: Number.parseInt(col, 10),
				message,
			});
		}
	}

	return { errorCount: errors.length, errors };
}

/**
 * Format errors for Claude-friendly output.
 *
 * @param parsed - Parsed TSC output
 * @param filePath - Path to filter errors by
 * @returns Formatted error string
 */
function formatErrors(parsed: TscParseResult, filePath: string): string {
	// Filter to only errors in the edited file
	// TSC outputs relative paths, filePath is absolute, so check if absolute ends with relative
	const fileErrors = parsed.errors.filter(
		(e) => e.file === filePath || filePath.endsWith(e.file),
	);

	if (fileErrors.length === 0) return "";

	const lines: string[] = [
		`${fileErrors.length} type error(s) in ${filePath}:`,
	];

	for (const e of fileErrors) {
		lines.push(`  ${e.file}:${e.line}:${e.col} - ${e.message}`);
	}

	return lines.join("\n");
}

async function main() {
	await initLogger();
	const cid = createCorrelationId();
	const startTime = Date.now();

	tscLogger.info("Hook started", {
		cid,
		hook: "tsc-check",
		event: "PostToolUse",
	});

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

	const input = await Bun.stdin.text();
	const hookInput = parseHookInput(input);

	if (!hookInput) {
		tscLogger.debug("No hook input, skipping", { cid });
		process.exit(0);
	}

	const filePaths = extractFilePaths(hookInput);
	tscLogger.debug("Files extracted", {
		cid,
		count: filePaths.length,
		files: filePaths,
	});

	if (filePaths.length === 0) {
		tscLogger.info("Hook completed", {
			cid,
			exitCode: 0,
			filesProcessed: 0,
			durationMs: Date.now() - startTime,
		});
		process.exit(0);
	}

	// Process each file
	const allErrors: string[] = [];
	let filesProcessed = 0;
	let filesSkipped = 0;

	for (const filePath of filePaths) {
		// Skip non-TypeScript files
		if (!TSC_SUPPORTED_EXTENSIONS.some((ext) => filePath.endsWith(ext))) {
			tscLogger.debug("File filtered", {
				cid,
				file: filePath,
				reason: "unsupported extension",
			});
			filesSkipped++;
			continue;
		}

		// Git-aware: Skip files outside the git repository
		const inRepo = await isFileInRepo(filePath);
		if (!inRepo) {
			tscLogger.debug("File filtered", {
				cid,
				file: filePath,
				reason: "not in repo",
			});
			filesSkipped++;
			continue;
		}

		filesProcessed++;
		tscLogger.debug("Checking file", { cid, file: filePath });
		const fileStartTime = Date.now();

		// Run tsc --noEmit on the single file with timeout protection
		const { stdout, stderr, exitCode, timedOut } = await spawnWithTimeout(
			["bunx", "tsc", "--noEmit", "--pretty", "false", filePath],
			TSC_TIMEOUT_MS,
		);

		if (timedOut) {
			tscLogger.warn("TSC timed out", {
				cid,
				file: filePath,
				timeoutMs: TSC_TIMEOUT_MS,
			});
			allErrors.push(
				`TypeScript check timed out for ${filePath} (${TSC_TIMEOUT_MS / 1000}s limit). ` +
					"File may contain complex types or circular references.",
			);
			continue;
		}

		const output = `${stdout}\n${stderr}`;

		if (exitCode !== 0) {
			const parsed = parseTscOutput(output);
			tscLogger.debug("TSC completed", {
				cid,
				file: filePath,
				errorCount: parsed.errorCount,
				durationMs: Date.now() - fileStartTime,
			});
			const formatted = formatErrors(parsed, filePath);
			if (formatted) {
				allErrors.push(formatted);
			}
		} else {
			tscLogger.debug("TSC completed", {
				cid,
				file: filePath,
				errorCount: 0,
				durationMs: Date.now() - fileStartTime,
			});
		}
	}

	if (allErrors.length > 0) {
		tscLogger.warn("Type errors found", { cid, errorCount: allErrors.length });
		console.error(
			`TypeScript type errors:\n${allErrors.join("\n\n")}\n\n` +
				"Fix these type errors manually.\n" +
				"Full project check: bun typecheck",
		);
		tscLogger.info("Hook completed", {
			cid,
			exitCode: 2,
			filesProcessed,
			filesSkipped,
			durationMs: Date.now() - startTime,
		});
		process.exit(2);
	}

	tscLogger.info("Hook completed", {
		cid,
		exitCode: 0,
		filesProcessed,
		filesSkipped,
		durationMs: Date.now() - startTime,
	});
	process.exit(0);
}

// Only run main() when executed directly, not when imported by tests
if (import.meta.main) {
	main();
}
