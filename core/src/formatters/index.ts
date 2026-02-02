/**
 * Formatters module - Output formatting utilities
 *
 * This module re-exports from terminal for backward compatibility
 * and provides additional formatting utilities.
 *
 * @deprecated Terminal utilities - Import from "@sidequest/core/terminal" instead
 *
 * @example
 * ```ts
 * // Preferred (new code - terminal utilities):
 * import { OutputFormat, parseOutputFormat, emphasize, color } from "@sidequest/core/terminal";
 *
 * // Legacy (still works):
 * import { OutputFormat, parseOutputFormat, emphasize, color } from "@sidequest/core/formatters";
 *
 * // New formatter utilities:
 * import { formatBytes, getLanguageForExtension } from "@sidequest/core/formatters";
 * ```
 */

// Re-export from terminal for backward compatibility
export {
	blue,
	bold,
	// Color utilities
	color,
	cyan,
	dim,
	emphasize,
	// Semantic messages
	error,
	gray,
	green,
	info,
	magenta,
	OutputFormat,
	parseOutputFormat,
	red,
	success,
	warning,
	yellow,
} from "../terminal/index.ts";

// Export new formatter utilities
export { formatBytes } from "./bytes.ts";
export { formatCurrency, parsePrice } from "./currency.ts";
export { getLanguageForExtension } from "./syntax.ts";
export { dedupeConsecutiveLines } from "./text.ts";
export {
	formatDateWithSpaces,
	formatDuration,
	formatFilenameTime,
	formatTime12Hour,
} from "./time.ts";

// Legacy colors object for existing code that uses colors.red, colors.green, etc.
// This provides the raw ANSI codes that were previously exported
export const colors = {
	reset: "\x1b[0m",
	dim: "\x1b[2m",
	cyan: "\x1b[36m",
	blue: "\x1b[34m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	red: "\x1b[31m",
	magenta: "\x1b[35m",
};
