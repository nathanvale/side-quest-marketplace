/**
 * Firecrawl Plugin Types
 *
 * TypeScript interfaces for the Firecrawl v2 REST API.
 * Focused on the core operations: scrape, map, search, and extract.
 */

// =============================================================================
// Configuration
// =============================================================================

/**
 * Configuration for the Firecrawl client.
 */
export interface FirecrawlConfig {
	/** Firecrawl API key (defaults to FIRECRAWL_API_KEY env var) */
	apiKey?: string;
	/** Base URL for the Firecrawl API */
	baseUrl?: string;
	/** Request timeout in milliseconds */
	timeout?: number;
	/** Number of retry attempts for failed requests */
	retries?: number;
}

// =============================================================================
// Common Types
// =============================================================================

/**
 * Location settings for geo-targeted requests.
 */
export interface LocationSettings {
	/** ISO 3166-1 alpha-2 country code (e.g., 'US', 'AU', 'DE') */
	country?: string;
	/** Preferred languages in order of priority */
	languages?: string[];
}

/**
 * Actions to perform on a page before scraping.
 */
export type ScrapeAction =
	| { type: "wait"; milliseconds?: number; selector?: string }
	| { type: "screenshot"; fullPage?: boolean }
	| { type: "click"; selector: string }
	| { type: "write"; selector: string; text: string }
	| { type: "press"; key: string }
	| { type: "scroll"; direction?: "up" | "down" }
	| { type: "scrape" }
	| { type: "executeJavascript"; script: string }
	| { type: "generatePDF" };

/**
 * Output format types for scraping.
 */
export type ScrapeFormat =
	| "markdown"
	| "html"
	| "rawHtml"
	| "screenshot"
	| "links"
	| "summary"
	| "images"
	| { type: "json"; prompt?: string; schema?: Record<string, unknown> }
	| {
			type: "screenshot";
			fullPage?: boolean;
			quality?: number;
			viewport?: { width: number; height: number };
	  };

/**
 * Proxy type for requests.
 */
export type ProxyType = "basic" | "stealth" | "auto";

/**
 * Page metadata returned from scraping.
 */
export interface PageMetadata {
	title?: string;
	description?: string;
	language?: string;
	sourceURL?: string;
	keywords?: string;
	statusCode?: number;
	error?: string;
	[key: string]: unknown;
}

// =============================================================================
// Scrape Types
// =============================================================================

/**
 * Options for the scrape operation.
 */
export interface ScrapeOptions {
	/** Output formats to include */
	formats?: ScrapeFormat[];
	/** Only return main content (excludes headers, navs, footers) */
	onlyMainContent?: boolean;
	/** HTML tags to include in output */
	includeTags?: string[];
	/** HTML tags to exclude from output */
	excludeTags?: string[];
	/** Return cached version if younger than this (ms). Default: 2 days */
	maxAge?: number;
	/** Custom headers for the request */
	headers?: Record<string, string>;
	/** Delay before fetching (ms) */
	waitFor?: number;
	/** Emulate mobile device */
	mobile?: boolean;
	/** Skip TLS certificate verification */
	skipTlsVerification?: boolean;
	/** Request timeout (ms) */
	timeout?: number;
	/** Actions to perform before scraping */
	actions?: ScrapeAction[];
	/** Location settings */
	location?: LocationSettings;
	/** Remove base64 images from output */
	removeBase64Images?: boolean;
	/** Enable ad and cookie popup blocking */
	blockAds?: boolean;
	/** Proxy type to use */
	proxy?: ProxyType;
	/** Store result in cache */
	storeInCache?: boolean;
}

/**
 * Request payload for the scrape endpoint.
 */
export interface ScrapeRequest extends ScrapeOptions {
	/** URL to scrape */
	url: string;
}

/**
 * Data returned from a scrape operation.
 */
export interface ScrapeData {
	markdown?: string;
	summary?: string;
	html?: string;
	rawHtml?: string;
	screenshot?: string;
	links?: string[];
	metadata?: PageMetadata;
	warning?: string;
}

/**
 * Response from the scrape endpoint.
 */
export interface ScrapeResponse {
	success: boolean;
	data?: ScrapeData;
	error?: string;
}

// =============================================================================
// Map Types
// =============================================================================

/**
 * Sitemap handling mode.
 */
export type SitemapMode = "skip" | "include" | "only";

/**
 * Options for the map operation.
 */
export interface MapOptions {
	/** Search query to filter/order results by relevance */
	search?: string;
	/** How to handle sitemap.xml */
	sitemap?: SitemapMode;
	/** Include subdomains */
	includeSubdomains?: boolean;
	/** Ignore query parameters in URLs */
	ignoreQueryParameters?: boolean;
	/** Maximum URLs to return (default: 5000, max: 100000) */
	limit?: number;
	/** Request timeout (ms) */
	timeout?: number;
	/** Location settings */
	location?: LocationSettings;
}

