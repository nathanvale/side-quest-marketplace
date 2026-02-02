#!/usr/bin/env bun

/// <reference types="bun-types" />

/**
 * Biome Linter & Formatter MCP Server
 *
 * Provides tools to run Biome linting and formatting with structured, token-efficient output.
 * Filters out verbose logs, focusing agents on actionable diagnostics.
 *
 * Uses native Bun.spawn() for better performance over Node.js child_process.
 */

import { startServer, tool, z } from "@side-quest/core/mcp";
import {
	createLoggerAdapter,
	type Logger,
	ResponseFormat,
	wrapToolHandler,
} from "@side-quest/core/mcp-response";
import { spawnAndCollect } from "@side-quest/core/spawn";
import { validatePathOrDefault } from "@side-quest/core/validation";
import { createCorrelationId, mcpLogger } from "../hooks/shared/logger";

// --- Types ---

export interface LintDiagnostic {
	file: string;
	message: string;
	code: string;
	line: number;
	severity: "error" | "warning" | "info";
	suggestion?: string;
}

export interface LintSummary {
	error_count: number;
	warning_count: number;
	diagnostics: LintDiagnostic[];
}

// --- Parsing Functions (exported for testing) ---

/**
 * Parse Biome JSON output to extract lint diagnostics
 */
export function parseBiomeOutput(stdout: string): LintSummary {
	try {
		const report = JSON.parse(stdout);
		const diagnostics: LintDiagnostic[] = [];

		if (report.diagnostics) {
			for (const d of report.diagnostics) {
				if (d.severity === "error" || d.severity === "warning") {
					diagnostics.push({
						file: d.location?.path?.file || "unknown",
						line: d.location?.span?.start?.line || 0,
						message: d.description || d.message,
						code: d.category || "unknown",
						severity: d.severity,
						suggestion: d.advice ? JSON.stringify(d.advice) : undefined,
					});
				}
			}
		}

		const summary = report.summary || {};

		return {
			error_count:
				summary.errors ??
				diagnostics.filter((d) => d.severity === "error").length,
			warning_count:
				summary.warnings ??
				diagnostics.filter((d) => d.severity === "warning").length,
			diagnostics,
		};
	} catch (_e) {
		return {
			error_count: 1,
			warning_count: 0,
			diagnostics: [
				{
					file: "unknown",
					line: 0,
					message: `Failed to parse Biome JSON output: ${stdout.substring(0, 200)}`,
					code: "internal_error",
					severity: "error",
				},
			],
		};
	}
}

// --- Helpers ---

/**
 * Run Biome check and parse JSON output.
 *
 * Why: Uses spawnAndCollect to ensure streams are consumed in parallel with
 * waiting for exit, avoiding race conditions that could lose output.
 *
 * Note: Always parse JSON output regardless of exit code because Biome exits
 * with 0 for warnings (only errors cause non-zero exit). This ensures we
 * report warnings to the user.
 */
async function runBiomeCheck(path = "."): Promise<LintSummary> {
	const { stdout } = await spawnAndCollect([
		"bunx",
		"@biomejs/biome",
		"check",
		"--reporter=json",
		path,
	]);

	// Always parse output - Biome exits 0 for warnings, only errors cause non-zero
	return parseBiomeOutput(stdout);
}

/**
 * Run Biome format --write and check --write to fix all issues.
 *
 * Why: Biome has two separate concerns:
 * 1. Formatting (whitespace, indentation) - handled by `biome format`
 * 2. Linting (code quality rules) - handled by `biome check`
 *
 * We need to run BOTH to fix all auto-fixable issues.
 *
 * Uses spawnAndCollect to ensure streams are consumed in parallel with
 * waiting for exit, avoiding race conditions that could lose output.
 */
