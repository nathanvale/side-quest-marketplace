/**
 * Kit CLI Wrapper
 *
 * Pure functions for executing Kit CLI commands with proper error handling.
 * Uses spawnSync for synchronous execution to fit MCP tool patterns.
 */

import {
  type SpawnSyncOptionsWithStringEncoding,
  spawnSync,
} from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createErrorFromOutput,
  isSemanticUnavailableError,
  KitError,
  KitErrorType,
  SEMANTIC_INSTALL_HINT,
} from './errors.js'
import {
  createCorrelationId,
  grepLogger,
  semanticLogger,
  symbolsLogger,
} from './logger.js'
import type {
  CodeSymbol,
  GrepMatch,
  GrepOptions,
  GrepResult,
  KitResult,
  SemanticMatch,
  SemanticOptions,
  SemanticResult,
  SymbolsOptions,
  SymbolsResult,
} from './types.js'
import {
  GREP_TIMEOUT,
  getDefaultKitPath,
  SEMANTIC_TIMEOUT,
  SYMBOLS_TIMEOUT,
} from './types.js'

// ============================================================================
// Kit CLI Execution
// ============================================================================

/**
 * Check if Kit CLI is installed and available in PATH.
 * @returns True if kit command is available
 */
export function isKitInstalled(): boolean {
  try {
    const result = spawnSync('kit', ['--version'], {
      encoding: 'utf8',
      timeout: 5000,
    })
    return result.status === 0
  } catch {
    return false
  }
}

/**
 * Get Kit CLI version.
 * @returns Version string or null if not installed
 */
export function getKitVersion(): string | null {
  try {
    const result = spawnSync('kit', ['--version'], {
      encoding: 'utf8',
      timeout: 5000,
    })
    if (result.status === 0 && result.stdout) {
      return result.stdout.trim()
    }
    return null
  } catch {
    return null
  }
}

/**
 * Execute a Kit CLI command.
 * @param args - Arguments to pass to kit
 * @param options - Execution options
 * @returns Execution result with stdout, stderr, and exit code
 */
function executeKit(
  args: string[],
  options: {
    timeout?: number
    cwd?: string
  } = {},
): { stdout: string; stderr: string; exitCode: number } {
  const { timeout = 30000, cwd } = options

  const spawnOptions: SpawnSyncOptionsWithStringEncoding = {
    encoding: 'utf8',
    timeout,
    maxBuffer: 10 * 1024 * 1024, // 10MB
    ...(cwd && { cwd }),
  }

  const result = spawnSync('kit', args, spawnOptions)

  // Handle spawn errors (e.g., command not found)
  if (result.error) {
    const errorMessage = result.error.message || 'Failed to execute kit'
    return {
      stdout: '',
      stderr: errorMessage,
      exitCode: 1,
    }
  }

  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.status ?? 1,
  }
}

// ============================================================================
// Grep Execution
// ============================================================================

/**
 * Raw grep match as returned by Kit CLI.
 */
interface RawGrepMatch {
  file: string
  line_number: number
  line_content: string
}

/**
 * Execute kit grep command.
 * @param options - Grep options
 * @returns Grep result or error
 */
