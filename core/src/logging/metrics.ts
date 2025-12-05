/**
 * Performance Metrics Collection for MCP Tools and Hooks
 *
 * Automatically aggregates durationMs from LogTape logs to provide:
 * - Call counts per tool
 * - Min/max/avg latency
 * - Error rates
 * - Success rates
 * - Performance rankings
 *
 * Designed to be integrated into Stop hooks for session summaries.
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Single operation metric for a specific tool */
export interface OperationMetrics {
	/** Tool name (e.g., "kit_index_find", "biome_lintCheck") */
	tool: string;
	/** Total number of invocations */
	count: number;
	/** Total milliseconds across all invocations */
	totalDurationMs: number;
	/** Average duration in milliseconds */
	avgDurationMs: number;
	/** Minimum duration observed */
	minDurationMs: number;
	/** Maximum duration observed */
	maxDurationMs: number;
	/** Number of failed operations */
	errorCount: number;
	/** Success rate as percentage (0-100) */
	successRate: number;
}

/** Complete session performance summary */
export interface PerformanceSummary {
	/** Total number of operations across all tools */
	totalOperations: number;
	/** Number of successful operations */
	successfulOperations: number;
	/** Number of failed operations */
	failedOperations: number;
	/** Overall success rate percentage */
	overallSuccessRate: number;
	/** Total time spent across all operations */
	totalDurationMs: number;
	/** Metrics for each tool */
	toolMetrics: OperationMetrics[];
	/** Slowest operations (top 5) */
	slowest: Array<{ tool: string; durationMs: number }>;
	/** Fastest operations (top 5) */
	fastest: Array<{ tool: string; durationMs: number }>;
	/** Most frequently used tools (top 5) */
	mostUsed: Array<{ tool: string; count: number }>;
	/** Tools with highest error rates */
	mostProblematic: Array<{
		tool: string;
		errorRate: number;
		errorCount: number;
	}>;
}

/** Raw log entry structure from LogTape JSONL */
interface LogEntry {
	"@timestamp": string;
	level: string;
	logger: string;
	message: string;
	properties?: {
		cid?: string;
		tool?: string;
		durationMs?: number;
		success?: boolean;
		exitCode?: number;
		hook?: string;
	};
}

/** Options for metrics collection */
export interface MetricsCollectorOptions {
	/** Log directory path (default: ~/.claude/logs) */
	logDir?: string;
	/** Only include metrics for these plugins (default: all) */
	includePlugins?: string[];
	/** Exclude these plugins from metrics */
	excludePlugins?: string[];
	/** Minimum duration threshold (ms) to warn about slow operations */
	slowThreshold?: number;
	/** Minimum error rate (%) to warn about problematic tools */
	errorRateThreshold?: number;
}

/**
 * Collects and aggregates performance metrics from LogTape JSONL logs.
 *
 * Automatically parses ~/.claude/logs/*.jsonl files to extract durationMs
 * from MCP tool responses and hook completions.
 *
 * @example
 * ```typescript
 * import { MetricsCollector } from "@sidequest/core/logging";
 *
 * // In a Stop hook
 * const collector = new MetricsCollector();
 * await collector.collect();
 * const summary = collector.getSummary();
 *
 * console.log(summary.toMarkdown());
 * ```
 */
export class MetricsCollector {
	private metrics = new Map<string, OperationMetrics>();
	private options: Required<MetricsCollectorOptions>;

	constructor(options: MetricsCollectorOptions = {}) {
		this.options = {
			logDir: options.logDir ?? join(homedir(), ".claude", "logs"),
			includePlugins: options.includePlugins ?? [],
			excludePlugins: options.excludePlugins ?? [],
			slowThreshold: options.slowThreshold ?? 1000, // 1s default
			errorRateThreshold: options.errorRateThreshold ?? 5, // 5% default
		};
	}

	/**
	 * Record a single operation metric.
	 * Typically called automatically by parsing logs, but can be used manually.
	 */
	recordOperation(tool: string, durationMs: number, success: boolean): void {
		const existing = this.metrics.get(tool);

		if (existing) {
			existing.count++;
			existing.totalDurationMs += durationMs;
			existing.avgDurationMs = existing.totalDurationMs / existing.count;
			existing.minDurationMs = Math.min(existing.minDurationMs, durationMs);
			existing.maxDurationMs = Math.max(existing.maxDurationMs, durationMs);
			if (!success) {
				existing.errorCount++;
			}
			existing.successRate =
				((existing.count - existing.errorCount) / existing.count) * 100;
		} else {
			this.metrics.set(tool, {
				tool,
				count: 1,
				totalDurationMs: durationMs,
				avgDurationMs: durationMs,
				minDurationMs: durationMs,
				maxDurationMs: durationMs,
				errorCount: success ? 0 : 1,
				successRate: success ? 100 : 0,
			});
		}
	}

