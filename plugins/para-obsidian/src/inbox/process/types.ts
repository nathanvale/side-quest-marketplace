/**
 * Type definitions for the clipping processor module.
 *
 * This module handles conversion of web clippings (notes with type:clipping frontmatter)
 * into properly typed notes with enriched content and structured frontmatter.
 *
 * @module inbox/process/types
 */

/**
 * Clipping type classification for web clips.
 * Used during processing to determine enrichment strategy and template selection.
 *
 * @example
 * ```typescript
 * const type: ClippingType = "youtube"
 * ```
 */
export type ClippingType =
	| "article" // Blog posts, news articles, general web content
	| "youtube" // YouTube videos
	| "recipe" // Cooking recipes, meal plans
	| "product" // Product pages, shopping items
	| "github" // GitHub repositories, issues, PRs
	| "documentation" // Developer docs, API references
	| "social" // Twitter/X posts, Reddit threads
	| "podcast" // Podcast episodes
	| "book" // Book pages, reviews, GoodReads
	| "accommodation" // Hotels, Airbnb, vacation rentals
	| "place" // Locations from Google Maps, Apple Maps
	| "restaurant" // Restaurants, cafes, dining venues
	| "generic"; // Catch-all for unclassified content

/**
 * Frontmatter extracted from a clipping note.
 * These are the standard fields created by the Obsidian Web Clipper.
 *
 * @example
 * ```typescript
 * const frontmatter: ClippingFrontmatter = {
 *   type: "clipping",
 *   source: "https://example.com/article",
 *   domain: "example.com",
 *   clipped: "2024-01-15T10:30:00Z",
 *   distill_status: "pending",
 *   capture_reason: "Learn about TypeScript patterns"
 * }
 * ```
 */
export interface ClippingFrontmatter {
	/** Always "clipping" for raw clipped content */
	type: "clipping";
	/** Original URL of the clipped content */
	source: string;
	/** Domain extracted from source URL */
	domain: string;
	/** ISO timestamp when content was clipped */
	clipped: string;
	/** Processing status: "pending", "processed", "enriched" */
	distill_status: string;
	/** Optional user-provided reason for capturing this content */
	capture_reason?: string;
	/** Number of highlights in the clipping (0 = full page, >0 = highlights only). Can be string or number depending on YAML parsing. */
	highlight_count?: number | string;
	/**
	 * Optional explicit clipping type set by Web Clipper.
	 * When set, skips auto-classification and uses this type directly.
	 * Valid values: youtube, recipe, restaurant, accommodation, article, etc.
	 */
	clipping_type?: string;
}

/**
 * Enrichment data fetched from external sources.
 * Different enrichment strategies populate different fields.
 *
 * @example
 * ```typescript
 * // YouTube enrichment
 * const ytEnrich: ClippingEnrichment = {
 *   transcript: "Full transcript text...",
 *   videoId: "dQw4w9WgXcQ",
 *   channelName: "Example Channel",
 *   duration: "3:42",
 *   enrichmentSource: "youtube-mcp",
 *   enrichmentStatus: "success"
 * }
 *
 * // Recipe enrichment
 * const recipeEnrich: ClippingEnrichment = {
 *   ingredients: ["2 cups flour", "1 egg"],
 *   instructions: ["Mix flour", "Add egg"],
 *   prepTime: "15min",
 *   cookTime: "30min",
 *   servings: "4",
 *   enrichmentSource: "firecrawl-extract",
 *   enrichmentStatus: "success"
 * }
 * ```
 */
export interface ClippingEnrichment {
	// YouTube-specific enrichment
	/** Full transcript text from YouTube video */
	transcript?: string;
	/** YouTube video ID extracted from URL */
	videoId?: string;
	/** Channel name from video metadata */
	channelName?: string;
	/** Video duration formatted as "MM:SS" or "HH:MM:SS" or "X minutes" */
	duration?: string;
	/** Video upload/publish date (ISO string) */
	uploadDate?: string;
	/** Video description */
	videoDescription?: string;
	/** Video title from YouTube metadata */
	videoTitle?: string;

	// Recipe-specific enrichment (from Firecrawl extract)
	/** List of recipe ingredients */
	ingredients?: string[];
	/** Step-by-step cooking instructions */
	instructions?: string[];
	/** Preparation time (e.g., "15min", "1 hour") */
	prepTime?: string;
	/** Cooking time (e.g., "30min", "2 hours") */
	cookTime?: string;
	/** Number of servings (e.g., "4", "6-8") */
	servings?: string;

	// General enrichment (from Firecrawl scrape)
	/** Raw scraped content from the page */
	scrapedContent?: string;
	/** Author name extracted from page metadata */
	author?: string;
	/** Publication date (ISO string) */
	publishDate?: string;

	// Processing metadata
	/** Which enrichment service was used */
	enrichmentSource:
		| "youtube-mcp"
		| "firecrawl-scrape"
		| "firecrawl-extract"
		| "google-maps-url"
		| "none";
	/** Whether enrichment succeeded, failed, or was skipped */
	enrichmentStatus: "success" | "failed" | "skipped";
	/** Error message if enrichment failed */
	enrichmentError?: string;

