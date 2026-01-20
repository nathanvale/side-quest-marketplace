/**
 * Numeric validation utilities for bounded ranges.
 *
 * Provides validation for numeric values with specific constraints,
 * ensuring integers where needed and enforcing valid ranges.
 *
 * @module validation/numbers
 */

import type { ValidationResult } from "./patterns.ts";

/**
 * Validate priority value (0-100 integer).
 *
 * Ensures priority is a non-negative integer within the expected range.
 * Commonly used for ranking and ordering operations.
 *
 * @param priority - Priority value to validate
 * @returns Validated priority
 * @throws Error if priority is out of range or not an integer
 *
 * @example
 * ```ts
 * const p = validatePriority(75); // ✅ OK
 * validatePriority(0); // ✅ OK (minimum)
 * validatePriority(100); // ✅ OK (maximum)
 * validatePriority(150); // ❌ Error: out of range
 * validatePriority(75.5); // ❌ Error: not an integer
 * validatePriority(-1); // ❌ Error: negative
 * ```
 */
export function validatePriority(priority: number): number {
	if (!Number.isInteger(priority) || priority < 0 || priority > 100) {
		throw new Error(`Priority must be 0-100 (got: ${priority})`);
	}
	return priority;
}

/**
 * Validate weight value (0.0 to 1.0).
 *
 * Ensures weight is a valid decimal number within the normalized range.
 * Commonly used for scoring, confidence levels, and weighted averages.
 *
 * @param weight - Weight value to validate
 * @returns Validated weight
 * @throws Error if weight is out of range
 *
 * @example
 * ```ts
 * const w = validateWeight(0.75); // ✅ OK
 * validateWeight(0.0); // ✅ OK (minimum)
 * validateWeight(1.0); // ✅ OK (maximum)
 * validateWeight(0.5); // ✅ OK (midpoint)
 * validateWeight(1.5); // ❌ Error: out of range
 * validateWeight(-0.1); // ❌ Error: negative
 * validateWeight(NaN); // ❌ Error: not a number
 * ```
 */
export function validateWeight(weight: number): number {
	if (Number.isNaN(weight) || weight < 0 || weight > 1) {
		throw new Error(`Weight must be 0.0 to 1.0 (got: ${weight})`);
	}
	return weight;
}

/**
 * Options for integer validation.
 */
export interface ValidateIntegerOptions {
	/** Field name for error messages */
	name: string;
	/** Minimum allowed value (default: Number.MIN_SAFE_INTEGER) */
	min?: number;
	/** Maximum allowed value (default: Number.MAX_SAFE_INTEGER) */
	max?: number;
	/** Default value if input is undefined/null */
	defaultValue?: number;
	/** Whether to allow string input that parses to integer (default: true) */
	allowStringInput?: boolean;
}

/**
 * Validate that a value is an integer within optional bounds.
 *
 * Supports string input parsing (e.g., "42" → 42) and default values.
 * More general than validatePriority - works with any integer range including
 * negative numbers.
 *
 * @param value - Value to validate (number, string, or undefined/null)
 * @param options - Validation options (name, bounds, defaults)
 * @returns ValidationResult with validated integer or error
 *
 * @example
 * ```ts
 * // Valid integer
 * validateInteger(42, { name: "count" })
 * // => { valid: true, value: 42 }
 *
 * // String parsing
 * validateInteger("42", { name: "count" })
 * // => { valid: true, value: 42 }
 *
 * // Default value
 * validateInteger(undefined, { name: "count", defaultValue: 10 })
 * // => { valid: true, value: 10 }
 *
 * // Range validation
 * validateInteger(150, { name: "count", min: 1, max: 100 })
 * // => { valid: false, error: "count must be between 1 and 100" }
 *
 * // Non-integer
 * validateInteger(3.14, { name: "count" })
 * // => { valid: false, error: "count must be an integer" }
 *
 * // Negative numbers allowed by default
 * validateInteger(-5, { name: "offset" })
 * // => { valid: true, value: -5 }
 * ```
 */
export function validateInteger(
	value: unknown,
	options: ValidateIntegerOptions,
): ValidationResult<number> {
	const {
		name,
		min = Number.MIN_SAFE_INTEGER,
		max = Number.MAX_SAFE_INTEGER,
		defaultValue,
		allowStringInput = true,
	} = options;

	// Handle undefined/null with default
	if (value === undefined || value === null) {
		if (defaultValue !== undefined) {
			return { valid: true, value: defaultValue };
		}
		return { valid: false, error: `${name} is required` };
	}

	// Convert string to number if allowed
	let num: unknown = value;
	if (allowStringInput && typeof value === "string") {
		num = Number.parseInt(value, 10);
	}

	// Type check
	if (typeof num !== "number" || Number.isNaN(num)) {
		return { valid: false, error: `${name} must be a number` };
	}

	// Integer check
	if (!Number.isInteger(num)) {
		return { valid: false, error: `${name} must be an integer` };
	}

	// Range check
	if (num < min || num > max) {
		return { valid: false, error: `${name} must be between ${min} and ${max}` };
	}

	return { valid: true, value: num };
}
