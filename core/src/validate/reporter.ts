/**
 * Validation result formatters for different output modes.
 *
 * Provides functions to format ValidationResult into:
 * - Markdown format (human-readable, suitable for terminal output)
 * - JSON format (machine-parseable, suitable for CI/automation)
 * - Summary format (one-line overview)
 */

import type { ValidationIssue, ValidationResult } from "./types.ts";

/**
 * Formats a validation result as markdown (human-readable).
 *
 * Example output:
 * ```
 * Validating plugins/git...
 *
 * ERRORS (1):
 *   hooks/hooks.json:12 [hooks/invalid-event]
 *     Invalid event type "PostTooluse". Valid: SessionStart, PreToolUse, PostToolUse, Stop
 *
 * WARNINGS (2):
 *   src/index.ts:45 [mcp/tool-naming]
 *     Tool "getCommits" should be "mcp__plugin_git_git-intelligence__get_commits"
 *
 * 1 error, 2 warnings
 *
 * Validation FAILED (errors block commit)
 * ```
 *
 * @param result - The validation result to format
 * @returns Markdown-formatted string
 */
export function formatMarkdown(result: ValidationResult): string {
	const lines: string[] = [];

	// Header
	lines.push(`Validating ${result.plugin}...`);
	lines.push("");

	// Group issues by severity
	const errors = result.issues.filter((i) => i.severity === "error");
	const warnings = result.issues.filter((i) => i.severity === "warning");
	const infos = result.issues.filter((i) => i.severity === "info");

	// Errors section
	if (errors.length > 0) {
		lines.push(`ERRORS (${errors.length}):`);
		for (const issue of errors) {
			lines.push(formatIssueMarkdown(issue));
		}
		lines.push("");
	}

	// Warnings section
	if (warnings.length > 0) {
		lines.push(`WARNINGS (${warnings.length}):`);
		for (const issue of warnings) {
			lines.push(formatIssueMarkdown(issue));
		}
		lines.push("");
	}

	// Infos section
	if (infos.length > 0) {
		lines.push(`INFO (${infos.length}):`);
		for (const issue of infos) {
			lines.push(formatIssueMarkdown(issue));
		}
		lines.push("");
	}

	// Summary line
	const summaryParts: string[] = [];
	if (result.summary.errors > 0) {
		summaryParts.push(
			`${result.summary.errors} error${result.summary.errors === 1 ? "" : "s"}`,
		);
	}
	if (result.summary.warnings > 0) {
		summaryParts.push(
			`${result.summary.warnings} warning${result.summary.warnings === 1 ? "" : "s"}`,
		);
	}
	if (result.summary.info > 0) {
		summaryParts.push(`${result.summary.info} info`);
	}

	if (summaryParts.length > 0) {
		lines.push(summaryParts.join(", "));
		lines.push("");
	}

	// Status line
	if (result.passed) {
		lines.push("Validation PASSED");
	} else {
		lines.push("Validation FAILED (errors block commit)");
	}

	return lines.join("\n");
}

/**
 * Formats a single validation issue as markdown.
 * @param issue - The issue to format
 * @returns Formatted issue string with indentation
 */
function formatIssueMarkdown(issue: ValidationIssue): string {
	const lines: string[] = [];

	// Location line: "  file:line [ruleId]"
	const location = issue.file
		? `${issue.file}${issue.line ? `:${issue.line}` : ""}`
		: "(no location)";
	lines.push(`  ${location} [${issue.ruleId}]`);

	// Message line: "    message"
	lines.push(`    ${issue.message}`);

	// Suggestion line (if present): "    Suggestion: ..."
	if (issue.suggestion) {
		lines.push(`    Suggestion: ${issue.suggestion}`);
	}

	return lines.join("\n");
}

/**
 * Formats a validation result as JSON (machine-parseable).
 *
 * Outputs the ValidationResult as pretty-printed JSON for consumption by
 * CI systems, tools, or scripts.
 *
 * @param result - The validation result to format
 * @returns JSON string (indented with 2 spaces)
 */
export function formatJson(result: ValidationResult): string {
	return JSON.stringify(result, null, 2);
}

/**
 * Formats a validation result as a one-line summary.
 *
 * Example outputs:
 * - `plugins/git: PASSED`
 * - `plugins/git: FAILED (1 error, 2 warnings)`
 * - `plugins/git: PASSED (2 warnings)`
 *
 * @param result - The validation result to format
 * @returns One-line summary string
 */
export function formatSummary(result: ValidationResult): string {
	const parts: string[] = [`${result.plugin}:`];

	if (result.passed) {
		parts.push("PASSED");
	} else {
		parts.push("FAILED");
	}

	// Add issue counts if present
	const counts: string[] = [];
	if (result.summary.errors > 0) {
		counts.push(
			`${result.summary.errors} error${result.summary.errors === 1 ? "" : "s"}`,
		);
	}
	if (result.summary.warnings > 0) {
		counts.push(
			`${result.summary.warnings} warning${result.summary.warnings === 1 ? "" : "s"}`,
		);
	}
	if (result.summary.info > 0) {
		counts.push(`${result.summary.info} info`);
	}

	if (counts.length > 0) {
		parts.push(`(${counts.join(", ")})`);
	}

	return parts.join(" ");
}
