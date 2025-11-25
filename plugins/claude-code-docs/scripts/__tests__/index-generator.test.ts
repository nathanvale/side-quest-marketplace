import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { IndexGenerator } from '../lib/index-generator'
import type { ManifestEntry } from '../lib/types'

describe('IndexGenerator', () => {
  const testDir = '/tmp/claude-docs-test-index-generator'
  let generator: IndexGenerator

  beforeEach(async () => {
    await rm(testDir, { recursive: true, force: true })
    await mkdir(testDir, { recursive: true })
    generator = new IndexGenerator(testDir)
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  describe('formatTitle', () => {
    test('formats simple filename', () => {
      expect(generator.formatTitle('hooks.md')).toBe('Hooks')
    })

    test('formats filename with underscores', () => {
      expect(generator.formatTitle('sdk_migration-guide.md')).toBe('Sdk Migration Guide')
    })

    test('formats filename with hyphens', () => {
      expect(generator.formatTitle('hooks-guide.md')).toBe('Hooks Guide')
    })

    test('formats multi-word with underscores and hyphens', () => {
      expect(generator.formatTitle('api_v1_getting-started.md')).toBe('Api V1 Getting Started')
    })

    test('handles single character words', () => {
      expect(generator.formatTitle('a-b-c.md')).toBe('A B C')
    })
  })

  describe('createIndex', () => {
    test('creates INDEX.md with sorted files', async () => {
      const files: ManifestEntry[] = [
        {
          url: 'https://code.claude.com/docs/en/hooks',
          filename: 'hooks.md',
          sha256: 'abc123',
          fetched_at: '2025-01-15T10:00:00Z',
        },
        {
          url: 'https://code.claude.com/docs/en/quickstart',
          filename: 'quickstart.md',
          sha256: 'def456',
          fetched_at: '2025-01-15T10:01:00Z',
        },
        {
          url: 'https://code.claude.com/docs/en/analytics',
          filename: 'analytics.md',
          sha256: 'ghi789',
          fetched_at: '2025-01-15T10:02:00Z',
        },
      ]

      await generator.createIndex(files)

      const indexPath = join(testDir, 'INDEX.md')
      const content = await readFile(indexPath, 'utf-8')

      expect(content).toContain('# Claude Code Documentation Index')
      expect(content).toContain('https://code.claude.com/docs/en')
      expect(content).toContain('## Documentation Files')
      expect(content).toContain('- [Analytics](analytics.md)')
      expect(content).toContain('- [Hooks](hooks.md)')
      expect(content).toContain('- [Quickstart](quickstart.md)')

      // Verify alphabetical order
      const analyticsIndex = content.indexOf('[Analytics]')
      const hooksIndex = content.indexOf('[Hooks]')
      const quickstartIndex = content.indexOf('[Quickstart]')
      expect(analyticsIndex).toBeLessThan(hooksIndex)
      expect(hooksIndex).toBeLessThan(quickstartIndex)
    })

    test('handles empty files array', async () => {
      await generator.createIndex([])

      const indexPath = join(testDir, 'INDEX.md')
      const content = await readFile(indexPath, 'utf-8')

      expect(content).toContain('# Claude Code Documentation Index')
      expect(content).toContain('## Documentation Files')
      expect(content).not.toContain('- [')
    })

    test('handles nested path filenames', async () => {
      const files: ManifestEntry[] = [
        {
          url: 'https://code.claude.com/docs/en/sdk/migration-guide',
          filename: 'sdk_migration-guide.md',
          sha256: 'abc123',
          fetched_at: '2025-01-15T10:00:00Z',
        },
      ]

      await generator.createIndex(files)

      const indexPath = join(testDir, 'INDEX.md')
      const content = await readFile(indexPath, 'utf-8')

      expect(content).toContain('- [Sdk Migration Guide](sdk_migration-guide.md)')
    })

    test('sorts files case-insensitively', async () => {
      const files: ManifestEntry[] = [
        {
          url: 'https://code.claude.com/docs/en/zebra',
          filename: 'zebra.md',
          sha256: 'abc',
          fetched_at: '2025-01-15T10:00:00Z',
        },
        {
          url: 'https://code.claude.com/docs/en/apple',
          filename: 'Apple.md',
          sha256: 'def',
          fetched_at: '2025-01-15T10:01:00Z',
        },
        {
          url: 'https://code.claude.com/docs/en/banana',
          filename: 'banana.md',
          sha256: 'ghi',
          fetched_at: '2025-01-15T10:02:00Z',
        },
      ]

      await generator.createIndex(files)

      const indexPath = join(testDir, 'INDEX.md')
      const content = await readFile(indexPath, 'utf-8')

      const appleIndex = content.indexOf('[Apple]')
      const bananaIndex = content.indexOf('[Banana]')
      const zebraIndex = content.indexOf('[Zebra]')

      expect(appleIndex).toBeLessThan(bananaIndex)
      expect(bananaIndex).toBeLessThan(zebraIndex)
    })
  })
})
