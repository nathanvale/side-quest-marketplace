/**
 * Input validation and sanitization utilities
 *
 * Prevents path traversal, injection attacks, and validates user inputs
 * according to expected formats and constraints.
 *
 * @module shared/validation
 */

import {
	sanitizePattern as coreSanitizePattern,
	validateFilePath as coreValidateFilePath,
	validatePathSafety as coreValidatePathSafety,
} from "@sidequest/core/fs";

// Re-export validation functions from @sidequest/core/validation
export {
	validateAreaName,
	validateClassifierId,
	validateDisplayName,
	validateFieldName,
	validateGlob,
	validatePriority,
	validateRegex,
	validateTemplateName,
	validateWeight,
} from "@sidequest/core/validation";

/**
 * Sanitize pattern string (prevent ReDoS)
 *
 * Removes dangerous regex patterns that could cause exponential backtracking.
 * Delegates to core implementation.
 *
 * @param pattern - Regex pattern to sanitize
 * @returns Sanitized pattern
 *
 * @example
 * ```ts
 * const safe = sanitizePattern('medical.*bill'); // OK
 * const safe2 = sanitizePattern('(a+)+'); // Removes nested quantifiers
 * ```
 */
export function sanitizePattern(pattern: string): string {
	return coreSanitizePattern(pattern);
}

/**
 * Validate file path (no path traversal, within bounds)
 *
 * Delegates to core implementation. Prevents absolute paths, path traversal,
 * and hidden files.
 *
 * @param inputPath - Path to validate
 * @returns Sanitized path
 * @throws Error if path contains traversal patterns
 *
 * @example
 * ```ts
 * const path = validateFilePath('Templates/invoice.md'); // OK
 * validateFilePath('../../../etc/passwd'); // throws - path traversal
 * ```
 */
export function validateFilePath(inputPath: string): string {
	return coreValidateFilePath(inputPath);
}

/**
 * Validate that a path is safe and doesn't escape the vault boundary.
 *
 * Re-exported from @sidequest/core/fs for convenience.
 * Uses realpath canonicalization to prevent symlink-based path traversal attacks.
 *
 * @param inputPath - Path to validate (relative or absolute)
 * @param rootPath - The root path that inputPath must stay within
 * @throws Error if path contains unsafe patterns or escapes root
 *
 * @example
 * ```ts
 * validatePathSafety('00 Inbox/note.md', '/vault'); // OK
 * validatePathSafety('../../etc/passwd', '/vault'); // throws - path traversal
 * validatePathSafety('~/secrets', '/vault'); // throws - unsafe pattern
 * ```
 */
export function validatePathSafety(inputPath: string, rootPath: string): void {
	coreValidatePathSafety(inputPath, rootPath);
}
