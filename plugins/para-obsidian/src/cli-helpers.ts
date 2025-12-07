/**
 * CLI helper functions.
 *
 * Extracted to separate file to avoid side effects when importing for testing.
 *
 * @module cli-helpers
 */

/**
 * Parse --arg flags into key=value overrides.
 *
 * Splits each arg on '=' to extract key-value pairs for overriding
 * LLM-suggested field values.
 *
 * @param argFlags - Array of arg flag values in "key=value" format
 * @returns Record of key-value pairs
 *
 * @example
 * ```typescript
 * parseArgOverrides(["area=[[Work]]", "status=active"])
 * // Returns: { area: "[[Work]]", status: "active" }
 * ```
 */
export function parseArgOverrides(argFlags: string[]): Record<string, string> {
	const overrides: Record<string, string> = {};
	for (const arg of argFlags) {
		const eqIndex = arg.indexOf("=");
		if (eqIndex === -1) continue; // Skip malformed args
		const key = arg.slice(0, eqIndex).trim();
		const value = arg.slice(eqIndex + 1).trim();
		if (key && value) {
			overrides[key] = value;
		}
	}
	return overrides;
}
