/**
 * Terminal Plugin
 *
 * Front door to dotfiles bin scripts with full observability.
 * Provides MCP tools for say, quarantine, and downloads domains.
 */

// Bin runner exports
export {
	type BinScriptResult,
	binScriptExists,
	getBinScriptPath,
	type RunBinScriptOptions,
	runBinScript,
} from "./bin-runner.js";
// Logger exports
export {
	createCorrelationId,
	downloadsLogger,
	initLogger,
	logDir,
	logFile,
	logger,
	quarantineLogger,
	sayLogger,
} from "./logger.js";
