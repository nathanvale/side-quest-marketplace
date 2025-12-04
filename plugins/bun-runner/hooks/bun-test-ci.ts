#!/usr/bin/env bun

/**
 * Stop hook that runs comprehensive tests for all changed test files.
 * Validates test changes before turn ends.
 *
 * Git-aware: Only runs if test files have been modified or staged.
 * Test-aware: Only runs .test.ts and .test.tsx files.
 *
 * Exit codes:
 * - 0: Always (informational only, never blocking)
 *
 * Output: Aggregated test results sent to stderr for Claude to see
 */

import { getChangedFiles } from "@sidequest/core/git";
import { TEST_FILE_EXTENSIONS } from "./shared/constants.js";
import {
	createCorrelationId,
	initLogger,
	testLogger,
} from "./shared/logger.js";
import { formatTestOutput, runChangedTests } from "./shared/test-runner.js";

async function main() {
	await initLogger();
	const cid = createCorrelationId();
	const startTime = Date.now();

	testLogger.info("Hook started", {
		cid,
		hook: "bun-test-ci",
		event: "Stop",
	});

	// Get all changed test files (staged, modified, or untracked)
	const changedTestFiles = await getChangedFiles(TEST_FILE_EXTENSIONS);

	testLogger.debug("Changed test files detected", {
		cid,
		count: changedTestFiles.length,
		files: changedTestFiles,
	});

	if (changedTestFiles.length === 0) {
		// No test files changed, nothing to run
		testLogger.info("Hook completed", {
			cid,
			exitCode: 0,
			reason: "no test changes",
			durationMs: Date.now() - startTime,
		});
		process.exit(0);
	}

	// Run all changed tests
	testLogger.debug("Running changed tests", {
		cid,
		fileCount: changedTestFiles.length,
	});

	const testStartTime = Date.now();
	const result = await runChangedTests(changedTestFiles);

	testLogger.debug("Tests completed", {
		cid,
		passed: result.passed,
		failed: result.failed,
		timedOut: result.timedOut,
		durationMs: Date.now() - testStartTime,
	});

	// Output results (informational)
	const context =
		changedTestFiles.length === 1
			? changedTestFiles[0]!
			: `${changedTestFiles.length} test files`;
	const output = formatTestOutput(result, context);

	console.error(`\nComprehensive test results:\n${output}\n`);

	if (result.failed > 0) {
		console.error(
			"\nTo fix failing tests, use:\n" +
				'  MCP tool: bun_testFile(file: "path/to/test.ts")\n' +
				`  Fallback CLI: bun test ${changedTestFiles.join(" ")}`,
		);
	}

	testLogger.info("Hook completed", {
		cid,
		exitCode: 0,
		testFilesRun: changedTestFiles.length,
		passed: result.passed,
		failed: result.failed,
		durationMs: Date.now() - startTime,
	});

	// Always exit 0 (non-blocking, informational only)
	process.exit(0);
}

main();
