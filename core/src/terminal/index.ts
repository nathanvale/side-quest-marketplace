/**
 * Terminal module - CLI output formatting using Bun's native APIs
 *
 * Provides utilities for colorful, well-formatted terminal output:
 * - ANSI color formatting with Bun.color()
 * - String width calculation for alignment
 * - ASCII table formatting
 * - Pretty-printing objects
 * - Progress indicators
 *
 * @example
 * ```ts
 * import { color, bold, dim, table, stripAnsi } from "@sidequest/core/terminal";
 *
 * // Colorful output
 * console.log(color("red", "Error:"), "Something went wrong");
 * console.log(bold("Important"), dim("(optional)"));
 *
 * // Tables
 * console.log(table([
 *   { name: "Alice", age: 30 },
 *   { name: "Bob", age: 25 }
 * ]));
 * ```
 */

// ============================================================================
// Color formatting
// ============================================================================

/** Color input types supported by Bun.color */
export type ColorInput =
	| string
	| number
	| { r: number; g: number; b: number; a?: number }
	| [number, number, number]
	| [number, number, number, number];

/** ANSI color depth options */
export type AnsiColorDepth = "ansi" | "ansi-16" | "ansi-256" | "ansi-16m";

/**
 * Format a color as ANSI escape code for terminal output
 *
 * Accepts CSS color names, hex, RGB, HSL, and more.
 * Auto-detects terminal color depth support.
 *
 * @param input - Color value (name, hex, rgb, etc.)
 * @param text - Text to colorize (optional)
 * @returns ANSI escape code or colorized text
 *
 * @example
 * ```ts
 * // Just get the escape code
 * const redCode = color("red");
 * console.log(redCode + "Red text" + RESET);
 *
 * // Colorize text directly
 * console.log(color("red", "Error message"));
 * console.log(color("#ff6600", "Warning"));
 * console.log(color("rgb(0, 255, 0)", "Success"));
 * ```
 */
export function color(input: ColorInput, text?: string): string {
	const ansi = Bun.color(input, "ansi");
	if (!ansi) return text ?? "";

	if (text !== undefined) {
		return `${ansi}${text}${RESET}`;
	}
	return ansi;
}

/**
 * Format a color as ANSI background color
 *
 * @param input - Color value
 * @param text - Text to apply background to (optional)
 * @returns ANSI escape code for background
 */
export function bgColor(input: ColorInput, text?: string): string {
	const rgba = Bun.color(input, "{rgba}");
	if (!rgba) return text ?? "";

	// Background colors use 48 instead of 38
	const bg = `\x1b[48;2;${rgba.r};${rgba.g};${rgba.b}m`;

	if (text !== undefined) {
		return `${bg}${text}${RESET}`;
	}
	return bg;
}

/** ANSI reset code */
export const RESET = "\x1b[0m";

/** ANSI style codes */
export const BOLD = "\x1b[1m";
export const DIM = "\x1b[2m";
export const ITALIC = "\x1b[3m";
export const UNDERLINE = "\x1b[4m";
export const BLINK = "\x1b[5m";
export const INVERSE = "\x1b[7m";
export const HIDDEN = "\x1b[8m";
export const STRIKETHROUGH = "\x1b[9m";

/**
 * Apply bold style to text
 */
export function bold(text: string): string {
	return `${BOLD}${text}${RESET}`;
}

/**
 * Apply dim style to text
 */
export function dim(text: string): string {
	return `${DIM}${text}${RESET}`;
}

/**
 * Apply italic style to text
 */
export function italic(text: string): string {
	return `${ITALIC}${text}${RESET}`;
}

/**
 * Apply underline style to text
 */
export function underline(text: string): string {
	return `${UNDERLINE}${text}${RESET}`;
}

/**
 * Apply strikethrough style to text
 */
export function strikethrough(text: string): string {
	return `${STRIKETHROUGH}${text}${RESET}`;
}

/**
 * Apply inverse (swap foreground/background) style
 */
export function inverse(text: string): string {
	return `${INVERSE}${text}${RESET}`;
}

// ============================================================================
// Common semantic colors
// ============================================================================

/**
 * Red text for errors
 */
export function red(text: string): string {
	return color("red", text);
}

/**
 * Green text for success
 */
export function green(text: string): string {
	return color("green", text);
}

/**
 * Yellow text for warnings
 */
export function yellow(text: string): string {
	return color("yellow", text);
}

/**
 * Blue text for info
 */
