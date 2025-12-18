/**
 * Enrichment Types
 *
 * Types for the enrichment pipeline with Strategy Pattern.
 * Enrichment occurs BEFORE classification to enhance content for better
 * LLM classification and destination suggestions.
 *
 * Pipeline: Scan → Enrich → Classify → Suggest → Review → Execute
 *
 * @module inbox/enrich/types
 */

import type { InboxFile } from "../scan/extractors";

/**
 * Result of enriching a bookmark with Firecrawl.
 * Contains improved title, summary, and metadata from the scraped page.
 */
export interface BookmarkEnrichment {
	/** Original title from frontmatter (preserved for reference) */
	readonly originalTitle: string;

	/** LLM-improved, descriptive title */
	readonly improvedTitle: string;

	/** Formatted title: "Bookmark <improvedTitle>" */
	readonly formattedTitle: string;

	/** Page summary generated from scraped content */
	readonly summary: string;

	/** Domain extracted from URL (e.g., "github.com") */
	readonly domain: string;

	/** ISO timestamp of when enrichment was performed */
	readonly enrichedAt: string;

	/** True if this was a cache hit (already enriched) */
	readonly fromCache?: boolean;
}

/**
 * Options for bookmark enrichment.
 */
export interface EnrichmentOptions {
	/** Timeout in milliseconds for Firecrawl request (default: 30000) */
	readonly timeout?: number;

	/** Maximum retries on transient failures (default: 3) */
	readonly maxRetries?: number;

	/** Base delay in ms for exponential backoff (default: 1000) */
	readonly baseDelayMs?: number;

	/** Force re-enrichment even if already enriched (default: false) */
	readonly force?: boolean;

	/** LLM model to use for title/summary improvement */
	readonly llmModel?: string;
}

/**
 * Error thrown when bookmark enrichment fails.
 * Contains details about the failure for user-friendly messaging.
 */
export class BookmarkEnrichmentError extends Error {
	/** Error code for categorization */
	readonly code: EnrichmentErrorCode;

	/** Original URL that failed to enrich */
	readonly url: string;

	/** Whether this is a retryable error */
	readonly retryable: boolean;

	/** Suggested wait time before retry (if retryable) */
	readonly retryAfterMs?: number;

	constructor(
		message: string,
		code: EnrichmentErrorCode,
		url: string,
		retryable = false,
		retryAfterMs?: number,
	) {
		super(message);
		this.name = "BookmarkEnrichmentError";
		this.code = code;
		this.url = url;
		this.retryable = retryable;
		this.retryAfterMs = retryAfterMs;
	}
}

/**
 * Error codes for bookmark enrichment failures.
 */
export type EnrichmentErrorCode =
	| "FIRECRAWL_UNAVAILABLE" // Service unreachable
	| "FIRECRAWL_RATE_LIMITED" // 429 Too Many Requests
	| "FIRECRAWL_TIMEOUT" // Request timed out
	| "FIRECRAWL_BLOCKED" // Site blocks scraping
	| "FIRECRAWL_NOT_FOUND" // URL returns 404
	| "FIRECRAWL_ERROR" // Generic Firecrawl error
	| "LLM_FAILED" // LLM improvement failed
	| "INVALID_URL" // URL is malformed or missing
	| "NO_CONTENT" // Page returned no usable content
	| "API_KEY_MISSING"; // FIRECRAWL_API_KEY not set

/**
 * Progress callback for batch enrichment operations.
 */
export interface EnrichmentProgress {
	/** Current file being processed (1-based) */
	readonly current: number;

	/** Total files to process */
	readonly total: number;

	/** Filename being processed */
	readonly filename: string;

	/** Status of current file */
	readonly status: "processing" | "success" | "skipped" | "failed";

	/** Error message if status is "failed" */
	readonly error?: string;

	/** Enrichment result if status is "success" */
	readonly enrichment?: BookmarkEnrichment;
}

/**
 * Options for batch enrichment operations.
 */
export interface BatchEnrichmentOptions extends EnrichmentOptions {
	/** Delay between requests in ms (default: 2000) */
	readonly delayBetweenRequestsMs?: number;

	/** Progress callback */
	readonly onProgress?: (progress: EnrichmentProgress) => void | Promise<void>;

	/** Only process files with type:bookmark (default: true) */
	readonly filterByType?: boolean;

