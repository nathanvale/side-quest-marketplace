#!/usr/bin/env bun

/**
 * Kit MCP Server
 *
 * Provides grep, semantic search, and symbol extraction tools
 * using the Kit CLI (cased-kit).
 */

import { startServer, tool, z } from 'mcpez'

import {
  executeKitGrep,
  executeKitSemantic,
  executeKitSymbols,
  formatGrepResults,
  formatSemanticResults,
  formatSymbolsResults,
  initLogger,
  isError,
  ResponseFormat,
  validateGrepInputs,
  validateSemanticInputs,
  validateSymbolsInputs,
} from '../../src/index.js'

// Initialize logging
initLogger().catch(console.error)

// ============================================================================
// Kit Grep Tool
// ============================================================================

tool(
  'kit_grep',
  {
    description: `Fast text search across repository files using Kit CLI.

Searches for literal patterns with optional regex support. Great for:
- Finding function definitions
- Locating error messages
- Searching for specific strings

Results include file paths, line numbers, and matched content.`,
    inputSchema: {
      pattern: z
        .string()
        .describe('Search pattern (text or regex). Example: "function auth"'),
      path: z
        .string()
        .optional()
        .describe(
          'Repository path to search (default: ~/code/my-second-brain)',
        ),
      case_sensitive: z
        .boolean()
        .optional()
        .describe('Case sensitive search (default: true)'),
      include: z
        .string()
        .optional()
        .describe('Include files matching pattern. Example: "*.ts"'),
      exclude: z
        .string()
        .optional()
        .describe('Exclude files matching pattern. Example: "*.test.ts"'),
      max_results: z
        .number()
        .optional()
        .describe('Maximum results to return (default: 100, max: 1000)'),
      directory: z
        .string()
        .optional()
        .describe('Limit search to specific subdirectory'),
      response_format: z
        .enum(['markdown', 'json'])
        .optional()
        .describe("Output format: 'markdown' (default) or 'json'"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async (args: {
    pattern: string
    path?: string
    case_sensitive?: boolean
    include?: string
    exclude?: string
    max_results?: number
    directory?: string
    response_format?: string
  }) => {
    // Validate inputs
    const validation = validateGrepInputs({
      pattern: args.pattern,
      path: args.path,
      include: args.include,
      exclude: args.exclude,
      maxResults: args.max_results,
    })

    if (!validation.valid) {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: `**Validation Error:**\n\n${validation.errors.join('\n')}`,
          },
        ],
      }
    }

    const { validated } = validation

    // Execute grep
    const result = executeKitGrep({
      pattern: validated!.pattern,
      path: validated!.path,
      caseSensitive: args.case_sensitive,
      include: validated!.include,
      exclude: validated!.exclude,
      maxResults: validated!.maxResults,
      directory: args.directory,
    })

    // Format output
    const format =
      args.response_format === 'json'
        ? ResponseFormat.JSON
        : ResponseFormat.MARKDOWN

    return {
      ...(isError(result) ? { isError: true } : {}),
      content: [
        { type: 'text' as const, text: formatGrepResults(result, format) },
      ],
    }
  },
)

// ============================================================================
// Kit Semantic Search Tool
// ============================================================================

tool(
  'kit_semantic',
  {
    description: `Semantic search using natural language queries and vector embeddings.

Find code by meaning rather than exact text matches. Great for:
- "How does authentication work?"
- "Error handling patterns"
- "Database connection logic"

NOTE: Requires ML dependencies. If unavailable, falls back to text search.
To enable: uv tool install 'cased-kit[ml]'`,
    inputSchema: {
      query: z
        .string()
        .describe(
          'Natural language query. Example: "authentication flow logic"',
        ),
      path: z
        .string()
        .optional()
        .describe(
          'Repository path to search (default: ~/code/my-second-brain)',
        ),
      top_k: z
        .number()
        .optional()
        .describe('Number of results to return (default: 5, max: 50)'),
      chunk_by: z
        .enum(['symbols', 'lines'])
        .optional()
        .describe("Chunking strategy: 'symbols' (default) or 'lines'"),
      build_index: z
        .boolean()
        .optional()
        .describe('Force rebuild of vector index (default: false)'),
      response_format: z
        .enum(['markdown', 'json'])
        .optional()
        .describe("Output format: 'markdown' (default) or 'json'"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async (args: {
    query: string
    path?: string
    top_k?: number
    chunk_by?: 'symbols' | 'lines'
    build_index?: boolean
    response_format?: string
  }) => {
    // Validate inputs
    const validation = validateSemanticInputs({
      query: args.query,
      path: args.path,
      topK: args.top_k,
    })

    if (!validation.valid) {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: `**Validation Error:**\n\n${validation.errors.join('\n')}`,
          },
        ],
      }
    }

    const { validated } = validation

    // Execute semantic search
    const result = executeKitSemantic({
      query: validated!.query,
      path: validated!.path,
      topK: validated!.topK,
      chunkBy: args.chunk_by,
      buildIndex: args.build_index,
    })

    // Format output
    const format =
      args.response_format === 'json'
        ? ResponseFormat.JSON
        : ResponseFormat.MARKDOWN

    return {
      ...(isError(result) ? { isError: true } : {}),
      content: [
        { type: 'text' as const, text: formatSemanticResults(result, format) },
      ],
    }
  },
)

// ============================================================================
// Kit Symbols Tool
// ============================================================================

tool(
  'kit_symbols',
  {
    description: `Extract code symbols (functions, classes, etc.) from the repository.

Lists all defined symbols with their locations. Great for:
- Getting an overview of code structure
- Finding function and class definitions
- Understanding module APIs`,
    inputSchema: {
      path: z
        .string()
        .optional()
        .describe(
          'Repository path to analyze (default: ~/code/my-second-brain)',
        ),
      pattern: z
        .string()
        .optional()
        .describe('Filter files by pattern. Example: "*.ts"'),
      symbol_type: z
        .enum([
          'function',
          'class',
          'variable',
          'type',
          'interface',
          'method',
          'property',
          'constant',
        ])
        .optional()
        .describe('Filter by symbol type'),
      response_format: z
        .enum(['markdown', 'json'])
        .optional()
        .describe("Output format: 'markdown' (default) or 'json'"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async (args: {
    path?: string
    pattern?: string
    symbol_type?: string
    response_format?: string
  }) => {
    // Validate inputs
    const validation = validateSymbolsInputs({
      path: args.path,
      pattern: args.pattern,
      symbolType: args.symbol_type,
    })

    if (!validation.valid) {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: `**Validation Error:**\n\n${validation.errors.join('\n')}`,
          },
        ],
      }
    }

    const { validated } = validation

    // Execute symbols extraction
    const result = executeKitSymbols({
      path: validated!.path,
      pattern: validated!.pattern,
      symbolType: validated!.symbolType,
    })

    // Format output
    const format =
      args.response_format === 'json'
        ? ResponseFormat.JSON
        : ResponseFormat.MARKDOWN

    return {
      ...(isError(result) ? { isError: true } : {}),
      content: [
        { type: 'text' as const, text: formatSymbolsResults(result, format) },
      ],
    }
  },
)

// ============================================================================
// Start Server
// ============================================================================

startServer()
