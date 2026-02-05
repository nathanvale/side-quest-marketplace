/**
 * Firecrawl Plugin - Library Exports
 *
 * Retained for para-obsidian which imports createFirecrawlClient and types.
 * Will be removed in Phase B when para-obsidian migrates to CLI.
 */

export type { FirecrawlClient } from "./client";
export { createFirecrawlClient } from "./client";

export type {
	ExtractOptions,
	ExtractRequest,
	ExtractResponse,
	ExtractStatusResponse,
	FirecrawlConfig,
	FirecrawlError,
	FirecrawlResult,
	ImageSearchResult,
	LocationSettings,
	MapLink,
	MapOptions,
	MapRequest,
	MapResponse,
	NewsSearchResult,
	PageMetadata,
	ProxyType,
	ScrapeAction,
	ScrapeData,
	ScrapeFormat,
	ScrapeOptions,
	ScrapeRequest,
	ScrapeResponse,
	SearchCategory,
	SearchData,
	SearchOptions,
	SearchRequest,
	SearchResponse,
	SearchSource,
	SitemapMode,
	WebSearchResult,
} from "./types";

export { isFirecrawlError } from "./types";
