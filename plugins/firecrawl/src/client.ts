/**
 * Firecrawl REST Client
 *
 * A lightweight client for the Firecrawl v2 API with retry logic and error handling.
 */

import type {
  ExtractRequest,
  ExtractResponse,
  ExtractStatusResponse,
  FirecrawlConfig,
  FirecrawlError,
  FirecrawlResult,
  MapRequest,
  MapResponse,
  ScrapeRequest,
  ScrapeResponse,
  SearchRequest,
  SearchResponse,
} from './types'

const DEFAULT_BASE_URL = 'https://api.firecrawl.dev/v2'
const DEFAULT_TIMEOUT = 60000
const DEFAULT_RETRIES = 2

/**
 * Creates a Firecrawl client with the given configuration.
 * @param config - Client configuration
 * @returns Client with scrape, map, search, and extract methods
 */
export function createFirecrawlClient(config: FirecrawlConfig = {}) {
  const apiKey = config.apiKey ?? process.env.FIRECRAWL_API_KEY
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL
  const timeout = config.timeout ?? DEFAULT_TIMEOUT
  const retries = config.retries ?? DEFAULT_RETRIES

  if (!apiKey) {
    throw new Error(
      'Firecrawl API key required. Set FIRECRAWL_API_KEY or pass apiKey in config.',
    )
  }

  /**
   * Makes an HTTP request to the Firecrawl API with retry logic.
   */
  async function request<T>(
    endpoint: string,
    method: 'GET' | 'POST',
    body?: unknown,
  ): Promise<FirecrawlResult<T>> {
    const url = `${baseUrl}${endpoint}`
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)

        const response = await fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        const data = (await response.json()) as T | FirecrawlError

        // Handle rate limiting with retry
        if (response.status === 429 && attempt < retries) {
          const retryAfter =
            Number.parseInt(response.headers.get('Retry-After') ?? '5', 10) *
            1000
          await sleep(retryAfter)
          continue
        }

        // Handle server errors with retry
        if (response.status >= 500 && attempt < retries) {
          await sleep(1000 * (attempt + 1)) // Exponential backoff
          continue
        }

        // Return error response
        if (!response.ok) {
          return {
            success: false,
            error:
              (data as FirecrawlError).error ??
              `HTTP ${response.status}: ${response.statusText}`,
            statusCode: response.status,
          } as FirecrawlError
        }

        return data as T
      } catch (error) {
        lastError = error as Error

        // Retry on network errors (sleep before next attempt)
        if (attempt < retries) {
          await sleep(1000 * (attempt + 1))
        }
      }
    }

    return {
      success: false,
      error: lastError?.message ?? 'Request failed after retries',
    } as FirecrawlError
  }

  return {
    /**
     * Scrapes content from a single URL.
     * @param options - Scrape options including URL
     * @returns Scraped content in requested formats
     */
    async scrape(
      options: ScrapeRequest,
    ): Promise<FirecrawlResult<ScrapeResponse>> {
      return request<ScrapeResponse>('/scrape', 'POST', options)
    },

    /**
     * Maps a website to discover all URLs.
     * @param options - Map options including base URL
     * @returns List of discovered URLs
     */
    async map(options: MapRequest): Promise<FirecrawlResult<MapResponse>> {
      return request<MapResponse>('/map', 'POST', options)
    },

    /**
     * Searches the web and optionally scrapes results.
     * @param options - Search options including query
     * @returns Search results organized by source type
     */
    async search(
      options: SearchRequest,
    ): Promise<FirecrawlResult<SearchResponse>> {
      return request<SearchResponse>('/search', 'POST', options)
    },

    /**
     * Extracts structured data from URLs using LLMs.
     * @param options - Extract options including URLs and schema
     * @returns Job ID for async extraction
     */
    async extract(
      options: ExtractRequest,
    ): Promise<FirecrawlResult<ExtractResponse>> {
      return request<ExtractResponse>('/extract', 'POST', options)
    },

    /**
     * Gets the status of an extraction job.
     * @param id - Extraction job ID
     * @returns Extraction status and data if complete
     */
    async getExtractStatus(
      id: string,
    ): Promise<FirecrawlResult<ExtractStatusResponse>> {
      return request<ExtractStatusResponse>(`/extract/${id}`, 'GET')
    },
  }
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Type for the Firecrawl client instance.
 */
export type FirecrawlClient = ReturnType<typeof createFirecrawlClient>
