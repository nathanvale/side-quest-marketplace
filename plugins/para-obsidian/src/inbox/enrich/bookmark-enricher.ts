/**
 * Bookmark Enricher
 *
 * Enriches bookmark metadata using Firecrawl to scrape the original page
 * and LLM to improve titles and generate summaries.
 *
 * Features:
 * - Exponential backoff with jitter for transient failures
 * - Rate limiting between requests
 * - Graceful error handling with user-friendly messages
 *
 * @module inbox/enrich/bookmark-enricher
 */

import { observe } from "../../shared/instrumentation";
import { enrichLogger } from "../../shared/logger";
import {
	type BookmarkEnrichment,
	BookmarkEnrichmentError,
	type EnrichmentOptions,
} from "./types";

const log = enrichLogger;

// Default configuration
const DEFAULT_TIMEOUT = 30000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;

/**
 * Extracts domain from a URL.
 * @param url - Full URL
 * @returns Domain (e.g., "github.com")
 */
export function extractDomain(url: string): string {
	try {
		const parsed = new URL(url);
		return parsed.hostname.replace(/^www\./, "");
	} catch {
		return "unknown";
	}
}

/**
 * Validates a URL is well-formed and has http/https protocol.
 * @param url - URL to validate
 * @returns True if valid
 */
export function isValidUrl(url: string): boolean {
	try {
		const parsed = new URL(url);
		return parsed.protocol === "http:" || parsed.protocol === "https:";
	} catch {
		return false;
	}
}

/**
 * Sleep with exponential backoff and jitter.
 * @param attempt - Current attempt number (0-based)
 * @param baseDelay - Base delay in ms
 * @returns Promise that resolves after delay
 */
