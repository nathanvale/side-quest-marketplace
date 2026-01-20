/**
 * Teams-scrape plugin
 *
 * Extract and persist Microsoft Teams chat messages with:
 * - Clipboard parsing from Teams format
 * - Persistent storage with atomic writes
 * - Deterministic new message detection
 * - Full observability (logging, correlation IDs, timing)
 *
 * @module teams-scrape
 */

/** Plugin marker for workspace validation */
export const PLUGIN_NAME = "teams-scrape";

// Logger exports
export {
	cliLogger,
	createCorrelationId,
	initLogger,
	logDir,
	logFile,
	logger,
	parserLogger,
	storageLogger,
} from "./logger.js";

// Parser exports
export {
	generateMessageId,
	parseAUDateToISO,
	parseTeamsClipboard,
} from "./parser.js";

// Storage exports
export {
	CONFIG_DIR,
	getStoragePath,
	listStoredChats,
	loadStoredChat,
	mergeAndSave,
	saveChat,
	targetToSlug,
} from "./storage.js";
// Type exports
export type {
	CliCommand,
	ListResult,
	ScrapeResult,
	StoredChat,
	TeamsMessage,
} from "./types.js";
