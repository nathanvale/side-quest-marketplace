#!/usr/bin/env bun

/// <reference types="bun-types" />

/**
 * Bun Test Runner MCP Server
 *
 * Provides tools to run Bun tests with structured, token-efficient output.
 * Filters out passing tests and verbose logs, focusing agents on failures.
 *
 * Uses native Bun.spawn() for better performance over Node.js child_process.
 */

import {
	createCorrelationId,
	createPluginLogger,
} from "@sidequest/core/logging";
import { startServer, tool, z } from "@sidequest/core/mcp";
import {
	createLoggerAdapter,
	ResponseFormat,
	wrapToolHandler,
} from "@sidequest/core/mcp-response";
import { spawnWithTimeout } from "@sidequest/core/spawn";
import {
	validatePath,
	validateShellSafePattern,
} from "@sidequest/core/validation";
import {
	parseBunTestOutput,
	type TestFailure,
	type TestSummary,
} from "./parse-utils";

// Initialize logger
const { initLogger, getSubsystemLogger } = createPluginLogger({
	name: "bun-runner",
	subsystems: ["mcp"],
});

// Initialize logger on server startup
initLogger().catch(console.error);

const mcpLogger = getSubsystemLogger("mcp");

// --- Types ---

// --- Parsing Functions (exported for testing) ---

/**
 * Parse bun test output to extract test results
 */
