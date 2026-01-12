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
	applyClippingClassification,
	clippingClassificationStrategy,
} from "./clipping-strategy";

export {
	CLIPPING_TYPE_EMOJI,
	type ClippingType,
	CONTENT_MARKERS,
	classifyClipping,
	extractYouTubeVideoId,
	URL_PATTERNS,
} from "./clipping-types";

export {
	applyYouTubeEnrichment,
	YouTubeEnrichmentError,
	type YouTubeErrorCode,
	youtubeEnrichmentStrategy,
} from "./youtube-strategy";
