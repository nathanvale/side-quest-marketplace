/**
 * Kit Plugin Logger
 *
 * JSONL logging with LogTape for observability and debugging.
 * Logs rotate at 1MB, keeping 5 files.
 *
 * Logging Level Convention:
 * - DEBUG: Detailed diagnostic info (file counts, cache hits, parameter echo)
 * - INFO: Normal operation events (start/complete, results summary)
 * - WARN: Degraded operation (fallbacks, skipped files, soft failures)
 * - ERROR: Operation failures (exceptions, command failures, parse errors)
 */

import { existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { getRotatingFileSink } from '@logtape/file'
import {
  configure,
  getLogger,
  jsonLinesFormatter,
  type Logger,
} from '@logtape/logtape'

// ============================================================================
// Configuration
// ============================================================================

/** Log directory location */
const LOG_DIR = join(homedir(), '.kit', 'logs')

/** Log file name */
const LOG_FILE = 'kit.jsonl'

/** Maximum log file size before rotation (1 MiB) */
const MAX_SIZE = 0x400 * 0x400

/** Number of rotated files to keep */
const MAX_FILES = 5

// ============================================================================
// Setup
// ============================================================================

/** Whether logging has been initialized */
let isInitialized = false

/**
 * Initialize the logging system.
 * Safe to call multiple times - only initializes once.
 */
export async function initLogger(): Promise<void> {
  if (isInitialized) return

  // Ensure log directory exists
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true })
  }

  await configure({
    sinks: {
      file: getRotatingFileSink(join(LOG_DIR, LOG_FILE), {
        formatter: jsonLinesFormatter,
        maxSize: MAX_SIZE,
        maxFiles: MAX_FILES,
        // @ts-expect-error - lazy option exists in newer versions
        lazy: true,
      }),
    },
    loggers: [
      {
        category: ['kit'],
        sinks: ['file'],
        lowestLevel: 'debug',
      },
    ],
  })

  // Log initialization (using a fresh logger instance)
  const startupLogger = getLogger(['kit'])
  startupLogger.info('Kit logging initialized', {
    logDir: LOG_DIR,
    logFile: LOG_FILE,
    maxSize: MAX_SIZE,
    maxFiles: MAX_FILES,
  })

  isInitialized = true
}

// ============================================================================
// Correlation ID
// ============================================================================

/**
 * Generate an 8-character correlation ID for tracing operations.
 * @returns Short UUID string (e.g., "a1b2c3d4")
 */
export function createCorrelationId(): string {
  return crypto.randomUUID().slice(0, 8)
}

// ============================================================================
// Loggers
// ============================================================================

/**
 * Get the root Kit logger.
 * @returns Logger instance for the kit category
 */
export function getKitLogger(): Logger {
  return getLogger(['kit'])
}

/**
 * Get the grep subsystem logger.
 * @returns Logger instance for kit.grep
 */
export function getGrepLogger(): Logger {
  return getLogger(['kit', 'grep'])
}

/**
 * Get the semantic search subsystem logger.
 * @returns Logger instance for kit.semantic
 */
export function getSemanticLogger(): Logger {
  return getLogger(['kit', 'semantic'])
}

/**
 * Get the symbols subsystem logger.
 * @returns Logger instance for kit.symbols
 */
export function getSymbolsLogger(): Logger {
  return getLogger(['kit', 'symbols'])
}

/**
 * Get the file tree subsystem logger.
 * @returns Logger instance for kit.fileTree
 */
export function getFileTreeLogger(): Logger {
  return getLogger(['kit', 'fileTree'])
}

/**
 * Get the file content subsystem logger.
 * @returns Logger instance for kit.fileContent
 */
export function getFileContentLogger(): Logger {
  return getLogger(['kit', 'fileContent'])
}

/**
 * Get the usages subsystem logger.
 * @returns Logger instance for kit.usages
 */
export function getUsagesLogger(): Logger {
  return getLogger(['kit', 'usages'])
}

/**
 * Get the AST search subsystem logger.
 * @returns Logger instance for kit.ast
 */
export function getAstLogger(): Logger {
  return getLogger(['kit', 'ast'])
}

// ============================================================================
// Convenience Exports
// ============================================================================

/** Root Kit logger */
export const logger = getLogger(['kit'])

/** Grep subsystem logger */
export const grepLogger = getLogger(['kit', 'grep'])

/** Semantic search subsystem logger */
export const semanticLogger = getLogger(['kit', 'semantic'])

/** Symbols subsystem logger */
export const symbolsLogger = getLogger(['kit', 'symbols'])

/** File tree subsystem logger */
export const fileTreeLogger = getLogger(['kit', 'fileTree'])

/** File content subsystem logger */
export const fileContentLogger = getLogger(['kit', 'fileContent'])

/** Usages subsystem logger */
export const usagesLogger = getLogger(['kit', 'usages'])

/** AST search subsystem logger */
export const astLogger = getLogger(['kit', 'ast'])

/** Log directory path */
export const logDir = LOG_DIR

/** Log file path */
export const logFile = join(LOG_DIR, LOG_FILE)
