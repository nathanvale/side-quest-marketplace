/**
 * Markdown template renderers for CLI output
 *
 * Provides pre-formatted markdown output to reduce LLM token usage.
 * Use --format markdown flag in CLI to enable.
 */

/**
 * Output format enum for CLI flag parsing
 */
export enum OutputFormat {
	JSON = "json",
	MARKDOWN = "markdown",
}

/**
 * Parses --format flag value to OutputFormat
 *
 * @param value - Raw flag value from CLI (e.g., "markdown", "md", "json")
 * @returns OutputFormat (defaults to JSON for backwards compatibility)
 *
 * @example
 * ```typescript
 * parseOutputFormat("markdown") // OutputFormat.MARKDOWN
 * parseOutputFormat("md")       // OutputFormat.MARKDOWN
 * parseOutputFormat("json")     // OutputFormat.JSON
 * parseOutputFormat(undefined)  // OutputFormat.JSON (default)
 * ```
 */
export function parseOutputFormat(value?: string): OutputFormat {
	if (value?.toLowerCase() === "markdown" || value?.toLowerCase() === "md") {
		return OutputFormat.MARKDOWN;
	}
	return OutputFormat.JSON;
}

export { renderMovieDetailsMarkdown } from "./movie-details.ts";
// Re-export all template renderers
export { renderMoviesMarkdown } from "./movies.ts";
export { renderPricingMarkdown } from "./pricing.ts";
export { renderSeatsMarkdown } from "./seats.ts";
export { renderSendConfirmationMarkdown } from "./send-confirmation.ts";
export { renderSessionMarkdown } from "./session.ts";
