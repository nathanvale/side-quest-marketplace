/**
 * Kit Plugin Formatters
 *
 * Response formatters for MCP tool output in markdown and JSON formats.
 */

import type {
  ErrorResult,
  GrepResult,
  KitResult,
  SemanticResult,
  SymbolsResult,
} from './types.js'
import { isError, ResponseFormat } from './types.js'

// ============================================================================
// Grep Formatters
// ============================================================================

/**
 * Format grep results for display.
 * @param result - Grep result or error
 * @param format - Output format (markdown or json)
 * @returns Formatted string
 */
export function formatGrepResults(
  result: KitResult<GrepResult>,
  format: ResponseFormat = ResponseFormat.MARKDOWN,
): string {
  if (isError(result)) {
    return formatError(result, format)
  }

  if (format === ResponseFormat.JSON) {
    return JSON.stringify(result, null, 2)
  }

  // Markdown format
  const lines: string[] = []

  lines.push(`## Grep Results`)
  lines.push('')
  lines.push(`Found **${result.count}** matches for \`${result.pattern}\``)
  lines.push('')

  if (result.matches.length === 0) {
    lines.push('_No matches found._')
    return lines.join('\n')
  }

  // Group matches by file
  const byFile = new Map<string, typeof result.matches>()
  for (const match of result.matches) {
    const existing = byFile.get(match.file) ?? []
    existing.push(match)
    byFile.set(match.file, existing)
  }

  for (const [file, matches] of byFile) {
    lines.push(`### ${file}`)
    lines.push('')

    for (const match of matches) {
      const lineNum = match.line ? `:${match.line}` : ''
      lines.push(`- **${file}${lineNum}**: ${truncate(match.content, 100)}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

// ============================================================================
// Semantic Formatters
// ============================================================================

/**
 * Format semantic search results for display.
 * @param result - Semantic result or error
 * @param format - Output format (markdown or json)
 * @returns Formatted string
 */
export function formatSemanticResults(
  result: KitResult<SemanticResult>,
  format: ResponseFormat = ResponseFormat.MARKDOWN,
): string {
  if (isError(result)) {
    return formatError(result, format)
  }

  if (format === ResponseFormat.JSON) {
    return JSON.stringify(result, null, 2)
  }

  // Markdown format
  const lines: string[] = []

  lines.push(`## Semantic Search Results`)
  lines.push('')

  // Show fallback notice if applicable
  if (result.fallback && result.installHint) {
    lines.push('> **Note:** ' + result.installHint.split('\n')[0])
    lines.push('>')
    lines.push(
      '> Using text search fallback. Results may be less relevant than semantic search.',
    )
    lines.push('')
  }

  lines.push(`Found **${result.count}** matches for query: _"${result.query}"_`)
  lines.push('')

  if (result.matches.length === 0) {
    lines.push('_No matches found._')
    return lines.join('\n')
  }

  result.matches.forEach((match, i) => {
    const score = (match.score * 100).toFixed(1)
    const lineInfo =
      match.startLine && match.endLine
        ? `:${match.startLine}-${match.endLine}`
        : match.startLine
          ? `:${match.startLine}`
          : ''

    lines.push(`### ${i + 1}. ${match.file}${lineInfo} (${score}% relevance)`)
    lines.push('')
    lines.push('```')
    lines.push(truncate(match.chunk, 500))
    lines.push('```')
    lines.push('')
  })

  return lines.join('\n')
}

// ============================================================================
// Symbols Formatters
// ============================================================================

/**
 * Format symbols results for display.
 * @param result - Symbols result or error
 * @param format - Output format (markdown or json)
 * @returns Formatted string
 */
export function formatSymbolsResults(
  result: KitResult<SymbolsResult>,
  format: ResponseFormat = ResponseFormat.MARKDOWN,
): string {
  if (isError(result)) {
    return formatError(result, format)
  }

  if (format === ResponseFormat.JSON) {
    return JSON.stringify(result, null, 2)
  }

  // Markdown format
  const lines: string[] = []

  lines.push(`## Code Symbols`)
  lines.push('')
  lines.push(`Found **${result.count}** symbols in \`${result.path}\``)
  lines.push('')

  if (result.symbols.length === 0) {
    lines.push('_No symbols found._')
    return lines.join('\n')
  }

  // Group by type
  const byType = new Map<string, typeof result.symbols>()
  for (const symbol of result.symbols) {
    const existing = byType.get(symbol.type) ?? []
    existing.push(symbol)
    byType.set(symbol.type, existing)
  }

  // Sort types for consistent output
  const sortedTypes = [...byType.keys()].sort()

  for (const type of sortedTypes) {
    const symbols = byType.get(type)!
    const icon = getSymbolIcon(type)

    lines.push(`### ${icon} ${capitalize(type)}s (${symbols.length})`)
    lines.push('')

    for (const symbol of symbols) {
      const loc = symbol.endLine
        ? `${symbol.startLine}-${symbol.endLine}`
        : String(symbol.startLine)
      lines.push(`- **${symbol.name}** - \`${symbol.file}:${loc}\``)
    }
    lines.push('')
  }

  return lines.join('\n')
}

// ============================================================================
// Error Formatters
// ============================================================================

/**
 * Format an error result.
 * @param error - Error result
 * @param format - Output format
 * @returns Formatted string
 */
export function formatError(
  error: ErrorResult,
  format: ResponseFormat = ResponseFormat.MARKDOWN,
): string {
  if (format === ResponseFormat.JSON) {
    return JSON.stringify(error, null, 2)
  }

  const lines: string[] = []
  lines.push(`## Error`)
  lines.push('')
  lines.push(`**${error.error}**`)

  if (error.hint) {
    lines.push('')
    lines.push(`💡 **Hint:** ${error.hint}`)
  }

  return lines.join('\n')
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Truncate a string to a maximum length.
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 3) + '...'
}

/**
 * Capitalize the first letter of a string.
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Get an icon for a symbol type.
 */
function getSymbolIcon(type: string): string {
  const icons: Record<string, string> = {
    function: '📦',
    class: '📚',
    method: '🔧',
    property: '🏷️',
    variable: '📌',
    constant: '🔒',
    type: '📝',
    interface: '📋',
    enum: '📊',
    module: '📁',
  }
  return icons[type.toLowerCase()] ?? '•'
}
