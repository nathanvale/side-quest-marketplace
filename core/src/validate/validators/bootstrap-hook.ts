/**
 * Bootstrap Hook Validator
 *
 * Validates that all plugins with dependencies have a SessionStart hook
 * that calls the core bootstrap script as the FIRST hook.
 *
 * This ensures proper dependency installation before other hooks run.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ValidationIssue, ValidatorOptions } from "../types.ts";

/**
 * Expected bootstrap hook configuration
 */
// biome-ignore lint/suspicious/noTemplateCurlyInString: This is the actual template string used in hooks.json, not a JS template literal
const EXPECTED_BOOTSTRAP_COMMAND =
	"${CLAUDE_PLUGIN_ROOT}/../../core/bootstrap.sh";
const EXPECTED_TIMEOUT = 60;
const EXPECTED_MATCHER = "*";

/**
 * Hook command interface
 */
interface HookCommand {
	type: string;
	command: string;
	timeout?: number;
}

/**
 * Hook matcher interface
 */
interface HookMatcher {
	matcher?: string;
	hooks: HookCommand[];
}

/**
 * Hooks.json structure
 */
interface HooksJson {
	hooks?: {
		SessionStart?: HookMatcher[];
		[key: string]: HookMatcher[] | undefined;
	};
}

/**
 * Package.json structure (minimal)
 */
interface PackageJson {
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
}

/**
 * Check if a plugin has dependencies
 */
function hasDependencies(packageJson: PackageJson): boolean {
	const hasProd =
		packageJson.dependencies &&
		Object.keys(packageJson.dependencies).length > 0;
	const hasDev =
		packageJson.devDependencies &&
		Object.keys(packageJson.devDependencies).length > 0;
	return Boolean(hasProd || hasDev);
}

/**
 * Find the bootstrap hook in SessionStart hooks array
 */
function findBootstrapHook(sessionStartMatchers: HookMatcher[]): {
	found: boolean;
	matcherIndex: number;
	hookIndex: number;
	matcher?: HookMatcher;
	hook?: HookCommand;
} {
	for (let i = 0; i < sessionStartMatchers.length; i++) {
		const matcher = sessionStartMatchers[i];
		if (!matcher?.hooks) continue;

		for (let j = 0; j < matcher.hooks.length; j++) {
			const hook = matcher.hooks[j];
			if (hook?.command === EXPECTED_BOOTSTRAP_COMMAND) {
				return {
					found: true,
					matcherIndex: i,
					hookIndex: j,
					matcher,
					hook,
				};
			}
		}
	}

	return { found: false, matcherIndex: -1, hookIndex: -1 };
}

/**
 * Validates that plugins with dependencies have the bootstrap hook
 */
