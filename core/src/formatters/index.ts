/**
 * Formatters module - Output formatting utilities
 *
 * This module re-exports from terminal for backward compatibility.
 * New code should import directly from "@sidequest/core/terminal".
 *
 * @deprecated Import from "@sidequest/core/terminal" instead
 *
 * @example
 * ```ts
 * // Preferred (new code):
 * import { OutputFormat, parseOutputFormat, emphasize, color } from "@sidequest/core/terminal";
 *
 * // Legacy (still works):
 * import { OutputFormat, parseOutputFormat, emphasize, color } from "@sidequest/core/formatters";
 * ```
 */

// Re-export from terminal for backward compatibility
export {
	OutputFormat,
	parseOutputFormat,
	emphasize,
	// Color utilities
	color,
	red,
	green,
	yellow,
	blue,
	cyan,
	magenta,
	gray,
	dim,
	bold,
	// Semantic messages
	error,
	success,
	warning,
	info,
} from "../terminal/index.js";

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
