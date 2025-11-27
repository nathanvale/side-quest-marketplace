#!/usr/bin/env bun

/**
 * Bash History MCP Server
 *
 * Provides search and retrieval of bash command history using atuin.
 * Displays exit codes, timestamps, and command text.
 */

import { execSync } from 'node:child_process'
import { startServer, tool, z } from 'mcpez'

// Types

interface HistoryCommand {
  time: string
  exit_code: number | string
  command: string
}

interface HistoryResult {
  count: number
  commands: HistoryCommand[]
  message?: string
  source?: string
}

interface ErrorResult {
  error: string
}

type SearchResult = HistoryResult | ErrorResult

function isError(result: SearchResult): result is ErrorResult {
  return typeof result === 'object' && result !== null && 'error' in result
}

/**
 * Execute atuin search command and parse results
 */
function searchHistory(
  query: string,
  limit = 10,
  includeFailed = false,
): SearchResult {
  try {
    // Use --exit 0 to filter only successful commands when not including failed
    const exitFilter = includeFailed ? '' : '--exit 0'
    const escapedQuery = query.replace(/"/g, '\\"')
    const cmd = `atuin search --limit ${limit} --search-mode fuzzy --filter-mode global --format "{time}\\t{exit}\\t{command}" ${exitFilter} "${escapedQuery}"`

    const output = execSync(cmd, { encoding: 'utf8' })

    if (!output.trim()) {
      return {
        count: 0,
        commands: [],
        message: `No commands found matching: ${query}`,
      }
    }

    const lines = output.trim().split('\n')
    const commands: HistoryCommand[] = lines.map((line) => {
      const [time, exitCodeStr, ...commandParts] = line.split('\t')
      return {
        time: time ?? '',
        exit_code: Number.parseInt(exitCodeStr ?? '0', 10),
        command: commandParts.join('\t'),
      }
    })

    return {
      count: commands.length,
      commands,
    }
  } catch {
    // If atuin fails, fall back to zsh history
    try {
      const escapedQuery = query.replace(/"/g, '\\"')
      const fallbackCmd = `fc -l -${limit} | grep -i "${escapedQuery}" | awk '{$1=""; print $0}' | sed 's/^ //'`
      const output = execSync(fallbackCmd, {
        encoding: 'utf8',
        shell: '/bin/zsh',
      })

      const lines = output
        .trim()
        .split('\n')
        .filter((l) => l)
      const commands: HistoryCommand[] = lines.map((command) => ({
        time: 'N/A',
        exit_code: 'N/A',
        command: command.trim(),
      }))

      return {
        count: commands.length,
        commands,
        source: 'zsh_history_fallback',
      }
    } catch (fallbackError) {
      const err = fallbackError as Error
      return { error: `Failed to search history: ${err.message}` }
    }
  }
}

/**
 * Get recent command history
 */
function getRecentHistory(limit = 10, includeFailed = false): SearchResult {
  return searchHistory('', limit * 2, includeFailed)
}

/**
 * Format search results for display
 */
function formatResults(results: SearchResult): string {
  if (isError(results)) {
    return `Error: ${results.error}`
  }

  if (results.count === 0) {
    return results.message || 'No commands found in history.'
  }

  let output = `Found ${results.count} command${results.count === 1 ? '' : 's'}:\n\n`

  results.commands.forEach((cmd, idx) => {
    const exitIcon =
      cmd.exit_code === 0 ? '[OK]' : cmd.exit_code === 'N/A' ? '[?]' : '[FAIL]'
    const exitDisplay = cmd.exit_code === 'N/A' ? 'N/A' : `${cmd.exit_code}`

    output += `${idx + 1}. ${exitIcon} Exit: ${exitDisplay} | Time: ${cmd.time}\n`
    output += `   ${cmd.command}\n\n`
  })

  if (results.source === 'zsh_history_fallback') {
    output += '\n[!] Using zsh history fallback (atuin unavailable)\n'
  }

  return output.trim()
}

// Register tools using Zod schemas

tool(
  'search_history',
  {
    description:
      'Search command history using atuin. Returns matching commands with timestamps, exit codes, and full command text.',
    inputSchema: {
      query: z.string().describe('Search query to find matching commands'),
      limit: z
        .number()
        .optional()
        .describe('Maximum number of results to return (default: 10)'),
      include_failed: z
        .boolean()
        .optional()
        .describe(
          'Include commands that failed (non-zero exit code). Default: false',
        ),
    },
  },
  async (args: Record<string, unknown>) => {
    const { query, limit, include_failed } = args as {
      query: string
      limit?: number
      include_failed?: boolean
    }
    const results = searchHistory(query, limit ?? 10, include_failed ?? false)
    return {
      content: [{ type: 'text' as const, text: formatResults(results) }],
    }
  },
)

tool(
  'get_recent_history',
  {
    description:
      'Get recent command history from atuin with timestamps and exit codes.',
    inputSchema: {
      limit: z
        .number()
        .optional()
        .describe('Number of recent commands to retrieve (default: 10)'),
      include_failed: z
        .boolean()
        .optional()
        .describe(
          'Include commands that failed (non-zero exit code). Default: false',
        ),
    },
  },
  async (args: Record<string, unknown>) => {
    const { limit, include_failed } = args as {
      limit?: number
      include_failed?: boolean
    }
    const results = getRecentHistory(limit ?? 10, include_failed ?? false)
    return {
      content: [{ type: 'text' as const, text: formatResults(results) }],
    }
  },
)

// Start the MCP server
startServer('bash-history', { version: '1.0.0' })