	// Summary generation (LLM-powered)
	/** AI-generated summary for frontmatter (1-2 sentences, 50-150 chars) */
	summary?: string;
	/** AI-cleaned content (removes web cruft, keeps only article-relevant content) */
	cleanedContent?: string;
	/** Summary generation status */
	summaryStatus?: "success" | "failed" | "skipped";
	/** Error message if summary generation failed */
	summaryError?: string;

	// Accommodation-specific fields (from LLM extraction)
	/** Check-in date (YYYY-MM-DD) */
	checkIn?: string;
	/** Check-out date (YYYY-MM-DD) */
	checkOut?: string;
	/** Location (city or area) */
	location?: string;
	/** Price with currency (e.g., "548.64 AUD") */
	price?: string;

	// Place-specific fields (from LLM extraction)
	/** Place name */
	placeName?: string;
	/** Full address */
	address?: string;
	/** Suburb/neighborhood */
	suburb?: string;
	/** Category (e.g., "park", "restaurant", "museum") */
	category?: string;
	/** Google Maps URL */
	googleMaps?: string;
	/** Apple Maps URL */
	appleMaps?: string;

	// Restaurant-specific fields (from Firecrawl extract)
	/** Restaurant name */
	restaurantName?: string;
	/** Cuisine type (e.g., "Italian", "Japanese") */
	cuisine?: string;
	/** City where restaurant is located */
	city?: string;
	/** Price range indicator (e.g., "$$", "$$$") */
	priceRange?: string;
	/** URL for making reservations */
	bookingUrl?: string;
	/** URL for viewing menu */
	menuUrl?: string;
	/** Restaurant phone number */
	phone?: string;
	/** Chef name if notable */
	chef?: string;
	/** Signature dishes or specialties */
	specialties?: string[];
	/** Ambiance/vibe description */
	ambiance?: string;

	// GitHub-specific fields (from URL/content extraction)
	/** GitHub username (for profile pages) */
	githubUsername?: string;
	/** GitHub display name */
	githubDisplayName?: string;
	/** GitHub bio/tagline */
	githubBio?: string;
	/** GitHub location */
	githubLocation?: string;
	/** Repository name (for repo pages) */
	repoName?: string;
	/** Repository owner */
	repoOwner?: string;
	/** Repository description */
	repoDescription?: string;
	/** Primary programming language */
	repoLanguage?: string;
	/** Star count */
	repoStars?: number;
	/** Fork count */
	repoForks?: number;
	/** GitHub page type: profile, repo, issue, pr, gist, org */
	githubPageType?: "profile" | "repo" | "issue" | "pr" | "gist" | "org";
	/** Pinned repositories (for profiles) */
	pinnedRepos?: Array<{
		name: string;
		description?: string;
		language?: string;
		stars?: number;
	}>;
	/** Current projects/highlights (for profiles) */
	currentProjects?: string[];

	// Firecrawl metadata (for re-classification)
	/** Page metadata from Firecrawl scrape (Open Graph, meta tags) */
	firecrawlMetadata?: {
		title?: string;
		description?: string;
		ogTitle?: string;
		ogDescription?: string;
		ogSiteName?: string;
		[key: string]: unknown;
	};
}

/**
 * Template variables available for substitution during note creation.
 * These are passed to the template engine when converting a clipping to a typed note.
 *
 * @example
 * ```typescript
 * const vars: TemplateVariables = {
 *   title: "Understanding TypeScript Generics",
 *   source: "https://example.com/article",
 *   domain: "example.com",
 *   clipped: "2024-01-15T10:30:00Z",
 *   content: "Original clipped content...",
 *   author: "John Doe",
 *   publish_date: "2024-01-10"
 * }
 * ```
 */
export interface TemplateVariables {
	// Core fields (always present)
	/** Note title (derived from frontmatter or filename) */
	title: string;
	/** Original source URL */
	source: string;
	/** Domain extracted from source URL */
	domain: string;
	/** ISO timestamp when content was clipped */
	clipped: string;
	/** Original clipped content from note body */
	content: string;
	/** Optional user-provided capture reason */
	capture_reason?: string;

	// YouTube-specific fields
	/** YouTube video ID */
	video_id?: string;
	/** Full video transcript */
	transcript?: string;
	/** Transcript fetch status for template logic */
	transcript_status?: "success" | "failed" | "pending";
	/** YouTube channel name */
	channel_name?: string;
	/** Video duration (e.g., "31 minutes") */
	duration?: string;
	/** Video publish date (ISO string) */
	published?: string;
	/** Video description from YouTube */
	description?: string;

	// Recipe-specific fields
	/** Formatted ingredient list (joined with newlines) */
	ingredients?: string;
	/** Formatted instruction steps (joined with newlines) */
	instructions?: string;
	/** Preparation time */
	prep_time?: string;
	/** Cooking time */
	cook_time?: string;
	/** Number of servings */
	servings?: string;

