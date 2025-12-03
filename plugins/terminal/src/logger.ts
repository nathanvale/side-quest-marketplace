/**
 * Terminal Plugin Logger
 *
 * JSONL logging with LogTape for observability and debugging.
 * Uses @sidequest/core logging factory for consistent log location.
 *
 * Log location: ~/.claude/logs/terminal.jsonl
 *
 * Logging Level Convention:
 * - DEBUG: Detailed diagnostic info (bin script args, timing)
 * - INFO: Normal operation events (start/complete, results summary)
 * - WARN: Degraded operation (script failures, missing scripts)
 * - ERROR: Operation failures (exceptions, command failures)
 */

import {
	createCorrelationId,
	createPluginLogger,
} from "@sidequest/core/logging";

const {
	initLogger,
	rootLogger: logger,
	getSubsystemLogger,
	logDir,
	logFile,
} = createPluginLogger({
	name: "terminal",
	subsystems: ["say", "quarantine", "downloads"],
});

// ============================================================================
// Exports
// ============================================================================

export { createCorrelationId, initLogger, logDir, logFile, logger };

/** Say subsystem logger */
export const sayLogger = getSubsystemLogger("say");

/** Quarantine subsystem logger */
export const quarantineLogger = getSubsystemLogger("quarantine");

/** Downloads subsystem logger */
export const downloadsLogger = getSubsystemLogger("downloads");