async function sleepWithBackoff(
	attempt: number,
	baseDelay: number,
): Promise<void> {
	// Exponential backoff: baseDelay * 2^attempt
	const exponentialDelay = baseDelay * 2 ** attempt;
	// Add jitter: +/- 25%
	const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
	const delay = Math.min(exponentialDelay + jitter, MAX_DELAY_MS);

	await new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Creates the LLM prompt for improving bookmark title and summary.
 * @param pageContent - Scraped page content (markdown)
 * @param originalTitle - Original title from frontmatter
 * @param url - Original URL
 * @returns Prompt string
 */
function buildImprovementPrompt(
	pageContent: string,
	originalTitle: string,
	url: string,
): string {
	// Truncate content to avoid token limits - use less to leave room for response
	const truncatedContent = pageContent.slice(0, 4000);

	// Extract domain for context
	let domain = "unknown";
	try {
		domain = new URL(url).hostname.replace(/^www\./, "");
	} catch {
		// Keep default
	}

	return `Improve this bookmark's metadata. You must respond ONLY with the exact format shown below.

URL: ${url}
DOMAIN: ${domain}
ORIGINAL TITLE: ${originalTitle}

PAGE CONTENT (excerpt):
${truncatedContent}

INSTRUCTIONS:
1. Write a clear, descriptive title (max 60 chars) that explains what the page is about
2. Write a 2-4 sentence summary (200-400 chars) that captures the key value of this page - what will you find here and why is it useful?

RESPOND EXACTLY LIKE THIS (nothing else, no explanations):
TITLE: Your Improved Title Here
SUMMARY: Your detailed summary here.

EXAMPLE RESPONSE:
TITLE: Tool Use Guide for Claude AI
SUMMARY: Comprehensive guide to extending Claude's capabilities with external tools and function calling. Covers defining tool schemas, handling tool use responses, chaining multiple tools, and best practices for building reliable agentic systems.`;
}

/**
 * Parses the LLM response to extract improved title and summary.
 * Handles various response formats since different LLMs may format differently.
 *
 * @param response - Raw LLM response
 * @returns Parsed title and summary
 */
function parseImprovementResponse(response: string): {
	title: string;
	summary: string;
} {
	// Normalize the response - remove markdown code blocks if present
	let normalized = response.trim();
	if (normalized.startsWith("```")) {
		normalized = normalized.replace(/```[\s\S]*?\n/, "").replace(/```$/, "");
	}

	// Title is on a single line after TITLE:
	const titleMatch = normalized.match(/TITLE:\s*(.+?)(?:\n|$)/i);

	// Summary can span multiple lines - capture everything after SUMMARY:
	// until end of string (since summary is the last field)
	const summaryMatch = normalized.match(/SUMMARY:\s*([\s\S]+)$/i);

	const title = titleMatch?.[1]?.trim() || "";
	// Clean up summary: normalize whitespace and trim
	const rawSummary = summaryMatch?.[1]?.trim() || "";
	const summary = rawSummary.replace(/\s+/g, " ").trim();

	return { title, summary };
}

/**
 * Extracts a clean summary from raw page content when LLM parsing fails.
 * Removes navigation elements, markdown links, and other noise.
 *
 * @param content - Raw page content from Firecrawl
 * @returns Clean summary (first 200 chars of main content)
 */
function extractFallbackSummary(content: string): string {
	// Remove common navigation/header patterns
	const cleaned = content
		// Remove markdown links but keep text
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		// Remove navigation patterns
		.replace(/skip to (main )?content/gi, "")
		.replace(/sign(ed)? (in|out|up)/gi, "")
		.replace(/reload|refresh/gi, "")
		// Remove multiple newlines and whitespace
		.replace(/\n{2,}/g, " ")
		.replace(/\s+/g, " ")
		.trim();

	// Find first substantial sentence (at least 30 chars)
	const sentences = cleaned.split(/[.!?]+/).filter((s) => s.trim().length > 30);
	if (sentences.length > 0) {
		const firstSentence = sentences[0]!.trim();
		return firstSentence.slice(0, 200);
	}

	// Last resort: just take first 200 chars
	return cleaned.slice(0, 200);
}

/**
 * Enriches a bookmark URL with Firecrawl and LLM.
 *
 * This function:
 * 1. Validates the URL
 * 2. Scrapes the page with Firecrawl (with retries)
 * 3. Calls LLM to improve title and generate summary
 * 4. Returns structured enrichment data
 *
 * @param url - Bookmark URL to enrich
 * @param originalTitle - Original title from frontmatter
 * @param options - Enrichment options
 * @returns Promise resolving to enrichment data
 * @throws BookmarkEnrichmentError on failure
 *
 * @example
 * ```typescript
 * const enrichment = await enrichBookmarkWithFirecrawl(
 *   "https://example.com/article",
 *   "Some Article",
 *   { maxRetries: 3 }
 * );
 * console.log(enrichment.formattedTitle); // "Bookmark Example Article Title"
 * ```
 */
export async function enrichBookmarkWithFirecrawl(
	url: string,
	originalTitle: string,
	options: EnrichmentOptions,
): Promise<BookmarkEnrichment> {
	const {
		timeout = DEFAULT_TIMEOUT,
		maxRetries = DEFAULT_MAX_RETRIES,
		baseDelayMs = DEFAULT_BASE_DELAY_MS,
		llmModel,
		cid,
		sessionCid,
		parentCid,
	} = options;

	return await observe(
		log,
		"enrich:bookmark",
		async () => {
			// Validate URL
			if (!url || typeof url !== "string") {
				throw new BookmarkEnrichmentError(
					"Bookmark URL is missing or invalid",
					"INVALID_URL",
					url || "",
					false,
				);
			}

			if (!isValidUrl(url)) {
				throw new BookmarkEnrichmentError(
					`Invalid URL format: ${url}`,
					"INVALID_URL",
					url,
					false,
				);
			}

			// Check for Firecrawl API key early
			if (!process.env.FIRECRAWL_API_KEY) {
				throw new BookmarkEnrichmentError(
					"FIRECRAWL_API_KEY environment variable is not set. Please set it to use bookmark enrichment.",
					"API_KEY_MISSING",
					url,
					false,
				);
			}

			// Import Firecrawl client dynamically to avoid circular dependencies
			// and allow the plugin to function without firecrawl installed
			let firecrawlClient: Awaited<
				ReturnType<
					typeof import("@sidequest/firecrawl/client").createFirecrawlClient
				>
			>;
			try {
				const { createFirecrawlClient } = await import(
					"@sidequest/firecrawl/client"
				);
				firecrawlClient = createFirecrawlClient({ timeout });
			} catch {
				throw new BookmarkEnrichmentError(
					"Firecrawl client not available. Ensure @sidequest/firecrawl is installed.",
					"FIRECRAWL_UNAVAILABLE",
					url,
					false,
				);
			}

			// Scrape with retries - wrapped in nested observe()
			const pageContent = await observe(
				log,
				"enrich:firecrawlScrape",
				async () => {
					let content: string | null = null;
					let lastError: Error | null = null;

					for (let attempt = 0; attempt <= maxRetries; attempt++) {
						if (log) {
							log.info`Firecrawl starting url=${url} attempt=${attempt + 1}/${maxRetries + 1}`;
						}
						try {
							const result = await firecrawlClient.scrape({
								url,
								formats: ["markdown"],
								onlyMainContent: true,
							});

							// Check for Firecrawl error response
							if ("success" in result && result.success === false) {
								const errorResult = result as {
									error?: string;
									statusCode?: number;
								};
								const statusCode = errorResult.statusCode;

								// Rate limited - retryable
								if (statusCode === 429) {
									if (attempt < maxRetries) {
										if (log) {
											log.warn`Firecrawl rate limited url=${url} retrying...`;
										}
										await sleepWithBackoff(attempt, baseDelayMs);
										continue;
									}
									throw new BookmarkEnrichmentError(
										"Firecrawl rate limit exceeded. Please try again later.",
										"FIRECRAWL_RATE_LIMITED",
										url,
										true,
										60000, // Suggest 1 minute wait
									);
								}

								// Not found - not retryable
								if (statusCode === 404) {
									throw new BookmarkEnrichmentError(
										`Page not found: ${url}`,
										"FIRECRAWL_NOT_FOUND",
										url,
										false,
									);
								}

								// Server error - retryable
								if (statusCode && statusCode >= 500) {
									if (attempt < maxRetries) {
										if (log) {
											log.warn`Firecrawl server error url=${url} statusCode=${statusCode} retrying...`;
										}
										await sleepWithBackoff(attempt, baseDelayMs);
										continue;
									}
									throw new BookmarkEnrichmentError(
										`Firecrawl server error (${statusCode}). Please try again later.`,
										"FIRECRAWL_ERROR",
										url,
										true,
									);
								}

								// Check for blocked message
								const errorMessage = errorResult.error || "";
								if (
									errorMessage.toLowerCase().includes("blocked") ||
									errorMessage.toLowerCase().includes("forbidden")
								) {
									throw new BookmarkEnrichmentError(
										`Site blocks scraping: ${url}`,
										"FIRECRAWL_BLOCKED",
										url,
										false,
									);
								}

								// Generic error
								throw new BookmarkEnrichmentError(
									errorResult.error || "Firecrawl request failed",
									"FIRECRAWL_ERROR",
									url,
									attempt < maxRetries,
								);
							}

							// Success - extract content
							const successResult = result as { data?: { markdown?: string } };
							content = successResult.data?.markdown || null;

							if (!content || content.trim().length < 50) {
								if (log) {
									log.warn`Firecrawl returned no usable content url=${url} contentLength=${content?.length ?? 0}`;
								}
								throw new BookmarkEnrichmentError(
									"Page returned no usable content",
									"NO_CONTENT",
									url,
									false,
								);
							}

							if (log) {
								log.debug`Firecrawl success url=${url} contentLength=${content.length}`;
							}
							// Success - break retry loop
							break;
						} catch (error) {
							// If it's already our error type, re-throw (unless retryable)
							if (error instanceof BookmarkEnrichmentError) {
								if (!error.retryable || attempt >= maxRetries) {
									throw error;
								}
								lastError = error;
								await sleepWithBackoff(attempt, baseDelayMs);
								continue;
							}

							// Network/timeout errors - retryable
							const errorMessage =
								error instanceof Error ? error.message : String(error);
							if (
								errorMessage.includes("ETIMEDOUT") ||
								errorMessage.includes("timeout") ||
								errorMessage.includes("ECONNREFUSED") ||
								errorMessage.includes("ENOTFOUND")
							) {
								if (attempt < maxRetries) {
									if (log) {
										log.warn`Firecrawl network error url=${url} error=${errorMessage} retrying...`;
									}
									lastError = error as Error;
									await sleepWithBackoff(attempt, baseDelayMs);
									continue;
								}
								throw new BookmarkEnrichmentError(
									"Firecrawl request timed out. Please try again later.",
									"FIRECRAWL_TIMEOUT",
									url,
									true,
								);
							}

							// Unknown error
							lastError = error as Error;
							if (attempt >= maxRetries) {
								throw new BookmarkEnrichmentError(
									`Firecrawl error: ${errorMessage}`,
									"FIRECRAWL_ERROR",
									url,
									false,
								);
							}
							await sleepWithBackoff(attempt, baseDelayMs);
						}
					}

					// Should have content at this point
					if (!content) {
						throw new BookmarkEnrichmentError(
							lastError?.message ||
								"Failed to fetch page content after retries",
							"FIRECRAWL_ERROR",
							url,
							true,
						);
					}

					return content;
				},
				{ parentCid: cid, context: { url, sessionCid } },
			);

			// Call LLM to improve title and summary - wrapped in nested observe()
			const { improvedTitle, summary } = await observe(
				log,
				"enrich:improveTitleAndSummary",
				async () => {
					const modelToUse = llmModel || "haiku";
					if (log) {
						log.info`LLM improvement starting model=${modelToUse} url=${url}`;
					}

					try {
						const { callLLM } = await import("../core/llm");
						const prompt = buildImprovementPrompt(
							pageContent,
							originalTitle,
							url,
						);
						const response = await callLLM(prompt, modelToUse, llmModel, {
							sessionCid,
						});

						const parsed = parseImprovementResponse(response);
						const title = parsed.title || originalTitle;
						// Use clean fallback summary if LLM parsing failed
						const summaryText =
							parsed.summary || extractFallbackSummary(pageContent);

						if (log) {
							const usedFallback = !parsed.title || !parsed.summary;
							log.debug`LLM response parsed title="${title.slice(0, 40)}..." summaryLength=${summaryText.length} usedFallback=${usedFallback}`;
						}

						return { improvedTitle: title, summary: summaryText };
					} catch (error) {
						// LLM failure - use fallback
						const errorMessage =
							error instanceof Error ? error.message : String(error);
						if (log) {
							log.error`LLM improvement failed url=${url} error=${errorMessage}`;
						}
						throw new BookmarkEnrichmentError(
							`LLM improvement failed: ${errorMessage}`,
							"LLM_FAILED",
							url,
							true,
						);
					}
				},
				{ parentCid: cid, context: { url, sessionCid } },
			);

			// Build enrichment result
			const domain = extractDomain(url);
			const formattedTitle = `Bookmark ${improvedTitle}`;

			return {
				originalTitle,
				improvedTitle,
				formattedTitle,
				summary,
				domain,
				enrichedAt: new Date().toISOString(),
			};
		},
		{ parentCid, context: { url, sessionCid } },
	);
}
