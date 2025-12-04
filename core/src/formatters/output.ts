/**
 * Output format utilities for CLI commands
 *
 * Supports dual output modes:
 * - Markdown: Human-readable, optimized for Claude parsing (default)
 * - JSON: Machine-readable, for programmatic consumption
 */

export enum OutputFormat {
	MARKDOWN = "markdown",
	JSON = "json",
}

export function parseOutputFormat(flag?: string): OutputFormat {
	if (flag === "json") return OutputFormat.JSON;
	if (flag === "md" || flag === "markdown") return OutputFormat.MARKDOWN;
	return OutputFormat.MARKDOWN;
}

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

export function color(colorName: keyof typeof colors, text: string): string {
	return `${colors[colorName]}${text}${colors.reset}`;
}

export const emphasize = {
	success: (text: string) => color("green", text),
	info: (text: string) => color("cyan", text),
	warn: (text: string) => color("yellow", text),
	error: (text: string) => color("red", text),
	dim: (text: string) => color("dim", text),
};
