/**
 * Kit Plugin Logger
 *
 * JSONL logging with LogTape for observability and debugging.
 * Logs rotate at 1MB, keeping 5 files.
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

/** Log directory path */
export const logDir = LOG_DIR

/** Log file path */
export const logFile = join(LOG_DIR, LOG_FILE)
