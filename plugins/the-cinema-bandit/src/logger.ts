/**
 * Cinema Bandit Logger
 *
 * JSONL logging with LogTape for observability and debugging.
 * Logs rotate at 1MB, keeping 5 files.
 *
 * Logging Level Convention:
 * - DEBUG: Detailed diagnostic info (selector attempts, parsing steps)
 * - INFO: Normal operation events (start/complete, item counts, timing)
 * - WARN: Degraded operation (fallbacks, edge cases, soft failures)
 * - ERROR: Operation failures (exceptions, validation errors, parse errors)
 */

import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { getRotatingFileSink } from "@logtape/file";
import { configure, getLogger, jsonLinesFormatter } from "@logtape/logtape";

// ============================================================================
// Configuration
// ============================================================================

/** Log directory location */
const LOG_DIR = join(homedir(), ".the-cinema-bandit", "logs");

/** Log file name */
const LOG_FILE = "cinema-bandit.jsonl";

/** Maximum log file size before rotation (1 MiB) */
const MAX_SIZE = 0x400 * 0x400;

/** Number of rotated files to keep */
const MAX_FILES = 5;

// ============================================================================
// Setup
// ============================================================================

/** Whether logging has been initialized */
let isInitialized = false;

/**
 * Initialize the logging system.
 * Safe to call multiple times - only initializes once.
 */
export async function initLogger(): Promise<void> {
	if (isInitialized) return;

	// Ensure log directory exists
	if (!existsSync(LOG_DIR)) {
		mkdirSync(LOG_DIR, { recursive: true });
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
				category: ["cinema-bandit"],
				sinks: ["file"],
				lowestLevel: "debug",
			},
		],
	});

	// Log initialization
	const startupLogger = getLogger(["cinema-bandit"]);
	startupLogger.info("Cinema Bandit logging initialized", {
		logDir: LOG_DIR,
		logFile: LOG_FILE,
		maxSize: MAX_SIZE,
		maxFiles: MAX_FILES,
	});

	isInitialized = true;
}

// ============================================================================
// Correlation ID
// ============================================================================

/**
 * Generate an 8-character correlation ID for tracing operations.
 * @returns Short UUID string (e.g., "a1b2c3d4")
 */
export function createCorrelationId(): string {
	return crypto.randomUUID().slice(0, 8);
}

// ============================================================================
// Loggers
// ============================================================================

/** Root Cinema Bandit logger */
export const cinemaLogger = getLogger(["cinema-bandit"]);

/** Scraper subsystem logger (Playwright browser, movie/session/pricing scraping) */
export const scraperLogger = getLogger(["cinema-bandit", "scraper"]);

/** Pricing subsystem logger (price parsing, validation, calculations) */
export const pricingLogger = getLogger(["cinema-bandit", "pricing"]);

/** Auth subsystem logger (OAuth flow, token management) */
export const authLogger = getLogger(["cinema-bandit", "auth"]);

/** Gmail subsystem logger (email sending, message composition) */
export const gmailLogger = getLogger(["cinema-bandit", "gmail"]);

// ============================================================================
// Convenience Exports
// ============================================================================

/** Log directory path */
export const logDir = LOG_DIR;

/** Log file path */
export const logFile = join(LOG_DIR, LOG_FILE);
