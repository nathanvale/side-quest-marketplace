/**
 * Tests for CLI argument parsing.
 *
 * Note: Full CLI integration tests would require mocking process.argv
 * and the client. These tests focus on the argument parsing logic.
 */

import { describe, expect, test } from 'bun:test'

/**
 * Parses command-line arguments into a structured object.
 * Extracted here for testing.
 */
function parseArgs(args: string[]): {
  command: string
  positional: string[]
  flags: Record<string, string>
} {
  const command = args[0] ?? ''
  const positional: string[] = []
  const flags: Record<string, string> = {}

  let i = 1
  while (i < args.length) {
    const arg = args[i] as string
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const nextArg = args[i + 1]
      const value = nextArg ?? 'true'
      if (!value.startsWith('--')) {
        flags[key] = value
        i += 2
      } else {
        flags[key] = 'true'
        i++
      }
    } else {
      positional.push(arg)
      i++
    }
  }

  return { command, positional, flags }
}

describe('parseArgs', () => {
  test('parses command', () => {
    const result = parseArgs(['scrape'])
    expect(result.command).toBe('scrape')
    expect(result.positional).toEqual([])
    expect(result.flags).toEqual({})
  })

  test('parses positional argument', () => {
    const result = parseArgs(['scrape', 'https://example.com'])
    expect(result.command).toBe('scrape')
    expect(result.positional).toEqual(['https://example.com'])
  })

  test('parses multiple positional arguments', () => {
    const result = parseArgs(['search', 'typescript', 'tutorials'])
    expect(result.command).toBe('search')
    expect(result.positional).toEqual(['typescript', 'tutorials'])
  })

  test('parses flag with value', () => {
    const result = parseArgs(['map', 'https://example.com', '--limit', '50'])
    expect(result.command).toBe('map')
    expect(result.positional).toEqual(['https://example.com'])
    expect(result.flags).toEqual({ limit: '50' })
  })

  test('parses multiple flags', () => {
    const result = parseArgs([
      'scrape',
      'https://example.com',
      '--format',
      'markdown',
      '--timeout',
      '5000',
    ])
    expect(result.flags).toEqual({ format: 'markdown', timeout: '5000' })
  })

  test('handles flag without value as true', () => {
    const result = parseArgs(['scrape', 'https://example.com', '--verbose', '--fast'])
    expect(result.flags.verbose).toBe('true')
    expect(result.flags.fast).toBe('true')
  })

  test('handles empty args', () => {
    const result = parseArgs([])
    expect(result.command).toBe('')
    expect(result.positional).toEqual([])
    expect(result.flags).toEqual({})
  })

  test('parses complex extract command', () => {
    const result = parseArgs([
      'extract',
      'https://example.com',
      '--prompt',
      'Extract the main title',
      '--schema',
      '{"title": {"type": "string"}}',
    ])

    expect(result.command).toBe('extract')
    expect(result.positional).toEqual(['https://example.com'])
    expect(result.flags.prompt).toBe('Extract the main title')
    expect(result.flags.schema).toBe('{"title": {"type": "string"}}')
  })
})
