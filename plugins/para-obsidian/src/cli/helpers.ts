/**
 * CLI helper functions.
 *
 * Extracted to separate file to avoid side effects when importing for testing.
 *
 * @module cli-helpers
 */

import { parseArgOverrides as coreParseArgOverrides } from "@side-quest/core/cli";

/**
 * Parse --arg flags into key=value overrides.
 *
 * Splits each arg on '=' to extract key-value pairs for overriding
 * LLM-suggested field values.
 *
 * @param argFlags - Array of arg flag values in "key=value" format
 * @returns Record of key-value pairs
 * @deprecated Use parseArgOverrides from @sidequest/core/cli instead
 *
 * @example
 * ```typescript
 * parseArgOverrides(["area=[[Work]]", "status=active"])
 * // Returns: { area: "[[Work]]", status: "active" }
 * ```
 */
export function parseArgOverrides(argFlags: string[]): Record<string, string> {
	return coreParseArgOverrides(argFlags);
}
