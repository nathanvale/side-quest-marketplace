/**
 * TSC-Runner Plugin Logger
 *
 * Uses the shared @sidequest/core logging infrastructure for consistent
 * JSONL logging across all SideQuest plugins.
 *
 * Subsystems:
 * - tsc: TypeScript hooks (tsc-check.ts, tsc-ci.ts)
 *
 * Log location: ~/.claude/logs/tsc-runner.jsonl
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
	name: "tsc-runner",
	subsystems: ["tsc"],
});

// Re-export core utilities
export { createCorrelationId, initLogger, logDir, logFile, logger };

// Export subsystem logger
export const tscLogger = getSubsystemLogger("tsc");