export function blue(text: string): string {
	return color("blue", text);
}

/**
 * Magenta text
 */
export function magenta(text: string): string {
	return color("magenta", text);
}

/**
 * Cyan text
 */
export function cyan(text: string): string {
	return color("cyan", text);
}

/**
 * Gray text for secondary content
 */
export function gray(text: string): string {
	return color("gray", text);
}

// ============================================================================
// Semantic output helpers
// ============================================================================

/**
 * Format an error message
 */
export function error(message: string): string {
	return `${color("red", "✖")} ${message}`;
}

/**
 * Format a success message
 */
export function success(message: string): string {
	return `${color("green", "✔")} ${message}`;
}

/**
 * Format a warning message
 */
export function warning(message: string): string {
	return `${color("yellow", "⚠")} ${message}`;
}

/**
 * Format an info message
 */
export function info(message: string): string {
	return `${color("blue", "ℹ")} ${message}`;
}

/**
 * Format a debug message
 */
export function debug(message: string): string {
	return `${dim("⬢")} ${dim(message)}`;
}

// ============================================================================
// String utilities
// ============================================================================

/**
 * Strip ANSI escape codes from a string
 *
 * Uses Bun's native stripANSI (6-57x faster than npm strip-ansi).
 *
 * @param text - Text with potential ANSI codes
 * @returns Plain text without ANSI codes
 *
 * @example
 * ```ts
 * stripAnsi("\x1b[31mRed\x1b[0m"); // "Red"
 * ```
 */
export function stripAnsi(text: string): string {
	return Bun.stripANSI(text);
}

/**
 * Get the display width of a string in terminal columns
 *
 * Handles ANSI codes, emoji, and wide characters correctly.
 * Uses Bun's native stringWidth (6756x faster than npm string-width).
 *
 * @param text - Text to measure
 * @param options - Options for width calculation
 * @returns Number of terminal columns
 *
 * @example
 * ```ts
 * stringWidth("hello"); // 5
 * stringWidth("\x1b[31mhello\x1b[0m"); // 5 (ANSI ignored)
 * stringWidth("你好"); // 4 (wide characters)
 * stringWidth("👋"); // 2 (emoji)
 * ```
 */
export function stringWidth(
	text: string,
	options?: {
		/** Count ANSI codes as width (default: false) */
		countAnsiEscapeCodes?: boolean;
		/** Treat ambiguous width chars as narrow (default: true) */
		ambiguousIsNarrow?: boolean;
	},
): number {
	return Bun.stringWidth(text, options);
}

/**
 * Pad a string to a specific width (considering display width)
 *
 * @param text - Text to pad
 * @param width - Target width in columns
 * @param align - Alignment: "left", "right", "center"
 * @param char - Padding character (default: space)
 * @returns Padded string
 */
export function pad(
	text: string,
	width: number,
	align: "left" | "right" | "center" = "left",
	char = " ",
): string {
	const currentWidth = stringWidth(text);
	if (currentWidth >= width) return text;

	const padding = width - currentWidth;

	switch (align) {
		case "right":
			return char.repeat(padding) + text;
		case "center": {
			const left = Math.floor(padding / 2);
			const right = padding - left;
			return char.repeat(left) + text + char.repeat(right);
		}
		default:
			return text + char.repeat(padding);
	}
}

/**
 * Truncate a string to a maximum width (considering display width)
 *
 * @param text - Text to truncate
 * @param maxWidth - Maximum width in columns
 * @param suffix - Suffix to add when truncated (default: "…")
 * @returns Truncated string
 */
export function truncate(text: string, maxWidth: number, suffix = "…"): string {
	const textWidth = stringWidth(text);
	if (textWidth <= maxWidth) return text;

	const suffixWidth = stringWidth(suffix);
	const targetWidth = maxWidth - suffixWidth;

	// Build string character by character
	let result = "";
	let width = 0;

	for (const char of text) {
		const charWidth = stringWidth(char);
		if (width + charWidth > targetWidth) break;
		result += char;
		width += charWidth;
	}

	return result + suffix;
}

// ============================================================================
// Pretty printing
// ============================================================================

/**
 * Pretty-print an object (like console.log formatting)
 *
 * Uses Bun.inspect for consistent formatting.
 *
 * @param value - Value to inspect
 * @param options - Inspection options
 * @returns Formatted string
 *
 * @example
 * ```ts
 * inspect({ a: 1, b: [2, 3] });
 * // '{ a: 1, b: [ 2, 3 ] }'
 *
 * inspect(value, { colors: true, depth: 5 });
 * ```
 */
