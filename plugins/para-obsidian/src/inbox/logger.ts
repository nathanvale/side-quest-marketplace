/**
 * Inbox Processing Framework - Logging Infrastructure
 *
 * Provides structured logging for inbox processing using @sidequest/core/logging.
 *
 * Subsystems:
 * - inbox: Scan operations, orchestration, summary
 * - pdf: PDF text extraction, file operations
 * - llm: LLM detection, field extraction
 * - execute: Note creation, attachment moves, registry updates
 *
 * @example
 * ```typescript
 * import { inboxLogger, createCorrelationId } from "./logger";
 *
 * const cid = createCorrelationId();
 * inboxLogger.info`Scan started items=${items.length} ${cid}`;
 * ```
 */

import { join } from "node:path";
import {
	createCorrelationId as coreCreateCorrelationId,
	createPluginLogger,
} from "@sidequest/core/logging";

// =============================================================================
// Logger Setup
// =============================================================================

/**
 * Inbox processing subsystems for hierarchical logging.
 */
const SUBSYSTEMS = ["inbox", "pdf", "llm", "execute"] as const;

type InboxSubsystem = (typeof SUBSYSTEMS)[number];

/**
 * Plugin logger factory result.
 */
const logDirFromEnv =
	process.env.PARA_OBSIDIAN_LOG_DIR ??
	(process.env.PARA_VAULT
		? join(process.env.PARA_VAULT, ".claude", "logs")
		: undefined);

const { initLogger, rootLogger, subsystemLoggers, logFile } =
	createPluginLogger({
		name: "para-obsidian",
		subsystems: [...SUBSYSTEMS],
		logDir: logDirFromEnv,
	});

let initLogged = false;

/**
 * Initialize logging and emit a one-time notice about the log file location.
 */
export async function initLoggerWithNotice(): Promise<void> {
	await initLogger();
	if (!initLogged && rootLogger) {
		rootLogger.info`Logger initialized logFile=${logFile}`;
		initLogged = true;
	}
}

// =============================================================================
// Exported Loggers
// =============================================================================

/**
 * Root logger for para-obsidian plugin.
 * Use subsystem loggers for more specific categories.
 */
export { initLogger, logFile, rootLogger };

/**
 * Logger for inbox scan operations and orchestration.
 *
 * Events:
 * - Scan started/complete
 * - Item skipped (registry)
 * - Summary statistics
 */
export const inboxLogger = subsystemLoggers.inbox;

/**
 * Logger for PDF processing operations.
 *
 * Events:
 * - Extraction started/complete/failed
 * - Heuristics matched
 * - File size/timeout issues
 */
export const pdfLogger = subsystemLoggers.pdf;

/**
 * Logger for LLM operations.
 *
 * Events:
 * - Detection started/complete
 * - Field extraction
 * - API errors/retries
 */
export const llmLogger = subsystemLoggers.llm;

/**
 * Logger for execution operations.
 *
 * Events:
 * - Item approved
 * - Note created
 * - Attachment moved
 * - Execute failed
 * - Registry updated
 */
export const executeLogger = subsystemLoggers.execute;

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get a subsystem logger by name.
 *
 * @param subsystem - Subsystem name
 * @returns The logger for that subsystem
 */
export function getSubsystemLogger(subsystem: InboxSubsystem) {
	const loggerMap: Record<InboxSubsystem, typeof inboxLogger> = {
		inbox: inboxLogger,
		pdf: pdfLogger,
		llm: llmLogger,
		execute: executeLogger,
	};

	return loggerMap[subsystem];
}

/**
 * Create a unique correlation ID for tracing operations.
 * Use one cid per process-inbox invocation.
 *
 * @returns Unique correlation ID string
 */
export function createCorrelationId(): string {
	return coreCreateCorrelationId();
}

/**
 * All subsystem loggers as a typed object.
 */
export const loggers = {
	inbox: inboxLogger,
	pdf: pdfLogger,
	llm: llmLogger,
	execute: executeLogger,
} as const;
