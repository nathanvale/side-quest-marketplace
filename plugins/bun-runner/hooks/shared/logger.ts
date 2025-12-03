/**
 * Bun-Runner Plugin Logger
 *
 * Uses the shared @sidequest/core logging infrastructure for consistent
 * JSONL logging across all SideQuest plugins.
 *
 * Subsystems:
 * - biome: Biome hooks (biome-check.ts, biome-ci.ts)
 * - tsc: TypeScript hooks (tsc-check.ts, tsc-ci.ts)
 * - mcp: MCP server tools
 *
 * Log location: ~/.claude/logs/bun-runner.jsonl
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
	name: "bun-runner",
	subsystems: ["biome", "tsc", "mcp"],
});

// Re-export core utilities
export { createCorrelationId, initLogger, logDir, logFile, logger };

// Export subsystem loggers (using getSubsystemLogger for non-nullable types)
export const biomeLogger = getSubsystemLogger("biome");
export const tscLogger = getSubsystemLogger("tsc");
export const mcpLogger = getSubsystemLogger("mcp");
