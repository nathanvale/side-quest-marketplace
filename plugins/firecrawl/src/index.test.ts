import { describe, expect, test } from 'bun:test'
import { processFirecrawl } from './index'

describe('processFirecrawl', () => {
  test('returns success with message', () => {
    const result = processFirecrawl('test input')
    expect(result.success).toBe(true)
    expect(result.message).toBe('Processed: test input')
  })
})