export function executeKitGrep(options: GrepOptions): KitResult<GrepResult> {
  const cid = createCorrelationId()
  const startTime = Date.now()

  // Check if Kit is installed
  if (!isKitInstalled()) {
    grepLogger.error('Kit not installed', { cid })
    return new KitError(KitErrorType.KitNotInstalled).toJSON()
  }

  const {
    pattern,
    path = getDefaultKitPath(),
    caseSensitive = true,
    include,
    exclude,
    maxResults = 100,
    directory,
  } = options

  // Build command arguments
  const args: string[] = ['grep', path, pattern]

  // Add options
  if (!caseSensitive) {
    args.push('--ignore-case')
  }

  if (include) {
    args.push('--include', include)
  }

  if (exclude) {
    args.push('--exclude', exclude)
  }

  args.push('--max-results', String(maxResults))

  if (directory) {
    args.push('--directory', directory)
  }

  // Use temp file for JSON output (kit grep doesn't support --format json)
  const tempFile = join(tmpdir(), `kit-grep-${cid}.json`)
  args.push('--output', tempFile)

  grepLogger.info('Executing kit grep', {
    cid,
    pattern,
    path,
    args,
  })

  try {
    const result = executeKit(args, { timeout: GREP_TIMEOUT })

    // Check for errors
    if (result.exitCode !== 0) {
      grepLogger.error('Grep failed', {
        cid,
        exitCode: result.exitCode,
        stderr: result.stderr,
        durationMs: Date.now() - startTime,
      })

      // Clean up temp file if it exists
      if (existsSync(tempFile)) {
        rmSync(tempFile)
      }

      return createErrorFromOutput(result.stderr, result.exitCode).toJSON()
    }

    // Read and parse JSON output
    if (!existsSync(tempFile)) {
      grepLogger.error('Temp file not created', { cid })
      return new KitError(
        KitErrorType.OutputParseError,
        'Grep completed but output file not found',
      ).toJSON()
    }

    const jsonContent = readFileSync(tempFile, 'utf8')
    rmSync(tempFile) // Clean up

    let rawMatches: RawGrepMatch[]
    try {
      rawMatches = JSON.parse(jsonContent)
    } catch {
      grepLogger.error('Failed to parse grep output', { cid, jsonContent })
      return new KitError(
        KitErrorType.OutputParseError,
        'Failed to parse grep JSON output',
      ).toJSON()
    }

    // Transform to our format
    const matches: GrepMatch[] = rawMatches.map((m) => ({
      file: m.file,
      line: m.line_number,
      content: m.line_content,
    }))

    grepLogger.info('Grep completed', {
      cid,
      pattern,
      matchCount: matches.length,
      durationMs: Date.now() - startTime,
    })

    return {
      count: matches.length,
      matches,
      pattern,
      path,
    }
  } catch (error) {
    // Clean up temp file if it exists
    if (existsSync(tempFile)) {
      rmSync(tempFile)
    }

    const message = error instanceof Error ? error.message : 'Unknown error'
    grepLogger.error('Grep threw exception', { cid, error: message })
    return new KitError(KitErrorType.KitCommandFailed, message).toJSON()
  }
}

// ============================================================================
// Symbols Execution
// ============================================================================

/**
 * Raw symbol as returned by Kit CLI.
 */
interface RawSymbol {
  name: string
  type: string
  file: string
  start_line: number
  end_line?: number
  code?: string
}

/**
 * Execute kit symbols command.
 * @param options - Symbols options
 * @returns Symbols result or error
 */
