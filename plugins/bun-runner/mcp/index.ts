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
import { spawn } from "bun";
import {
	parseBunTestOutput,
	type TestFailure,
	type TestSummary,
} from "./parse-utils";
import { validatePath, validatePattern } from "./path-validator";

// Initialize logger
const { initLogger, getSubsystemLogger } = createPluginLogger({
	name: "bun-runner",
	subsystems: ["mcp"],
});

// Initialize logger on server startup
initLogger().catch(console.error);

const mcpLogger = getSubsystemLogger("mcp");

// --- Types ---

/**
 * Response format options for tool output
 */
enum ResponseFormat {
	MARKDOWN = "markdown",
	JSON = "json",
}

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
 * Run Bun tests and parse output using native Bun.spawn()
 * Uses AbortController for timeout instead of spawn's buggy timeout option
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
	return parseBunTestOutputImpl(output);
}

/**
 * Run Bun tests with coverage and parse output
 * Uses AbortController for timeout instead of spawn's buggy timeout option
 *
 * Uses `bun test --coverage` directly - Bun handles workspace discovery natively.
 */
async function runBunTestCoverage(): Promise<{
	summary: TestSummary;
	coverage: { percent: number; uncovered: string[] };
}> {
	const TIMEOUT_MS = 60000;
	const cmd = ["bun", "test", "--coverage"];

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

/**
 * Create an error response for MCP tools.
 *
 * Why: MCP tools should return structured error responses with isError flag
 * so Claude knows the operation failed and can take corrective action.
 */
function errorResponse(
	message: string,
	format: ResponseFormat = ResponseFormat.JSON,
) {
	return {
		content: [
			{
				type: "text" as const,
				text:
					format === ResponseFormat.JSON
						? JSON.stringify({ error: message, isError: true })
						: `**Error:** ${message}`,
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
	async (args: { pattern?: string; response_format?: string }) => {
		const cid = createCorrelationId();
		const startTime = Date.now();

		mcpLogger.info("Tool request", {
			cid,
			tool: "bun_runTests",
			pattern: args.pattern,
		});

		// Validate pattern for security
		if (args.pattern) {
			try {
				validatePattern(args.pattern);
				// If pattern looks like a path, validate it stays in repo
				if (args.pattern.includes("/") || args.pattern.includes("..")) {
					await validatePath(args.pattern);
				}
			} catch (error) {
				mcpLogger.error("Tool failed", {
					cid,
					tool: "bun_runTests",
					error: error instanceof Error ? error.message : "Invalid pattern",
					durationMs: Date.now() - startTime,
				});
				return errorResponse(
					error instanceof Error ? error.message : "Invalid pattern",
					ResponseFormat.JSON,
				);
			}
		}

		const format =
			args.response_format === "json"
				? ResponseFormat.JSON
				: ResponseFormat.MARKDOWN;

		try {
			const summary = await runBunTests(args.pattern);

			mcpLogger.info("Tool response", {
				cid,
				tool: "bun_runTests",
				success: true,
				passed: summary.passed,
				failed: summary.failed,
				durationMs: Date.now() - startTime,
			});

			return {
				...(summary.failed > 0 ? { isError: true } : {}),
				content: [
					{ type: "text" as const, text: formatTestSummary(summary, format) },
				],
			};
		} catch (error) {
			mcpLogger.error("Tool failed", {
				cid,
				tool: "bun_runTests",
				error: error instanceof Error ? error.message : "Unknown error",
				durationMs: Date.now() - startTime,
			});
			return errorResponse(
				error instanceof Error ? error.message : "Unknown error",
				format,
			);
		}
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
	async (args: Record<string, unknown>) => {
		const cid = createCorrelationId();
		const startTime = Date.now();
		const { file, response_format } = args as {
			file: string;
			response_format?: string;
		};

		mcpLogger.info("Tool request", { cid, tool: "bun_testFile", file });

		// Validate file path for security and get absolute path
		let validatedFile: string;
		try {
			validatedFile = await validatePath(file);
		} catch (error) {
			mcpLogger.error("Tool failed", {
				cid,
				tool: "bun_testFile",
				error: error instanceof Error ? error.message : "Invalid file path",
				durationMs: Date.now() - startTime,
			});
			return errorResponse(
				error instanceof Error ? error.message : "Invalid file path",
				ResponseFormat.JSON,
			);
		}

		const format =
			response_format === "json"
				? ResponseFormat.JSON
				: ResponseFormat.MARKDOWN;

		try {
			const summary = await runBunTests(validatedFile);

			mcpLogger.info("Tool response", {
				cid,
				tool: "bun_testFile",
				success: true,
				passed: summary.passed,
				failed: summary.failed,
				durationMs: Date.now() - startTime,
			});

			return {
				...(summary.failed > 0 ? { isError: true } : {}),
				content: [
					{
						type: "text" as const,
						text: formatTestSummary(summary, format, file),
					},
				],
			};
		} catch (error) {
			mcpLogger.error("Tool failed", {
				cid,
				tool: "bun_testFile",
				error: error instanceof Error ? error.message : "Unknown error",
				durationMs: Date.now() - startTime,
			});
			return errorResponse(
				error instanceof Error ? error.message : "Unknown error",
				format,
			);
		}
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
	async (args: { response_format?: string }) => {
		const cid = createCorrelationId();
		const startTime = Date.now();

		mcpLogger.info("Tool request", { cid, tool: "bun_testCoverage" });

		const format =
			args.response_format === "json"
				? ResponseFormat.JSON
				: ResponseFormat.MARKDOWN;

		try {
			const { summary, coverage } = await runBunTestCoverage();

			mcpLogger.info("Tool response", {
				cid,
				tool: "bun_testCoverage",
				success: true,
				passed: summary.passed,
				failed: summary.failed,
				coverage: coverage.percent,
				durationMs: Date.now() - startTime,
			});

			return {
				...(summary.failed > 0 ? { isError: true } : {}),
				content: [
					{
						type: "text" as const,
						text: formatCoverageResult(summary, coverage, format),
					},
				],
			};
		} catch (error) {
			mcpLogger.error("Tool failed", {
				cid,
				tool: "bun_testCoverage",
				error: error instanceof Error ? error.message : "Unknown error",
				durationMs: Date.now() - startTime,
			});
			return errorResponse(
				error instanceof Error ? error.message : "Unknown error",
				format,
			);
		}
	},
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
