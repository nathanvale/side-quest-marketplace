/**
 * Output format utilities for CLI commands
 *
 * Supports dual output modes:
 * - Markdown: Human-readable, optimized for Claude parsing (default)
 * - JSON: Machine-readable, for programmatic consumption
 */

/**
 * Output format enum
 */
export enum OutputFormat {
	MARKDOWN = "markdown",
	JSON = "json",
}

/**
 * Parse output format flag
 *
 * @param flag - Format flag value (e.g., "json", "md", "markdown")
 * @returns Output format enum value
 *
 * @example
 * ```typescript
 * parseOutputFormat("json");     // OutputFormat.JSON
 * parseOutputFormat("md");       // OutputFormat.MARKDOWN
 * parseOutputFormat("markdown"); // OutputFormat.MARKDOWN
 * parseOutputFormat(undefined);  // OutputFormat.MARKDOWN (default)
 * ```
 */
export function parseOutputFormat(flag?: string): OutputFormat {
	if (flag === "json") return OutputFormat.JSON;
	if (flag === "md" || flag === "markdown") return OutputFormat.MARKDOWN;
	return OutputFormat.MARKDOWN; // Default for human readability
}

/**
 * ANSI color codes for terminal output (used in markdown mode)
 */
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

/**
 * Apply color to text (only for markdown/terminal output)
 *
 * @param colorName - Color name from colors object
 * @param text - Text to colorize
 * @returns Colorized text with ANSI codes
 */
export function color(colorName: keyof typeof colors, text: string): string {
	return `${colors[colorName]}${text}${colors.reset}`;
}