	/**
	 * Parse JSONL log entries and aggregate metrics.
	 * Reads all *.jsonl files in the log directory.
	 */
	async collect(): Promise<void> {
		const logDir = this.options.logDir;

		if (!existsSync(logDir)) {
			return; // No logs to collect
		}

		// Read all .jsonl files
		const { readdirSync } = await import("node:fs");
		const entries = readdirSync(logDir, { withFileTypes: true });

		for (const entry of entries) {
			if (entry.isFile() && entry.name.endsWith(".jsonl")) {
				const pluginName = entry.name.replace(/\.jsonl$/, "");

				// Apply include/exclude filters
				if (
					this.options.includePlugins.length > 0 &&
					!this.options.includePlugins.includes(pluginName)
				) {
					continue;
				}
				if (this.options.excludePlugins.includes(pluginName)) {
					continue;
				}

				await this.parseLogFile(join(logDir, entry.name));
			}
		}
	}

	/**
	 * Parse a single JSONL log file and extract metrics.
	 */
	private async parseLogFile(filePath: string): Promise<void> {
		if (!existsSync(filePath)) {
			return;
		}

		const content = readFileSync(filePath, "utf-8");
		const lines = content.trim().split("\n");

		for (const line of lines) {
			if (!line.trim()) continue;

			try {
				const entry: LogEntry = JSON.parse(line);

				// Look for "MCP tool response" or "Hook completed" messages
				const isMcpResponse = entry.message === "MCP tool response";
				const isHookCompleted = entry.message === "Hook completed";

				if ((isMcpResponse || isHookCompleted) && entry.properties) {
					const { tool, durationMs, success, exitCode, hook } =
						entry.properties;

					if (durationMs !== undefined) {
						// Determine tool name
						const toolName = tool ?? hook ?? "unknown";

						// Determine success
						const isSuccess =
							success !== undefined
								? success
								: exitCode !== undefined
									? exitCode === 0
									: true;

						this.recordOperation(toolName, durationMs, isSuccess);
					}
				}
			} catch {}
		}
	}

	/**
	 * Get aggregated performance summary.
	 */
	getSummary(): PerformanceSummary {
		const toolMetrics = Array.from(this.metrics.values());

		// Calculate totals
		const totalOperations = toolMetrics.reduce((sum, m) => sum + m.count, 0);
		const failedOperations = toolMetrics.reduce(
			(sum, m) => sum + m.errorCount,
			0,
		);
		const successfulOperations = totalOperations - failedOperations;
		const overallSuccessRate =
			totalOperations > 0
				? (successfulOperations / totalOperations) * 100
				: 100;
		const totalDurationMs = toolMetrics.reduce(
			(sum, m) => sum + m.totalDurationMs,
			0,
		);

		// Sort and rank
		const byMaxDuration = [...toolMetrics].sort(
			(a, b) => b.maxDurationMs - a.maxDurationMs,
		);
		const byMinDuration = [...toolMetrics].sort(
			(a, b) => a.minDurationMs - b.minDurationMs,
		);
		const byCallCount = [...toolMetrics].sort((a, b) => b.count - a.count);
		const byErrorRate = [...toolMetrics]
			.filter((m) => m.errorCount > 0)
			.sort((a, b) => 100 - b.successRate - (100 - a.successRate));

		return {
			totalOperations,
			successfulOperations,
			failedOperations,
			overallSuccessRate,
			totalDurationMs,
			toolMetrics,
			slowest: byMaxDuration.slice(0, 5).map((m) => ({
				tool: m.tool,
				durationMs: m.maxDurationMs,
			})),
			fastest: byMinDuration.slice(0, 5).map((m) => ({
				tool: m.tool,
				durationMs: m.minDurationMs,
			})),
			mostUsed: byCallCount.slice(0, 5).map((m) => ({
				tool: m.tool,
				count: m.count,
			})),
			mostProblematic: byErrorRate.slice(0, 5).map((m) => ({
				tool: m.tool,
				errorRate: 100 - m.successRate,
				errorCount: m.errorCount,
			})),
		};
	}

