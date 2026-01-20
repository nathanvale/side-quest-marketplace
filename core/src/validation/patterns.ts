/**
 * Pattern validation utilities for glob patterns and regex patterns.
 *
 * Provides security-critical validation preventing:
 * - Glob injection attacks
 * - ReDoS (Regular Expression Denial of Service) vulnerabilities
 *
 * @module validation/patterns
 */

/**
 * Validation result with success status, validated value, and optional error.
 */
export interface ValidationResult<T = string> {
	/** Whether validation passed */
	valid: boolean;
	/** Validated value (only present if valid) */
	value?: T;
	/** Error message (only present if invalid) */
	error?: string;
}

// ============================================================================
// Glob Validation
// ============================================================================

/**
 * Characters that are valid in glob patterns.
 * Restricts to safe subset to prevent injection.
 */
const SAFE_GLOB_CHARS = /^[a-zA-Z0-9_\-.*?[\]{}/\\,!]+$/;

/**
 * Check if a glob pattern is safe.
 *
 * Validates that the pattern:
 * - Is not empty
 * - Contains only safe characters
 * - Has balanced brackets/braces
 *
 * @param pattern - Glob pattern to validate
 * @returns True if pattern is safe
 *
 * @example
 * ```typescript
 * isValidGlob("*.ts") // => true
 * isValidGlob("**\/*.ts") // => true
 * isValidGlob("*.ts; rm -rf /") // => false (injection)
 * isValidGlob("[abc") // => false (unbalanced)
 * ```
 */
export function isValidGlob(pattern: string): boolean {
	// Empty check
	if (!pattern || pattern.trim() === "") {
		return false;
	}

	// Trim before checking (allow leading/trailing whitespace)
	const trimmed = pattern.trim();

	// Check for safe characters only
	if (!SAFE_GLOB_CHARS.test(trimmed)) {
		return false;
	}

	// Check for balanced brackets
	let bracketDepth = 0;
	let braceDepth = 0;
	for (const char of trimmed) {
		if (char === "[") bracketDepth++;
		if (char === "]") bracketDepth--;
		if (char === "{") braceDepth++;
		if (char === "}") braceDepth--;
		if (bracketDepth < 0 || braceDepth < 0) return false;
	}

	return bracketDepth === 0 && braceDepth === 0;
}

/**
 * Validate and sanitize a glob pattern.
 *
 * @param pattern - Glob pattern to validate
 * @returns Validation result with trimmed pattern
 *
 * @example
 * ```typescript
 * validateGlob("*.ts")
 * // => { valid: true, value: "*.ts" }
 *
 * validateGlob("  *.ts  ")
 * // => { valid: true, value: "*.ts" }
 *
 * validateGlob("*.ts; rm -rf /")
 * // => { valid: false, error: "Invalid glob pattern: ..." }
 * ```
 */
export function validateGlob(pattern: string): ValidationResult {
	if (!isValidGlob(pattern)) {
		return {
			valid: false,
			error: `Invalid glob pattern: ${pattern}. Use patterns like "*.py", "**/*.ts", or "src/**/*.js"`,
		};
	}

	return { valid: true, value: pattern.trim() };
}

// ============================================================================
// Shell Safety Validation (Defense-in-Depth)
// ============================================================================

/**
 * Shell metacharacters that could enable command injection.
 * Used for defense-in-depth validation even with array-based spawn.
 *
 * Characters: ; & | < > ` $ \
 *
 * While modern spawn APIs use array-based arguments (not shell strings),
 * validating against these provides an additional security layer.
 */
