/**
 * Enrichment Strategies
 *
 * Barrel export for all enrichment strategies.
 *
 * @module inbox/enrich/strategies
 */

export {
	applyBookmarkEnrichment,
	bookmarkEnrichmentStrategy,
} from "./bookmark-strategy";

export {
	applyYouTubeEnrichment,
	YouTubeEnrichmentError,
	type YouTubeErrorCode,
	youtubeEnrichmentStrategy,
} from "./youtube-strategy";