	/**
	 * Format summary as Markdown table.
	 */
	toMarkdown(): string {
		const summary = this.getSummary();

		let output =
			"═══════════════════════════════════════════════════════════════\n";
		output += "📊 MCP Performance Metrics - Session Summary\n";
		output +=
			"═══════════════════════════════════════════════════════════════\n\n";

		// Overall stats
		output += `Total Operations: ${summary.totalOperations}\n`;
		output += `Successful: ${summary.successfulOperations} (${summary.overallSuccessRate.toFixed(1)}%)\n`;
		output += `Failed: ${summary.failedOperations} (${(100 - summary.overallSuccessRate).toFixed(1)}%)\n`;
		output += `Total Duration: ${this.formatDuration(summary.totalDurationMs)}\n\n`;

		// Tool performance table
		if (summary.toolMetrics.length > 0) {
			output +=
				"───────────────────────────────────────────────────────────────\n";
			output +=
				"Tool Name                   Calls  Avg Time   Min    Max  Errors\n";
			output +=
				"───────────────────────────────────────────────────────────────\n";

			for (const metric of summary.toolMetrics) {
				const toolName = metric.tool.padEnd(26);
				const calls = metric.count.toString().padStart(5);
				const avgTime = this.formatMs(metric.avgDurationMs).padStart(8);
				const minTime = this.formatMs(metric.minDurationMs).padStart(6);
				const maxTime = this.formatMs(metric.maxDurationMs).padStart(6);
				const errors = metric.errorCount.toString().padStart(3);

				output += `${toolName} ${calls}  ${avgTime} ${minTime} ${maxTime}  ${errors}\n`;
			}

			output +=
				"───────────────────────────────────────────────────────────────\n\n";
		}

		// Rankings
		if (summary.slowest.length > 0) {
			output += "Slowest Operations:\n";
			for (const [idx, { tool, durationMs }] of summary.slowest.entries()) {
				output += `${idx + 1}. ${tool} (${this.formatDuration(durationMs)})\n`;
			}
			output += "\n";
		}

		if (summary.fastest.length > 0) {
			output += "Fastest Operations:\n";
			for (const [idx, { tool, durationMs }] of summary.fastest.entries()) {
				output += `${idx + 1}. ${tool} (${this.formatMs(durationMs)})\n`;
			}
			output += "\n";
		}

		if (summary.mostUsed.length > 0) {
			output += "Most Frequently Used:\n";
			for (const [idx, { tool, count }] of summary.mostUsed.entries()) {
				output += `${idx + 1}. ${tool} (${count} calls)\n`;
			}
			output += "\n";
		}

		// Recommendations
		output += "Recommendations:\n";

		const slowTools = summary.toolMetrics.filter(
			(m) => m.avgDurationMs > this.options.slowThreshold,
		);
		const problematicTools = summary.toolMetrics.filter(
			(m) => 100 - m.successRate > this.options.errorRateThreshold,
		);

		if (slowTools.length === 0 && problematicTools.length === 0) {
			output += "• All tools performing well!\n";
		}

		for (const tool of slowTools) {
			output += `• ${tool.tool} averaging ${this.formatMs(tool.avgDurationMs)} - consider optimization\n`;
		}

		for (const tool of problematicTools) {
			output += `• ${tool.tool} has ${(100 - tool.successRate).toFixed(1)}% error rate - investigate failures\n`;
		}

		return output;
	}

	/**
	 * Format summary as JSON.
	 */
	toJSON(): object {
		return this.getSummary();
	}

	/**
	 * Clear all collected metrics.
	 */
	clear(): void {
		this.metrics.clear();
	}

	/**
	 * Format milliseconds as human-readable string.
	 */
	private formatMs(ms: number): string {
		return `${Math.round(ms)}ms`;
	}

	/**
	 * Format duration as human-readable string (handles seconds).
	 */
	private formatDuration(ms: number): string {
		if (ms < 1000) {
			return `${Math.round(ms)}ms`;
		}
		return `${(ms / 1000).toFixed(2)}s`;
	}
}

/**
 * Global singleton collector for session-wide metrics.
 * Can be used across plugins to aggregate into a single report.
 */
let globalCollector: MetricsCollector | undefined;

/**
 * Get or create the global metrics collector.
 */
export function getGlobalMetricsCollector(
	options?: MetricsCollectorOptions,
): MetricsCollector {
	if (!globalCollector) {
		globalCollector = new MetricsCollector(options);
	}
	return globalCollector;
}

/**
 * Reset the global collector (useful for testing).
 */
export function resetGlobalMetricsCollector(): void {
	globalCollector = undefined;
}
