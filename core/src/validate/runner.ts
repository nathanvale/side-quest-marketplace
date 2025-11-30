/**
 * Validation runner that orchestrates all validators
 */

import { randomUUID } from "node:crypto";
import { basename } from "node:path";
import { spawn } from "bun";
import type { ValidationResult } from "./types.ts";
import {
	validateBootstrapHook,
	validateHooksJson,
	validateMcpJson,
	validateMcpToolNaming,
	validatePluginStructure,
	validateSkillMd,
} from "./validators/index.ts";

/**
 * Options for plugin validation
 */
export interface ValidatePluginOptions {
	/**
	 * Include warnings in the validation results
	 * @default true
	 */
	includeWarnings?: boolean;

	/**
	 * Run the existing claude plugin validate command
	 * @default true
	 */
	runClaudeValidate?: boolean;
}

/**
 * Run the existing claude plugin validate command
 */
async function runClaudeValidate(
	pluginRoot: string,
): Promise<ValidationResult> {
	const proc = spawn({
		cmd: ["claude", "plugin", "validate", pluginRoot],
		stdout: "pipe",
		stderr: "pipe",
	});

	const exitCode = await proc.exited;
	const stdout = await new Response(proc.stdout).text();
	const stderr = await new Response(proc.stderr).text();
	const output = `${stdout}${stderr}`.trim();

	// Parse output for errors, warnings, and info
	const issues: Array<{
		ruleId: string;
		severity: "error" | "warning" | "info";
		message: string;
		file: string;
	}> = [];
	const lines = output.split("\n");

	for (const line of lines) {
		if (line.includes("error") || line.includes("Error")) {
			issues.push({
				ruleId: "claude-validate/error",
				severity: "error",
				message: line,
				file: pluginRoot,
			});
		} else if (line.includes("warning") || line.includes("Warning")) {
			issues.push({
				ruleId: "claude-validate/warning",
				severity: "warning",
				message: line,
				file: pluginRoot,
			});
		}
	}

	const passed = exitCode === 0 || output.includes("Validation passed");

	return {
		plugin: basename(pluginRoot),
		path: pluginRoot,
		passed,
		issues,
		summary: {
			errors: issues.filter((i) => i.severity === "error").length,
			warnings: issues.filter((i) => i.severity === "warning").length,
			info: issues.filter((i) => i.severity === "info").length,
		},
	};
}

/**
 * Validate a plugin using all available validators
 *
 * @param pluginRoot - Absolute path to the plugin root directory
 * @param options - Validation options
 * @returns Validation result with aggregated issues
 */
export async function validatePlugin(
	pluginRoot: string,
	options: ValidatePluginOptions = {},
): Promise<ValidationResult> {
	const {
		includeWarnings = true,
		runClaudeValidate: shouldRunClaudeValidate = true,
	} = options;

	// Generate correlation ID for logging
	const correlationId = randomUUID();

	console.error(
		`[${correlationId}] Starting plugin validation for: ${pluginRoot}`,
	);

	const allIssues = [];

	try {
		// 1. Run existing claude plugin validate if requested
		if (shouldRunClaudeValidate) {
			console.error(`[${correlationId}] Running claude plugin validate...`);
			const claudeResult = await runClaudeValidate(pluginRoot);
			allIssues.push(...claudeResult.issues);
		}

		// 2. Run custom validators
		console.error(`[${correlationId}] Running custom validators...`);

		const validatorOptions = { pluginRoot, includeWarnings };

		// Run all validators in parallel
		const [
			bootstrapHookIssues,
			hooksJsonIssues,
			skillMdIssues,
			mcpJsonIssues,
			mcpToolNamingIssues,
			pluginStructureIssues,
		] = await Promise.all([
			validateBootstrapHook(validatorOptions),
			validateHooksJson(validatorOptions),
			validateSkillMd(validatorOptions),
			validateMcpJson(validatorOptions),
			validateMcpToolNaming(validatorOptions),
			validatePluginStructure(validatorOptions),
		]);

		// 3. Aggregate all issues
		allIssues.push(
			...bootstrapHookIssues,
			...hooksJsonIssues,
			...skillMdIssues,
			...mcpJsonIssues,
			...mcpToolNamingIssues,
			...pluginStructureIssues,
		);

		// 4. Filter out warnings if requested
		const filteredIssues = includeWarnings
			? allIssues
			: allIssues.filter((issue) => issue.severity === "error");

		// 5. Create summary
		const summary = {
			errors: filteredIssues.filter((i) => i.severity === "error").length,
			warnings: filteredIssues.filter((i) => i.severity === "warning").length,
			info: filteredIssues.filter((i) => i.severity === "info").length,
		};

		console.error(
			`[${correlationId}] Validation complete - Errors: ${summary.errors}, Warnings: ${summary.warnings}, Info: ${summary.info}`,
		);

		// 6. Return result
		return {
			plugin: basename(pluginRoot),
			path: pluginRoot,
			passed: summary.errors === 0,
			issues: filteredIssues,
			summary,
		};
	} catch (error) {
		console.error(
			`[${correlationId}] Validation failed with error: ${error instanceof Error ? error.message : String(error)}`,
		);

		return {
			plugin: basename(pluginRoot),
			path: pluginRoot,
			passed: false,
			issues: [
				{
					ruleId: "runner/validation-failed",
					severity: "error",
					message: `Validation runner failed: ${error instanceof Error ? error.message : String(error)}`,
					file: pluginRoot,
				},
			],
			summary: {
				errors: 1,
				warnings: 0,
				info: 0,
			},
		};
	}
}
