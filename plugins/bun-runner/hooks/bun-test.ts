#!/usr/bin/env bun

/**
 * PostToolUse hook that runs tests for edited .test.ts files.
 * Provides fast feedback after Write/Edit operations.
 *
 * Git-aware: Only processes files that are in the git repository.
 * Test-aware: Only runs on .test.ts and .test.tsx files.
 *
 * Exit codes:
 * - 0: Always (informational only, never blocking)
 *
 * Output: Test results sent to stderr for Claude to see
 */

import { isFileInRepo } from "@side-quest/core/git";
import {
	extractFilePaths,
	parseHookInput,
} from "@sidequest/marketplace-core/hooks";
import { TEST_FILE_EXTENSIONS } from "./shared/constants.js";
import {
	createCorrelationId,
	initLogger,
	testLogger,
} from "./shared/logger.js";
import { runTestFile } from "./shared/test-runner.js";

async function main() {
	await initLogger();
	const cid = createCorrelationId();
	const startTime = Date.now();

	testLogger.info("Hook started", {
		cid,
		hook: "bun-test",
		event: "PostToolUse",
	});

	// Parse hook input from stdin
	const input = await Bun.stdin.text();
	const hookInput = parseHookInput(input);

	if (!hookInput) {
		testLogger.debug("No hook input, skipping", { cid });
		process.exit(0);
	}

	const filePaths = extractFilePaths(hookInput);
	testLogger.debug("Files extracted", {
		cid,
		count: filePaths.length,
		files: filePaths,
	});

	if (filePaths.length === 0) {
		testLogger.info("Hook completed", {
			cid,
			exitCode: 0,
			reason: "no files",
			durationMs: Date.now() - startTime,
		});
		process.exit(0);
	}

	// Filter for test files only
	let testFilesProcessed = 0;
	let filesSkipped = 0;

	for (const filePath of filePaths) {
		// Skip non-test files
		if (!TEST_FILE_EXTENSIONS.some((ext) => filePath.endsWith(ext))) {
			testLogger.debug("File filtered", {
				cid,
				file: filePath,
				reason: "not a test file",
			});
			filesSkipped++;
			continue;
		}

		// Git-aware: Skip files outside the git repository
		const inRepo = await isFileInRepo(filePath);
		if (!inRepo) {
			testLogger.debug("File filtered", {
				cid,
				file: filePath,
				reason: "not in repo",
			});
			filesSkipped++;
			continue;
		}

		testFilesProcessed++;
		const fileStartTime = Date.now();

		testLogger.debug("Running tests", {
			cid,
			file: filePath,
		});

		// Run tests for this file
		const result = await runTestFile(filePath);

		testLogger.debug("Tests completed", {
			cid,
			file: filePath,
			passed: result.passed,
			failed: result.failed,
			timedOut: result.timedOut,
			durationMs: Date.now() - fileStartTime,
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
					file: filePath,
					status: result.timedOut ? "timeout" : "failed",
					passed: result.passed,
					failed: result.failed,
					failures: result.failures.map((f) => ({
						file: f.file,
						line: f.line,
						message: f.message.split("\n")[0], // First line only for token efficiency
					})),
					hint: result.timedOut
						? "Tests timed out - check for hanging async operations"
						: "Fix the failing test assertions",
				}),
			);
		} else {
			console.error(`✓ ${result.passed} test(s) passed: ${filePath}`);
		}
	}

	testLogger.info("Hook completed", {
		cid,
		exitCode: 0,
		testFilesProcessed,
		filesSkipped,
		durationMs: Date.now() - startTime,
	});

	// Always exit 0 (non-blocking, informational only)
	process.exit(0);
}

main();
