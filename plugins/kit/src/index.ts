/**
 * Kit Plugin
 *
 * MCP server integrating Kit CLI for grep, semantic search,
 * and symbol extraction. Provides intelligent code search
 * capabilities for the Obsidian vault and other codebases.
 */

// ============================================================================
// Re-exports
// ============================================================================

export * from './errors.js'
export * from './formatters.js'
export * from './kit-wrapper.js'
export {
  createCorrelationId,
  getGrepLogger,
  getKitLogger,
  getSemanticLogger,
  getSymbolsLogger,
  grepLogger,
  initLogger,
  logDir,
  logFile,
  logger,
  semanticLogger,
  symbolsLogger,
} from './logger.js'
export * from './types.js'
export * from './validators.js'