async function runBiomeFix(
	path = ".",
): Promise<{ formatFixed: number; lintFixed: number; remaining: LintSummary }> {
	// Step 1: Fix formatting issues
	const { stdout: formatStdout, exitCode: formatExitCode } =
		await spawnAndCollect([
			"bunx",
			"@biomejs/biome",
			"format",
			"--write",
			"--reporter=json",
			path,
		]);

	let formatFixed = 0;
	try {
		const report = JSON.parse(formatStdout);
		// Biome format reports number of changed files in summary.changed
		formatFixed = report.summary?.changed || 0;
	} catch (error) {
		mcpLogger.warn({
			message: "Failed to parse Biome format output",
			error: error instanceof Error ? error.message : "Unknown",
			stdout: formatStdout.substring(0, 200),
			exitCode: formatExitCode,
		});
	}

	// Step 2: Fix linting issues
	const { stdout: checkStdout, exitCode: checkExitCode } =
		await spawnAndCollect([
			"bunx",
			"@biomejs/biome",
			"check",
			"--write",
			"--reporter=json",
			path,
		]);

	let lintFixed = 0;
	try {
		const report = JSON.parse(checkStdout);
		// Biome check reports number of changed files in summary.changed
		lintFixed = report.summary?.changed || 0;
	} catch (error) {
		mcpLogger.warn({
			message: "Failed to parse Biome check output",
			error: error instanceof Error ? error.message : "Unknown",
			stdout: checkStdout.substring(0, 200),
			exitCode: checkExitCode,
		});
	}

	mcpLogger.debug({
		message: "Biome fix completed",
		formatFixed,
		lintFixed,
		totalFixed: formatFixed + lintFixed,
	});

	// Step 3: Check for remaining issues
	const remaining = await runBiomeCheck(path);

	return { formatFixed, lintFixed, remaining };
}

/**
 * Run Biome format check (no write).
 *
 * Why: Uses spawnAndCollect to ensure streams are consumed in parallel with
 * waiting for exit, avoiding race conditions that could lose output.
 */
async function runBiomeFormatCheck(
	path = ".",
): Promise<{ formatted: boolean; files: string[] }> {
	const { stdout, exitCode } = await spawnAndCollect([
		"bunx",
		"@biomejs/biome",
		"format",
		"--reporter=json",
		path,
	]);

	if (exitCode === 0) {
		return { formatted: true, files: [] };
	}

	// Parse unformatted files from output
	const unformattedFiles: string[] = [];
	try {
		const report = JSON.parse(stdout);
		if (report.diagnostics) {
			for (const d of report.diagnostics) {
				const file = d.location?.path?.file;
				if (file && !unformattedFiles.includes(file)) {
					unformattedFiles.push(file);
				}
			}
		}
	} catch {
		// If parse fails, just report not formatted
	}

	return { formatted: false, files: unformattedFiles };
}

// --- Logger Adapter ---

/**
 * Logger adapter for wrapToolHandler.
 * Converts LogTape logger interface to the Logger interface expected by wrapToolHandler.
 */
const loggerAdapter: Logger = createLoggerAdapter(mcpLogger);

// --- Formatters ---

/**
 * Format lint summary for display
 */
function formatLintSummary(
	summary: LintSummary,
	format: ResponseFormat,
): string {
	if (format === ResponseFormat.JSON) {
		return JSON.stringify(summary, null, 2);
	}

	if (summary.error_count === 0 && summary.warning_count === 0) {
		return "No linting issues found.";
	}

	let output = `Found ${summary.error_count} errors and ${summary.warning_count} warnings:\n\n`;

	summary.diagnostics.forEach((d) => {
		const icon = d.severity === "error" ? "[error]" : "[warn]";
		output += `${icon} ${d.file}:${d.line} [${d.code}]\n`;
		output += `   ${d.message}\n`;
		if (d.suggestion) {
			output += "   Suggestion available\n";
		}
		output += "\n";
	});

	return output.trim();
}

/**
 * Format lint fix result for display
 */
function formatLintFixResult(
	fixed: number,
	remaining: LintSummary,
	format: ResponseFormat,
): string {
	if (format === ResponseFormat.JSON) {
		return JSON.stringify({ fixed, remaining }, null, 2);
	}

	let output = "";

	if (fixed > 0) {
		output += `Fixed ${fixed} issue(s)\n\n`;
	}

	if (remaining.error_count === 0 && remaining.warning_count === 0) {
		if (fixed === 0) {
			return "No issues to fix.";
		}
		return `${output}All issues resolved.`.trim();
	}

	output += `${remaining.error_count} error(s) and ${remaining.warning_count} warning(s) remain:\n\n`;

	remaining.diagnostics.forEach((d) => {
		const icon = d.severity === "error" ? "[error]" : "[warn]";
		output += `${icon} ${d.file}:${d.line} [${d.code}]\n`;
		output += `   ${d.message}\n\n`;
	});

	return output.trim();
}

