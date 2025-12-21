/**
 * Plugin Logger Factory.
 *
 * Creates configured LogTape loggers for SideQuest plugins with:
 * - JSONL file output with rotation
 * - Hierarchical categories for subsystem filtering
 * - Centralized log location (~/.claude/logs/<plugin>.jsonl)
 */

import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { getRotatingFileSink } from "@logtape/file";
import {
	configure,
	getLogger,
	jsonLinesFormatter,
	type Logger,
} from "@logtape/logtape";
import {
	DEFAULT_LOG_EXTENSION,
	DEFAULT_LOG_LEVEL,
	DEFAULT_MAX_FILES,
	DEFAULT_MAX_SIZE,
	type LogLevel,
} from "./config.ts";
import { createCorrelationId } from "./correlation.ts";

/** Default centralized log directory for all plugins */
const DEFAULT_LOG_DIR = join(homedir(), ".claude", "logs");

/**
 * Options for creating a plugin logger.
 */
export interface PluginLoggerOptions {
	/** Plugin name (used for log file name and category). Should be kebab-case. */
	name: string;

	/**
	 * Subsystem names for hierarchical loggers.
	 * Each subsystem gets its own logger under the plugin category.
	 *
	 * @example ["scraper", "auth", "gmail"] → loggers for ["my-plugin", "scraper"], etc.
	 */
	subsystems?: string[];

	/**
	 * Log directory. Defaults to ~/.claude/logs/
	 * All plugin logs are stored flat in this directory.
	 */
	logDir?: string;

	/**
	 * Log file name (without extension). Defaults to plugin name.
	 * Results in: <logDir>/<logFileName>.jsonl
	 */
	logFileName?: string;

	/**
	 * Maximum log file size before rotation. Defaults to 1 MiB.
	 */
	maxSize?: number;

	/**
	 * Number of rotated files to keep. Defaults to 5.
	 */
	maxFiles?: number;

	/**
	 * Lowest log level to capture. Defaults to "debug".
	 */
	lowestLevel?: LogLevel;
}

/**
 * Result of creating a plugin logger.
 */
export interface PluginLogger {
	/**
	 * Initialize the logging system. Must be called before logging.
	 * Safe to call multiple times - only initializes once.
	 */
	initLogger: () => Promise<void>;

	/**
	 * Generate a correlation ID for request tracing.
	 */
	createCorrelationId: typeof createCorrelationId;

	/**
	 * Root logger for the plugin category.
	 */
	rootLogger: Logger;

	/**
	 * Get a subsystem logger by name.
	 *
	 * @param subsystem - Subsystem name (e.g., "scraper", "auth")
	 * @returns Logger for [pluginName, subsystem] category
	 */
	getSubsystemLogger: (subsystem: string) => Logger;

	/** Log directory path */
	logDir: string;

	/** Log file path */
	logFile: string;

	/**
	 * Pre-created subsystem loggers (if subsystems were specified in options).
	 * Keys are subsystem names, values are Logger instances.
	 */
	subsystemLoggers: Record<string, Logger>;
}

/**
 * Create a configured logger for a SideQuest plugin.
 *
 * @param options - Logger configuration options
 * @returns Plugin logger with initialization function and logger instances
 *
 * @example
 * ```typescript
 * // In your plugin's logger.ts
 * import { createPluginLogger } from "@sidequest/core/logging";
 *
 * const {
 *   initLogger,
 *   createCorrelationId,
 *   rootLogger,
 *   getSubsystemLogger,
 *   subsystemLoggers,
 * } = createPluginLogger({
 *   name: "my-plugin",
 *   subsystems: ["scraper", "auth", "api"],
 * });
 *
 * // Export for use in plugin
 * export { initLogger, createCorrelationId };
 * export const logger = rootLogger;
 * export const scraperLogger = subsystemLoggers.scraper;
 * export const authLogger = subsystemLoggers.auth;
 * export const apiLogger = subsystemLoggers.api;
 * ```
 */
export function createPluginLogger(options: PluginLoggerOptions): PluginLogger {
	const {
		name,
		subsystems = [],
		logDir = DEFAULT_LOG_DIR,
		logFileName = name,
		maxSize = DEFAULT_MAX_SIZE,
		maxFiles = DEFAULT_MAX_FILES,
		lowestLevel = DEFAULT_LOG_LEVEL,
	} = options;

	const logFile = join(logDir, `${logFileName}${DEFAULT_LOG_EXTENSION}`);

	let isInitialized = false;

	/**
	 * Initialize the logging system.
	 * Safe to call multiple times - only initializes once.
	 * Also safe to call when logtape is already configured (e.g., by test setup).
	 */
	async function initLogger(): Promise<void> {
		if (isInitialized) return;

		// Ensure log directory exists
		if (!existsSync(logDir)) {
			mkdirSync(logDir, { recursive: true });
		}

		// Use unique sink name per plugin to avoid LogTape configuration conflicts
		// Multiple plugins calling configure() will merge their configs
		const sinkName = `file_${name}`;

		try {
			await configure({
				sinks: {
					[sinkName]: getRotatingFileSink(logFile, {
						formatter: jsonLinesFormatter,
						maxSize,
						maxFiles,
						// @ts-expect-error - lazy option exists in newer versions
						lazy: true,
					}),
				},
				loggers: [
					{
						category: [name],
						sinks: [sinkName],
						lowestLevel,
					},
					// Configure LogTape meta logger to reduce MCP server noise
					{
						category: ["logtape", "meta"],
						sinks: [sinkName],
						lowestLevel: "error",
					},
				],
			});
		} catch (error: unknown) {
			// Handle "Already configured" error gracefully - this happens when:
			// 1. Tests use setupTestLogging() before importing production code
			// 2. Multiple plugins try to configure logtape
			// In both cases, we can safely ignore and continue with existing config
			if (
				error instanceof Error &&
				error.message.includes("Already configured")
			) {
				isInitialized = true;
				return;
			}
			throw error;
		}

		// Log initialization
		const startupLogger = getLogger([name]);
		startupLogger.info("Logging initialized", {
			plugin: name,
			logDir,
			logFile,
			maxSize,
			maxFiles,
		});

		isInitialized = true;
	}

	// Create root logger
	const rootLogger = getLogger([name]);

	// Create subsystem logger getter
	function getSubsystemLogger(subsystem: string): Logger {
		return getLogger([name, subsystem]);
	}

	// Pre-create subsystem loggers
	const subsystemLoggers: Record<string, Logger> = {};
	for (const subsystem of subsystems) {
		subsystemLoggers[subsystem] = getSubsystemLogger(subsystem);
	}

	return {
		initLogger,
		createCorrelationId,
		rootLogger,
		getSubsystemLogger,
		logDir,
		logFile,
		subsystemLoggers,
	};
}
