/**
 * Input validation utilities for identifiers, numbers, names, and patterns.
 *
 * Provides comprehensive validation functions preventing:
 * - Path traversal attacks
 * - Naming convention violations
 * - Out-of-range values
 * - Glob injection attacks
 * - Shell command injection attacks
 * - ReDoS (Regular Expression Denial of Service) vulnerabilities
 *
 * @module validation
 */

export {
	validateClassifierId,
	validateFieldName,
	validateTemplateName,
} from "./identifiers.ts";
export { validateAreaName, validateDisplayName } from "./names.ts";
export {
	type ValidateIntegerOptions,
	validateInteger,
	validatePriority,
	validateWeight,
} from "./numbers.ts";
export { validatePath, validatePathOrDefault } from "./paths.ts";
export {
	isRegexSafe,
	isValidGlob,
	SHELL_METACHARACTERS,
	type ValidationResult,
	validateGlob,
	validateRegex,
	validateShellSafePattern,
} from "./patterns.ts";
