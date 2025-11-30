/**
 * Validator for hooks/hooks.json files
 *
 * Validates the official Claude Code hooks.json schema:
 * {
 *   "hooks": {
 *     "EventType": [
 *       {
 *         "matcher": "ToolPattern",
 *         "hooks": [
 *           { "type": "command", "command": "...", "timeout": 30 }
 *         ]
 *       }
 *     ]
 *   }
 * }
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ValidationIssue, ValidatorOptions } from "../types.ts";

/**
 * Valid hook event types per Claude Code documentation
 * @see https://docs.anthropic.com/en/docs/claude-code/hooks
 */
const VALID_EVENTS = [
	"PreToolUse",
	"PermissionRequest",
	"PostToolUse",
	"UserPromptSubmit",
	"Notification",
	"Stop",
	"SubagentStop",
	"PreCompact",
	"SessionStart",
	"SessionEnd",
] as const;

/**
 * Valid hook types
 */
const VALID_HOOK_TYPES = ["command", "prompt"] as const;

/**
 * Maximum allowed timeout in milliseconds (10 minutes)
 */
const MAX_TIMEOUT = 600;

/**
 * Default timeout in seconds
 */
const DEFAULT_TIMEOUT = 60;

/**
 * Hook command structure
 */
interface HookCommand {
	type?: string;
	command?: string;
	prompt?: string;
	timeout?: number;
}

/**
 * Hook matcher structure
 */
interface HookMatcher {
	matcher?: string;
	hooks?: HookCommand[];
}

/**
 * Hooks.json structure (official schema)
 */
interface HooksConfig {
	description?: string;
	hooks?: Record<string, HookMatcher[]>;
}

/**
 * Validates a single hook command object
 */
function validateHookCommand(
	hook: HookCommand,
	eventType: string,
	matcherIndex: number,
	hookIndex: number,
	hooksJsonPath: string,
	pluginRoot: string,
): ValidationIssue[] {
	const issues: ValidationIssue[] = [];
	const location = `${eventType}[${matcherIndex}].hooks[${hookIndex}]`;

	// Validate hook type
	if (!hook.type) {
		issues.push({
			ruleId: "hooks/missing-type",
			severity: "error",
			message: `Hook at ${location} is missing 'type' property`,
			file: hooksJsonPath,
			suggestion: `Add "type": "command" or "type": "prompt"`,
		});
	} else if (
		!VALID_HOOK_TYPES.includes(hook.type as (typeof VALID_HOOK_TYPES)[number])
	) {
		issues.push({
			ruleId: "hooks/invalid-type",
			severity: "error",
			message: `Hook at ${location} has invalid type: "${hook.type}"`,
			file: hooksJsonPath,
			suggestion: `Use one of: ${VALID_HOOK_TYPES.join(", ")}`,
		});
	}

	// Validate command-type hooks
	if (hook.type === "command") {
		if (!hook.command) {
			issues.push({
				ruleId: "hooks/missing-command",
				severity: "error",
				message: `Command hook at ${location} is missing 'command' property`,
				file: hooksJsonPath,
				suggestion: "Add a 'command' property with the script to execute",
			});
		} else {
			// Validate command file exists
			const fileIssues = validateCommandFile(
				hook.command,
				location,
				hooksJsonPath,
				pluginRoot,
			);
			issues.push(...fileIssues);
		}
	}

	// Validate prompt-type hooks
	if (hook.type === "prompt") {
		if (!hook.prompt) {
			issues.push({
				ruleId: "hooks/missing-prompt",
				severity: "error",
				message: `Prompt hook at ${location} is missing 'prompt' property`,
				file: hooksJsonPath,
				suggestion: "Add a 'prompt' property with the prompt text",
			});
		}
	}

	// Validate timeout
	if (hook.timeout !== undefined) {
		if (typeof hook.timeout !== "number") {
			issues.push({
				ruleId: "hooks/invalid-timeout-type",
				severity: "error",
				message: `Hook at ${location} has non-numeric timeout: "${hook.timeout}"`,
				file: hooksJsonPath,
				suggestion: `Set timeout to a number (default: ${DEFAULT_TIMEOUT}, max: ${MAX_TIMEOUT})`,
			});
		} else if (hook.timeout < 0 || hook.timeout > MAX_TIMEOUT) {
			issues.push({
				ruleId: "hooks/timeout-out-of-range",
				severity: "warning",
				message: `Hook at ${location} has timeout ${hook.timeout}s outside valid range (0-${MAX_TIMEOUT})`,
				file: hooksJsonPath,
				suggestion: `Set timeout between 0 and ${MAX_TIMEOUT} seconds`,
			});
		}
	}

	return issues;
}

/**
 * Validates that a command file exists
 */
