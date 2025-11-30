#!/usr/bin/env bun

/**
 * Example demonstrating the reporter output formats.
 * Run: bun run core/src/validate/reporter-example.ts
 */

import { formatJson, formatMarkdown, formatSummary } from "./reporter.ts";
import type { ValidationResult } from "./types.ts";

// Example validation result with errors and warnings
const exampleResult: ValidationResult = {
	plugin: "plugins/git",
	path: "/Users/nathanvale/code/side-quest-marketplace/plugins/git",
	passed: false,
	issues: [
		{
			ruleId: "hooks/invalid-event",
			message:
				'Invalid event type "PostTooluse". Valid: SessionStart, PreToolUse, PostToolUse, Stop',
			severity: "error",
			file: "hooks/hooks.json",
			line: 12,
		},
		{
			ruleId: "mcp/tool-naming",
			message:
				'Tool "getCommits" should be "mcp__plugin_git_git-intelligence__get_commits"',
			severity: "warning",
			file: "src/index.ts",
			line: 45,
			suggestion: 'Rename to "mcp__plugin_git_git-intelligence__get_commits"',
		},
		{
			ruleId: "mcp/tool-naming",
			message: 'Tool "searchCommits" should follow naming convention',
			severity: "warning",
			file: "src/index.ts",
			line: 67,
		},
	],
	summary: {
		errors: 1,
		warnings: 2,
		info: 0,
	},
};

// Example passing result with warnings
const passingResult: ValidationResult = {
	plugin: "plugins/kit",
	path: "/Users/nathanvale/code/side-quest-marketplace/plugins/kit",
	passed: true,
	issues: [
		{
			ruleId: "docs/missing-jsdoc",
			message: "Function 'searchHistory' is missing JSDoc",
			severity: "warning",
			file: "src/index.ts",
			line: 23,
		},
	],
	summary: {
		errors: 0,
		warnings: 1,
		info: 0,
	},
};

console.log("=== MARKDOWN FORMAT (Failing) ===\n");
console.log(formatMarkdown(exampleResult));

console.log("\n\n=== MARKDOWN FORMAT (Passing with warnings) ===\n");
console.log(formatMarkdown(passingResult));

console.log("\n\n=== JSON FORMAT ===\n");
console.log(formatJson(exampleResult));

console.log("\n\n=== SUMMARY FORMAT ===\n");
console.log(formatSummary(exampleResult));
console.log(formatSummary(passingResult));
