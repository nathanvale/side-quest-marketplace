/**
 * Markdown template renderers for CLI output
 *
 * Provides pre-formatted markdown output to reduce LLM token usage.
 * Use --format markdown flag in CLI to enable.
 */

// Re-export all template renderers
export { renderMovieDetailsMarkdown } from "./movie-details.ts";
export { renderMoviesMarkdown } from "./movies.ts";
export { renderPricingMarkdown } from "./pricing.ts";
export { renderSeatsMarkdown } from "./seats.ts";
export { renderSendConfirmationMarkdown } from "./send-confirmation.ts";
export { renderSessionMarkdown } from "./session.ts";
