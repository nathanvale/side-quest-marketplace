#!/usr/bin/env bun
/**
 * Firecrawl CLI
 *
 * Command-line interface for Firecrawl operations.
 * Designed for use by Claude Code slash commands.
 *
 * Usage:
 *   bun run src/cli.ts scrape <url> [--format markdown|summary]
 *   bun run src/cli.ts map <url> [--limit N]
 *   bun run src/cli.ts search <query> [--limit N]
 *   bun run src/cli.ts extract <urls...> --prompt "..." [--schema '{...}']
 */

import { createFirecrawlClient } from './client'
import {
  formatExtractResponse,
  formatMapResponse,
  formatScrapeResponse,
  formatSearchResponse,
} from './formatters'
import type { ScrapeFormat } from './types'

/**
 * Parses command-line arguments into a structured object.
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

/**
 * Prints usage information and exits.
 */
function printUsage(): never {
  console.log(`
Firecrawl CLI - Web scraping and search

Usage:
  firecrawl scrape <url> [options]
  firecrawl map <url> [options]
  firecrawl search <query> [options]
  firecrawl extract <url> [options]

Commands:
  scrape    Scrape content from a single URL
  map       Discover all URLs on a website
  search    Search the web and optionally scrape results
  extract   Extract structured data using LLM

Options:
  --format <type>   Output format: markdown, summary (scrape only)
  --limit <n>       Maximum results (map, search)
  --prompt <text>   Extraction prompt (extract only)
  --schema <json>   JSON schema for extraction (extract only)

Environment:
  FIRECRAWL_API_KEY   Your Firecrawl API key (required)

Examples:
  firecrawl scrape https://example.com
  firecrawl map https://example.com --limit 100
  firecrawl search "typescript tutorials" --limit 5
  firecrawl extract https://example.com --prompt "Extract the main heading"
`)
  process.exit(1)
}

/**
 * Main CLI entry point.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2)

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage()
  }

  const { command, positional, flags } = parseArgs(args)

  // Validate API key
  if (!process.env.FIRECRAWL_API_KEY) {
    console.error('Error: FIRECRAWL_API_KEY environment variable is required')
    process.exit(1)
  }

  const client = createFirecrawlClient()

  try {
    switch (command) {
      case 'scrape': {
        const url = positional[0]
        if (!url) {
          console.error('Error: URL required for scrape command')
          process.exit(1)
        }

        const format = (flags.format ?? 'markdown') as ScrapeFormat
        const formats: ScrapeFormat[] = [format]

        const result = await client.scrape({
          url,
          formats,
          onlyMainContent: true,
        })
        console.log(formatScrapeResponse(result))
        break
      }

      case 'map': {
        const url = positional[0]
        if (!url) {
          console.error('Error: URL required for map command')
          process.exit(1)
        }

        const limit = flags.limit ? Number.parseInt(flags.limit, 10) : 100

        const result = await client.map({ url, limit })
        console.log(formatMapResponse(result))
        break
      }

      case 'search': {
        const query = positional.join(' ')
        if (!query) {
          console.error('Error: Query required for search command')
          process.exit(1)
        }

        const limit = flags.limit ? Number.parseInt(flags.limit, 10) : 5

        const result = await client.search({
          query,
          limit,
          scrapeOptions: { formats: ['markdown'], onlyMainContent: true },
        })
        console.log(formatSearchResponse(result))
        break
      }

      case 'extract': {
        const url = positional[0]
        if (!url) {
          console.error('Error: URL required for extract command')
          process.exit(1)
        }

        const prompt = flags.prompt
        if (!prompt) {
          console.error('Error: --prompt required for extract command')
          process.exit(1)
        }

        const schema = flags.schema ? JSON.parse(flags.schema) : undefined

        // Start extraction
        const startResult = await client.extract({
          urls: [url],
          prompt,
          schema,
        })

        if (!startResult.success || !('id' in startResult)) {
          console.error(
            'Error:',
            (startResult as { error?: string }).error ??
              'Extract failed to start',
          )
          process.exit(1)
        }

        // Poll for completion
        const jobId = startResult.id as string
        let attempts = 0
        const maxAttempts = 30

        while (attempts < maxAttempts) {
          await sleep(2000)
          const statusResult = await client.getExtractStatus(jobId)

          if (!statusResult.success) {
            console.error(
              'Error:',
              (statusResult as { error?: string }).error ??
                'Status check failed',
            )
            process.exit(1)
          }

          if ('status' in statusResult && statusResult.status === 'completed') {
            console.log(formatExtractResponse(statusResult))
            return
          }

          if ('status' in statusResult && statusResult.status === 'failed') {
            console.error('Extraction failed')
            process.exit(1)
          }

          attempts++
        }

        console.error('Extraction timed out')
        process.exit(1)
        break
      }

      default:
        console.error(`Unknown command: ${command}`)
        printUsage()
    }
  } catch (error) {
    console.error('Error:', (error as Error).message)
    process.exit(1)
  }
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Run CLI
main()