	// Article/General fields
	/** Content author name */
	author?: string;
	/** Publication date (ISO string) */
	publish_date?: string;
	/** Scraped content from page */
	scraped_content?: string;

	// Summary (LLM-generated)
	/** AI-generated summary for frontmatter (1-2 sentences, searchable) */
	summary?: string;

	// Accommodation-specific fields
	/** Check-in date (YYYY-MM-DD) */
	check_in?: string;
	/** Check-out date (YYYY-MM-DD) */
	check_out?: string;
	/** Location (city or area) */
	location?: string;
	/** Price with currency (e.g., "548.64 AUD") */
	price?: string;

	// Place-specific fields
	/** Place name */
	place_name?: string;
	/** Full address */
	address?: string;
	/** Suburb/neighborhood */
	suburb?: string;
	/** Category (e.g., "park", "restaurant", "museum") */
	category?: string;
	/** Google Maps URL */
	google_maps?: string;
	/** Apple Maps URL */
	apple_maps?: string;

	// Restaurant-specific fields
	/** Restaurant name */
	restaurant_name?: string;
	/** Cuisine type (e.g., "Italian", "Japanese") */
	cuisine?: string;
	/** City where restaurant is located */
	city?: string;
	/** Price range indicator (e.g., "$$", "$$$") */
	price_range?: string;
	/** URL for making reservations */
	booking_url?: string;
	/** URL for viewing menu */
	menu_url?: string;
	/** Restaurant phone number */
	phone?: string;
	/** Chef name if notable */
	chef?: string;
	/** Signature dishes or specialties (comma-separated) */
	specialties?: string;
	/** Ambiance/vibe description */
	ambiance?: string;

	// GitHub-specific fields
	/** GitHub username (for profile pages) */
	github_username?: string;
	/** GitHub display name */
	github_display_name?: string;
	/** GitHub bio/tagline */
	github_bio?: string;
	/** GitHub location */
	github_location?: string;
	/** Repository name (for repo pages) */
	repo_name?: string;
	/** Repository owner */
	repo_owner?: string;
	/** Repository description */
	repo_description?: string;
	/** Primary programming language */
	repo_language?: string;
	/** Star count */
	repo_stars?: string;
	/** Fork count */
	repo_forks?: string;
	/** GitHub page type: profile, repo, issue, pr, gist, org */
	github_page_type?: string;
	/** Formatted pinned repositories (markdown) */
	pinned_repos?: string;
	/** Formatted current projects (markdown) */
	current_projects?: string;
	/** GitHub profile URL */
	github_url?: string;
}

/**
 * Options for processing clipping notes.
 *
 * @example
 * ```typescript
 * const options: ProcessOptions = {
 *   dryRun: true,
 *   verbose: true,
 *   skipEnrichment: false
 * }
 * ```
 */
export interface ProcessOptions {
	/** Preview changes without actually modifying files */
	dryRun?: boolean;
	/** Show detailed logging during processing */
	verbose?: boolean;
	/** Skip external enrichment (YouTube, Firecrawl) */
	skipEnrichment?: boolean;
}

/**
 * Result of processing a single clipping note.
 * Tracks the conversion outcome and provides details for reporting.
 *
 * @example
 * ```typescript
 * const result: ClippingProcessResult = {
 *   originalPath: "00 Inbox/my-clip.md",
 *   convertedPath: "03 Resources/Understanding TypeScript.md",
 *   clippingType: "article",
 *   enrichment: {
 *     scrapedContent: "...",
 *     author: "John Doe",
 *     enrichmentSource: "firecrawl-scrape",
 *     enrichmentStatus: "success"
 *   },
 *   status: "success",
 *   deleted: true
 * }
 * ```
 */
export interface ClippingProcessResult {
	/** Original path of the clipping note (vault-relative) */
	originalPath: string;
	/** Path of the created typed note (vault-relative, undefined if failed) */
	convertedPath?: string;
	/** Detected clipping type */
	clippingType: ClippingType;
	/** Enrichment data and status */
	enrichment: ClippingEnrichment;
	/** Overall processing status */
	status: "success" | "failed" | "skipped";
	/** Error message if processing failed */
	error?: string;
	/** Whether the original clipping was deleted after conversion */
	deleted: boolean;
}

/**
 * Summary of batch processing results.
 * Provides aggregate statistics and per-clipping details.
 *
 * @example
 * ```typescript
 * const summary: ProcessBatchResult = {
 *   processed: 15,
 *   failed: 2,
 *   skipped: 3,
 *   results: [...],
 *   byType: {
 *     youtube: 5,
 *     article: 7,
 *     recipe: 3
 *   }
 * }
 * ```
 */
export interface ProcessBatchResult {
	/** Total number of clippings successfully processed */
	processed: number;
	/** Total number of clippings that failed */
	failed: number;
	/** Total number of clippings skipped */
	skipped: number;
	/** Detailed results for each clipping */
	results: ClippingProcessResult[];
	/** Count of processed clippings by type */
	byType: Record<ClippingType, number>;
}
