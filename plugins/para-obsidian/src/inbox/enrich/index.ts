/**
 * Enrichment Module
 *
 * Exports for the enrichment pipeline with Strategy Pattern.
 * Enrichment occurs BEFORE classification to enhance content.
 *
 * Pipeline: Scan → Enrich → Classify → Suggest → Review → Execute
 *
 * @module inbox/enrich
 */

// Re-export RateLimiter from core for convenience
export { RateLimiter } from "@side-quest/core/concurrency";
// Core enrichment functions
export {
	enrichBookmarkWithFirecrawl,
	extractDomain,
	isValidUrl,
} from "./bookmark-enricher";
// Pipeline
export {
	createDefaultEnrichmentPipeline,
	createEnrichmentPipeline,
	DEFAULT_ENRICHMENT_STRATEGIES,
	type EnrichmentPipeline,
	isEnrichmentSuccess,
} from "./pipeline";
// Strategies
export {
	applyBookmarkEnrichment,
	bookmarkEnrichmentStrategy,
} from "./strategies";
// Types
export {
	type BatchEnrichmentOptions,
	type BatchEnrichmentResult,
	type BookmarkEnrichment,
	BookmarkEnrichmentError,
	type EnrichmentContext,
	type EnrichmentEligibility,
	type EnrichmentErrorCode,
	type EnrichmentOptions,
	type EnrichmentPipelineConfig,
	type EnrichmentPipelineResult,
	type EnrichmentProgress,
	type EnrichmentResult,
	type EnrichmentStrategy,
} from "./types";