/**
 * Format format check result for display
 */
function formatFormatCheckResult(
	formatted: boolean,
	files: string[],
	format: ResponseFormat,
): string {
	if (format === ResponseFormat.JSON) {
		return JSON.stringify({ formatted, unformatted_files: files }, null, 2);
	}

	if (formatted) {
		return "All files are properly formatted.";
	}

	let output = `${files.length} file(s) need formatting:\n\n`;
	files.forEach((f) => {
		output += `   - ${f}\n`;
	});
	output += "\nRun biome_lintFix to auto-format these files.";

	return output.trim();
}

// --- Tools ---

/**
 * MCP Tools
 *
 * Tool names registered with mcpez's tool() function are automatically prefixed
 * with `mcp__biome-runner_biome-runner__` to follow marketplace convention:
 * mcp__<plugin>_<server>__<tool>
 *
 * Examples:
 * - "biome_lintCheck" becomes "mcp__biome-runner_biome-runner__biome_lintCheck"
 * - "biome_lintFix" becomes "mcp__biome-runner_biome-runner__biome_lintFix"
 * - "biome_formatCheck" becomes "mcp__biome-runner_biome-runner__biome_formatCheck"
 */

tool(
	"biome_lintCheck",
	{
		description:
			"Run Biome linter on files and return structured errors. Use this to check for code quality issues without fixing them.",
		inputSchema: {
			path: z
				.string()
				.optional()
				.describe(
					"Path to file or directory to check (default: current directory)",
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
		async (args: { path?: string }, format: ResponseFormat) => {
			// Validate path for security
			const validatedPath = await validatePathOrDefault(args.path);

			// Run biome check
			const summary = await runBiomeCheck(validatedPath);

			// Format response
			return formatLintSummary(summary, format);
		},
		{
			toolName: "biome_lintCheck",
			logger: loggerAdapter,
			createCid: createCorrelationId,
		},
	),
);

tool(
	"biome_lintFix",
	{
		description:
			"Run Biome linter with --write to auto-fix issues. Returns count of fixed issues and any remaining unfixable errors.",
		inputSchema: {
			path: z
				.string()
				.optional()
				.describe(
					"Path to file or directory to fix (default: current directory)",
				),
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.default("json")
				.describe("Output format: 'markdown' or 'json' (default)"),
		},
		annotations: {
			readOnlyHint: false,
			destructiveHint: true,
			idempotentHint: true,
			openWorldHint: false,
		},
	},
	wrapToolHandler(
		async (args: { path?: string }, format: ResponseFormat) => {
			// Validate path for security - especially critical since this tool writes files
			const validatedPath = await validatePathOrDefault(args.path);

			// Run biome fix (format + lint)
			const { formatFixed, lintFixed, remaining } =
				await runBiomeFix(validatedPath);
			const totalFixed = formatFixed + lintFixed;

			// Format response
			return formatLintFixResult(totalFixed, remaining, format);
		},
		{
			toolName: "biome_lintFix",
			logger: loggerAdapter,
			createCid: createCorrelationId,
		},
	),
);

tool(
	"biome_formatCheck",
	{
		description:
			"Check if files are properly formatted without making changes. Returns list of unformatted files.",
		inputSchema: {
			path: z
				.string()
				.optional()
				.describe(
					"Path to file or directory to check (default: current directory)",
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
		async (args: { path?: string }, format: ResponseFormat) => {
			// Validate path for security
			const validatedPath = await validatePathOrDefault(args.path);

			// Run biome format check
			const { formatted, files } = await runBiomeFormatCheck(validatedPath);

			// Format response
			return formatFormatCheckResult(formatted, files, format);
		},
		{
			toolName: "biome_formatCheck",
			logger: loggerAdapter,
			createCid: createCorrelationId,
		},
	),
);

startServer("biome-runner", {
	version: "1.0.0",
	fileLogging: {
		enabled: true,
		subsystems: ["mcp"],
		level: "info",
	},
});