export function inspect(
	value: unknown,
	options?: {
		/** Enable ANSI colors */
		colors?: boolean;
		/** Max depth to recurse */
		depth?: number;
		/** Sort object keys */
		sorted?: boolean;
	},
): string {
	return Bun.inspect(value, options);
}

/**
 * Format data as an ASCII table
 *
 * Uses Bun.inspect.table for native table formatting.
 *
 * @param data - Array of objects to display
 * @param columns - Optional array of column names to include
 * @param options - Table options
 * @returns Formatted table string
 *
 * @example
 * ```ts
 * table([
 *   { name: "Alice", age: 30, city: "NYC" },
 *   { name: "Bob", age: 25, city: "LA" }
 * ]);
 * // ┌───┬───────┬─────┬──────┐
 * // │   │ name  │ age │ city │
 * // ├───┼───────┼─────┼──────┤
 * // │ 0 │ Alice │  30 │ NYC  │
 * // │ 1 │ Bob   │  25 │ LA   │
 * // └───┴───────┴─────┴──────┘
 *
 * table(data, ["name", "age"]); // Only show specific columns
 * table(data, { colors: true }); // With ANSI colors
 * ```
 */
export function table(
	data: unknown[],
	columnsOrOptions?: string[] | { colors?: boolean },
	options?: { colors?: boolean },
): string {
	if (Array.isArray(columnsOrOptions)) {
		return Bun.inspect.table(data, columnsOrOptions, options);
	}
	return Bun.inspect.table(data, columnsOrOptions);
}

// ============================================================================
// Progress indicators
// ============================================================================

/**
 * Create a simple progress bar string
 *
 * @param current - Current value
 * @param total - Total value
 * @param width - Bar width in characters (default: 40)
 * @returns Progress bar string
 *
 * @example
 * ```ts
 * progressBar(30, 100);
 * // "████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 30%"
 * ```
 */
export function progressBar(
	current: number,
	total: number,
	width = 40,
): string {
	const percent = Math.min(100, Math.max(0, (current / total) * 100));
	const filled = Math.round((percent / 100) * width);
	const empty = width - filled;

	const bar = "█".repeat(filled) + "░".repeat(empty);
	const percentStr = `${Math.round(percent)}%`.padStart(4);

	return `${bar} ${percentStr}`;
}

/**
 * Spinner frames for loading animations
 */
export const SPINNER_FRAMES = [
	"⠋",
	"⠙",
	"⠹",
	"⠸",
	"⠼",
	"⠴",
	"⠦",
	"⠧",
	"⠇",
	"⠏",
];

/**
 * Get a spinner frame for the current time
 *
 * @param intervalMs - How often to change frame (default: 80ms)
 * @returns Current spinner character
 */
export function spinner(intervalMs = 80): string {
	const index = Math.floor(Date.now() / intervalMs) % SPINNER_FRAMES.length;
	return SPINNER_FRAMES[index] ?? SPINNER_FRAMES[0] ?? "⠋";
}

// ============================================================================
// Box drawing
// ============================================================================

/** Box drawing characters */
export const BOX = {
	topLeft: "┌",
	topRight: "┐",
	bottomLeft: "└",
	bottomRight: "┘",
	horizontal: "─",
	vertical: "│",
	teeRight: "├",
	teeLeft: "┤",
	teeDown: "┬",
	teeUp: "┴",
	cross: "┼",
} as const;

/**
 * Draw a box around text
 *
 * @param text - Text to box (can be multiline)
 * @param options - Box options
 * @returns Boxed text string
 *
 * @example
 * ```ts
 * box("Hello, World!");
 * // ┌───────────────┐
 * // │ Hello, World! │
 * // └───────────────┘
 *
 * box("Title\nContent", { title: "My Box" });
 * ```
 */