export function executeKitSymbols(
  options: SymbolsOptions,
): KitResult<SymbolsResult> {
  const cid = createCorrelationId()
  const startTime = Date.now()

  // Check if Kit is installed
  if (!isKitInstalled()) {
    symbolsLogger.error('Kit not installed', { cid })
    return new KitError(KitErrorType.KitNotInstalled).toJSON()
  }

  const { path = getDefaultKitPath(), pattern, symbolType } = options

  // Build command arguments
  const args: string[] = ['symbols', path, '--format', 'json']

  if (pattern) {
    // Kit symbols doesn't have a pattern filter, we'll filter in post
  }

  symbolsLogger.info('Executing kit symbols', {
    cid,
    path,
    pattern,
    symbolType,
  })

  try {
    const result = executeKit(args, { timeout: SYMBOLS_TIMEOUT })

    // Check for errors
    if (result.exitCode !== 0) {
      symbolsLogger.error('Symbols failed', {
        cid,
        exitCode: result.exitCode,
        stderr: result.stderr,
        durationMs: Date.now() - startTime,
      })
      return createErrorFromOutput(result.stderr, result.exitCode).toJSON()
    }

    // Parse JSON output
    let rawSymbols: RawSymbol[]
    try {
      rawSymbols = JSON.parse(result.stdout)
    } catch {
      symbolsLogger.error('Failed to parse symbols output', {
        cid,
        stdout: result.stdout,
      })
      return new KitError(
        KitErrorType.OutputParseError,
        'Failed to parse symbols JSON output',
      ).toJSON()
    }

    // Transform and filter
    let symbols: CodeSymbol[] = rawSymbols.map((s) => ({
      name: s.name,
      type: s.type,
      file: s.file,
      startLine: s.start_line,
      endLine: s.end_line,
      code: s.code,
    }))

    // Filter by symbol type if specified
    if (symbolType) {
      symbols = symbols.filter(
        (s) => s.type.toLowerCase() === symbolType.toLowerCase(),
      )
    }

    // Filter by file pattern if specified (simple glob matching)
    if (pattern) {
      const regex = globToRegex(pattern)
      symbols = symbols.filter((s) => regex.test(s.file))
    }

    symbolsLogger.info('Symbols completed', {
      cid,
      symbolCount: symbols.length,
      durationMs: Date.now() - startTime,
    })

    return {
      count: symbols.length,
      symbols,
      path,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    symbolsLogger.error('Symbols threw exception', { cid, error: message })
    return new KitError(KitErrorType.KitCommandFailed, message).toJSON()
  }
}

// ============================================================================
// Semantic Search Execution
// ============================================================================

/**
 * Raw semantic match as returned by Kit CLI.
 */
interface RawSemanticMatch {
  file: string
  chunk: string
  score: number
  start_line?: number
  end_line?: number
}

/**
 * Execute kit semantic search command.
 * @param options - Semantic search options
 * @returns Semantic result or error (with fallback to grep)
 */
export function executeKitSemantic(
  options: SemanticOptions,
): KitResult<SemanticResult> {
  const cid = createCorrelationId()
  const startTime = Date.now()

  // Check if Kit is installed
  if (!isKitInstalled()) {
    semanticLogger.error('Kit not installed', { cid })
    return new KitError(KitErrorType.KitNotInstalled).toJSON()
  }

  const {
    query,
    path = getDefaultKitPath(),
    topK = 5,
    chunkBy = 'symbols',
    buildIndex = false,
  } = options

  // Build command arguments
  const args: string[] = [
    'search-semantic',
    path,
    query,
    '--top-k',
    String(topK),
    '--format',
    'json',
    '--chunk-by',
    chunkBy,
  ]

  if (buildIndex) {
    args.push('--build-index')
  }

  semanticLogger.info('Executing kit semantic search', {
    cid,
    query,
    path,
    topK,
    chunkBy,
  })

  try {
    const result = executeKit(args, { timeout: SEMANTIC_TIMEOUT })

    // Check for semantic search unavailable (ML deps not installed)
    // Note: kit writes error messages to stdout, not stderr
    const combinedOutput = `${result.stdout}\n${result.stderr}`
    if (result.exitCode !== 0 && isSemanticUnavailableError(combinedOutput)) {
      semanticLogger.warn('Semantic search unavailable, falling back to grep', {
        cid,
        output: combinedOutput.slice(0, 200),
      })

      // Fall back to grep search
      return fallbackToGrep(query, path, topK, cid)
    }

    // Check for other errors
    if (result.exitCode !== 0) {
      semanticLogger.error('Semantic search failed', {
        cid,
        exitCode: result.exitCode,
        output: combinedOutput.slice(0, 500),
        durationMs: Date.now() - startTime,
      })
      return createErrorFromOutput(combinedOutput, result.exitCode).toJSON()
    }

    // Parse JSON output
    let rawMatches: RawSemanticMatch[]
    try {
      rawMatches = JSON.parse(result.stdout)
    } catch {
      semanticLogger.error('Failed to parse semantic output', {
        cid,
        stdout: result.stdout,
      })
      return new KitError(
        KitErrorType.OutputParseError,
        'Failed to parse semantic search JSON output',
      ).toJSON()
    }

    // Transform to our format
    const matches: SemanticMatch[] = rawMatches.map((m) => ({
      file: m.file,
      chunk: m.chunk,
      score: m.score,
      startLine: m.start_line,
      endLine: m.end_line,
    }))

    semanticLogger.info('Semantic search completed', {
      cid,
      query,
      matchCount: matches.length,
      durationMs: Date.now() - startTime,
    })

    return {
      count: matches.length,
      matches,
      query,
      path,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    semanticLogger.error('Semantic search threw exception', {
      cid,
      error: message,
    })
    return new KitError(KitErrorType.KitCommandFailed, message).toJSON()
  }
}

/**
 * Fall back to grep when semantic search is unavailable.
 */
function fallbackToGrep(
  query: string,
  path: string,
  limit: number,
  cid: string,
): KitResult<SemanticResult> {
  // Extract keywords from the query for grep
  const keywords = query
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 3)

  const pattern = keywords.join('|')

  semanticLogger.info('Fallback grep search', { cid, pattern, path })

  const grepResult = executeKitGrep({
    pattern,
    path,
    maxResults: limit,
    caseSensitive: false,
  })

  if ('error' in grepResult) {
    return grepResult
  }

  // Convert grep matches to semantic format
  // Score decreases by 0.05 per result, with minimum of 0.1 to avoid negative scores
  const matches: SemanticMatch[] = grepResult.matches.map((m, idx) => ({
    file: m.file,
    chunk: m.content,
    score: Math.max(0.1, 1 - idx * 0.05),
    startLine: m.line,
    endLine: m.line,
  }))

  return {
    count: matches.length,
    matches,
    query,
    path,
    fallback: true,
    installHint: SEMANTIC_INSTALL_HINT,
  }
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Convert a simple glob pattern to a regex.
 * Supports * and ** patterns.
 */
function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/{{GLOBSTAR}}/g, '.*')

  return new RegExp(escaped)
}