	/** Dry run - show what would be done without making changes */
	readonly dryRun?: boolean;
}

/**
 * Result of a batch enrichment operation.
 */
export interface BatchEnrichmentResult {
	/** Number of files successfully enriched */
	readonly succeeded: number;

	/** Number of files that failed */
	readonly failed: number;

	/** Number of files skipped (not bookmarks, already enriched, etc.) */
	readonly skipped: number;

	/** Total files processed */
	readonly total: number;

	/** Details for each file */
	readonly details: ReadonlyArray<{
		readonly path: string;
		readonly status: "success" | "failed" | "skipped";
		readonly reason?: string;
		readonly enrichment?: BookmarkEnrichment;
	}>;
}

// =============================================================================
// Strategy Pattern Types
// =============================================================================

/**
 * Context passed to enrichment strategies.
 */
export interface EnrichmentContext {
	/** The inbox file being processed */
	readonly file: InboxFile;
	/** Parsed frontmatter from the file */
	readonly frontmatter: Record<string, unknown>;
	/** File body content (without frontmatter) */
	readonly body: string;
	/** Vault path for context */
	readonly vaultPath: string;
}

/**
 * Result from an enrichment strategy's canEnrich check.
 */
export interface EnrichmentEligibility {
	/** Whether this strategy can enrich the file */
	readonly eligible: boolean;
	/** Reason if not eligible */
	readonly reason?: string;
}

/**
 * Generic enrichment result - union of all enrichment types.
 * Extensible for future enrichment strategies (PDFs, images, etc.)
 */
export type EnrichmentResult =
	| { readonly type: "bookmark"; readonly data: BookmarkEnrichment }
	| { readonly type: "none"; readonly reason: string };

/**
 * Enrichment strategy interface - Strategy Pattern.
 *
 * Each strategy handles enrichment for a specific content type.
 * Strategies are checked in priority order until one matches.
 *
 * @example
 * ```typescript
 * const bookmarkStrategy: EnrichmentStrategy = {
 *   id: "bookmark",
 *   name: "Bookmark Enricher",
 *   priority: 100,
 *   canEnrich: (ctx) => ({
 *     eligible: ctx.frontmatter.type === "bookmark" && !!ctx.frontmatter.url,
 *   }),
 *   enrich: async (ctx, options) => {
 *     const result = await enrichBookmarkWithFirecrawl(ctx.frontmatter.url, ...);
 *     return { type: "bookmark", data: result };
 *   },
 * };
 * ```
 */
export interface EnrichmentStrategy {
	/** Unique identifier for the strategy */
	readonly id: string;

	/** Human-readable name */
	readonly name: string;

	/** Priority (higher = checked first, 100 = bookmark, 50 = default) */
	readonly priority: number;

	/**
	 * Check if this strategy can enrich the given file.
	 * Should be fast - only check frontmatter/metadata.
	 */
	canEnrich(ctx: EnrichmentContext): EnrichmentEligibility;

	/**
	 * Perform the enrichment operation.
	 * Returns enrichment data - caller handles file updates.
	 *
	 * @throws BookmarkEnrichmentError on failure
	 */
	enrich(
		ctx: EnrichmentContext,
		options?: EnrichmentOptions,
	): Promise<EnrichmentResult>;
}

// =============================================================================
// Pipeline Types
// =============================================================================

/**
 * Result from processing a file through the enrichment pipeline.
 */
export interface EnrichmentPipelineResult {
	/** The file that was processed */
	readonly file: InboxFile;
	/** Updated frontmatter (may include enrichment fields) */
	readonly frontmatter: Record<string, unknown>;
	/** Whether enrichment was performed */
	readonly enriched: boolean;
	/** Which strategy was used (if any) */
	readonly strategyId?: string;
	/** Enrichment data (if performed) */
	readonly result?: EnrichmentResult;
	/** Error if enrichment failed */
	readonly error?: BookmarkEnrichmentError;
}

/**
 * Enrichment pipeline configuration.
 */
export interface EnrichmentPipelineConfig {
	/** Strategies to use (sorted by priority internally) */
	readonly strategies: readonly EnrichmentStrategy[];
	/** Default options for all strategies */
	readonly defaultOptions?: EnrichmentOptions;
	/** Vault path */
	readonly vaultPath: string;
}
