/**
 * Shared test runner logic for bun-runner hooks.
 *
 * Reuses the MCP server's test execution functions with hook-specific
 * adaptations for timeout handling and output formatting.
 */

import { spawnWithTimeout } from "@sidequest/core/spawn";
import {
	isWorkspaceProject,
	parseBunTestOutput,
	type TestSummary,
} from "../../mcp-servers/bun-runner/index.js";
import { TEST_CI_TIMEOUT_MS, TEST_FILE_TIMEOUT_MS } from "./constants.js";

/**
 * Extended test summary with timeout flag for hook-specific handling.
 */
export interface TestResult extends TestSummary {
	timedOut: boolean;
}

/**
 * Run tests for a specific file with timeout protection.
 *
 * Why: PostToolUse hooks need fast feedback on single files.
 * Uses shorter timeout and runs only the edited test file.
 *
 * @param filePath - Path to the test file
 * @returns Test summary with timeout flag
 */
export async function runTestFile(filePath: string): Promise<TestResult> {
	const isWorkspace = await isWorkspaceProject();

	// Build command based on workspace detection
	const cmd = isWorkspace
		? ["bun", "--filter", "*", "test", filePath]
		: ["bun", "test", filePath];

	const { stdout, stderr, exitCode, timedOut } = await spawnWithTimeout(
		cmd,
		TEST_FILE_TIMEOUT_MS,
		{ env: { CI: "true" } },
	);

	if (timedOut) {
		return {
			passed: 0,
			failed: 1,
			total: 1,
			failures: [
				{
					file: filePath,
					message: `Tests timed out after ${TEST_FILE_TIMEOUT_MS / 1000}s. Check for hanging tests or infinite loops.`,
				},
			],
			timedOut: true,
		};
	}

	const output = `${stdout}\n${stderr}`;

	if (exitCode === 0) {
		// All tests passed
		const passMatch = output.match(/(\d+) pass/);
		const passed = passMatch?.[1] ? Number.parseInt(passMatch[1], 10) : 0;

		return {
			passed,
			failed: 0,
			total: passed,
			failures: [],
			timedOut: false,
		};
	}

	// Parse failures
	const summary = parseBunTestOutput(output);
	return { ...summary, timedOut: false };
}

/**
 * Run tests for multiple changed files with timeout protection.
 *
 * Why: Stop hooks validate all changed tests before turn ends.
 * Uses longer timeout and runs all changed test files.
 *
 * @param filePaths - Array of test file paths
 * @returns Test summary with timeout flag
 */
export async function runChangedTests(
	filePaths: string[],
): Promise<TestResult> {
	const isWorkspace = await isWorkspaceProject();

	// Build command to run all test files
	// Bun test accepts multiple file arguments
	const cmd = isWorkspace
		? ["bun", "--filter", "*", "test", ...filePaths]
		: ["bun", "test", ...filePaths];

	const { stdout, stderr, exitCode, timedOut } = await spawnWithTimeout(
		cmd,
		TEST_CI_TIMEOUT_MS,
		{ env: { CI: "true" } },
	);

	if (timedOut) {
		return {
			passed: 0,
			failed: filePaths.length,
			total: filePaths.length,
			failures: [
				{
					file: "multiple files",
					message: `Tests timed out after ${TEST_CI_TIMEOUT_MS / 1000}s. ${filePaths.length} test files were running.`,
				},
			],
			timedOut: true,
		};
	}

	const output = `${stdout}\n${stderr}`;

	if (exitCode === 0) {
		// All tests passed
		const passMatch = output.match(/(\d+) pass/);
		const passed = passMatch?.[1] ? Number.parseInt(passMatch[1], 10) : 0;

		return {
			passed,
			failed: 0,
			total: passed,
			failures: [],
			timedOut: false,
		};
	}

	// Parse failures
	const summary = parseBunTestOutput(output);
	return { ...summary, timedOut: false };
}

/**
 * Format test summary for Claude-friendly hook output.
 * Token-efficient: shows summary + first 5 failures only.
 *
 * @param summary - Test summary with results
 * @param context - Context string (file name or "X files")
 * @returns Formatted string for stderr output
 */
export function formatTestOutput(summary: TestResult, context: string): string {
	if (summary.timedOut) {
		return summary.failures[0]?.message || "Tests timed out";
	}

	if (summary.failed === 0) {
		return `✓ All ${summary.passed} tests passed in ${context}`;
	}

	const lines: string[] = [];
	lines.push(
		`✗ ${summary.failed} test(s) failed in ${context} (${summary.passed} passed)`,
	);
	lines.push("");

	// Limit to first 5 failures for token efficiency
	for (const failure of summary.failures.slice(0, 5)) {
		const location = failure.line
			? `${failure.file}:${failure.line}`
			: failure.file;
		lines.push(`  ${location}`);
		// Only first line of error message
		lines.push(`  ${failure.message.split("\n")[0]}`);
	}

	if (summary.failures.length > 5) {
		lines.push("");
		lines.push(`  ... and ${summary.failures.length - 5} more failures`);
	}

	return lines.join("\n");
}