function validateCommandFile(
	command: string,
	location: string,
	hooksJsonPath: string,
	pluginRoot: string,
): ValidationIssue[] {
	const issues: ValidationIssue[] = [];
	let filePath = command;

	// Extract file path from bun run commands
	if (command.startsWith("bun run ")) {
		filePath = command.replace("bun run ", "");
	} else if (command.startsWith("bun ")) {
		// Skip other bun commands (like "bun install", "bun test")
		return issues;
	}

	// Handle ${CLAUDE_PLUGIN_ROOT} variable
	// biome-ignore lint/suspicious/noTemplateCurlyInString: This is a literal string to match against, not a template literal
	if (filePath.includes("${CLAUDE_PLUGIN_ROOT}")) {
		// biome-ignore lint/suspicious/noTemplateCurlyInString: This is a literal string to match against, not a template literal
		filePath = filePath.replace("${CLAUDE_PLUGIN_ROOT}", pluginRoot);
	} else if (!filePath.startsWith("/")) {
		// Relative path from plugin root
		filePath = join(pluginRoot, filePath);
	}

	// Validate file exists
	if (!existsSync(filePath)) {
		issues.push({
			ruleId: "hooks/command-file-not-found",
			severity: "error",
			message: `Command file not found at ${location}: ${filePath}`,
			file: hooksJsonPath,
			suggestion: "Create the file or fix the path in the command",
		});
	}

	return issues;
}

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
		const hooksConfig: HooksConfig = JSON.parse(content);

		// Validate top-level structure: hooks must be an object (not array)
		if (!hooksConfig.hooks) {
			issues.push({
				ruleId: "hooks/missing-hooks-object",
				severity: "error",
				message: "hooks.json must contain a 'hooks' object",
				file: hooksJsonPath,
				suggestion:
					'Add a "hooks" object with event types as keys (e.g., "SessionStart", "PostToolUse")',
			});
			return issues;
		}

		if (
			typeof hooksConfig.hooks !== "object" ||
			Array.isArray(hooksConfig.hooks)
		) {
			issues.push({
				ruleId: "hooks/invalid-structure",
				severity: "error",
				message:
					"'hooks' must be an object with event types as keys, not an array",
				file: hooksJsonPath,
				suggestion:
					'Structure: { "hooks": { "SessionStart": [...], "PostToolUse": [...] } }',
			});
			return issues;
		}

		// Validate each event type
		for (const [eventType, matchers] of Object.entries(hooksConfig.hooks)) {
			// Validate event type name
			if (!VALID_EVENTS.includes(eventType as (typeof VALID_EVENTS)[number])) {
				issues.push({
					ruleId: "hooks/invalid-event",
					severity: "warning",
					message: `Unknown event type: "${eventType}"`,
					file: hooksJsonPath,
					suggestion: `Valid events: ${VALID_EVENTS.join(", ")}`,
				});
			}

			// Validate matchers array
			if (!Array.isArray(matchers)) {
				issues.push({
					ruleId: "hooks/invalid-matchers",
					severity: "error",
					message: `Event "${eventType}" must have an array of matchers`,
					file: hooksJsonPath,
					suggestion: `Structure: "${eventType}": [{ "matcher": "*", "hooks": [...] }]`,
				});
				continue;
			}

			// Validate each matcher
			for (
				let matcherIndex = 0;
				matcherIndex < matchers.length;
				matcherIndex++
			) {
				const matcher = matchers[matcherIndex] as HookMatcher;

				if (typeof matcher !== "object" || matcher === null) {
					issues.push({
						ruleId: "hooks/invalid-matcher",
						severity: "error",
						message: `Matcher at ${eventType}[${matcherIndex}] must be an object`,
						file: hooksJsonPath,
						suggestion: '{ "matcher": "*", "hooks": [...] }',
					});
					continue;
				}

				// Validate hooks array within matcher
				if (!matcher.hooks) {
					issues.push({
						ruleId: "hooks/missing-hooks-array",
						severity: "error",
						message: `Matcher at ${eventType}[${matcherIndex}] is missing 'hooks' array`,
						file: hooksJsonPath,
						suggestion: 'Add a "hooks" array with hook configurations',
					});
					continue;
				}

				if (!Array.isArray(matcher.hooks)) {
					issues.push({
						ruleId: "hooks/invalid-hooks-array",
						severity: "error",
						message: `'hooks' at ${eventType}[${matcherIndex}] must be an array`,
						file: hooksJsonPath,
						suggestion: '"hooks": [{ "type": "command", "command": "..." }]',
					});
					continue;
				}

				// Validate each hook in the matcher
				for (let hookIndex = 0; hookIndex < matcher.hooks.length; hookIndex++) {
					const hook = matcher.hooks[hookIndex] as HookCommand;
					const hookIssues = validateHookCommand(
						hook,
						eventType,
						matcherIndex,
						hookIndex,
						hooksJsonPath,
						options.pluginRoot,
					);
					issues.push(...hookIssues);
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