export async function validateBootstrapHook(
	options: ValidatorOptions,
): Promise<ValidationIssue[]> {
	const issues: ValidationIssue[] = [];
	const packageJsonPath = join(options.pluginRoot, "package.json");
	const pluginJsonPath = join(
		options.pluginRoot,
		".claude-plugin",
		"plugin.json",
	);
	const hooksJsonPath = join(options.pluginRoot, "hooks", "hooks.json");

	// Skip if this is not a plugin (e.g., marketplace root with marketplace.json instead of plugin.json)
	if (!existsSync(pluginJsonPath)) {
		return issues;
	}

	// Check if package.json exists
	if (!existsSync(packageJsonPath)) {
		// No package.json = no dependencies = no validation needed
		return issues;
	}

	// Read and parse package.json
	let packageJson: PackageJson;
	try {
		const content = await Bun.file(packageJsonPath).text();
		packageJson = JSON.parse(content);
	} catch (error) {
		issues.push({
			ruleId: "bootstrap/invalid-package-json",
			severity: "error",
			message: `Failed to parse package.json: ${error instanceof Error ? error.message : "Unknown error"}`,
			file: packageJsonPath,
			suggestion: "Ensure package.json contains valid JSON",
		});
		return issues;
	}

	// Check if plugin has dependencies
	if (!hasDependencies(packageJson)) {
		// No dependencies = no bootstrap hook required
		return issues;
	}

	// Plugin has dependencies - bootstrap hook is REQUIRED

	// Check if hooks.json exists
	if (!existsSync(hooksJsonPath)) {
		issues.push({
			ruleId: "bootstrap/missing-hooks-json",
			severity: "error",
			message:
				"Plugin with dependencies MUST have hooks/hooks.json with SessionStart bootstrap hook",
			file: packageJsonPath,
			suggestion: "Create hooks/hooks.json with a SessionStart bootstrap hook",
		});
		return issues;
	}

	// Read and parse hooks.json
	let hooksJson: HooksJson;
	try {
		const content = await Bun.file(hooksJsonPath).text();
		hooksJson = JSON.parse(content);
	} catch (error) {
		issues.push({
			ruleId: "bootstrap/invalid-hooks-json",
			severity: "error",
			message: `Failed to parse hooks.json: ${error instanceof Error ? error.message : "Unknown error"}`,
			file: hooksJsonPath,
			suggestion: "Ensure hooks.json contains valid JSON",
		});
		return issues;
	}

	// Check if hooks.json has hooks object
	if (!hooksJson.hooks) {
		issues.push({
			ruleId: "bootstrap/missing-hooks-object",
			severity: "error",
			message:
				'hooks.json must contain a "hooks" object with SessionStart bootstrap hook',
			file: hooksJsonPath,
			suggestion:
				'Add a "hooks" object with a SessionStart array containing the bootstrap hook',
		});
		return issues;
	}

	// Check if SessionStart exists
	if (
		!hooksJson.hooks.SessionStart ||
		!Array.isArray(hooksJson.hooks.SessionStart)
	) {
		issues.push({
			ruleId: "bootstrap/missing-session-start",
			severity: "error",
			message:
				"Plugin with dependencies MUST have SessionStart hook with bootstrap script",
			file: hooksJsonPath,
			suggestion: `Add SessionStart array with bootstrap hook: command: "${EXPECTED_BOOTSTRAP_COMMAND}"`,
		});
		return issues;
	}

	const sessionStart = hooksJson.hooks.SessionStart;

	// Check if SessionStart has any matchers
	if (sessionStart.length === 0) {
		issues.push({
			ruleId: "bootstrap/empty-session-start",
			severity: "error",
			message:
				"SessionStart must contain at least one matcher with bootstrap hook",
			file: hooksJsonPath,
			suggestion: "Add a matcher with the bootstrap hook configuration",
		});
		return issues;
	}

	// Find the bootstrap hook
	const bootstrapResult = findBootstrapHook(sessionStart);

	if (!bootstrapResult.found) {
		issues.push({
			ruleId: "bootstrap/missing-bootstrap-hook",
			severity: "error",
			message: `SessionStart must include bootstrap hook with command: ${EXPECTED_BOOTSTRAP_COMMAND}`,
			file: hooksJsonPath,
			suggestion: `Add bootstrap hook as the first hook with command: "${EXPECTED_BOOTSTRAP_COMMAND}", timeout: ${EXPECTED_TIMEOUT}`,
		});
		return issues;
	}

	// Bootstrap hook exists - validate it's in the correct position
	const { matcherIndex, hookIndex, matcher, hook } = bootstrapResult;

	// Check if bootstrap is the FIRST hook in the FIRST matcher
	if (matcherIndex !== 0 || hookIndex !== 0) {
		issues.push({
			ruleId: "bootstrap/wrong-position",
			severity: "error",
			message:
				"Bootstrap hook MUST be the first hook in the first SessionStart matcher",
			file: hooksJsonPath,
			suggestion:
				"Move the bootstrap hook to be the first hook in the first SessionStart matcher",
		});
	}

	// Validate matcher is "*"
	if (matcher?.matcher !== EXPECTED_MATCHER) {
		issues.push({
			ruleId: "bootstrap/wrong-matcher",
			severity: "warning",
			message: `Bootstrap hook matcher should be "*" (currently: ${matcher?.matcher || "undefined"})`,
			file: hooksJsonPath,
			suggestion: `Change the matcher to "*" to ensure bootstrap runs for all tools`,
		});
	}

	// Validate timeout
	if (hook?.timeout !== EXPECTED_TIMEOUT) {
		issues.push({
			ruleId: "bootstrap/wrong-timeout",
			severity: "warning",
			message: `Bootstrap hook timeout should be ${EXPECTED_TIMEOUT} (currently: ${hook?.timeout || "undefined"})`,
			file: hooksJsonPath,
			suggestion: `Set timeout to ${EXPECTED_TIMEOUT} to allow enough time for dependency installation`,
		});
	}

	return issues;
}
