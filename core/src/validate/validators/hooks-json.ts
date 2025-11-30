/**
 * Validator for hooks/hooks.json files
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ValidationIssue, ValidatorOptions } from "../types.ts";

/**
 * Validates hooks.json structure and references
 */
export async function validateHooksJson(
	options: ValidatorOptions,
): Promise<ValidationIssue[]> {
	const issues: ValidationIssue[] = [];
	const hooksJsonPath = join(options.pluginRoot, "hooks", "hooks.json");

	// If hooks.json doesn't exist, skip validation (not required)
	if (!existsSync(hooksJsonPath)) {
		return issues;
	}

	try {
		// Read and parse hooks.json
		const content = await Bun.file(hooksJsonPath).text();
		const hooksConfig = JSON.parse(content);

		// Validate structure
		if (!hooksConfig.hooks || !Array.isArray(hooksConfig.hooks)) {
			issues.push({
				ruleId: "hooks/invalid-structure",
				severity: "error",
				message: "hooks.json must contain a 'hooks' array",
				file: hooksJsonPath,
				suggestion: "Add a 'hooks' array to your hooks.json file",
			});
			return issues;
		}

		// Validate each hook
		for (const hook of hooksConfig.hooks) {
			if (!hook.event) {
				issues.push({
					ruleId: "hooks/missing-event",
					severity: "error",
					message: "Hook is missing 'event' property",
					file: hooksJsonPath,
					suggestion:
						"Add an 'event' property (SessionStart, PreToolUse, PostToolUse, or Stop)",
				});
			}

			if (!hook.command) {
				issues.push({
					ruleId: "hooks/missing-command",
					severity: "error",
					message: `Hook '${hook.event}' is missing 'command' property`,
					file: hooksJsonPath,
					suggestion: "Add a 'command' property with the script to execute",
				});
			}

			// Validate event type
			const validEvents = ["SessionStart", "PreToolUse", "PostToolUse", "Stop"];
			if (hook.event && !validEvents.includes(hook.event)) {
				issues.push({
					ruleId: "hooks/invalid-event",
					severity: "warning",
					message: `Unknown event type: ${hook.event}`,
					file: hooksJsonPath,
					suggestion: `Use one of: ${validEvents.join(", ")}`,
				});
			}

			// Check if command file exists
			if (hook.command) {
				let filePath = hook.command;

				// Extract file path from bun run commands
				if (hook.command.startsWith("bun run ")) {
					filePath = hook.command.replace("bun run ", "");
				} else if (hook.command.startsWith("bun ")) {
					// Skip other bun commands (like "bun install", "bun test")
					// These are not file paths and don't need validation
					continue;
				}

				// Handle ${CLAUDE_PLUGIN_ROOT} variable
				if (filePath.includes("${CLAUDE_PLUGIN_ROOT}")) {
					filePath = filePath.replace(
						"${CLAUDE_PLUGIN_ROOT}",
						options.pluginRoot,
					);
				} else {
					// Relative path from plugin root
					filePath = join(options.pluginRoot, filePath);
				}

				// Validate file exists
				if (!existsSync(filePath)) {
					issues.push({
						ruleId: "hooks/command-file-not-found",
						severity: "error",
						message: `Command file not found: ${filePath}`,
						file: hooksJsonPath,
						suggestion: "Create the file or fix the path in the command",
					});
				}
			}
		}
	} catch (error) {
		issues.push({
			ruleId: "hooks/parse-error",
			severity: "error",
			message: `Failed to parse hooks.json: ${error instanceof Error ? error.message : String(error)}`,
			file: hooksJsonPath,
			suggestion: "Ensure hooks.json is valid JSON with proper syntax",
		});
	}

	return issues;
}