function parseBunTestOutputImpl(output: string): TestSummary {
	const failures: TestFailure[] = [];
	const lines = output.split("\n");
	let currentFailure: TestFailure | null = null;
	let currentTestName: string | undefined;

	for (const line of lines) {
		if (!line) continue;

		// Bun v1.3+ format: "(fail) test name [0.21ms]" marks end of failure block
		// Extract test name and finalize the failure
		const failMatch = line.match(/\(fail\)\s+(.+?)\s+\[/);
		if (failMatch) {
			if (currentFailure) {
				// Use the test name from (fail) line as the primary identifier
				currentTestName = failMatch[1];
				currentFailure.message = `${currentTestName}: ${currentFailure.message}`;
				failures.push(currentFailure);
				currentFailure = null;
			}
			continue;
		}

		// Legacy format: "✗ test name" or "FAIL file" marks start of failure
		if (line.includes("✗") || line.startsWith("FAIL ")) {
			if (currentFailure) failures.push(currentFailure);
			currentFailure = {
				file: "unknown",
				message: line.trim(),
			};
			continue;
		}

		// "error:" line starts a new failure block in Bun v1.3+ format
		// But if we already have a failure from FAIL/✗, append to it instead
		if (line.trim().startsWith("error:")) {
			if (currentFailure) {
				// Append error to existing failure (legacy FAIL format)
				currentFailure.message += `\n${line.trim()}`;
			} else {
				// Start new failure block (Bun v1.3+ format)
				currentFailure = {
					file: "unknown",
					message: line.trim(),
				};
			}
			continue;
		}

		// Capture content for current failure
		if (currentFailure) {
			// Stack trace line - extract file/line info
			if (line.trim().startsWith("at ")) {
				const match =
					line.match(/\((.+):(\d+):(\d+)\)/) ||
					line.match(/at (.+):(\d+):(\d+)/);
				if (match?.[1] && match[2]) {
					currentFailure.file = match[1];
					currentFailure.line = Number.parseInt(match[2], 10);
				}
				currentFailure.stack = `${currentFailure.stack || ""}${line}\n`;
			} else if (line.trim() && !line.match(/^\d+ \| /)) {
				// Append to message (skip source code lines like "3 | test(...)")
				currentFailure.message += `\n${line.trim()}`;
			}
		}
	}
	if (currentFailure) failures.push(currentFailure);

	// Parse summary numbers
	const passMatch = output.match(/(\d+) pass/);
	const failMatchNum = output.match(/(\d+) fail/);

	const passed = passMatch?.[1] ? Number.parseInt(passMatch[1], 10) : 0;
	const failed = failMatchNum?.[1]
		? Number.parseInt(failMatchNum[1], 10)
		: failures.length;

	return {
		passed,
		failed,
		total: passed + failed,
		failures,
	};
}

// --- Helpers ---

/**
 * Run Bun tests and parse output using spawnWithTimeout from core
 *
 * Uses `bun test` directly - Bun natively handles workspace test discovery,
 * searching all packages for matching test files. The previous `--filter '*'`
 * approach broke pattern matching because patterns were interpreted as test
 * name filters within each package rather than cross-workspace file matching.
 */
async function runBunTests(pattern?: string): Promise<TestSummary> {
	// Simple: bun test handles workspaces natively
	const cmd = pattern ? ["bun", "test", pattern] : ["bun", "test"];
	const TIMEOUT_MS = 30000;

	const { stdout, stderr, exitCode, timedOut } = await spawnWithTimeout(
		cmd,
		TIMEOUT_MS,
		{ env: { CI: "true" } },
	);

	// Check for timeout
	if (timedOut) {
		return {
			passed: 0,
			failed: 1,
			total: 1,
			failures: [
				{
					file: "timeout",
					message:
						"Tests timed out after 30 seconds. Possible causes: open handles, infinite loops, or watch mode accidentally enabled.",
				},
			],
		};
	}

	// Combine stdout and stderr - bun test outputs results to stderr
	const output = `${stdout}\n${stderr}`;

	// If exit code is 0, all tests passed
	if (exitCode === 0) {
		const passMatch = output.match(/(\d+) pass/);
		const passed = passMatch?.[1] ? Number.parseInt(passMatch[1], 10) : 0;

		return {
			passed,
			failed: 0,
			total: passed,
			failures: [],
		};
	}

	// Parse failures from combined output
	return parseBunTestOutputImpl(output);
}

/**
 * Run Bun tests with coverage and parse output using spawnWithTimeout from core
 *
 * Uses `bun test --coverage` directly - Bun handles workspace discovery natively.
 */
async function runBunTestCoverage(): Promise<{
	summary: TestSummary;
	coverage: { percent: number; uncovered: string[] };
}> {
	const TIMEOUT_MS = 60000;
	const cmd = ["bun", "test", "--coverage"];

	const { stdout, stderr, exitCode, timedOut } = await spawnWithTimeout(
		cmd,
		TIMEOUT_MS,
		{ env: { CI: "true" } },
	);

	const output = `${stdout}\n${stderr}`;

	// Check for timeout
	if (timedOut) {
		return {
			summary: {
				passed: 0,
				failed: 1,
				total: 1,
				failures: [
					{
						file: "timeout",
						message: "Tests timed out after 60 seconds.",
					},
				],
			},
			coverage: { percent: 0, uncovered: [] },
		};
	}

	// Parse test results
	const summary =
		exitCode === 0
			? parseBunTestOutputImpl(stdout)
			: parseBunTestOutputImpl(output);

	// Parse coverage from output (e.g., "Coverage: 85.5%")
	const coverageMatch = output.match(/(\d+(?:\.\d+)?)\s*%/);
	const percent = coverageMatch?.[1] ? Number.parseFloat(coverageMatch[1]) : 0;

	// Find uncovered files (lines with 0% or low coverage)
	const uncovered: string[] = [];
	const lines = output.split("\n");
	for (const line of lines) {
		// Match lines like "src/file.ts | 0.00% | ..."
		const match = line.match(/^([^\s|]+)\s*\|\s*(\d+(?:\.\d+)?)\s*%/);
		if (match?.[1] && match[2]) {
			const file = match[1].trim();
			const fileCoverage = Number.parseFloat(match[2]);
			if (fileCoverage < 50 && file.endsWith(".ts")) {
				uncovered.push(`${file} (${fileCoverage}%)`);
			}
		}
	}

	return {
		summary,
		coverage: { percent, uncovered },
	};
}

// --- Formatters ---

/**
 * Format test summary for display
 */
function formatTestSummary(
	summary: TestSummary,
	format: ResponseFormat = ResponseFormat.MARKDOWN,
	context?: string,
): string {
	if (format === ResponseFormat.JSON) {
		return JSON.stringify({ ...summary, context }, null, 2);
	}

	if (summary.failed === 0) {
		const ctx = context ? ` in ${context}` : "";
		return `All ${summary.passed} tests passed${ctx}.`;
	}

	let output = `${summary.failed} tests failed${context ? ` in ${context}` : ""} (${summary.passed} passed)\n\n`;

	summary.failures.forEach((f, i) => {
		output += `${i + 1}. ${f.file}:${f.line || "?"}\n`;
		output += `   ${f.message.split("\n")[0]}\n`;
		if (f.stack) {
			output += `${f.stack
				.split("\n")
				.map((l) => `      ${l}`)
				.join("\n")}\n`;
		}
		output += "\n";
	});

	return output.trim();
}

/**
 * Format coverage result for display
 */
function formatCoverageResult(
	summary: TestSummary,
	coverage: { percent: number; uncovered: string[] },
	format: ResponseFormat = ResponseFormat.MARKDOWN,
): string {
	if (format === ResponseFormat.JSON) {
		return JSON.stringify({ summary, coverage }, null, 2);
	}

	let output = "";

	if (summary.failed === 0) {
		output += `All ${summary.passed} tests passed.\n\n`;
	} else {
		output += `${summary.failed} tests failed (${summary.passed} passed)\n\n`;
	}

	output += `Coverage: ${coverage.percent}%\n`;

	if (coverage.uncovered.length > 0) {
		output += "\nFiles with low coverage (<50%):\n";
		coverage.uncovered.forEach((f) => {
			output += `   - ${f}\n`;
		});
	}

	return output.trim();
}

// --- Tools ---

tool(
	"bun_runTests",
	{
		description:
			"Run tests using Bun and return a concise summary of failures. Use this instead of 'bun test' to save tokens and get structured error reports.",
		inputSchema: {
			pattern: z
				.string()
				.optional()
				.describe(
					"File pattern or test name to filter tests (e.g., 'auth' or 'login.test.ts')",
				),
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.default("json")
				.describe("Output format: 'markdown' or 'json' (default)"),
		},
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
	},
	wrapToolHandler(
		async (args: Record<string, unknown>, format: ResponseFormat) => {
			const { pattern } = args as { pattern?: string };

			// Validate pattern for security
			if (pattern) {
				validateShellSafePattern(pattern);
				// If pattern looks like a path, validate it stays in repo
				if (pattern.includes("/") || pattern.includes("..")) {
					await validatePath(pattern);
				}
			}

			const summary = await runBunTests(pattern);

			// Format the response
			const text = formatTestSummary(summary, format);

			// If tests failed, mark as error by throwing
			if (summary.failed > 0) {
				const error = new Error(text);
				// Attach summary for structured logging
				(error as Error & { summary?: TestSummary }).summary = summary;
				throw error;
			}

			return text;
		},
		{
			toolName: "bun_runTests",
			logger: createLoggerAdapter(mcpLogger),
			createCid: createCorrelationId,
		},
	),
);

tool(
	"bun_testFile",
	{
		description:
			"Run tests for a specific file only. More targeted than bun_runTests with a pattern.",
		inputSchema: {
			file: z
				.string()
				.describe("Path to the test file to run (e.g., 'src/utils.test.ts')"),
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.default("json")
				.describe("Output format: 'markdown' or 'json' (default)"),
		},
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
	},
	wrapToolHandler(
		async (args: Record<string, unknown>, format: ResponseFormat) => {
			const { file } = args as { file: string };

			// Validate file path for security and get absolute path
			const validatedFile = await validatePath(file);

			const summary = await runBunTests(validatedFile);

			// Format the response with file context
			const text = formatTestSummary(summary, format, file);

			// If tests failed, mark as error by throwing
			if (summary.failed > 0) {
				const error = new Error(text);
				// Attach summary for structured logging
				(error as Error & { summary?: TestSummary }).summary = summary;
				throw error;
			}

			return text;
		},
		{
			toolName: "bun_testFile",
			logger: createLoggerAdapter(mcpLogger),
			createCid: createCorrelationId,
		},
	),
);

tool(
	"bun_testCoverage",
	{
		description:
			"Run tests with code coverage and return a summary. Shows overall coverage percentage and files with low coverage.",
		inputSchema: {
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.default("json")
				.describe("Output format: 'markdown' or 'json' (default)"),
		},
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
	},
	wrapToolHandler(
		async (_args: Record<string, unknown>, format: ResponseFormat) => {
			const { summary, coverage } = await runBunTestCoverage();

			// Format the response
			const text = formatCoverageResult(summary, coverage, format);

			// If tests failed, mark as error by throwing
			if (summary.failed > 0) {
				const error = new Error(text);
				// Attach summary and coverage for structured logging
				(
					error as Error & { summary?: TestSummary; coverage?: typeof coverage }
				).summary = summary;
				(
					error as Error & { summary?: TestSummary; coverage?: typeof coverage }
				).coverage = coverage;
				throw error;
			}

			return text;
		},
		{
			toolName: "bun_testCoverage",
			logger: createLoggerAdapter(mcpLogger),
			createCid: createCorrelationId,
		},
	),
);

/**
 * Re-export types and parsing function from parse-utils for hook reuse.
 * These are used by bun-test.ts and bun-test-ci.ts hooks.
 */
export type { TestFailure, TestSummary };
export { parseBunTestOutput };

// Only start the server when run directly, not when imported by tests
if (import.meta.main) {
	startServer("bun-runner", {
		version: "1.0.0",
		fileLogging: {
			enabled: true,
			subsystems: ["mcp"],
			level: "info",
		},
	});
}
