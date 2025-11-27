/**
 * Kit Plugin Type Definitions
 *
 * Shared types for the Kit MCP server and CLI wrapper.
 */

// ============================================================================
// Response Format
// ============================================================================

/**
 * Response format options for tool output.
 */
export enum ResponseFormat {
  MARKDOWN = 'markdown',
  JSON = 'json',
}

// ============================================================================
// Grep Types
// ============================================================================

/**
 * A single grep match result.
 */
export interface GrepMatch {
  /** Relative file path from repository root */
  file: string
  /** Line number (1-indexed) */
  line?: number
  /** Matched line content */
  content: string
}

/**
 * Result of a grep search operation.
 */
export interface GrepResult {
  /** Number of matches found */
  count: number
  /** Array of match objects */
  matches: GrepMatch[]
  /** Search pattern used */
  pattern: string
  /** Repository path searched */
  path: string
}

/**
 * Options for grep search.
 */
export interface GrepOptions {
  /** Search pattern (text or regex) */
  pattern: string
  /** Repository path to search */
  path?: string
  /** Case-sensitive search (default: true) */
  caseSensitive?: boolean
  /** File pattern to include (e.g., "*.py") */
  include?: string
  /** File pattern to exclude */
  exclude?: string
  /** Maximum results to return (default: 100) */
  maxResults?: number
  /** Subdirectory to search within */
  directory?: string
}

// ============================================================================
// Semantic Search Types
// ============================================================================

/**
 * A single semantic search match.
 */
export interface SemanticMatch {
  /** Relative file path */
  file: string
  /** Code chunk that matched */
  chunk: string
  /** Relevance score (higher = more relevant) */
  score: number
  /** Start line of the chunk */
  startLine?: number
  /** End line of the chunk */
  endLine?: number
}

/**
 * Result of a semantic search operation.
 */
export interface SemanticResult {
  /** Number of matches found */
  count: number
  /** Array of semantic matches */
  matches: SemanticMatch[]
  /** Natural language query used */
  query: string
  /** Repository path searched */
  path: string
  /** Whether results came from fallback grep */
  fallback?: boolean
  /** Install hint if semantic search unavailable */
  installHint?: string
}

/**
 * Options for semantic search.
 */
export interface SemanticOptions {
  /** Natural language query */
  query: string
  /** Repository path to search */
  path?: string
  /** Number of results to return (default: 5) */
  topK?: number
  /** Chunking strategy: 'symbols' or 'lines' */
  chunkBy?: 'symbols' | 'lines'
  /** Force rebuild of vector index */
  buildIndex?: boolean
}

// ============================================================================
// Symbol Extraction Types
// ============================================================================

/**
 * A code symbol (function, class, variable, etc.).
 */
export interface CodeSymbol {
  /** Symbol name */
  name: string
  /** Symbol type (function, class, variable, type, etc.) */
  type: string
  /** File containing the symbol */
  file: string
  /** Start line number */
  startLine: number
  /** End line number (if available) */
  endLine?: number
  /** Symbol code/signature */
  code?: string
}

/**
 * Result of symbol extraction.
 */
export interface SymbolsResult {
  /** Number of symbols found */
  count: number
  /** Array of code symbols */
  symbols: CodeSymbol[]
  /** Repository path searched */
  path: string
}

/**
 * Options for symbol extraction.
 */
export interface SymbolsOptions {
  /** Repository path */
  path?: string
  /** File pattern filter (e.g., "*.py") */
  pattern?: string
  /** Filter by symbol type */
  symbolType?: string
}

// ============================================================================
// Generic Result Types
// ============================================================================

/**
 * Error result type.
 */
export interface ErrorResult {
  /** Error message */
  error: string
  /** Optional recovery hint */
  hint?: string
}

/**
 * Generic result type that can be success or error.
 */
export type KitResult<T> = T | ErrorResult

/**
 * Type guard for error results.
 */
export function isError<T extends object>(
  result: KitResult<T>,
): result is ErrorResult {
  return typeof result === 'object' && result !== null && 'error' in result
}

// ============================================================================
// Default Configuration
// ============================================================================

/** Default vault path for searches */
export const DEFAULT_KIT_PATH = '~/code/my-second-brain'

/** Default timeout for grep operations (ms) */
export const GREP_TIMEOUT = 30000

/** Default timeout for semantic operations (ms) */
export const SEMANTIC_TIMEOUT = 60000

/** Default timeout for symbol extraction (ms) */
export const SYMBOLS_TIMEOUT = 45000

/** Default max results for grep */
export const DEFAULT_MAX_RESULTS = 100

/** Default top-k for semantic search */
export const DEFAULT_TOP_K = 5
