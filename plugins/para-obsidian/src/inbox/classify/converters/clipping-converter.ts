/**
 * Clipping to Bookmark Converter
 *
 * Converts Obsidian Web Clipper notes (type: clipping) to bookmark format
 * with optional Firecrawl enrichment for page summaries.
 *
 * @module converters/clipping-converter
 */

import type { VaultContext } from "../../core/vault/context";

// Simple logger - logs to console for debugging
const logger = {
	info: (msg: string, meta?: Record<string, unknown>) =>
		console.log(`[clipping-converter] INFO: ${msg}`, meta ?? ""),
	warn: (msg: string, meta?: Record<string, unknown>) =>
		console.warn(`[clipping-converter] WARN: ${msg}`, meta ?? ""),
	debug: (msg: string, meta?: Record<string, unknown>) =>
		process.env.DEBUG &&
		console.log(`[clipping-converter] DEBUG: ${msg}`, meta ?? ""),
};

/**
 * Result of clipping to bookmark conversion.
 */
export interface ClippingConversionResult {
	/** Conversion success status */
	readonly success: boolean;
	/** Page title */
	readonly title: string;
	/** Page summary from Firecrawl (if available) */
	readonly summary?: string;
	/** Suggested area based on URL/content analysis */
	readonly suggestedArea?: string;
	/** Suggested project based on URL/content analysis */
	readonly suggestedProject?: string;
	/** Error message if conversion failed */
	readonly error?: string;
	/** Whether Firecrawl enrichment was attempted */
	readonly firecrawlAttempted: boolean;
	/** Specific error type for logging/debugging */
	readonly errorType?:
		| "api-key-missing"
		| "network"
		| "auth"
		| "rate-limit"
		| "timeout"
		| "other";
}

/**
 * Convert Web Clipper note (type: clipping) to bookmark format.
 *
 * Enriches bookmark with URL summary via Firecrawl API if available.
 * Gracefully degrades if API key not configured or request fails.
 *
 * @param frontmatter - Extracted frontmatter from clipping note
 * @param content - Note content (may contain page excerpt)
 * @param vaultContext - Vault areas/projects for routing suggestions
 * @returns Conversion result with enriched bookmark data
 *
 * @example
 * ```typescript
 * const result = await convertClippingToBookmark(
 *   { url: "https://example.com", title: "Example Page", type: "clipping" },
 *   "Page excerpt...",
 *   vaultContext
 * );
 *
 * if (result.success && result.summary) {
 *   console.log("Enriched with summary:", result.summary);
 * }
 * ```
 */
export async function convertClippingToBookmark(
	frontmatter: Record<string, unknown>,
	content: string,
	vaultContext: VaultContext,
): Promise<ClippingConversionResult> {
	const url = frontmatter.url as string | undefined;
	const title =
		(frontmatter.title as string | undefined) ?? "Untitled Bookmark";

	// Validate URL presence
	if (!url) {
		return {
			success: false,
			title,
			error: "URL required for bookmark conversion",
			firecrawlAttempted: false,
		};
	}

	// Check API key at conversion time (early validation)
	const apiKey = process.env.FIRECRAWL_API_KEY;
	let summary: string | undefined;
	let firecrawlAttempted = false;
	let errorType: ClippingConversionResult["errorType"];

	// Attempt Firecrawl enrichment if API key available
	if (apiKey) {
		firecrawlAttempted = true;
		try {
			// Dynamic import to avoid dependency errors when @sidequest/firecrawl not installed
			const { createFirecrawlClient } = await import(
				"@sidequest/firecrawl/client"
			);

			const client = createFirecrawlClient({ apiKey });

			// Scrape with timeout (30s) to prevent hanging
			const timeoutPromise = new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error("Firecrawl timeout")), 30000),
			);

			const scrapePromise = client.scrape({
				url,
				formats: ["markdown"],
			});

			const result = await Promise.race([scrapePromise, timeoutPromise]);

			// Check if result is successful
			if (result.success && result.data?.markdown) {
				// Smart truncation: break at sentence boundaries when possible
				const rawSummary = result.data.markdown;
				summary = smartTruncate(rawSummary, 2000);

				logger.info("Firecrawl enrichment succeeded", {
					url,
					summaryLength: summary.length,
				});
			} else if ("error" in result) {
				// Log specific error type for debugging
				const errorMsg = result.error ?? "Unknown error";
				errorType = categorizeError(errorMsg);
				logger.warn("Firecrawl enrichment failed", {
					url,
					error: errorMsg,
					errorType,
				});
			}
		} catch (error) {
			// Handle timeout and network errors
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			errorType = categorizeError(errorMessage);

			logger.warn("Firecrawl enrichment error", {
				url,
				error: errorMessage,
				errorType,
			});
		}
	} else {
		logger.debug("Firecrawl API key not configured, skipping enrichment", {
			url,
		});
		errorType = "api-key-missing";
	}

	// Suggest routing based on URL patterns and content
	const { suggestedArea, suggestedProject } = suggestRouting(
		url,
		summary ?? content,
		vaultContext,
	);

	return {
		success: true,
		title,
		summary,
		suggestedArea,
		suggestedProject,
		firecrawlAttempted,
		errorType,
	};
}