export function box(
	text: string,
	options?: {
		/** Padding inside box */
		padding?: number;
		/** Box title */
		title?: string;
		/** Border color */
		borderColor?: ColorInput;
	},
): string {
	const { padding = 1, title, borderColor } = options ?? {};
	const lines = text.split("\n");
	const paddingStr = " ".repeat(padding);

	// Calculate max width
	let maxWidth = 0;
	for (const line of lines) {
		const width = stringWidth(line);
		if (width > maxWidth) maxWidth = width;
	}
	if (title) {
		const titleWidth = stringWidth(title) + 2; // " title "
		if (titleWidth > maxWidth) maxWidth = titleWidth;
	}

	const innerWidth = maxWidth + padding * 2;
	const bc = borderColor ? color(borderColor) : "";
	const reset = borderColor ? RESET : "";

	// Build box
	const result: string[] = [];

	// Top border with optional title
	if (title) {
		const titlePart = ` ${title} `;
		const remaining = innerWidth - stringWidth(titlePart);
		const left = Math.floor(remaining / 2);
		const right = remaining - left;
		result.push(
			`${bc}${BOX.topLeft}${BOX.horizontal.repeat(left)}${reset}${titlePart}${bc}${BOX.horizontal.repeat(right)}${BOX.topRight}${reset}`,
		);
	} else {
		result.push(
			`${bc}${BOX.topLeft}${BOX.horizontal.repeat(innerWidth)}${BOX.topRight}${reset}`,
		);
	}

	// Content lines
	for (const line of lines) {
		const lineWidth = stringWidth(line);
		const rightPad = maxWidth - lineWidth;
		result.push(
			`${bc}${BOX.vertical}${reset}${paddingStr}${line}${" ".repeat(rightPad)}${paddingStr}${bc}${BOX.vertical}${reset}`,
		);
	}

	// Bottom border
	result.push(
		`${bc}${BOX.bottomLeft}${BOX.horizontal.repeat(innerWidth)}${BOX.bottomRight}${reset}`,
	);

	return result.join("\n");
}

// ============================================================================
// Terminal detection
// ============================================================================

/**
 * Check if stdout supports colors
 */
export function supportsColor(): boolean {
	// Check NO_COLOR env var (https://no-color.org/)
	if (process.env.NO_COLOR !== undefined) return false;

	// Check FORCE_COLOR env var
	if (process.env.FORCE_COLOR !== undefined) return true;

	// Check if stdout is a TTY
	return process.stdout.isTTY ?? false;
}

/**
 * Check if stdout is a TTY (interactive terminal)
 */
export function isTTY(): boolean {
	return process.stdout.isTTY ?? false;
}

/**
 * Get terminal width
 */
export function terminalWidth(): number {
	return process.stdout.columns ?? 80;
}

/**
 * Get terminal height
 */
export function terminalHeight(): number {
	return process.stdout.rows ?? 24;
}

// ============================================================================
// Entry point detection
// ============================================================================

/**
 * Check if current script is the entry point (not imported)
 *
 * Uses Bun.main to detect if script is run directly.
 *
 * @param importMetaPath - Pass import.meta.path
 * @returns True if script is entry point
 *
 * @example
 * ```ts
 * if (isMainScript(import.meta.path)) {
 *   main();
 * }
 * ```
 */
export function isMainScript(importMetaPath: string): boolean {
	return importMetaPath === Bun.main;
}

// ============================================================================
// Output format utilities (merged from formatters module)
// ============================================================================

/**
 * Output format for CLI commands
 *
 * Supports dual output modes:
 * - Markdown: Human-readable, optimized for Claude parsing (default)
 * - JSON: Machine-readable, for programmatic consumption
 */
export enum OutputFormat {
	MARKDOWN = "markdown",
	JSON = "json",
}

/**
 * Parse output format from CLI flag
 *
 * @param flag - Output format flag value
 * @returns Parsed OutputFormat enum value
 *
 * @example
 * ```ts
 * parseOutputFormat("json");     // OutputFormat.JSON
 * parseOutputFormat("markdown"); // OutputFormat.MARKDOWN
 * parseOutputFormat("md");       // OutputFormat.MARKDOWN
 * parseOutputFormat();           // OutputFormat.MARKDOWN (default)
 * ```
 */
export function parseOutputFormat(flag?: string): OutputFormat {
	if (flag === "json") return OutputFormat.JSON;
	if (flag === "md" || flag === "markdown") return OutputFormat.MARKDOWN;
	return OutputFormat.MARKDOWN;
}

/**
 * Semantic text emphasis helpers
 *
 * Simple color wrappers for common semantic meanings.
 *
 * @example
 * ```ts
 * console.log(emphasize.success("Done!"));
 * console.log(emphasize.error("Failed!"));
 * console.log(emphasize.warn("Careful!"));
 * ```
 */
export const emphasize = {
	success: (text: string) => green(text),
	info: (text: string) => cyan(text),
	warn: (text: string) => yellow(text),
	error: (text: string) => red(text),
	dim: (text: string) => dim(text),
};
