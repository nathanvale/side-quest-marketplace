/**
 * Currency formatting and parsing utilities
 *
 * Provides simple AUD currency formatting and price parsing.
 * Currently supports Australian dollar format only.
 *
 * @example
 * ```ts
 * import { formatCurrency, parsePrice } from "@sidequest/core/formatters";
 *
 * formatCurrency(42.50); // "$42.50"
 * formatCurrency(100);   // "$100.00"
 *
 * parsePrice("$27.00");    // 27
 * parsePrice("$1,000.50"); // 1000.5
 * parsePrice("27");        // 27
 * ```
 */

/**
 * Formats a number as Australian currency
 *
 * Converts a numeric amount to a string with dollar sign and 2 decimal places.
 * Uses simple formatting - does not add thousands separators.
 *
 * @param amount - Amount to format (in dollars)
 * @returns Formatted currency string with dollar sign
 *
 * @example
 * ```ts
 * formatCurrency(0);       // "$0.00"
 * formatCurrency(0.1);     // "$0.10"
 * formatCurrency(42.50);   // "$42.50"
 * formatCurrency(100);     // "$100.00"
 * formatCurrency(1000000); // "$1000000.00"
 * formatCurrency(-50);     // "$-50.00"
 * ```
 */
export function formatCurrency(amount: number): string {
	return `$${amount.toFixed(2)}`;
}

/**
 * Parses a price string to a number
 *
 * Handles various price string formats by removing dollar signs,
 * commas, and whitespace before parsing.
 *
 * Supported formats:
 * - "$27.00" → 27
 * - "$27" → 27
 * - "27.00" → 27
 * - "27" → 27
 * - "$1,000.50" → 1000.5
 * - "$ 27.00" → 27 (whitespace removed)
 *
 * @param priceText - Price string to parse
 * @returns Parsed numeric value
 * @throws {Error} If the input cannot be parsed as a number
 *
 * @example
 * ```ts
 * parsePrice("$27.00");    // 27
 * parsePrice("$27");       // 27
 * parsePrice("27.00");     // 27
 * parsePrice("27");        // 27
 * parsePrice("$1,000.50"); // 1000.5
 * parsePrice("$ 27.00");   // 27
 *
 * // Throws errors:
 * parsePrice("");          // Error: Invalid price format
 * parsePrice("abc");       // Error: Invalid price format
 * ```
 */
export function parsePrice(priceText: string): number {
	// Remove $, commas, and whitespace
	const cleaned = priceText.replace(/[$,\s]/g, "");

	// Parse to number
	const price = Number.parseFloat(cleaned);

	// Validate result
	if (Number.isNaN(price)) {
		throw new Error(`Invalid price format: "${priceText}"`);
	}

	return price;
}
