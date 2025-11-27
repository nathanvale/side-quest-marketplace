/**
 * Tests for the Firecrawl REST client.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { createFirecrawlClient } from './client'

// Mock fetch globally - using type assertion to handle Bun mock compatibility
const originalFetch = globalThis.fetch

// Type for mock with calls property
interface MockWithCalls {
  mock?: { calls?: Array<[string, RequestInit]> }
}

// Helper to get mock call args
function getMockCalls(): Array<[string, RequestInit]> {
  return ((fetch as unknown as MockWithCalls).mock?.calls as Array<[string, RequestInit]>) ?? []
}

// Helper to create a mock fetch that's compatible with globalThis.fetch
function createMockFetch(fn: () => Promise<Response>): typeof fetch {
  return mock(fn) as unknown as typeof fetch
}

describe('createFirecrawlClient', () => {
  beforeEach(() => {
    // Reset fetch mock before each test
    globalThis.fetch = originalFetch
  })

  afterEach(() => {
    // Restore original fetch
    globalThis.fetch = originalFetch
  })

  test('throws error when no API key provided', () => {
    const originalEnv = process.env.FIRECRAWL_API_KEY
    process.env.FIRECRAWL_API_KEY = ''

    expect(() => createFirecrawlClient()).toThrow('Firecrawl API key required')

    // Restore env
    process.env.FIRECRAWL_API_KEY = originalEnv ?? ''
  })

  test('accepts API key via config', () => {
    expect(() => createFirecrawlClient({ apiKey: 'test-key' })).not.toThrow()
  })

  test('accepts API key via environment variable', () => {
    const originalEnv = process.env.FIRECRAWL_API_KEY
    process.env.FIRECRAWL_API_KEY = 'env-test-key'

    expect(() => createFirecrawlClient()).not.toThrow()

    // Restore env
    process.env.FIRECRAWL_API_KEY = originalEnv ?? ''
  })
})

describe('scrape', () => {
  test('sends correct request to scrape endpoint', async () => {
    const mockResponse = {
      success: true,
      data: {
        markdown: '# Test',
        metadata: { title: 'Test Page' },
      },
    }

    globalThis.fetch = createMockFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    const client = createFirecrawlClient({ apiKey: 'test-key' })
    const result = await client.scrape({
      url: 'https://example.com',
      formats: ['markdown'],
    })

    expect(result).toEqual(mockResponse)
    expect(fetch).toHaveBeenCalledTimes(1)

    const calls = getMockCalls()
    const call = calls[0]
    if (!call) throw new Error('No fetch calls')
    const [url, options] = call
    expect(url).toBe('https://api.firecrawl.dev/v2/scrape')
    expect(options.method).toBe('POST')
    expect((options.headers as Record<string, string>).Authorization).toBe('Bearer test-key')
    expect(JSON.parse(options.body as string)).toEqual({
      url: 'https://example.com',
      formats: ['markdown'],
    })
  })

  test('handles error response', async () => {
    globalThis.fetch = createMockFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify({ success: false, error: 'Invalid URL' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    const client = createFirecrawlClient({ apiKey: 'test-key' })
    const result = await client.scrape({ url: 'invalid' })

    expect(result.success).toBe(false)
    expect((result as { error: string }).error).toBe('Invalid URL')
  })
})

describe('map', () => {
  test('sends correct request to map endpoint', async () => {
    const mockResponse = {
      success: true,
      links: [
        { url: 'https://example.com/page1', title: 'Page 1' },
        { url: 'https://example.com/page2', title: 'Page 2' },
      ],
    }

    globalThis.fetch = createMockFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    const client = createFirecrawlClient({ apiKey: 'test-key' })
    const result = await client.map({
      url: 'https://example.com',
      limit: 100,
    })

    expect(result).toEqual(mockResponse)

    const calls = getMockCalls()
    const call = calls[0]
    if (!call) throw new Error('No fetch calls')
    const [url, options] = call
    expect(url).toBe('https://api.firecrawl.dev/v2/map')
    expect(JSON.parse(options.body as string)).toEqual({
      url: 'https://example.com',
      limit: 100,
    })
  })
})

describe('search', () => {
  test('sends correct request to search endpoint', async () => {
    const mockResponse = {
      success: true,
      data: {
        web: [{ url: 'https://example.com', title: 'Example', description: 'A test' }],
      },
    }

    globalThis.fetch = createMockFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    const client = createFirecrawlClient({ apiKey: 'test-key' })
    const result = await client.search({
      query: 'test query',
      limit: 5,
    })

    expect(result).toEqual(mockResponse)

    const calls = getMockCalls()
    const call = calls[0]
    if (!call) throw new Error('No fetch calls')
    const [url, options] = call
    expect(url).toBe('https://api.firecrawl.dev/v2/search')
    expect(JSON.parse(options.body as string)).toEqual({
      query: 'test query',
      limit: 5,
    })
  })
})

describe('extract', () => {
  test('sends correct request to extract endpoint', async () => {
    const mockResponse = {
      success: true,
      id: 'job-123',
    }

    globalThis.fetch = createMockFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    const client = createFirecrawlClient({ apiKey: 'test-key' })
    const result = await client.extract({
      urls: ['https://example.com'],
      prompt: 'Extract the title',
      schema: { title: { type: 'string' } },
    })

    expect(result).toEqual(mockResponse)

    const calls = getMockCalls()
    const call = calls[0]
    if (!call) throw new Error('No fetch calls')
    const [url, options] = call
    expect(url).toBe('https://api.firecrawl.dev/v2/extract')
    expect(JSON.parse(options.body as string)).toEqual({
      urls: ['https://example.com'],
      prompt: 'Extract the title',
      schema: { title: { type: 'string' } },
    })
  })

  test('getExtractStatus sends GET request', async () => {
    const mockResponse = {
      success: true,
      status: 'completed' as const,
      data: { title: 'Extracted Title' },
    }

    globalThis.fetch = createMockFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    const client = createFirecrawlClient({ apiKey: 'test-key' })
    await client.getExtractStatus('job-123')

    const calls = getMockCalls()
    const call = calls[0]
    if (!call) throw new Error('No fetch calls')
    const [url, options] = call
    expect(url).toBe('https://api.firecrawl.dev/v2/extract/job-123')
    expect(options.method).toBe('GET')
  })
})

describe('retry logic', () => {
  test('retries on 429 rate limit', async () => {
    let callCount = 0

    globalThis.fetch = createMockFetch(() => {
      callCount++
      if (callCount === 1) {
        return Promise.resolve(
          new Response(JSON.stringify({ success: false, error: 'Rate limited' }), {
            status: 429,
            headers: { 'Retry-After': '0' },
          }),
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify({ success: true, data: { markdown: '# Test' } }), {
          status: 200,
        }),
      )
    })

    const client = createFirecrawlClient({ apiKey: 'test-key', retries: 1 })
    const result = await client.scrape({ url: 'https://example.com' })

    expect(result.success).toBe(true)
    expect(callCount).toBe(2)
  })

  test('retries on 500 server error', async () => {
    let callCount = 0

    globalThis.fetch = createMockFetch(() => {
      callCount++
      if (callCount === 1) {
        return Promise.resolve(
          new Response(JSON.stringify({ success: false, error: 'Server error' }), {
            status: 500,
          }),
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify({ success: true, data: { markdown: '# Test' } }), {
          status: 200,
        }),
      )
    })

    const client = createFirecrawlClient({ apiKey: 'test-key', retries: 1 })
    const result = await client.scrape({ url: 'https://example.com' })

    expect(result.success).toBe(true)
    expect(callCount).toBe(2)
  })

  test('returns error after max retries', async () => {
    globalThis.fetch = createMockFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify({ success: false, error: 'Server error' }), {
          status: 500,
        }),
      ),
    )

    const client = createFirecrawlClient({ apiKey: 'test-key', retries: 1 })
    const result = await client.scrape({ url: 'https://example.com' })

    expect(result.success).toBe(false)
  })
})

describe('custom configuration', () => {
  test('uses custom base URL', async () => {
    globalThis.fetch = createMockFetch(() =>
      Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 })),
    )

    const client = createFirecrawlClient({
      apiKey: 'test-key',
      baseUrl: 'https://custom.api.com',
    })
    await client.scrape({ url: 'https://example.com' })

    const calls = getMockCalls()
    const call = calls[0]
    if (!call) throw new Error('No fetch calls')
    const [url] = call
    expect(url).toBe('https://custom.api.com/scrape')
  })
})
