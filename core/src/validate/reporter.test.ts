import { describe, expect, test } from "bun:test";
import { formatJson, formatMarkdown, formatSummary } from "./reporter.ts";
import type { ValidationResult } from "./types.ts";

describe("reporter", () => {
	describe("formatMarkdown", () => {
		test("formats result with errors and warnings", () => {
			const result: ValidationResult = {
				plugin: "plugins/git",
				path: "/path/to/plugins/git",
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
							'Tool "searchHistory" should be "mcp__plugin_atuin_atuin__search_history"',
						severity: "warning",
						file: "src/index.ts",
						line: 45,
						suggestion: 'Rename to "mcp__plugin_atuin_atuin__search_history"',
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

			const output = formatMarkdown(result);

			expect(output).toContain("Validating plugins/git...");
			expect(output).toContain("ERRORS (1):");
			expect(output).toContain("hooks/hooks.json:12 [hooks/invalid-event]");
			expect(output).toContain("WARNINGS (2):");
			expect(output).toContain("src/index.ts:45 [mcp/tool-naming]");
			expect(output).toContain("1 error, 2 warnings");
			expect(output).toContain("Validation FAILED (errors block commit)");
			expect(output).toContain(
				'Suggestion: Rename to "mcp__plugin_atuin_atuin__search_history"',
			);
		});

		test("formats result with only warnings (passing)", () => {
			const result: ValidationResult = {
				plugin: "plugins/atuin",
				path: "/path/to/plugins/atuin",
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

			const output = formatMarkdown(result);

			expect(output).toContain("Validating plugins/atuin...");
			expect(output).toContain("WARNINGS (1):");
			expect(output).toContain("1 warning");
			expect(output).toContain("Validation PASSED");
		});

		test("formats result with no issues", () => {
			const result: ValidationResult = {
				plugin: "plugins/kit",
				path: "/path/to/plugins/kit",
				passed: true,
				issues: [],
				summary: {
					errors: 0,
					warnings: 0,
					info: 0,
				},
			};

			const output = formatMarkdown(result);

			expect(output).toContain("Validating plugins/kit...");
			expect(output).toContain("Validation PASSED");
			expect(output).not.toContain("ERRORS");
			expect(output).not.toContain("WARNINGS");
		});

		test("formats result with info messages", () => {
			const result: ValidationResult = {
				plugin: "plugins/test",
				path: "/path/to/plugins/test",
				passed: true,
				issues: [
					{
						ruleId: "docs/optimization",
						message: "Consider adding usage examples to README",
						severity: "info",
						file: "README.md",
					},
				],
				summary: {
					errors: 0,
					warnings: 0,
					info: 1,
				},
			};

			const output = formatMarkdown(result);

			expect(output).toContain("INFO (1):");
			expect(output).toContain("1 info");
			expect(output).toContain("Validation PASSED");
		});

		test("formats issue without file or line number", () => {
			const result: ValidationResult = {
				plugin: "plugins/test",
				path: "/path/to/plugins/test",
				passed: false,
				issues: [
					{
						ruleId: "plugin/missing-metadata",
						message: "Plugin is missing required metadata",
						severity: "error",
					},
				],
				summary: {
					errors: 1,
					warnings: 0,
					info: 0,
				},
			};

			const output = formatMarkdown(result);

			expect(output).toContain("(no location) [plugin/missing-metadata]");
		});
	});

	describe("formatJson", () => {
		test("formats result as JSON", () => {
			const result: ValidationResult = {
				plugin: "plugins/git",
				path: "/path/to/plugins/git",
				passed: false,
				issues: [
					{
						ruleId: "hooks/invalid-event",
						message: "Invalid event type",
						severity: "error",
						file: "hooks/hooks.json",
						line: 12,
					},
				],
				summary: {
					errors: 1,
					warnings: 0,
					info: 0,
				},
			};

			const output = formatJson(result);
			const parsed = JSON.parse(output);

			expect(parsed.plugin).toBe("plugins/git");
			expect(parsed.passed).toBe(false);
			expect(parsed.issues).toHaveLength(1);
			expect(parsed.issues[0].ruleId).toBe("hooks/invalid-event");
			expect(parsed.summary.errors).toBe(1);
		});

		test("formats empty result as JSON", () => {
			const result: ValidationResult = {
				plugin: "plugins/test",
				path: "/path/to/plugins/test",
				passed: true,
				issues: [],
				summary: {
					errors: 0,
					warnings: 0,
					info: 0,
				},
			};

			const output = formatJson(result);
			const parsed = JSON.parse(output);

			expect(parsed.plugin).toBe("plugins/test");
			expect(parsed.passed).toBe(true);
			expect(parsed.issues).toHaveLength(0);
		});
	});

	describe("formatSummary", () => {
		test("formats passing result with no issues", () => {
			const result: ValidationResult = {
				plugin: "plugins/kit",
				path: "/path/to/plugins/kit",
				passed: true,
				issues: [],
				summary: {
					errors: 0,
					warnings: 0,
					info: 0,
				},
			};

			expect(formatSummary(result)).toBe("plugins/kit: PASSED");
		});

		test("formats passing result with warnings", () => {
			const result: ValidationResult = {
				plugin: "plugins/git",
				path: "/path/to/plugins/git",
				passed: true,
				issues: [],
				summary: {
					errors: 0,
					warnings: 2,
					info: 0,
				},
			};

			expect(formatSummary(result)).toBe("plugins/git: PASSED (2 warnings)");
		});

		test("formats failing result with errors", () => {
			const result: ValidationResult = {
				plugin: "plugins/git",
				path: "/path/to/plugins/git",
				passed: false,
				issues: [],
				summary: {
					errors: 1,
					warnings: 0,
					info: 0,
				},
			};

			expect(formatSummary(result)).toBe("plugins/git: FAILED (1 error)");
		});

		test("formats failing result with errors and warnings", () => {
			const result: ValidationResult = {
				plugin: "plugins/git",
				path: "/path/to/plugins/git",
				passed: false,
				issues: [],
				summary: {
					errors: 1,
					warnings: 2,
					info: 0,
				},
			};

			expect(formatSummary(result)).toBe(
				"plugins/git: FAILED (1 error, 2 warnings)",
			);
		});

		test("formats result with multiple errors", () => {
			const result: ValidationResult = {
				plugin: "plugins/test",
				path: "/path/to/plugins/test",
				passed: false,
				issues: [],
				summary: {
					errors: 3,
					warnings: 0,
					info: 0,
				},
			};

			expect(formatSummary(result)).toBe("plugins/test: FAILED (3 errors)");
		});

		test("formats result with all severity levels", () => {
			const result: ValidationResult = {
				plugin: "plugins/test",
				path: "/path/to/plugins/test",
				passed: false,
				issues: [],
				summary: {
					errors: 1,
					warnings: 2,
					info: 3,
				},
			};

			expect(formatSummary(result)).toBe(
				"plugins/test: FAILED (1 error, 2 warnings, 3 info)",
			);
		});
	});
});
