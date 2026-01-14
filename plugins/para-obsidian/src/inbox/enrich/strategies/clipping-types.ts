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
	| "accommodation"
	| "place"
	| "restaurant"
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
	accommodation: "🏨",
	place: "📍",
	restaurant: "🍽️",
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
	{
		pattern: /booking\.com|airbnb\.|vrbo\.|expedia\.com\/hotels|hotels\.com/i,
		type: "accommodation",
	},
	{
		pattern: /google\.com\/maps|maps\.apple\.com|maps\.google\./i,
		type: "place",
	},
	{
		pattern:
			/opentable\.com|resy\.com|yelp\.com\/biz|zomato\.com|tripadvisor\.com\/Restaurant|thefork\./i,
		type: "restaurant",
	},
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
	{
		markers: [
			/\b(book a table|make a reservation|reservations?)\b/i,
			/\b(menu|cuisine|chef|restaurant|dining|dine)\b.*\b(book|reserve)\b/i,
		],
		type: "restaurant",
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
 * Metadata from Firecrawl scrape response.
 * Contains Open Graph tags, meta description, title, etc.
 */
export interface PageMetadata {
	/** Page title (from <title> or og:title) */
	title?: string;
	/** Meta description (from description or og:description) */
	description?: string;
	/** Open Graph title */
	ogTitle?: string;
	/** Open Graph description */
	ogDescription?: string;
	/** Open Graph site name */
	ogSiteName?: string;
	/** Allow additional OG/meta fields */
	[key: string]: unknown;
}

/**
 * Metadata markers for restaurant detection.
 * These patterns match common restaurant-related terms in OG/meta tags.
 */
const RESTAURANT_METADATA_MARKERS = [
	// Restaurant type indicators in title/description
	/\b(restaurant|ristorante|trattoria|osteria|pizzeria|cafe|café|bistro|brasserie|tavern|taverna|gastropub|diner|eatery)\b/i,
	// Dining/cuisine language
	/\b(fine dining|italian cuisine|french cuisine|asian cuisine|contemporary dining)\b/i,
	// Chef mentions
	/\b(chef|head chef|executive chef|michelin)\b/i,
];

/**
 * Classify from page metadata (Open Graph tags, meta description, title).
 * Used for re-classification after Firecrawl scrape when URL patterns don't match.
 *
 * @param metadata - Page metadata from Firecrawl
 * @returns Classified type or null if no match
 *
 * @example
 * ```typescript
 * classifyFromMetadata({
 *   title: "Italian Restaurant Paddington | I Maccheroni",
 *   description: "Michelin star trained Chef..."
 * })
 * // => "restaurant"
 * ```
 */
export function classifyFromMetadata(
	metadata: PageMetadata,
): ClippingType | null {
	// Combine all text fields for matching
	const textToCheck = [
		metadata.title,
		metadata.ogTitle,
		metadata.description,
		metadata.ogDescription,
		metadata.ogSiteName,
		metadata["og:title"] as string | undefined,
		metadata["og:description"] as string | undefined,
	]
		.filter(Boolean)
		.join(" ");

	if (!textToCheck) return null;

	// Check for restaurant signals in metadata
	for (const pattern of RESTAURANT_METADATA_MARKERS) {
		if (pattern.test(textToCheck)) {
			return "restaurant";
		}
	}

	// Future: Add more metadata-based classifications here
	// e.g., recipe (og:type === "recipe"), product (og:type === "product")

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
