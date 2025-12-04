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

import { isFileInRepo } from "@sidequest/core/git";
import { extractFilePaths, parseHookInput } from "@sidequest/core/hooks";
import { TEST_FILE_EXTENSIONS } from "./shared/constants.js";
import {
	createCorrelationId,
	initLogger,
	testLogger,
} from "./shared/logger.js";
import { formatTestOutput, runTestFile } from "./shared/test-runner.js";

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

		// Always output results (informational)
		const output = formatTestOutput(result, filePath);
		console.error(`\nTest results for ${filePath}:\n${output}\n`);
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
