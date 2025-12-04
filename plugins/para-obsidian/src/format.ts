/**
 * CLI output formatting utilities.
 *
 * Provides ANSI color codes and formatting helpers for
 * consistent, readable CLI output.
 *
 * @module format
 */

/** ANSI escape codes for terminal colors and styles. */
const codes = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	cyan: "\x1b[36m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	gray: "\x1b[90m",
};

/** Wraps text with ANSI color code and reset. */
function wrap(color: string, text: string): string {
	return `${color}${text}${codes.reset}`;
}

/**
 * Formatting helpers for CLI output.
 *
 * @example
 * ```typescript
 * console.log(fmt.heading('Configuration'));
 * console.log(fmt.success('✓ File created'));
 * console.log(fmt.warn('Warning: uncommitted changes'));
 * console.log(fmt.dim('(dry-run mode)'));
 * ```
 */
export const fmt = {
	/** Cyan bold text for section headings. */
	heading: (text: string) => wrap(codes.cyan + codes.bold, text),
	/** Green text for success messages. */
	success: (text: string) => wrap(codes.green, text),
	/** Yellow text for warnings. */
	warn: (text: string) => wrap(codes.yellow, text),
	/** Gray text for secondary information. */
	dim: (text: string) => wrap(codes.gray, text),
	/** Bold text for emphasis. */
	bold: (text: string) => wrap(codes.bold, text),
};
