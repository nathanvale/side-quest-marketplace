/**
 * Tests for module exports.
 */

import { describe, expect, test } from 'bun:test'
import {
  createFirecrawlClient,
  formatExtractResponse,
  formatMapResponse,
  formatScrapeResponse,
  formatSearchResponse,
  formatUrlList,
  isFirecrawlError,
} from './index'

describe('module exports', () => {
  test('exports createFirecrawlClient', () => {
    expect(typeof createFirecrawlClient).toBe('function')
  })

  test('exports formatters', () => {
    expect(typeof formatScrapeResponse).toBe('function')
    expect(typeof formatMapResponse).toBe('function')
    expect(typeof formatSearchResponse).toBe('function')
    expect(typeof formatExtractResponse).toBe('function')
    expect(typeof formatUrlList).toBe('function')
  })

  test('exports isFirecrawlError type guard', () => {
    expect(typeof isFirecrawlError).toBe('function')

    // Test the type guard
    const errorResult = { success: false, error: 'Test error' }
    const successResult = { success: true, data: {} }

    expect(isFirecrawlError(errorResult)).toBe(true)
    expect(isFirecrawlError(successResult)).toBe(false)
  })
})
