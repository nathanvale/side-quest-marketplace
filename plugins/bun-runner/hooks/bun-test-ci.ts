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

import { getChangedFiles } from "@side-quest/core/git";
import { TEST_FILE_EXTENSIONS } from "./shared/constants.js";
import {
	createCorrelationId,
	initLogger,
	testLogger,
} from "./shared/logger.js";
import { runChangedTests } from "./shared/test-runner.js";

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

	// Log each test failure for LLM training
	for (const failure of result.failures) {
		testLogger.error("Test failure", {
			cid,
			file: failure.file,
			line: failure.line,
			message: failure.message,
			stack: failure.stack,
		});
	}

	// Output results - JSON if failures, simple text if passed
	if (result.failed > 0 || result.timedOut) {
		console.error(
			JSON.stringify({
				tool: "bun-test",
				file_count: changedTestFiles.length,
				status: result.timedOut ? "timeout" : "failed",
				passed: result.passed,
				failed: result.failed,
				failures: result.failures.slice(0, 10).map((f) => ({
					// Limit to 10 for token efficiency
					file: f.file,
					line: f.line,
					message: f.message.split("\n")[0], // First line only
				})),
				hint: result.timedOut
					? "Tests timed out - check for hanging async operations"
					: "Fix the failing test assertions. Use bun_testFile MCP tool to debug individual files",
			}),
		);
	} else {
		const context =
			changedTestFiles.length === 1
				? changedTestFiles[0]!
				: `${changedTestFiles.length} test files`;
		console.error(`✓ ${result.passed} test(s) passed in ${context}`);
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
