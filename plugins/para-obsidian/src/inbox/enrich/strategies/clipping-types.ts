/**
 * Clipping type classification for web clips.
 * Used during inbox scanning to categorize raw clippings.
 *
 * @module inbox/enrich/strategies/clipping-types
 */

export type ClippingType =
	| "article"
	| "youtube"
	| "recipe"
	| "product"
	| "github"
	| "documentation"
	| "social"
	| "podcast"
	| "book"
	| "generic";

/** Emoji mapping for clipping types */
export const CLIPPING_TYPE_EMOJI: Record<ClippingType, string> = {
	article: "📰",
	youtube: "🎬",
	recipe: "🍳",
	product: "🛍️",
	github: "🐙",
	documentation: "📚",
	social: "💬",
	podcast: "🎧",
	book: "📖",
	generic: "✂️",
};

/** URL patterns for fast classification (high confidence) */
export const URL_PATTERNS: Array<{ pattern: RegExp; type: ClippingType }> = [
	{ pattern: /youtube\.com|youtu\.be/i, type: "youtube" },
	{ pattern: /github\.com/i, type: "github" },
	{ pattern: /twitter\.com|x\.com|reddit\.com/i, type: "social" },
	{ pattern: /docs\.|developer\./i, type: "documentation" },
	{
		pattern: /allrecipes|epicurious|foodnetwork|tasty|bonappetit|seriouseats/i,
		type: "recipe",
	},
	{ pattern: /amazon\.|ebay\.|etsy\./i, type: "product" },
	{
		pattern: /spotify\.com\/episode|podcasts\.apple|overcast\.fm/i,
		type: "podcast",
	},
	{ pattern: /goodreads\.com/i, type: "book" },
];

/** Content markers for medium-confidence classification */
export const CONTENT_MARKERS: Array<{
	markers: RegExp[];
	type: ClippingType;
}> = [
	{
		markers: [/ingredients?:/i, /prep time|cook time|servings?:/i],
		type: "recipe",
	},
	{
		markers: [/\$\d+|\bprice\b|add to cart|buy now/i],
		type: "product",
	},
	{
		markers: [/```|api reference|documentation|endpoint|sdk/i],
		type: "documentation",
	},
];

/**
 * Extract YouTube video ID from various URL formats.
 *
 * @param url - URL to extract video ID from
 * @returns Video ID or null if not found
 *
 * @example
 * ```typescript
 * extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
 * // => "dQw4w9WgXcQ"
 *
 * extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")
 * // => "dQw4w9WgXcQ"
 * ```
 */
export function extractYouTubeVideoId(url: string): string | null {
	const patterns = [
		/youtube\.com\/watch\?v=([^&]+)/,
		/youtu\.be\/([^?]+)/,
		/youtube\.com\/embed\/([^?]+)/,
		/youtube\.com\/v\/([^?]+)/,
		/youtube\.com\/shorts\/([^?]+)/,
	];
	for (const pattern of patterns) {
		const match = url.match(pattern);
		if (match?.[1]) return match[1];
	}
	return null;
}

/**
 * Classify a clipping based on URL and content.
 *
 * @param url - URL of the clipping
 * @param content - Optional content for marker matching
 * @returns Classified clipping type
 *
 * @example
 * ```typescript
 * classifyClipping("https://github.com/anthropics/anthropic-sdk-typescript")
 * // => "github"
 *
 * classifyClipping("https://example.com/recipe", "Ingredients: 2 cups flour")
 * // => "recipe"
 * ```
 */
export function classifyClipping(url: string, content?: string): ClippingType {
	// 1. URL patterns (fast, high confidence)
	for (const { pattern, type } of URL_PATTERNS) {
		if (pattern.test(url)) return type;
	}

	// 2. Content markers (medium confidence)
	if (content) {
		for (const { markers, type } of CONTENT_MARKERS) {
			if (markers.some((marker) => marker.test(content))) return type;
		}
	}

	// 3. Fallback
	return "generic";
}