/**
 * Smart truncation that preserves sentence boundaries.
 *
 * Attempts to break at last sentence boundary before limit.
 * Falls back to hard truncation if no sentence boundary found.
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum character length
 * @returns Truncated text with ellipsis if needed
 */
function smartTruncate(text: string, maxLength: number): string {
	if (text.length <= maxLength) {
		return text;
	}

	// Find last sentence boundary before limit
	const truncated = text.slice(0, maxLength);
	const sentenceEndings = [". ", "! ", "? ", ".\n", "!\n", "?\n"];

	let lastSentenceEnd = -1;
	for (const ending of sentenceEndings) {
		const index = truncated.lastIndexOf(ending);
		if (index > lastSentenceEnd) {
			lastSentenceEnd = index + 1; // Include the period/exclamation/question mark
		}
	}

	// If we found a sentence boundary in the last 20% of allowed length, use it
	if (lastSentenceEnd > maxLength * 0.8) {
		return truncated.slice(0, lastSentenceEnd).trim();
	}

	// Otherwise, hard truncate and add ellipsis
	return `${truncated.trim()}...`;
}

/**
 * Categorize error for specific logging and debugging.
 *
 * @param error - Error message or string
 * @returns Error category
 */
function categorizeError(error: string): ClippingConversionResult["errorType"] {
	const lowerError = error.toLowerCase();

	if (lowerError.includes("timeout") || lowerError.includes("timed out")) {
		return "timeout";
	}
	if (lowerError.includes("429") || lowerError.includes("rate limit")) {
		return "rate-limit";
	}
	if (
		lowerError.includes("401") ||
		lowerError.includes("403") ||
		lowerError.includes("unauthorized")
	) {
		return "auth";
	}
	if (
		lowerError.includes("network") ||
		lowerError.includes("fetch") ||
		lowerError.includes("enotfound")
	) {
		return "network";
	}

	return "other";
}

/**
 * Suggest PARA routing (area/project) based on URL patterns and content.
 *
 * Uses heuristic rules to match common URL patterns to vault structure.
 *
 * @param url - Page URL
 * @param content - Page summary or excerpt
 * @param vaultContext - Available areas and projects
 * @returns Routing suggestion
 */
function suggestRouting(
	url: string,
	content: string,
	vaultContext: VaultContext,
): { suggestedArea?: string; suggestedProject?: string } {
	const lowerUrl = url.toLowerCase();
	const lowerContent = content.toLowerCase();

	// URL pattern matching (in priority order)
	const areaPatterns: Record<string, RegExp[]> = {
		Finance: [/bank|finance|tax|invoice|receipt|payment/i],
		Health: [/health|medical|doctor|hospital|fitness|nutrition/i],
		Development: [/github\.com|stackoverflow|docs\.|developer\./i],
		Learning: [/course|tutorial|learn|education|udemy|coursera/i],
		Shopping: [/amazon|shop|store|buy|purchase/i],
	};

	// Check URL patterns first
	for (const [areaName, patterns] of Object.entries(areaPatterns)) {
		for (const pattern of patterns) {
			if (pattern.test(lowerUrl) || pattern.test(lowerContent)) {
				// Only suggest if area exists in vault
				const matchingArea = vaultContext.areas.find(
					(a) => a.toLowerCase() === areaName.toLowerCase(),
				);
				if (matchingArea) {
					return { suggestedArea: matchingArea };
				}
			}
		}
	}

	// No specific pattern matched
	return {};
}
