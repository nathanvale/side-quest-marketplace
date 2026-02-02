/**
 * TSC-Runner Plugin Logger
 *
 * Uses the shared @sidequest/core logging infrastructure for consistent
 * JSONL logging across all SideQuest plugins.
 *
 * Subsystems:
 * - tsc: TypeScript hooks (tsc-check.ts, tsc-ci.ts)
 * - mcp: MCP server tools
 *
 * Log location: ~/.claude/logs/tsc-runner.jsonl
 */

import {
	createCorrelationId,
	createPluginLogger,
} from "@side-quest/core/logging";

const {
	initLogger,
	rootLogger: logger,
	getSubsystemLogger,
	logDir,
	logFile,
} = createPluginLogger({
	name: "tsc-runner",
	subsystems: ["tsc", "mcp"],
});

// Re-export core utilities
export { createCorrelationId, initLogger, logDir, logFile, logger };

// Export subsystem loggers
export const tscLogger = getSubsystemLogger("tsc");
export const mcpLogger = getSubsystemLogger("mcp");
