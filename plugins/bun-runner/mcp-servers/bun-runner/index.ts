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

import { spawn } from "bun";
import { startServer, tool, z } from "mcpez";
import { validatePath, validatePattern } from "./path-validator";

// --- Types ---

/**
 * Response format options for tool output
 */
enum ResponseFormat {
	MARKDOWN = "markdown",
	JSON = "json",
}

export interface TestFailure {
	file: string;
	message: string;
	line?: number;
	stack?: string;
}

export interface TestSummary {
	passed: number;
	failed: number;
	total: number;
	failures: TestFailure[];
}

// --- Parsing Functions (exported for testing) ---

/**
 * Parse bun test output to extract test results
 */
export function parseBunTestOutput(output: string): TestSummary {
	const failures: TestFailure[] = [];
	const lines = output.split("\n");
	let currentFailure: TestFailure | null = null;

	for (const line of lines) {
		if (!line) continue;

		// Start of a failure
		if (line.includes("✗") || line.includes("FAIL")) {
			if (currentFailure) failures.push(currentFailure);
			currentFailure = {
				file: "unknown",
				message: line.trim(),
			};
		} else if (currentFailure) {
			// Capture stack trace or error message
			if (line.trim().startsWith("at ")) {
				// Try to extract file/line: at /path/to/file.ts:10:5
				const match = line.match(/at (.+):(\d+):(\d+)/);
				if (match?.[1] && match[2]) {
					currentFailure.file = match[1];
					currentFailure.line = Number.parseInt(match[2], 10);
				}
				currentFailure.stack = `${currentFailure.stack || ""}${line}\n`;
			} else if (line.trim()) {
				// Likely error message continuation
				currentFailure.message += `\n${line.trim()}`;
			}
		}
	}
	if (currentFailure) failures.push(currentFailure);

	// Parse summary numbers
	const passMatch = output.match(/(\d+) pass/);
	const failMatch = output.match(/(\d+) fail/);

	const passed = passMatch?.[1] ? Number.parseInt(passMatch[1], 10) : 0;
	const failed = failMatch?.[1]
		? Number.parseInt(failMatch[1], 10)
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
 * Detect if the current directory is a Bun/npm workspace root.
 *
 * In workspaces, we need to use `bun --filter '*' test` instead of `bun test`
 * because each package may have its own bunfig.toml with test preloads/setup.
 * Running `bun test` from root ignores package-level configs, causing failures
 * when tests depend on setup files (e.g., happy-dom globals).
 */
export async function isWorkspaceProject(): Promise<boolean> {
	try {
		const pkg = await Bun.file("package.json").json();
		return Array.isArray(pkg.workspaces) && pkg.workspaces.length > 0;
	} catch {
		return false;
	}
}

/**
 * Run Bun tests and parse output using native Bun.spawn()
 * Uses AbortController for timeout instead of spawn's buggy timeout option
 *
 * Workspace-aware: Uses `bun --filter '*' test` for workspace projects
 * to ensure each package's bunfig.toml (with test preloads) is respected.
 */
async function runBunTests(pattern?: string): Promise<TestSummary> {
	const isWorkspace = await isWorkspaceProject();

	// Build command based on workspace detection
	let cmd: string[];
	if (isWorkspace) {
		// Workspace: run test script in each package
		// Pattern filtering works differently - passed to each package's test run
		cmd = pattern
			? ["bun", "--filter", "*", "test", pattern]
			: ["bun", "--filter", "*", "test"];
	} else {
		// Non-workspace: direct bun test
		cmd = pattern ? ["bun", "test", pattern] : ["bun", "test"];
	}
	const TIMEOUT_MS = 30000;

	// Use AbortController for timeout - Bun's timeout option is buggy
	// (sets killed=true and truncates stdout even when process completes normally)
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

	const proc = spawn({
		cmd,
		env: { ...process.env, CI: "true" },
		stdout: "pipe",
		stderr: "pipe",
		signal: controller.signal,
	});

	// IMPORTANT: Consume streams in parallel with waiting for exit.
	// Reading after proc.exited resolves can miss output (race condition).
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	clearTimeout(timeoutId);

	// Check for timeout via AbortController
	if (controller.signal.aborted) {
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
	return parseBunTestOutput(output);
}

/**
 * Run Bun tests with coverage and parse output
 * Uses AbortController for timeout instead of spawn's buggy timeout option
 *
 * Workspace-aware: Uses `bun --filter '*' test --coverage` for workspace projects.
 * Note: Coverage aggregation across workspaces may vary by Bun version.
 */
async function runBunTestCoverage(): Promise<{
	summary: TestSummary;
	coverage: { percent: number; uncovered: string[] };
}> {
	const isWorkspace = await isWorkspaceProject();
	const TIMEOUT_MS = 60000;

	// Build command based on workspace detection
	const cmd = isWorkspace
		? ["bun", "--filter", "*", "test", "--coverage"]
		: ["bun", "test", "--coverage"];

	// Use AbortController for timeout - Bun's timeout option is buggy
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

	const proc = spawn({
		cmd,
		env: { ...process.env, CI: "true" },
		stdout: "pipe",
		stderr: "pipe",
		signal: controller.signal,
	});

	// IMPORTANT: Consume streams in parallel with waiting for exit.
	// Reading after proc.exited resolves can miss output (race condition).
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	clearTimeout(timeoutId);

	const output = `${stdout}\n${stderr}`;

	// Check for timeout via AbortController
	if (controller.signal.aborted) {
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
		exitCode === 0 ? parseBunTestOutput(stdout) : parseBunTestOutput(output);

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

/**
 * Create an error response for MCP tools.
 *
 * Why: MCP tools should return structured error responses with isError flag
 * so Claude knows the operation failed and can take corrective action.
 */
function errorResponse(message: string) {
	return {
		content: [
			{
				type: "text" as const,
				text: JSON.stringify({ error: message, isError: true }),
			},
		],
		isError: true,
	};
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
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
	},
	async (args: { pattern?: string; response_format?: string }) => {
		// Validate pattern for security
		if (args.pattern) {
			try {
				validatePattern(args.pattern);
				// If pattern looks like a path, validate it stays in repo
				if (args.pattern.includes("/") || args.pattern.includes("..")) {
					await validatePath(args.pattern);
				}
			} catch (error) {
				return errorResponse(
					error instanceof Error ? error.message : "Invalid pattern",
				);
			}
		}

		const format =
			args.response_format === "json"
				? ResponseFormat.JSON
				: ResponseFormat.MARKDOWN;
		const summary = await runBunTests(args.pattern);
		return {
			content: [
				{ type: "text" as const, text: formatTestSummary(summary, format) },
			],
		};
	},
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
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
	},
	async (args: Record<string, unknown>) => {
		const { file, response_format } = args as {
			file: string;
			response_format?: string;
		};

		// Validate file path for security
		try {
			await validatePath(file);
		} catch (error) {
			return errorResponse(
				error instanceof Error ? error.message : "Invalid file path",
			);
		}

		const format =
			response_format === "json"
				? ResponseFormat.JSON
				: ResponseFormat.MARKDOWN;
		const summary = await runBunTests(file);
		return {
			content: [
				{
					type: "text" as const,
					text: formatTestSummary(summary, format, file),
				},
			],
		};
	},
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
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
	},
	async (args: { response_format?: string }) => {
		const format =
			args.response_format === "json"
				? ResponseFormat.JSON
				: ResponseFormat.MARKDOWN;
		const { summary, coverage } = await runBunTestCoverage();
		return {
			content: [
				{
					type: "text" as const,
					text: formatCoverageResult(summary, coverage, format),
				},
			],
		};
	},
);

/**
 * Functions and types already exported above for hook reuse:
 * - parseBunTestOutput (line 47)
 * - isWorkspaceProject (line 107)
 * - TestFailure, TestSummary (lines 28-40)
 *
 * These are used by bun-test.ts and bun-test-ci.ts hooks.
 */

startServer("bun-runner", { version: "1.0.0" });
