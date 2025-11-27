#!/usr/bin/env bun

/**
 * Bash History MCP Server
 *
 * Provides search and retrieval of bash command history using atuin.
 * Displays exit codes, timestamps, and command text.
 */

import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
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

type SearchMode = 'fuzzy' | 'prefix' | 'full-text'

// Context types for git branch and session tracking

interface ContextEntry {
  ts: string
  cmd: string
  branch: string
  session: string
  cwd: string
}

interface ContextResult {
  count: number
  entries: ContextEntry[]
  message?: string
}

type ContextSearchResult = ContextResult | ErrorResult

interface SearchOptions {
  query: string
  limit?: number
  includeFailed?: boolean
  cwd?: string
  since?: string
  until?: string
  searchMode?: SearchMode
}

function isError(
  result: SearchResult | ContextSearchResult | InsightsResult,
): result is ErrorResult {
  return typeof result === 'object' && result !== null && 'error' in result
}

/**
 * Build the atuin search command with all filtering options
 */
function buildAtuinCommand(options: SearchOptions): string {
  const {
    query,
    limit = 10,
    includeFailed = false,
    cwd,
    since,
    until,
    searchMode = 'fuzzy',
  } = options

  const parts = ['atuin', 'search']
  parts.push(`--limit ${limit}`)
  parts.push(`--search-mode ${searchMode}`)
  parts.push('--filter-mode global')
  parts.push('--format "{time}\\t{exit}\\t{command}"')

  if (!includeFailed) parts.push('--exit 0')
  if (cwd) parts.push(`--cwd "${cwd.replace(/"/g, '\\"')}"`)
  if (since) parts.push(`--after "${since.replace(/"/g, '\\"')}"`)
  if (until) parts.push(`--before "${until.replace(/"/g, '\\"')}"`)

  const escapedQuery = query.replace(/"/g, '\\"')
  parts.push(`"${escapedQuery}"`)

  return parts.join(' ')
}

/**
 * Execute atuin search command and parse results
 */
function searchHistory(options: SearchOptions): SearchResult
function searchHistory(
  query: string,
  limit?: number,
  includeFailed?: boolean,
): SearchResult
function searchHistory(
  queryOrOptions: string | SearchOptions,
  limit = 10,
  includeFailed = false,
): SearchResult {
  // Normalize to options object
  const options: SearchOptions =
    typeof queryOrOptions === 'string'
      ? { query: queryOrOptions, limit, includeFailed }
      : queryOrOptions

  try {
    const cmd = buildAtuinCommand(options)
    const output = execSync(cmd, { encoding: 'utf8' })

    if (!output.trim()) {
      return {
        count: 0,
        commands: [],
        message: `No commands found matching: ${options.query}`,
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
      const escapedQuery = options.query.replace(/"/g, '\\"')
      const fallbackLimit = options.limit ?? 10
      const fallbackCmd = `fc -l -${fallbackLimit} | grep -i "${escapedQuery}" | awk '{$1=""; print $0}' | sed 's/^ //'`
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
 * Search context entries by git branch or session ID
 */
function searchByContext(options: {
  branch?: string
  sessionId?: string
  limit?: number
}): ContextSearchResult {
  const { branch, sessionId, limit = 20 } = options
  const contextFile = join(homedir(), '.claude', 'atuin-context.jsonl')

  if (!existsSync(contextFile)) {
    return {
      count: 0,
      entries: [],
      message:
        'No context history found. Commands will be tracked as you use Claude Code.',
    }
  }

  try {
    const content = readFileSync(contextFile, 'utf8')
    const lines = content.trim().split('\n').filter(Boolean)

    // Parse and filter entries
    const entries: ContextEntry[] = []
    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as ContextEntry
        // Filter by branch and/or session
        if (
          branch &&
          !entry.branch.toLowerCase().includes(branch.toLowerCase())
        ) {
          continue
        }
        if (sessionId && entry.session !== sessionId) {
          continue
        }
        entries.push(entry)
      } catch {
        // Skip malformed lines
      }
    }

    // Return most recent entries first, limited
    const sortedEntries = entries.reverse().slice(0, limit)

    if (sortedEntries.length === 0) {
      const filters = []
      if (branch) filters.push(`branch: ${branch}`)
      if (sessionId) filters.push(`session: ${sessionId}`)
      return {
        count: 0,
        entries: [],
        message: `No commands found matching: ${filters.join(', ')}`,
      }
    }

    return {
      count: sortedEntries.length,
      entries: sortedEntries,
    }
  } catch (err) {
    const error = err as Error
    return { error: `Failed to read context history: ${error.message}` }
  }
}

/**
 * Format context search results for display
 */
function formatContextResults(results: ContextSearchResult): string {
  if (isError(results)) {
    return `Error: ${results.error}`
  }

  if (results.count === 0) {
    return results.message || 'No commands found in context history.'
  }

  let output = `Found ${results.count} command${results.count === 1 ? '' : 's'}:\n\n`

  results.entries.forEach((entry, idx) => {
    const branchDisplay = entry.branch ? `[${entry.branch}]` : '[no branch]'
    output += `${idx + 1}. ${branchDisplay} ${entry.ts}\n`
    output += `   Session: ${entry.session}\n`
    output += `   CWD: ${entry.cwd}\n`
    output += `   ${entry.cmd}\n\n`
  })

  return output.trim()
}

type InsightPeriod = 'today' | 'week' | 'month' | 'all'
type InsightFocus = 'frequent' | 'failures' | 'all'

interface HistoryInsights {
  period: string
  stats?: string
  failedCommands?: { command: string; count: number; lastTime: string }[]
  message?: string
}

type InsightsResult = HistoryInsights | ErrorResult

/**
 * Get history insights using atuin stats
 */
function getHistoryInsights(
  period: InsightPeriod = 'today',
  focus: InsightFocus = 'all',
): InsightsResult {
  const insights: HistoryInsights = { period }

  try {
    // Get stats for the period
    if (focus === 'frequent' || focus === 'all') {
      try {
        const statsCmd =
          period === 'all' ? 'atuin stats' : `atuin stats ${period}`
        insights.stats = execSync(statsCmd, { encoding: 'utf8' })
      } catch {
        // Stats might fail if no history for period
        insights.stats = `No statistics available for ${period}`
      }
    }

    // Get failed commands
    if (focus === 'failures' || focus === 'all') {
      try {
        // Search for failed commands (exit code != 0)
        const afterFlag =
          period === 'today'
            ? '--after "today"'
            : period === 'week'
              ? '--after "1 week ago"'
              : period === 'month'
                ? '--after "1 month ago"'
                : ''

        const failedCmd = `atuin search --limit 50 ${afterFlag} --format "{time}\\t{exit}\\t{command}" 2>/dev/null || true`
        const output = execSync(failedCmd, {
          encoding: 'utf8',
          shell: '/bin/bash',
        })

        if (output.trim()) {
          // Parse and count failed commands
          const failedCounts = new Map<
            string,
            { count: number; lastTime: string }
          >()
          for (const line of output.trim().split('\n')) {
            const [time, exitStr, ...cmdParts] = line.split('\t')
            const exitCode = Number.parseInt(exitStr ?? '0', 10)
            if (exitCode !== 0) {
              const cmd = cmdParts.join('\t').trim()
              // Use first word as command key for grouping
              const cmdKey = cmd.split(' ')[0] ?? cmd
              const existing = failedCounts.get(cmdKey)
              if (existing) {
                existing.count++
              } else {
                failedCounts.set(cmdKey, { count: 1, lastTime: time ?? '' })
              }
            }
          }

          // Convert to sorted array
          insights.failedCommands = Array.from(failedCounts.entries())
            .map(([command, { count, lastTime }]) => ({
              command,
              count,
              lastTime,
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10)
        }
      } catch {
        // Failed commands search might fail
      }
    }

    return insights
  } catch (err) {
    const error = err as Error
    return { error: `Failed to get history insights: ${error.message}` }
  }
}

/**
 * Format history insights for display
 */
function formatInsights(results: InsightsResult): string {
  if (isError(results)) {
    return `Error: ${results.error}`
  }

  let output = `## Command History Insights (${results.period})\n\n`

  if (results.stats) {
    output += `### Most Frequent Commands\n\`\`\`\n${results.stats}\`\`\`\n\n`
  }

  if (results.failedCommands && results.failedCommands.length > 0) {
    output += `### Failed Commands (${results.failedCommands.reduce((sum, f) => sum + f.count, 0)} failures)\n`
    for (const { command, count, lastTime } of results.failedCommands) {
      output += `- ${command} (${count} failure${count === 1 ? '' : 's'}) - last: ${lastTime}\n`
    }
    output += '\n'
  } else if (results.failedCommands) {
    output += '### Failed Commands\nNo failed commands in this period.\n\n'
  }

  return output.trim()
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
      'Search command history using atuin. Returns matching commands with timestamps, exit codes, and full command text. Supports filtering by directory, time range, and search mode.',
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
      cwd: z
        .string()
        .optional()
        .describe('Filter to commands run in this directory'),
      since: z
        .string()
        .optional()
        .describe(
          'Commands after this time (e.g., "1 hour ago", "yesterday", "2024-01-15")',
        ),
      until: z
        .string()
        .optional()
        .describe(
          'Commands before this time (e.g., "1 hour ago", "yesterday", "2024-01-15")',
        ),
      search_mode: z
        .enum(['fuzzy', 'prefix', 'full-text'])
        .optional()
        .describe(
          'Search mode: fuzzy (default), prefix (starts with), or full-text (exact match anywhere)',
        ),
    },
  },
  async (args: Record<string, unknown>) => {
    const { query, limit, include_failed, cwd, since, until, search_mode } =
      args as {
        query: string
        limit?: number
        include_failed?: boolean
        cwd?: string
        since?: string
        until?: string
        search_mode?: SearchMode
      }
    const results = searchHistory({
      query,
      limit: limit ?? 10,
      includeFailed: include_failed ?? false,
      cwd,
      since,
      until,
      searchMode: search_mode ?? 'fuzzy',
    })
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

tool(
  'search_by_context',
  {
    description:
      'Search command history by git branch or Claude session ID. Use this to find commands you ran on a specific branch or in a specific session.',
    inputSchema: {
      branch: z
        .string()
        .optional()
        .describe(
          'Filter by git branch name (partial match, case-insensitive)',
        ),
      session_id: z
        .string()
        .optional()
        .describe('Filter by Claude session ID (exact match)'),
      limit: z
        .number()
        .optional()
        .describe('Maximum number of results to return (default: 20)'),
    },
  },
  async (args: Record<string, unknown>) => {
    const { branch, session_id, limit } = args as {
      branch?: string
      session_id?: string
      limit?: number
    }
    const results = searchByContext({
      branch,
      sessionId: session_id,
      limit: limit ?? 20,
    })
    return {
      content: [{ type: 'text' as const, text: formatContextResults(results) }],
    }
  },
)

tool(
  'history_insights',
  {
    description:
      'Get insights about command history: most frequent commands and failure patterns. Helps identify common workflows and recurring errors.',
    inputSchema: {
      period: z
        .enum(['today', 'week', 'month', 'all'])
        .optional()
        .describe('Time period to analyze (default: today)'),
      focus: z
        .enum(['frequent', 'failures', 'all'])
        .optional()
        .describe(
          'What to focus on: frequent commands, failures, or all (default: all)',
        ),
    },
  },
  async (args: Record<string, unknown>) => {
    const { period, focus } = args as {
      period?: InsightPeriod
      focus?: InsightFocus
    }
    const results = getHistoryInsights(period ?? 'today', focus ?? 'all')
    return {
      content: [{ type: 'text' as const, text: formatInsights(results) }],
    }
  },
)

// Start the MCP server
startServer('bash-history', { version: '1.0.0' })
