/**
 * Cinema Bandit Logger
 *
 * JSONL logging with LogTape for observability and debugging.
 * Uses @sidequest/core logging factory for consistent log location.
 *
 * Log location: ~/.claude/logs/the-cinema-bandit/the-cinema-bandit.jsonl
 *
 * Logging Level Convention:
 * - DEBUG: Detailed diagnostic info (selector attempts, parsing steps)
 * - INFO: Normal operation events (start/complete, item counts, timing)
 * - WARN: Degraded operation (fallbacks, edge cases, soft failures)
 * - ERROR: Operation failures (exceptions, validation errors, parse errors)
 */

import { homedir } from "node:os";
import { join } from "node:path";
import {
	createCorrelationId,
	createPluginLogger,
} from "@sidequest/core/logging";

/** Centralized log location following ~/.claude/logs/<plugin>/ convention */
const LOG_DIR = join(homedir(), ".claude", "logs", "the-cinema-bandit");

const {
	initLogger,
	rootLogger: cinemaLogger,
	getSubsystemLogger,
	logDir,
	logFile,
} = createPluginLogger({
	name: "cinema-bandit",
	subsystems: ["scraper", "pricing", "auth", "gmail"],
	logDir: LOG_DIR,
});

// ============================================================================
// Exports
// ============================================================================

export { cinemaLogger, createCorrelationId, initLogger, logDir, logFile };

/** Scraper subsystem logger (Playwright browser, movie/session/pricing scraping) */
export const scraperLogger = getSubsystemLogger("scraper");

/** Pricing subsystem logger (price parsing, validation, calculations) */
export const pricingLogger = getSubsystemLogger("pricing");

/** Auth subsystem logger (OAuth flow, token management) */
export const authLogger = getSubsystemLogger("auth");

/** Gmail subsystem logger (email sending, message composition) */
export const gmailLogger = getSubsystemLogger("gmail");
