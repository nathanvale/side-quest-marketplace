/**
 * Bookmark Enrichment Strategy
 *
 * Strategy for enriching bookmark files using Firecrawl scraping and LLM
 * to improve titles and generate summaries.
 *
 * This strategy:
 * 1. Checks if file has type:bookmark and a URL
 * 2. Scrapes the URL with Firecrawl
 * 3. Uses LLM to improve title and generate summary
 * 4. Returns enriched metadata
 *
 * @module inbox/enrich/strategies/bookmark-strategy
 */

import { createCorrelationId, enrichLogger } from "../../../shared/logger";
import { enrichBookmarkWithFirecrawl } from "../bookmark-enricher";
import {
	type BookmarkEnrichment,
	BookmarkEnrichmentError,
	type EnrichmentContext,
	type EnrichmentEligibility,
	type EnrichmentOptions,
	type EnrichmentResult,
	type EnrichmentStrategy,
} from "../types";

const log = enrichLogger;

/**
 * Bookmark enrichment strategy.
 *
 * Handles files with type:bookmark frontmatter that have a URL.
 * Uses Firecrawl to scrape the page and LLM to improve metadata.
 *
 * **DISABLED**: This strategy has been disabled in favor of YouTube enrichment.
 * Set priority to 50 (lower than YouTube's 100) and canEnrich always returns ineligible.
 */
export const bookmarkEnrichmentStrategy: EnrichmentStrategy = {
	id: "bookmark",
	name: "Bookmark Enricher",
	priority: 50, // Lowered from 100 (below YouTube's 100)

	canEnrich(_ctx: EnrichmentContext): EnrichmentEligibility {
		// Always return ineligible - bookmark enrichment is disabled
		return {
			eligible: false,
			reason: "Bookmark enrichment disabled (replaced by YouTube enrichment)",
		};
	},

	async enrich(
		ctx: EnrichmentContext,
		options?: EnrichmentOptions,
	): Promise<EnrichmentResult> {
		const { frontmatter, file } = ctx;
		const url = frontmatter.url as string;
		const originalTitle = (frontmatter.title as string) || file.filename;

		// Generate cid for this enrichment operation
		const cid = options?.cid || createCorrelationId();
		const sessionCid = options?.sessionCid;
		const parentCid = options?.parentCid;

		if (log) {
			log.info`Bookmark enrichment starting sessionCid=${sessionCid} cid=${cid} file=${file.filename} url=${url}`;
		}

		try {
			const enrichment = await enrichBookmarkWithFirecrawl(url, originalTitle, {
				maxRetries: options?.maxRetries ?? 3,
				baseDelayMs: options?.baseDelayMs ?? 1000,
				timeout: options?.timeout,
				llmModel: options?.llmModel,
				cid,
				sessionCid,
				parentCid,
			});

			if (log) {
				log.info`Bookmark enrichment success sessionCid=${sessionCid} cid=${cid} file=${file.filename} title="${enrichment.formattedTitle.slice(0, 50)}..."`;
			}

			return {
				type: "bookmark",
				data: enrichment,
			};
		} catch (error) {
			if (log) {
				const errMsg = error instanceof Error ? error.message : "Unknown error";
				log.error`Bookmark enrichment failed sessionCid=${sessionCid} cid=${cid} file=${file.filename} url=${url} error=${errMsg}`;
			}

			// Re-throw BookmarkEnrichmentError as-is
			if (error instanceof BookmarkEnrichmentError) {
				throw error;
			}

			// Wrap unknown errors
			throw new BookmarkEnrichmentError(
				error instanceof Error ? error.message : "Unknown error",
				"FIRECRAWL_ERROR",
				url,
				false,
			);
		}
	},
};

/**
 * Applies bookmark enrichment data to frontmatter.
 *
 * @param frontmatter - Original frontmatter
 * @param enrichment - Enrichment data from strategy
 * @returns Updated frontmatter with enrichment fields
 */
export function applyBookmarkEnrichment(
	frontmatter: Record<string, unknown>,
	enrichment: BookmarkEnrichment,
): Record<string, unknown> {
	return {
		...frontmatter,
		title: enrichment.formattedTitle,
		improvedTitle: enrichment.improvedTitle,
		originalTitle: enrichment.originalTitle,
		summary: enrichment.summary,
		domain: enrichment.domain,
		enrichedAt: enrichment.enrichedAt,
	};
}
