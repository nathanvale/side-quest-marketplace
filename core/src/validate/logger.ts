/**
 * Validation Logger
 *
 * Creates configured logger for the SideQuest marketplace validation system.
 * Provides hierarchical loggers for tracking validation of hooks, skills, MCP servers, and plugins.
 *
 * @example
 * ```typescript
 * import { initLogger, validateLogger, subsystemLoggers } from "@sidequest/core/validate/logger";
 *
 * // Initialize at entry point
 * await initLogger();
 *
 * // Use root logger
 * validateLogger.info("Starting validation");
 *
 * // Use subsystem loggers
 * subsystemLoggers.hooks.debug("Validating hook", { file: "hook.json" });
 * subsystemLoggers.mcp.warn("MCP server not found", { server: "my-server" });
 * ```
 */

import { createPluginLogger } from "@sidequest/core/logging";

export const {
	initLogger,
	rootLogger: validateLogger,
	subsystemLoggers,
	logDir,
	logFile,
	createCorrelationId,
	getSubsystemLogger,
} = createPluginLogger({
	name: "validate",
	subsystems: ["hooks", "skill", "mcp", "runner"],
});