/**
 * Request payload for the map endpoint.
 */
export interface MapRequest extends MapOptions {
	/** Base URL to map */
	url: string;
}

/**
 * Link info returned from map operation.
 */
export interface MapLink {
	url: string;
	title?: string;
	description?: string;
}

/**
 * Response from the map endpoint.
 */
export interface MapResponse {
	success: boolean;
	links?: MapLink[];
	error?: string;
}

// =============================================================================
// Search Types
// =============================================================================

/**
 * Search source types.
 */
export type SearchSource = "web" | "images" | "news";

/**
 * Search category filters.
 */
export type SearchCategory = "github" | "research" | "pdf";

/**
 * Options for the search operation.
 */
export interface SearchOptions {
	/** Maximum results to return (1-100, default: 5) */
	limit?: number;
	/** Sources to search */
	sources?: Array<{ type: SearchSource }>;
	/** Categories to filter by */
	categories?: Array<{ type: SearchCategory }>;
	/** Time-based search filter (e.g., 'qdr:d' for past day) */
	tbs?: string;
	/** Location string (e.g., 'San Francisco,California,United States') */
	location?: string;
	/** ISO country code (e.g., 'US', 'AU') */
	country?: string;
	/** Request timeout (ms) */
	timeout?: number;
	/** Scrape options for search results */
	scrapeOptions?: ScrapeOptions;
}

/**
 * Request payload for the search endpoint.
 */
export interface SearchRequest extends SearchOptions {
	/** Search query */
	query: string;
}

/**
 * Web search result.
 */
export interface WebSearchResult {
	title?: string;
	description?: string;
	url: string;
	markdown?: string;
	html?: string;
	rawHtml?: string;
	links?: string[];
	screenshot?: string;
	metadata?: PageMetadata;
	category?: SearchCategory;
}

/**
 * Image search result.
 */
export interface ImageSearchResult {
	title?: string;
	imageUrl: string;
	imageWidth?: number;
	imageHeight?: number;
	url: string;
	position?: number;
}

/**
 * News search result.
 */
export interface NewsSearchResult {
	title?: string;
	snippet?: string;
	url: string;
	date?: string;
	imageUrl?: string;
	position?: number;
	markdown?: string;
	html?: string;
	metadata?: PageMetadata;
}

/**
 * Search results data organized by source.
 */
export interface SearchData {
	web?: WebSearchResult[];
	images?: ImageSearchResult[];
	news?: NewsSearchResult[];
}

/**
 * Response from the search endpoint.
 */
export interface SearchResponse {
	success: boolean;
	data?: SearchData;
	warning?: string;
	error?: string;
}

// =============================================================================
// Extract Types
// =============================================================================

/**
 * Options for the extract operation.
 */
export interface ExtractOptions {
	/** Prompt to guide extraction */
	prompt?: string;
	/** JSON Schema for structured extraction */
	schema?: Record<string, unknown>;
	/** Use web search for additional data */
	enableWebSearch?: boolean;
	/** Ignore sitemap.xml during scanning */
	ignoreSitemap?: boolean;
	/** Include subdomains */
	includeSubdomains?: boolean;
	/** Include source URLs in response */
	showSources?: boolean;
	/** Scrape options for the pages */
	scrapeOptions?: ScrapeOptions;
	/** Ignore invalid URLs instead of failing */
	ignoreInvalidURLs?: boolean;
}

/**
 * Request payload for the extract endpoint.
 */
export interface ExtractRequest extends ExtractOptions {
	/** URLs to extract from (supports glob patterns) */
	urls: string[];
}

/**
 * Response from the extract endpoint.
 */
export interface ExtractResponse {
	success: boolean;
	/** Job ID for async extraction */
	id?: string;
	/** Invalid URLs that were skipped */
	invalidURLs?: string[];
	error?: string;
}

/**
 * Response from getting extract status.
 */
export interface ExtractStatusResponse {
	success: boolean;
	status?: "pending" | "completed" | "failed";
	data?: Record<string, unknown>;
	sources?: string[];
	error?: string;
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error response from the API.
 */
export interface FirecrawlError {
	success: false;
	error: string;
	statusCode?: number;
}

/**
 * Result type that can be either success or error.
 */
export type FirecrawlResult<T> = T | FirecrawlError;

/**
 * Type guard to check if result is an error.
 */
export function isFirecrawlError<T extends object>(
	result: FirecrawlResult<T>,
): result is FirecrawlError {
	return (
		typeof result === "object" &&
		result !== null &&
		"success" in result &&
		(result as FirecrawlError).success === false &&
		"error" in result
	);
}
