/**
 * Clipping Classification Strategy
 *
 * Strategy for classifying raw web clippings by type.
 *
 * This strategy:
 * 1. Checks if file has type:clipping and distill_status:raw
 * 2. Classifies clipping type from URL and content patterns
 * 3. Sets clipping_type and distill_status:classified
 * 4. For YouTube: extracts video_id and sets transcript_status:pending
 *
 * Features:
 * - URL pattern matching (fast, high confidence)
 * - Content marker detection (medium confidence)
 * - YouTube video ID extraction from 5 URL formats
 * - Generic fallback for unrecognized patterns
 *
 * @module inbox/enrich/strategies/clipping-strategy
 */

import { enrichLogger } from "../../../shared/logger";
import type {
	ClippingClassificationEnrichment,
	EnrichmentContext,
	EnrichmentEligibility,
	EnrichmentOptions,
	EnrichmentResult,
	EnrichmentStrategy,
} from "../types";
import { classifyClipping, extractYouTubeVideoId } from "./clipping-types";

const log = enrichLogger;

/**
 * Clipping classification strategy.
 *
 * Handles files with type:clipping and distill_status:raw.
 * Classifies the clipping type and prepares for downstream enrichment.
 */
export const clippingClassificationStrategy: EnrichmentStrategy = {
	id: "clipping-classification",
	name: "Clipping Classification",
	priority: 80, // After YouTube (100), before Bookmark (50)

	canEnrich(ctx: EnrichmentContext): EnrichmentEligibility {
		const { frontmatter, file } = ctx;

		// Must be a clipping type
		if (frontmatter.type !== "clipping") {
			return {
				eligible: false,
				reason: `Not a clipping (type: ${frontmatter.type ?? "none"})`,
			};
		}

		// Must have raw distill_status
		if (frontmatter.distill_status !== "raw") {
			if (log) {
				log.debug`Clipping eligibility: not raw file=${file.filename} status=${frontmatter.distill_status}`;
			}
			return {
				eligible: false,
				reason: "Clipping already classified or skipped",
			};
		}

		// Must have URL
		if (!frontmatter.source || typeof frontmatter.source !== "string") {
			if (log) {
				log.debug`Clipping eligibility: no source URL file=${file.filename}`;
			}
			return {
				eligible: false,
				reason: "Missing source URL",
			};
		}

		if (log) {
			log.debug`Clipping eligibility: eligible file=${file.filename} source=${frontmatter.source}`;
		}
		return { eligible: true };
	},

	async enrich(
		ctx: EnrichmentContext,
		options?: EnrichmentOptions,
	): Promise<EnrichmentResult> {
		const { frontmatter, file } = ctx;
		const url = frontmatter.source as string;

		const cid = options?.cid || "no-cid";
		const sessionCid = options?.sessionCid;

		if (log) {
			log.info`Clipping classification starting sessionCid=${sessionCid} cid=${cid} file=${file.filename} url=${url}`;
		}

		try {
			// Classify using URL and body content from context
			const clippingType = classifyClipping(url, ctx.body);

			// Extract YouTube video ID if applicable
			let videoId: string | undefined;
			if (clippingType === "youtube") {
				videoId = extractYouTubeVideoId(url) ?? undefined;
				if (!videoId && log) {
					log.warn`Clipping classification: YouTube URL but no video ID sessionCid=${sessionCid} cid=${cid} file=${file.filename} url=${url}`;
				}
			}

			const enrichment: ClippingClassificationEnrichment = {
				clippingType,
				classifiedAt: new Date().toISOString(),
				videoId,
			};

			if (log) {
				log.info`Clipping classification success sessionCid=${sessionCid} cid=${cid} file=${file.filename} type=${clippingType} videoId=${videoId ?? "none"}`;
			}

			return {
				type: "clipping-classification",
				data: enrichment,
			};
		} catch (error) {
			if (log) {
				const errMsg = error instanceof Error ? error.message : "Unknown error";
				log.error`Clipping classification failed sessionCid=${sessionCid} cid=${cid} file=${file.filename} url=${url} error=${errMsg}`;
			}

			// Clipping classification shouldn't fail, but handle gracefully
			throw new Error(
				`Clipping classification failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	},
};

/**
 * Applies clipping classification enrichment to frontmatter.
 * Updates clipping_type, distill_status, and optionally video_id/transcript_status.
 *
 * @param frontmatter - Original frontmatter
 * @param enrichment - Enrichment data from strategy
 * @returns Updated frontmatter with classification fields
 */
export function applyClippingClassification(
	frontmatter: Record<string, unknown>,
	enrichment: ClippingClassificationEnrichment,
): Record<string, unknown> {
	const updated: Record<string, unknown> = {
		...frontmatter,
		clipping_type: enrichment.clippingType,
		distill_status: "classified",
		classified_at: enrichment.classifiedAt,
	};

	// For YouTube clippings: add video_id and transcript_status
	if (enrichment.clippingType === "youtube" && enrichment.videoId) {
		updated.video_id = enrichment.videoId;
		updated.transcript_status = "pending";
	}

	return updated;
}
