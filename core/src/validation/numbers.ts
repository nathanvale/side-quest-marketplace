/**
 * Numeric validation utilities for bounded ranges.
 *
 * Provides validation for numeric values with specific constraints,
 * ensuring integers where needed and enforcing valid ranges.
 *
 * @module validation/numbers
 */

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
