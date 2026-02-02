/**
 * Centralized logging configuration for para-obsidian plugin.
 *
 * This module provides a single source of truth for all logging configuration.
 * Both MCP server and CLI components should import from here to ensure
 * consistent logging behavior.
 *
 * ## Environment Variables
 *
 * - `PARA_LOG_LEVEL` - Set minimum log level: "debug" | "info" | "warning" | "error" (default: "debug")
 * - `PARA_LOG_CONSOLE` - Enable console output for local development: "1" | "true" (default: off)
 * - `PARA_OBSIDIAN_LOG_DIR` - Custom log directory path (default: ~/.claude/logs)
 * - `PARA_VAULT` - Vault path (NOT used for logging - logs always go to user directory)
 *
 * @example
 * ```bash
 * # Enable debug logging with console output
 * PARA_LOG_LEVEL=debug PARA_LOG_CONSOLE=1 para scan
 *
 * # Production mode with warning level only
 * PARA_LOG_LEVEL=warning para process-inbox --auto
 * ```
 *
 * @module logger
 */

import { configure, getConsoleSink } from "@logtape/logtape";
import {
	createCorrelationId as coreCreateCorrelationId,
	createPluginLogger,
	type LogLevel,
} from "@side-quest/core/logging";

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
	"docx",
	"llm",
	"execute",
	"git",
	"enrich",
	// Phase 1: Observability uplift additions
	"search",
	"templates",
	"frontmatter",
	"fs",
	"lock",
	"tx",
	"cli",
	"classify",
	"routing",
	"voice",
] as const;

export type PluginSubsystem = (typeof SUBSYSTEMS)[number];

/**
 * Determine log directory from environment.
 * ALWAYS logs to ~/.claude/logs/ unless explicitly overridden.
 * Priority: PARA_OBSIDIAN_LOG_DIR > undefined (core default: ~/.claude/logs)
 *
 * NOTE: We intentionally do NOT use PARA_VAULT for logging to keep logs
 * centralized in the user directory, not scattered across vault directories.
 */
export const logDir = process.env.PARA_OBSIDIAN_LOG_DIR ?? undefined;

/**
 * Parse log level from environment variable.
 * Defaults to "debug" if not set or invalid.
 */
function parseLogLevel(env?: string): LogLevel {
	const level = env?.toLowerCase();
	switch (level) {
		case "debug":
		case "info":
		case "warning":
		case "error":
			return level;
		default:
			return "debug";
	}
}

/**
 * Check if console logging is enabled via environment variable.
 */
function isConsoleEnabled(): boolean {
	const val = process.env.PARA_LOG_CONSOLE?.toLowerCase();
	return val === "1" || val === "true";
}

/**
 * Minimum log level from environment.
 */
export const logLevel = parseLogLevel(process.env.PARA_LOG_LEVEL);

/**
 * Whether console output is enabled.
 */
export const consoleEnabled = isConsoleEnabled();

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
	lowestLevel: logLevel,
});

let loggerInitialized = false;

/**
 * Initialize the plugin logger.
 * Safe to call multiple times - only initializes once.
 *
 * Respects environment variables:
 * - PARA_LOG_LEVEL: Minimum log level to capture
 * - PARA_LOG_CONSOLE: Enable console output for development
 */
export async function initLogger(): Promise<void> {
	if (loggerInitialized) return;
	await initLoggerInternal();

	// Add console sink if enabled via environment
	if (consoleEnabled) {
		await configure({
			sinks: {
				console: getConsoleSink(),
			},
			loggers: [
				{
					category: ["para-obsidian"],
					sinks: ["console"],
					lowestLevel: logLevel,
				},
			],
		});
	}

	if (rootLogger) {
		rootLogger.info`Logger initialized logDir=${logDir ?? "~/.claude/logs"} logFile=${logFile} logLevel=${logLevel} consoleEnabled=${consoleEnabled}`;
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
 * Logger for DOCX processing operations.
 */
export const docxLogger = subsystemLoggers.docx!;

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

/**
 * Logger for search operations (text and semantic search).
 */
export const searchLogger = subsystemLoggers.search!;

/**
 * Logger for template operations (loading, parsing, validation, migrations).
 */
export const templatesLogger = subsystemLoggers.templates!;

/**
 * Logger for frontmatter operations (parsing, validation, updates).
 */
export const frontmatterLogger = subsystemLoggers.frontmatter!;

/**
 * Logger for filesystem operations (atomic writes, file locks).
 */
export const fsLogger = subsystemLoggers.fs!;

/**
 * Logger for file locking operations.
 */
export const lockLogger = subsystemLoggers.lock!;

/**
 * Logger for transaction operations (rollback, cleanup).
 */
export const txLogger = subsystemLoggers.tx!;

/**
 * Logger for CLI command operations.
 */
export const cliLogger = subsystemLoggers.cli!;

/**
 * Logger for classifier matching operations.
 */
export const classifyLogger = subsystemLoggers.classify!;

/**
 * Logger for routing operations (inbox move to PARA destinations).
 */
export const routingLogger = subsystemLoggers.routing!;

/**
 * Logger for voice memo transcription operations.
 */
export const voiceLogger = subsystemLoggers.voice!;

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
	search: searchLogger,
	templates: templatesLogger,
	frontmatter: frontmatterLogger,
	fs: fsLogger,
	lock: lockLogger,
	tx: txLogger,
	cli: cliLogger,
	routing: routingLogger,
	voice: voiceLogger,
} as const;
