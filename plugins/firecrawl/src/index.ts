/**
 * Firecrawl Plugin
 *
 * A token-efficient Firecrawl client for Claude Code.
 * Provides scrape, map, search, and extract operations via REST API.
 *
 * @example
 * ```ts
 * import { createFirecrawlClient } from '@sidequest/firecrawl'
 *
 * const client = createFirecrawlClient()
 * const result = await client.scrape({
 *   url: 'https://example.com',
 *   formats: ['markdown'],
 * })
 * ```
 */

export type { FirecrawlClient } from './client'
// Client
export { createFirecrawlClient } from './client'

// Formatters
export {
  formatExtractResponse,
  formatMapResponse,
  formatScrapeResponse,
  formatSearchResponse,
  formatUrlList,
} from './formatters'

// Types
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
} from './types'

export { isFirecrawlError } from './types'
