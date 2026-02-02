/**
 * Bun-Runner Plugin Logger
 *
 * Uses the shared @sidequest/core logging infrastructure for consistent
 * JSONL logging across all SideQuest plugins.
 *
 * Subsystems:
 * - test: Test execution hooks (bun-test.ts, bun-test-ci.ts)
 * - mcp: MCP server tools
 *
 * Log location: ~/.claude/logs/bun-runner.jsonl
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
	name: "bun-runner",
	subsystems: ["test", "mcp"],
});

// Re-export core utilities
export { createCorrelationId, initLogger, logger };

// Export log paths for reference
export const LOG_DIR = logDir;
export const LOG_FILE = logFile;

// Export subsystem loggers
export const testLogger = getSubsystemLogger("test");
export const mcpLogger = getSubsystemLogger("mcp");
