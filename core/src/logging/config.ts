/**
 * Logging configuration defaults.
 *
 * These values can be overridden when creating a plugin logger.
 */

/** Maximum log file size before rotation (1 MiB) */
export const DEFAULT_MAX_SIZE = 0x400 * 0x400;

/** Number of rotated files to keep */
export const DEFAULT_MAX_FILES = 5;

/** Default log file extension */
export const DEFAULT_LOG_EXTENSION = ".jsonl";

/**
 * Logging level conventions for SideQuest plugins.
 *
 * Note: LogTape uses "warning" not "warn" for consistency with its API.
 *
 * - DEBUG: Detailed diagnostic info (selector attempts, parsing steps, cache hits)
 * - INFO: Normal operation events (start/complete, item counts, timing)
 * - WARNING: Degraded operation (fallbacks, edge cases, soft failures)
 * - ERROR: Operation failures (exceptions, validation errors, parse errors)
 */
export type LogLevel = "debug" | "info" | "warning" | "error";

/** Default lowest log level to capture */
export const DEFAULT_LOG_LEVEL: LogLevel = "debug";
