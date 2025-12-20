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
 */
export const bookmarkEnrichmentStrategy: EnrichmentStrategy = {
	id: "bookmark",
	name: "Bookmark Enricher",
	priority: 100, // High priority - check bookmarks first

	canEnrich(ctx: EnrichmentContext): EnrichmentEligibility {
		const { frontmatter, file } = ctx;

		// Must be a bookmark type
		if (frontmatter.type !== "bookmark") {
			return { eligible: false, reason: "Not a bookmark (type !== bookmark)" };
		}

		// Must have a URL
		if (typeof frontmatter.url !== "string" || !frontmatter.url) {
			if (log) {
				log.debug`Bookmark eligibility: no URL file=${file.filename}`;
			}
			return { eligible: false, reason: "No URL in frontmatter" };
		}

		// Skip if already enriched (unless force option is used)
		if (frontmatter.enrichedAt) {
			if (log) {
				log.debug`Bookmark eligibility: already enriched file=${file.filename} enrichedAt=${frontmatter.enrichedAt}`;
			}
			return {
				eligible: false,
				reason: "Already enriched (use force to re-enrich)",
			};
		}

		if (log) {
			log.debug`Bookmark eligibility: eligible file=${file.filename} url=${frontmatter.url}`;
		}
		return { eligible: true };
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
