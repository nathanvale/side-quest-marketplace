/**
 * @sidequest/core/logging
 *
 * Shared logging utilities for SideQuest marketplace plugins.
 *
 * Provides a factory function for creating LogTape-based loggers with:
 * - JSONL file output for machine-parseable logs
 * - Automatic file rotation (1MB default, 5 files)
 * - Hierarchical categories for subsystem filtering
 * - Correlation IDs for request tracing
 *
 * @example
 * ```typescript
 * import { createPluginLogger } from "@sidequest/core/logging";
 *
 * const { initLogger, rootLogger, subsystemLoggers } = createPluginLogger({
 *   name: "my-plugin",
 *   subsystems: ["api", "cache"],
 * });
 *
 * // Initialize at entry point (MCP server startup, CLI main)
 * await initLogger();
 *
 * // Use loggers
 * rootLogger.info("Plugin started");
 * subsystemLoggers.api.debug("Request received", { endpoint: "/health" });
 * ```
 *
 * @packageDocumentation
 */

export {
	DEFAULT_LOG_EXTENSION,
	DEFAULT_LOG_LEVEL,
	DEFAULT_MAX_FILES,
	DEFAULT_MAX_SIZE,
	type LogLevel,
} from "./config.ts";
// Re-export everything
export { createCorrelationId } from "./correlation.ts";
export {
	createPluginLogger,
	type PluginLogger,
	type PluginLoggerOptions,
} from "./factory.ts";
export {
	getGlobalMetricsCollector,
	MetricsCollector,
	type MetricsCollectorOptions,
	type OperationMetrics,
	type PerformanceSummary,
	resetGlobalMetricsCollector,
} from "./metrics.ts";
