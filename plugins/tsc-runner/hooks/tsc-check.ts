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
import { findNearestTsConfig } from "./shared/tsc-config";
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

async function main() {
	await initLogger();
	const cid = createCorrelationId();
	const startTime = Date.now();

	tscLogger.info("Hook started", {
		cid,
		hook: "tsc-check",
		event: "PostToolUse",
	});

	// Note: We no longer check for tsconfig at git root here.
	// Instead, we find the nearest tsconfig.json for each edited file,
	// which works correctly in monorepos where each package has its own config.

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

	// Group files by their package (nearest tsconfig.json directory)
	const packageFiles = new Map<string, string[]>();
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

		// Find nearest tsconfig.json from the edited file
		const nearestConfig = await findNearestTsConfig(filePath);
		if (!nearestConfig.found || !nearestConfig.configDir) {
			tscLogger.debug("File filtered", {
				cid,
				file: filePath,
				reason: "no tsconfig found",
			});
			filesSkipped++;
			continue;
		}

		// Group by package directory
		const existing = packageFiles.get(nearestConfig.configDir) ?? [];
		existing.push(filePath);
		packageFiles.set(nearestConfig.configDir, existing);
	}

	// Run tsc once per package (not per file - tsc needs full project context)
	const allErrors: Array<{ file: string; line: number; col: number; message: string }> = [];
	let filesProcessed = 0;

	for (const [configDir, files] of packageFiles) {
		filesProcessed += files.length;
		tscLogger.debug("Checking package", {
			cid,
			configDir,
			fileCount: files.length,
			files,
		});
		const packageStartTime = Date.now();

		// Run tsc --noEmit from the package directory (checks all files in package)
		// Note: We don't pass specific files because tsc ignores tsconfig.json when files are specified
		const { stdout, stderr, exitCode, timedOut } = await spawnWithTimeout(
			["bunx", "tsc", "--noEmit", "--pretty", "false"],
			TSC_TIMEOUT_MS,
			{ cwd: configDir },
		);

		if (timedOut) {
			tscLogger.warn("TSC timed out", {
				cid,
				configDir,
				timeoutMs: TSC_TIMEOUT_MS,
			});
			allErrors.push({
				file: configDir,
				line: 0,
				col: 0,
				message: `TypeScript check timed out (${TSC_TIMEOUT_MS / 1000}s limit)`,
			});
			continue;
		}

		const output = `${stdout}\n${stderr}`;

		if (exitCode !== 0) {
			const parsed = parseTscOutput(output);
			tscLogger.debug("TSC completed", {
				cid,
				configDir,
				errorCount: parsed.errorCount,
				durationMs: Date.now() - packageStartTime,
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

			// Filter errors to only those in edited files
			for (const error of parsed.errors) {
				for (const file of files) {
					if (error.file === file || file.endsWith(error.file)) {
						allErrors.push({
							file: error.file,
							line: error.line,
							col: error.col,
							message: error.message,
						});
						break;
					}
				}
			}
		} else {
			tscLogger.debug("TSC completed", {
				cid,
				configDir,
				errorCount: 0,
				durationMs: Date.now() - packageStartTime,
			});
		}
	}

	if (allErrors.length > 0) {
		tscLogger.warn("Type errors found", { cid, errorCount: allErrors.length });

		// Output token-efficient JSON for Claude
		console.error(JSON.stringify({
			tool: "tsc",
			status: "error",
			error_count: allErrors.length,
			errors: allErrors,
			hint: "Fix the TypeScript type errors in the affected files"
		}));

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