export const SHELL_METACHARACTERS = /[;&|<>`$\\]/;

/**
 * Validate that a pattern doesn't contain dangerous shell metacharacters.
 * Provides defense-in-depth security even when using array-based spawn
 * (which doesn't use shell interpretation).
 *
 * @param pattern - CLI argument or pattern to validate
 * @throws Error if pattern contains shell metacharacters
 *
 * @example
 * ```typescript
 * validateShellSafePattern("test.ts")         // ✅ OK
 * validateShellSafePattern("src/glob/*.ts")   // ✅ OK
 * validateShellSafePattern("; rm -rf /")      // ❌ Error
 * validateShellSafePattern("$(whoami)")       // ❌ Error
 * validateShellSafePattern("`cat /etc/pwd`")  // ❌ Error
 * ```
 */
export function validateShellSafePattern(pattern: string): void {
	if (SHELL_METACHARACTERS.test(pattern)) {
		throw new Error(`Pattern contains shell metacharacters: ${pattern}`);
	}
}

// ============================================================================
// Regex Validation (ReDoS Prevention)
// ============================================================================

/**
 * Patterns known to cause catastrophic backtracking (ReDoS).
 * These are simplified heuristics - not exhaustive.
 */
const REDOS_PATTERNS = [
	// Nested quantifiers: (a+)+, (a*)*
	/\([^)]*[+*][^)]*\)[+*]/,
	// Overlapping alternation with quantifiers: (a|a)+
	/\(([^|)]+)\|\1\)[+*]/,
	// Long repeating groups: (.+.+)+
	/\(\.[+*]\.[+*]\)[+*]/,
];

/**
 * Default maximum pattern length (500 chars).
 * Patterns longer than this are considered risky.
 */
const DEFAULT_MAX_PATTERN_LENGTH = 500;

/**
 * Maximum allowed consecutive quantifiers (2).
 * Patterns with more than this are considered risky.
 */
const MAX_QUANTIFIER_NESTING = 2;

/**
 * Check if a regex pattern is potentially vulnerable to ReDoS.
 *
 * Performs heuristic checks for:
 * - Nested quantifiers: `(a+)+`
 * - Overlapping alternation: `(a|a)+`
 * - Excessive quantifier nesting: `++`, `**`
 * - Very long patterns (> 500 chars)
 *
 * @param pattern - Regex pattern string
 * @param maxLength - Maximum allowed pattern length (default: 500)
 * @returns True if pattern appears safe
 *
 * @example
 * ```typescript
 * isRegexSafe("hello.*world") // => true
 * isRegexSafe("(a+)+") // => false (nested quantifiers)
 * isRegexSafe("(a|a)+") // => false (overlapping alternation)
 * isRegexSafe("a".repeat(600)) // => false (too long)
 * ```
 */
export function isRegexSafe(
	pattern: string,
	maxLength = DEFAULT_MAX_PATTERN_LENGTH,
): boolean {
	// Check for known dangerous patterns
	for (const dangerous of REDOS_PATTERNS) {
		if (dangerous.test(pattern)) {
			return false;
		}
	}

	// Check for excessive quantifier nesting
	const quantifierNesting = (pattern.match(/[+*?]{2,}/g) || []).length;
	if (quantifierNesting > MAX_QUANTIFIER_NESTING) {
		return false;
	}

	// Check pattern length (very long patterns can be problematic)
	if (pattern.length > maxLength) {
		return false;
	}

	return true;
}

/**
 * Validate a regex pattern for search operations.
 *
 * Checks for:
 * - Empty patterns
 * - ReDoS vulnerabilities
 * - Valid regex syntax
 *
 * @param pattern - Regex pattern to validate
 * @returns Validation result with compiled RegExp
 *
 * @example
 * ```typescript
 * validateRegex("function\\s+\\w+")
 * // => { valid: true, value: /function\s+\w+/ }
 *
 * validateRegex("(a+)+")
 * // => { valid: false, error: "Pattern may cause performance issues..." }
 *
 * validateRegex("[unclosed")
 * // => { valid: false, error: "Invalid regex: ..." }
 * ```
 */
export function validateRegex(pattern: string): ValidationResult<RegExp> {
	// Empty check
	if (!pattern || pattern.trim() === "") {
		return { valid: false, error: "Search pattern cannot be empty" };
	}

	// ReDoS safety check
	if (!isRegexSafe(pattern)) {
		return {
			valid: false,
			error:
				"Pattern may cause performance issues. Simplify nested quantifiers.",
		};
	}

	// Try to compile the regex (trim first)
	const trimmed = pattern.trim();
	try {
		const compiled = new RegExp(trimmed);
		return { valid: true, value: compiled };
	} catch (e) {
		const message = e instanceof Error ? e.message : "Unknown error";
		return { valid: false, error: `Invalid regex: ${message}` };
	}
}
