/**
 * Kit Plugin Logger
 *
 * JSONL logging with LogTape for observability and debugging.
 * Uses @sidequest/core logging factory for consistent log location.
 *
 * Log location: ~/.claude/logs/kit.jsonl
 *
 * Logging Level Convention:
 * - DEBUG: Detailed diagnostic info (file counts, cache hits, parameter echo)
 * - INFO: Normal operation events (start/complete, results summary)
 * - WARN: Degraded operation (fallbacks, skipped files, soft failures)
 * - ERROR: Operation failures (exceptions, command failures, parse errors)
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
	name: "kit",
	subsystems: [
		"grep",
		"semantic",
		"symbols",
		"fileTree",
		"fileContent",
		"usages",
		"ast",
		"commit",
		"summarize",
	],
});

// ============================================================================
// Exports
// ============================================================================

export { createCorrelationId, initLogger, logDir, logFile, logger };

/** Grep subsystem logger */
export const grepLogger = getSubsystemLogger("grep");

/** Semantic search subsystem logger */
export const semanticLogger = getSubsystemLogger("semantic");

/** Symbols subsystem logger */
export const symbolsLogger = getSubsystemLogger("symbols");

/** File tree subsystem logger */
export const fileTreeLogger = getSubsystemLogger("fileTree");

/** File content subsystem logger */
export const fileContentLogger = getSubsystemLogger("fileContent");

/** Usages subsystem logger */
export const usagesLogger = getSubsystemLogger("usages");

/** AST search subsystem logger */
export const astLogger = getSubsystemLogger("ast");

/** Commit subsystem logger */
export const commitLogger = getSubsystemLogger("commit");

/** Summarize subsystem logger */
export const summarizeLogger = getSubsystemLogger("summarize");

// ============================================================================
// Legacy getter functions (for backwards compatibility)
// ============================================================================

/** @deprecated Use logger directly */
export function getKitLogger() {
	return logger;
}

/** @deprecated Use grepLogger directly */
export function getGrepLogger() {
	return grepLogger;
}

/** @deprecated Use semanticLogger directly */
export function getSemanticLogger() {
	return semanticLogger;
}

/** @deprecated Use symbolsLogger directly */
export function getSymbolsLogger() {
	return symbolsLogger;
}

/** @deprecated Use fileTreeLogger directly */
export function getFileTreeLogger() {
	return fileTreeLogger;
}

/** @deprecated Use fileContentLogger directly */
export function getFileContentLogger() {
	return fileContentLogger;
}

/** @deprecated Use usagesLogger directly */
export function getUsagesLogger() {
	return usagesLogger;
}

/** @deprecated Use astLogger directly */
export function getAstLogger() {
	return astLogger;
}
