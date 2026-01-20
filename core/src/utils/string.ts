/**
 * String utilities
 *
 * Common string manipulation functions for formatting and transformation.
 *
 * @example
 * ```ts
 * import { capitalize } from "@sidequest/core/utils/string";
 *
 * capitalize("hello"); // "Hello"
 * capitalize(""); // ""
 * ```
 */

/**
 * Capitalize the first letter of a string
 *
 * Returns the string with the first character uppercase and the rest unchanged.
 * Returns empty string as-is.
 *
 * @param str - String to capitalize
 * @returns String with first letter capitalized
 *
 * @example
 * ```ts
 * capitalize("hello"); // "Hello"
 * capitalize("HELLO"); // "HELLO"
 * capitalize("h"); // "H"
 * capitalize(""); // ""
 * capitalize("123abc"); // "123abc"
 * ```
 */
export function capitalize(str: string): string {
	if (!str) return str;
	return str.charAt(0).toUpperCase() + str.slice(1);
}
