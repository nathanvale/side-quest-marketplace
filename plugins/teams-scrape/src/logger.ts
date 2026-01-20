/**
 * Teams-scrape plugin logger setup.
 *
 * Configures structured logging with JSONL output and correlation ID tracking.
 *
 * @module teams-scrape/logger
 */

import { createPluginLogger } from "@sidequest/core/logging";

/**
 * Plugin logger configuration with subsystems for different components.
 */
const {
	initLogger,
	createCorrelationId,
	rootLogger,
	getSubsystemLogger,
	logDir,
	logFile,
} = createPluginLogger({
	name: "teams-scrape",
	subsystems: ["parser", "storage", "cli"],
});

/** Initialize the logging system. Call at CLI entry point. */
export { initLogger };

/** Generate correlation IDs for request tracing. */
export { createCorrelationId };

/** Root logger for general plugin logging. */
export const logger = rootLogger;

/** Parser subsystem logger. */
export const parserLogger = getSubsystemLogger("parser");

/** Storage subsystem logger. */
export const storageLogger = getSubsystemLogger("storage");

/** CLI subsystem logger. */
export const cliLogger = getSubsystemLogger("cli");

/** Log directory path (~/.claude/logs/) */
export { logDir };

/** Full log file path (~/.claude/logs/teams-scrape.jsonl) */
export { logFile };
