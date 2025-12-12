/**
 * Inbox Processing Framework - Logging Infrastructure
 *
 * Re-exports logging utilities from the centralized logger module.
 * This module provides backward compatibility for inbox-specific imports.
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

import {
	createCorrelationId,
	executeLogger,
	getLogFile,
	getSubsystemLogger,
	inboxLogger,
	initLogger,
	llmLogger,
	pdfLogger,
	rootLogger,
} from "../logger";

// =============================================================================
// Re-export from centralized logger
// =============================================================================

export {
	createCorrelationId,
	executeLogger,
	getSubsystemLogger,
	inboxLogger,
	llmLogger,
	pdfLogger,
	rootLogger,
};

/**
 * Get the current log file path.
 */
export const logFile = getLogFile();

/**
 * Initialize logging and emit a one-time notice about the log file location.
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
} as const;
