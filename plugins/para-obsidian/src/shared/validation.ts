/**
 * Input validation and sanitization utilities
 *
 * Prevents path traversal, injection attacks, and validates user inputs
 * according to expected formats and constraints.
 *
 * @module shared/validation
 */

import { basename, normalize } from "node:path";

/**
 * Validate classifier ID (kebab-case, no path traversal)
 *
 * @param id - Classifier ID to validate
 * @returns Sanitized classifier ID
 * @throws Error if ID is invalid
 *
 * @example
 * ```ts
 * const id = validateClassifierId('medical-bill'); // OK
 * validateClassifierId('medical_bill'); // throws - must be kebab-case
 * validateClassifierId('../secrets'); // throws - path traversal
 * ```
 */
export function validateClassifierId(id: string): string {
	// Prevent path traversal - check before normalization
	if (id.includes("..") || id.includes("/") || id.includes("\\")) {
		throw new Error(`Path traversal not allowed in classifier ID: ${id}`);
	}

	const clean = basename(normalize(id));

	// Prevent reserved names (check before kebab-case validation)
	const reserved = ["index", "types", "defaults", "_template"];
	if (reserved.includes(clean)) {
		throw new Error(`Reserved classifier ID: ${clean}`);
	}

	// Validate kebab-case
	if (!/^[a-z][a-z0-9-]*$/.test(clean)) {
		throw new Error(`Invalid classifier ID: must be kebab-case (got: ${id})`);
	}

	return clean;
}

/**
 * Validate priority value (0-100 integer)
 *
 * @param priority - Priority value to validate
 * @returns Validated priority
 * @throws Error if priority is out of range or not an integer
 *
 * @example
 * ```ts
 * const p = validatePriority(75); // OK
 * validatePriority(150); // throws - out of range
 * validatePriority(75.5); // throws - not an integer
 * ```
 */
export function validatePriority(priority: number): number {
	if (!Number.isInteger(priority) || priority < 0 || priority > 100) {
		throw new Error(`Priority must be 0-100 (got: ${priority})`);
	}
	return priority;
}

/**
 * Validate field name (camelCase, no special chars)
 *
 * @param name - Field name to validate
 * @returns Validated field name
 * @throws Error if name is invalid
 *
 * @example
 * ```ts
 * const name = validateFieldName('dateOfService'); // OK
 * validateFieldName('date-of-service'); // throws - must be camelCase
 * validateFieldName('date of service'); // throws - no spaces
 * ```
 */
export function validateFieldName(name: string): string {
	// Must start with lowercase letter, then letters/numbers only
	if (!/^[a-z][a-zA-Z0-9]*$/.test(name)) {
		throw new Error(`Invalid field name: must be camelCase (got: ${name})`);
	}
	return name;
}

/**
 * Validate template name (kebab-case, no path traversal)
 *
 * @param name - Template name to validate
 * @returns Sanitized template name
 * @throws Error if name is invalid
 *
 * @example
 * ```ts
 * const name = validateTemplateName('medical-bill'); // OK
 * validateTemplateName('../secrets'); // throws - path traversal
 * ```
 */
export function validateTemplateName(name: string): string {
	// Prevent path traversal - check before normalization
	if (name.includes("..") || name.includes("/") || name.includes("\\")) {
		throw new Error(`Path traversal not allowed in template name: ${name}`);
	}

	const clean = basename(normalize(name));

	// Validate kebab-case
	if (!/^[a-z][a-z0-9-]*$/.test(clean)) {
		throw new Error(`Invalid template name: must be kebab-case (got: ${name})`);
	}

	return clean;
}

/**
 * Sanitize pattern string (prevent ReDoS)
 *
 * Removes dangerous regex patterns that could cause exponential backtracking.
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
	// Remove potentially dangerous patterns
	let clean = pattern;

	// Remove nested quantifiers (e.g., (a+)+, (a*)*) - ReDoS risk
	clean = clean.replace(/\([^)]*[+*][^)]*\)[+*]/g, "");

	// Limit pattern length to prevent resource exhaustion
	if (clean.length > 500) {
		clean = clean.substring(0, 500);
	}

	return clean;
}

/**
 * Validate file path (no path traversal, within bounds)
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
	const normalized = normalize(inputPath);

	// Prevent absolute paths
	if (normalized.startsWith("/")) {
		throw new Error(`Path must be relative (got: ${inputPath})`);
	}

	// Prevent path traversal
	if (normalized.includes("..")) {
		throw new Error(`Path traversal not allowed (got: ${inputPath})`);
	}

	// Prevent hidden files (common security risk)
	const parts = normalized.split("/");
	for (const part of parts) {
		if (part.startsWith(".")) {
			throw new Error(`Hidden files not allowed (got: ${inputPath})`);
		}
	}

	return normalized;
}

/**
 * Validate PARA area name
 *
 * @param area - Area name to validate
 * @returns Validated area name
 * @throws Error if area is invalid
 *
 * @example
 * ```ts
 * const area = validateAreaName('Health'); // OK
 * validateAreaName(''); // throws - empty
 * validateAreaName('a'.repeat(200)); // throws - too long
 * ```
 */
export function validateAreaName(area: string): string {
	const trimmed = area.trim();

	if (trimmed.length === 0) {
		throw new Error("Area name cannot be empty");
	}

	if (trimmed.length > 100) {
		throw new Error(
			`Area name too long (max 100 chars, got: ${trimmed.length})`,
		);
	}

	// Allow letters, numbers, spaces, hyphens, underscores
	if (!/^[a-zA-Z0-9 _-]+$/.test(trimmed)) {
		throw new Error(`Invalid area name: ${area}`);
	}

	return trimmed;
}

/**
 * Validate display name (human-readable text)
 *
 * @param displayName - Display name to validate
 * @returns Validated display name
 * @throws Error if display name is invalid
 *
 * @example
 * ```ts
 * const name = validateDisplayName('Medical Bill'); // OK
 * validateDisplayName(''); // throws - empty
 * ```
 */
export function validateDisplayName(displayName: string): string {
	const trimmed = displayName.trim();

	if (trimmed.length === 0) {
		throw new Error("Display name cannot be empty");
	}

	if (trimmed.length > 100) {
		throw new Error(
			`Display name too long (max 100 chars, got: ${trimmed.length})`,
		);
	}

	return trimmed;
}

/**
 * Validate weight value (0.0 to 1.0)
 *
 * @param weight - Weight value to validate
 * @returns Validated weight
 * @throws Error if weight is out of range
 *
 * @example
 * ```ts
 * const w = validateWeight(0.75); // OK
 * validateWeight(1.5); // throws - out of range
 * validateWeight(-0.1); // throws - negative
 * ```
 */
export function validateWeight(weight: number): number {
	if (Number.isNaN(weight) || weight < 0 || weight > 1) {
		throw new Error(`Weight must be 0.0 to 1.0 (got: ${weight})`);
	}
	return weight;
}
