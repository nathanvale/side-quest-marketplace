/**
 * Core validation types for the SideQuest marketplace validation system.
 */

/**
 * Severity levels for validation issues.
 * - error: Blocks commit (must be fixed)
 * - warning: Shows but doesn't block (should be addressed)
 * - info: Informational only (nice to know)
 */
export type ValidationSeverity = "error" | "warning" | "info";

/**
 * Represents a single validation issue found during plugin validation.
 */
export interface ValidationIssue {
	/** Unique identifier for the validation rule that detected this issue (e.g., "hooks/invalid-event") */
	ruleId: string;

	/** Human-readable message describing the issue */
	message: string;

	/** Severity level of this issue */
	severity: ValidationSeverity;

	/** Optional file path where the issue was found */
	file?: string;

	/** Optional line number where the issue was found */
	line?: number;

	/** Optional suggestion for how to fix this issue */
	suggestion?: string;
}

/**
 * Complete validation result for a single plugin.
 */
export interface ValidationResult {
	/** Plugin name or identifier */
	plugin: string;

	/** Absolute path to the plugin directory */
	path: string;

	/** Whether validation passed (no ERROR severity issues; warnings are OK) */
	passed: boolean;

	/** Array of all validation issues found */
	issues: ValidationIssue[];

	/** Summary statistics of issues by severity */
	summary: {
		errors: number;
		warnings: number;
		info: number;
	};
}

/**
 * Options passed to validator functions.
 */
export interface ValidatorOptions {
	/** Include warnings in the validation results */
	includeWarnings?: boolean;

	/** Absolute path to the plugin root directory */
	pluginRoot: string;
}

/**
 * Type signature for a validator function.
 */
export type Validator = (
	options: ValidatorOptions,
) => Promise<ValidationIssue[]>;
