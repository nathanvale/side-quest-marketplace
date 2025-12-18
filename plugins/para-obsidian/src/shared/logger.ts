/**
 * Centralized logging configuration for para-obsidian plugin.
 *
 * This module provides a single source of truth for all logging configuration.
 * Both MCP server and CLI components should import from here to ensure
 * consistent logging behavior.
 *
 * @module logger
 */

import { join } from "node:path";
import {
	createCorrelationId as coreCreateCorrelationId,
	createPluginLogger,
} from "@sidequest/core/logging";

// =============================================================================
// Configuration
// =============================================================================

/**
 * All subsystems used by para-obsidian plugin.
 */
export const SUBSYSTEMS = [
	"mcp",
	"inbox",
	"pdf",
	"llm",
	"execute",
	"git",
	"enrich",
] as const;

export type PluginSubsystem = (typeof SUBSYSTEMS)[number];

/**
 * Determine log directory from environment.
 * Priority: PARA_OBSIDIAN_LOG_DIR > PARA_VAULT/.claude/logs > undefined
 */
export const logDir =
	process.env.PARA_OBSIDIAN_LOG_DIR ??
	(process.env.PARA_VAULT
		? join(process.env.PARA_VAULT, ".claude", "logs")
		: undefined);

// =============================================================================
// Logger Factory
// =============================================================================

const {
	initLogger: initLoggerInternal,
	getSubsystemLogger,
	subsystemLoggers,
	rootLogger,
	logFile,
} = createPluginLogger({
	name: "para-obsidian",
	subsystems: [...SUBSYSTEMS],
	logDir,
});

let loggerInitialized = false;

/**
 * Initialize the plugin logger.
 * Safe to call multiple times - only initializes once.
 */
export async function initLogger(): Promise<void> {
	if (loggerInitialized) return;
	await initLoggerInternal();
	if (rootLogger) {
		rootLogger.info`Logger initialized logDir=${logDir ?? "~/.claude/logs"} logFile=${logFile}`;
		loggerInitialized = true;
	}
}

// =============================================================================
// Exported Loggers
// =============================================================================

/**
 * Get the current log file path.
 */
export function getLogFile(): string | undefined {
	return logFile;
}

/**
 * Root logger for para-obsidian plugin.
 */
export { rootLogger };

/**
 * Get a subsystem logger by name.
 */
export { getSubsystemLogger };

/**
 * Logger for MCP tool operations.
 */
export const mcpLogger = subsystemLoggers.mcp!;

/**
 * Logger for inbox scan operations and orchestration.
 */
export const inboxLogger = subsystemLoggers.inbox!;

/**
 * Logger for PDF processing operations.
 */
export const pdfLogger = subsystemLoggers.pdf!;

/**
 * Logger for LLM operations.
 */
export const llmLogger = subsystemLoggers.llm!;

/**
 * Logger for execution operations (note creation, moves).
 */
export const executeLogger = subsystemLoggers.execute!;

/**
 * Logger for git operations (status, add, commit, sessions).
 */
export const gitLogger = subsystemLoggers.git!;

/**
 * Logger for enrichment pipeline operations (Firecrawl, LLM improvement).
 */
export const enrichLogger = subsystemLoggers.enrich!;

// =============================================================================
// Re-exports for convenience
// =============================================================================

/**
 * Create a correlation ID for request tracing.
 */
export const createCorrelationId = coreCreateCorrelationId;

/**
 * Initialize logging and emit a one-time notice about the log file location.
 * Useful for CLI commands that want to inform users where logs are being written.
 */
export async function initLoggerWithNotice(): Promise<void> {
	await initLogger();
}

/**
 * All subsystem loggers as a typed object.
 */
export const loggers = {
	inbox: inboxLogger,
	pdf: pdfLogger,
	llm: llmLogger,
	execute: executeLogger,
	git: gitLogger,
	enrich: enrichLogger,
} as const;
