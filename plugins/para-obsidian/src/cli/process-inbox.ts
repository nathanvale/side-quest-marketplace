/**
 * Process inbox command handler for PARA Obsidian CLI
 */

import { confirm } from "@inquirer/prompts";
import { MetricsCollector } from "@sidequest/core/logging";
import { color, emphasize } from "@sidequest/core/terminal";
import { createSpinner } from "nanospinner";
import { DEFAULT_MODEL } from "../config/defaults";
import type { BatchResult, InboxSuggestion } from "../inbox";
import {
	createInboxEngine,
	displayResults,
	formatSuggestionsTable,
	runInteractiveLoop,
} from "../inbox";
import { checkSLOBreach, recordSLOEvent } from "../inbox/shared/slos";
import { checkThreshold } from "../inbox/shared/thresholds";
import { isCreateNoteSuggestion } from "../inbox/types";
import {
	createCorrelationId,
	getLogFile,
	inboxLogger,
	initLoggerWithNotice,
} from "../shared/logger";
import { startSession } from "./shared/session";
import type { CommandContext, CommandResult } from "./types";

type MetricsSummary = ReturnType<MetricsCollector["getSummary"]>;

/**
 * Metrics captured during scan operation
 */
interface ScanMetrics {
	durationMs: number;
	filesProcessed: number;
	skipped: number;
	errors: number;
	llmFailures: number;
	llmFallbacks: number;
	llmUnavailable: boolean;
	thresholdsExceeded: string[];
}

/**
 * Metrics captured during execute operation
 */
interface ExecuteMetrics {
	durationMs: number;
	succeeded: number;
	failed: number;
	thresholdsExceeded: string[];
}

/**
 * Singleton metrics collector instance scoped to this plugin only.
 * Prevents expensive repeated log scans and cross-plugin contamination.
 */
let metricsCollector: MetricsCollector | null = null;

/**
 * Get or create metrics collector with plugin-scoped filtering.
 * Collects metrics only once per CLI invocation for performance.
 */
async function getOrCreateMetricsCollector(): Promise<MetricsCollector> {
	if (!metricsCollector) {
		metricsCollector = new MetricsCollector({
			includePlugins: ["para-obsidian"], // CRITICAL: scope to this plugin only
		});
		await metricsCollector.collect();
	}
	return metricsCollector;
}

/**
 * Collect metrics summary (cached after first collection).
 */
async function collectMetricsSummary(): Promise<MetricsSummary | null> {
	try {
		const collector = await getOrCreateMetricsCollector();
		return collector.getSummary();
	} catch {
		return null;
	}
}

/**
 * Helper to add log context to output
 */
function withLogContext<T extends object>(
	payload: T,
	metrics?: MetricsSummary | null,
) {
	return {
		...payload,
		logFile: getLogFile(),
		...(metrics ? { metrics } : {}),
	};
}

/**
 * Get stage label for display
 */
function stageLabel(stage: string, model?: string): string {
	switch (stage) {
		case "start":
			return "starting";
		case "hash":
			return "hashing";
		case "extract":
			return "extracting";
		case "enrich":
			return "enriching";
		case "llm":
			return model ? `LLM (${model})` : "LLM";
		case "skip":
			return "skipped";
		case "done":
			return "done";
		case "error":
			return "error";
		default:
			return stage;
	}
}

/**
 * Handle process-inbox command
 */
export async function handleProcessInbox(
	ctx: CommandContext,
): Promise<CommandResult> {
	const { config, flags, isJson } = ctx;

	// Start session with correlation ID tracking (shows at start and end)
	const session = startSession("para process-inbox", { silent: isJson });
	const sessionCid = session.sessionCid;

	await initLoggerWithNotice();
	if (!isJson) {
		console.log(emphasize.info(`Logs: ${getLogFile()}`));
	}

	let result: CommandResult;
	try {
		// Parse process-inbox specific flags
		const autoMode = flags.auto === true;
		const previewMode = flags.preview === true;
		const dryRun = flags["dry-run"] === true;
		const skipConfirm = flags.confirm === true; // --confirm skips the interactive prompt
		// Verbose and force flags reserved for future use
		const _verbose = flags.verbose === true;
		const _force = flags.force === true;
		const filterPattern =
			typeof flags.filter === "string" ? flags.filter : undefined;

		// Get LLM model from env or default (uses DEFAULT_MODEL from config/defaults.ts)
		// TODO: Get llmModel from config when inbox config is added to ParaObsidianConfig
		const llmModel = process.env.PARA_LLM_MODEL || DEFAULT_MODEL;

		// Create engine with config
		const engine = createInboxEngine({
			vaultPath: config.vault,
			inboxFolder: "00 Inbox",
			attachmentsFolder: "Attachments",
			templatesFolder: config.templatesDir,
			llmProvider: llmModel, // Pass the model as provider
			llmModel: llmModel, // Also pass as explicit model
		});

		// Scan inbox for suggestions
		let suggestions: InboxSuggestion[];
		let scanMetrics: ScanMetrics | null = null;
		if (isJson) {
			suggestions = await engine.scan({ sessionCid });
		} else {
			const scanResult = await scanWithSpinner(engine, llmModel, sessionCid);
			suggestions = scanResult.suggestions;
			scanMetrics = scanResult.metrics;
		}

		// Apply filter if provided
		const filteredSuggestions = filterPattern
			? suggestions.filter(
					(s) =>
						s.source.includes(filterPattern) ||
						(isCreateNoteSuggestion(s) &&
							s.suggestedTitle?.includes(filterPattern)) ||
						false,
				)
			: suggestions;

		if (filteredSuggestions.length === 0) {
			result = await handleEmptyInbox(isJson, sessionCid, scanMetrics);
		} else if (previewMode) {
			// Preview mode: just display suggestions
			result = await handlePreviewMode(
				filteredSuggestions,
				isJson,
				sessionCid,
				scanMetrics,
			);
		} else if (autoMode) {
			// Auto mode: process all without interaction
			result = await handleAutoMode(
				engine,
				filteredSuggestions,
				dryRun,
				skipConfirm,
				isJson,
				sessionCid,
				scanMetrics,
			);
		} else {
			// Interactive mode: run the interactive approval loop
			result = await handleInteractiveMode(
				engine,
				filteredSuggestions,
				dryRun,
				isJson,
				config.vault,
				sessionCid,
				config.paraFolders,
			);
		}
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		session.end({ error: errorMsg });
		throw error;
	}

	// End session with success status
	session.end({ success: result.success });
	return result;
}

/** Average seconds per file for LLM classification (used for ETA calculation) */
const AVG_SECONDS_PER_FILE = 20;

/**
 * Format duration in human-readable form
 */
function formatDuration(seconds: number): string {
	if (seconds < 60) return `${Math.round(seconds)}s`;
	const mins = Math.floor(seconds / 60);
	const secs = Math.round(seconds % 60);
	return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

/**
 * Calculate ETA based on progress
 */
function calculateEta(
	processed: number,
	total: number,
	elapsedMs: number,
): string {
	if (processed === 0 || total === 0) {
		// Initial estimate based on average
		const remaining = total || 1;
		return `~${formatDuration(remaining * AVG_SECONDS_PER_FILE)}`;
	}

	// Use actual timing for more accurate estimate
	const avgMsPerFile = elapsedMs / processed;
	const remaining = total - processed;
	const etaMs = remaining * avgMsPerFile;
	return formatDuration(etaMs / 1000);
}

/**
 * Render a visual progress bar (bar only, count displayed separately)
 * @param percentComplete - Progress percentage (0-100)
 * @param width - Width of the bar in characters (default: 20)
 * @returns Formatted progress bar string like "[████████░░░░░░░░]"
 */
function renderProgressBar(percentComplete: number, width = 20): string {
	const ratio = Math.min(Math.max(percentComplete / 100, 0), 1);
	const filled = Math.round(ratio * width);
	const empty = width - filled;

	const bar = "█".repeat(filled) + "░".repeat(empty);
	return `[${bar}]`;
}

/**
 * Render a visual progress bar using processed/total counts (legacy version)
 * @param processed - Number of items processed
 * @param total - Total number of items
 * @param width - Width of the bar in characters (default: 20)
 * @returns Formatted progress bar string like "[████████░░░░░░░░]"
 */
function renderProgressBarFromCounts(
	processed: number,
	total: number,
	width = 20,
): string {
	if (total === 0) return `[${"░".repeat(width)}]`;
	const percentComplete = Math.round((processed / total) * 100);
	return renderProgressBar(percentComplete, width);
}

/**
 * Scan inbox with progress spinner
 */
async function scanWithSpinner(
	engine: ReturnType<typeof createInboxEngine>,
	llmModel: string,
	sessionCid: string,
): Promise<{ suggestions: InboxSuggestion[]; metrics: ScanMetrics }> {
	const cid = createCorrelationId();
	const scanSpinner = createSpinner("Scanning inbox...").start();
	const scanStarted = Date.now();
	const scanState = {
		total: 0,
		processed: 0, // Files that have completed (done/skip/error)
		skipped: 0,
		errors: 0,
		llmFailures: 0,
		llmFallbacks: 0,
		lastFallbackReason: undefined as string | undefined,
		lastLlmError: undefined as string | undefined,
		currentFile: "",
		stage: "start" as
			| "start"
			| "hash"
			| "extract"
			| "enrich"
			| "llm"
			| "skip"
			| "done"
			| "error",
		stageStartedAt: Date.now(),
	};

	const updateScanText = () => {
		const elapsedMs = Date.now() - scanStarted;
		const elapsedStage = (
			(Date.now() - scanState.stageStartedAt) /
			1000
		).toFixed(1);
		const eta = calculateEta(scanState.processed, scanState.total, elapsedMs);

		// Progress bar fills based on COMPLETED files only
		const progressBar = renderProgressBarFromCounts(
			scanState.processed,
			scanState.total || 0,
			16,
		);

		// Simple count: completed / total
		const countInfo =
			scanState.total > 0 ? ` ${scanState.processed}/${scanState.total}` : "";

		const stats =
			scanState.skipped > 0 || scanState.errors > 0
				? ` (${scanState.skipped} skipped, ${scanState.errors} errors)`
				: "";
		const etaDisplay =
			scanState.total > 0 && scanState.processed < scanState.total
				? ` ${eta}`
				: "";

		// Stage indicator (what we're doing now)
		const stageInfo =
			scanState.currentFile === ""
				? ""
				: ` ${stageLabel(scanState.stage, scanState.stage === "llm" ? llmModel : undefined)} ${scanState.currentFile} ${elapsedStage}s`;

		scanSpinner.update({
			text: `${progressBar}${countInfo}${stats}${etaDisplay}${stageInfo}`,
		});
	};

	const scanTicker = setInterval(updateScanText, 500);

	// Ensure cleanup on SIGINT (Ctrl+C)
	const cleanup = () => {
		clearInterval(scanTicker);
		scanSpinner.error({ text: "Scan interrupted" });
	};
	process.on("SIGINT", cleanup);

	try {
		const suggestions = await engine.scan({
			sessionCid,
			onProgress: (progress) => {
				const { total, filename, stage } = progress;
				scanState.total = total;

				if (
					stage === "start" ||
					stage === "hash" ||
					stage === "extract" ||
					stage === "enrich"
				) {
					// Update stage display only - no progress increment
					scanState.currentFile = filename;
					scanState.stage = stage;
					scanState.stageStartedAt = Date.now();
				} else if (stage === "llm") {
					// Update stage display for LLM processing
					scanState.currentFile = filename;
					scanState.stage = "llm";
					scanState.stageStartedAt = Date.now();
					// Track fallback reason when fallback is triggered
					if (progress.isFallback && progress.fallbackReason) {
						scanState.lastFallbackReason = progress.fallbackReason;
					}
				} else if (stage === "skip") {
					// Skipped files count as processed
					scanState.skipped += 1;
					scanState.processed += 1;
				} else if (stage === "done") {
					// File completed
					scanState.processed += 1;
					// Track running LLM failure count (only on DoneProgress)
					if (progress.llmFailures !== undefined) {
						scanState.llmFailures = progress.llmFailures;
					}
					// Track fallback usage
					if (progress.llmFallbackUsed) {
						scanState.llmFallbacks += 1;
					}
					// Track last error for summary
					if (progress.llmError) {
						scanState.lastLlmError = progress.llmError;
					}
				} else if (stage === "error") {
					scanState.errors += 1;
					scanState.processed += 1;
					// Error message with progress bar
					const progressBar = renderProgressBarFromCounts(
						scanState.processed,
						scanState.total || 0,
						16,
					);
					const count = `${scanState.processed}/${scanState.total}`;
					scanSpinner.update({
						text: `${progressBar} ${count} error: ${filename} - ${progress.error}`,
					});
					return;
				}
				updateScanText();
			},
		});
		clearInterval(scanTicker);
		process.removeListener("SIGINT", cleanup);
		const durationMs = Date.now() - scanStarted;
		const elapsed = (durationMs / 1000).toFixed(1);
		const total = scanState.total || suggestions.length;
		const finalBar = renderProgressBarFromCounts(
			scanState.processed,
			total,
			16,
		);
		const finalCount = `${scanState.processed}/${total}`;
		const finalStats = [];
		if (scanState.skipped > 0) finalStats.push(`${scanState.skipped} skipped`);
		if (scanState.errors > 0) finalStats.push(`${scanState.errors} errors`);
		const statsStr = finalStats.length > 0 ? ` (${finalStats.join(", ")})` : "";

		// KEEP user-facing output
		scanSpinner.success({
			text: `${finalBar} ${finalCount}${statsStr} in ${elapsed}s`,
		});

		// ADD observability alongside
		if (inboxLogger) {
			inboxLogger.info`Scan completed tool=cli:scanInbox cid=${cid} durationMs=${durationMs} success=true total=${total} processed=${scanState.processed} skipped=${scanState.skipped} errors=${scanState.errors} timestamp=${new Date().toISOString()}`;
		}

		// Check scan duration threshold
		const scanThresholdCheck = checkThreshold("scanTotalMs", durationMs);
		if (scanThresholdCheck.exceeded && inboxLogger) {
			inboxLogger.warn("MCP tool response", {
				tool: "cli:thresholdExceeded",
				sessionCid,
				durationMs,
				success: true,
				thresholdExceeded: true,
				thresholdName: "scanTotalMs",
				thresholdValue: scanThresholdCheck.threshold,
				thresholdPercentage: scanThresholdCheck.percentage,
				alertLevel:
					scanThresholdCheck.percentage > 150 ? "critical" : "warning",
			});
			// Surface in console for visibility
			console.log(
				color(
					scanThresholdCheck.percentage > 150 ? "red" : "yellow",
					`⚠ Scan duration exceeded threshold: ${(durationMs / 1000).toFixed(1)}s (${scanThresholdCheck.percentage}% of ${(scanThresholdCheck.threshold / 1000).toFixed(0)}s limit)`,
				),
			);
		}

		// Check SLO breach for scan latency
		const scanSLOCheck = await checkSLOBreach("scan_latency", durationMs);
		recordSLOEvent("scan_latency", scanSLOCheck.breached, durationMs);
		if (scanSLOCheck.breached && inboxLogger) {
			inboxLogger.error("SLO breach detected", {
				tool: "cli:sloBreached",
				sessionCid,
				sloName: "scan_latency",
				breached: true,
				burnRate: scanSLOCheck.burnRate,
				currentValue: scanSLOCheck.currentValue,
				threshold: scanSLOCheck.slo.threshold,
				target: scanSLOCheck.slo.target,
				errorBudget: scanSLOCheck.slo.errorBudget,
			});
		}

		// Show LLM status messages
		const filesAttempted = scanState.processed - scanState.skipped;

		// Check LLM failure rate threshold
		if (filesAttempted > 0 && scanState.llmFailures > 0) {
			const llmFailureRate = scanState.llmFailures / filesAttempted;
			const llmFailureCheck = checkThreshold("llmFailureRate", llmFailureRate);
			if (llmFailureCheck.exceeded && inboxLogger) {
				inboxLogger.warn("MCP tool response", {
					tool: "cli:thresholdExceeded",
					sessionCid,
					durationMs,
					success: true,
					thresholdExceeded: true,
					thresholdName: "llmFailureRate",
					thresholdValue: llmFailureCheck.threshold,
					thresholdPercentage: llmFailureCheck.percentage,
					llmFailures: scanState.llmFailures,
					filesAttempted,
					actualRate: llmFailureRate,
					alertLevel: llmFailureCheck.percentage > 150 ? "critical" : "warning",
				});
				// Surface in console for visibility
				console.log(
					color(
						llmFailureCheck.percentage > 150 ? "red" : "yellow",
						`⚠ LLM failure rate exceeded threshold: ${(llmFailureRate * 100).toFixed(1)}% (${llmFailureCheck.percentage}% of ${(llmFailureCheck.threshold * 100).toFixed(0)}% limit)`,
					),
				);
			}
		}

		// Check error rate threshold
		if (scanState.processed > 0 && scanState.errors > 0) {
			const errorRate = scanState.errors / scanState.processed;
			const errorRateCheck = checkThreshold("errorRate", errorRate);
			if (errorRateCheck.exceeded && inboxLogger) {
				inboxLogger.warn("MCP tool response", {
					tool: "cli:thresholdExceeded",
					sessionCid,
					durationMs,
					success: true,
					thresholdExceeded: true,
					thresholdName: "errorRate",
					thresholdValue: errorRateCheck.threshold,
					thresholdPercentage: errorRateCheck.percentage,
					errors: scanState.errors,
					processed: scanState.processed,
					actualRate: errorRate,
					alertLevel: errorRateCheck.percentage > 150 ? "critical" : "warning",
				});
				// Surface in console for visibility
				console.log(
					color(
						errorRateCheck.percentage > 150 ? "red" : "yellow",
						`⚠ Error rate exceeded threshold: ${(errorRate * 100).toFixed(1)}% (${errorRateCheck.percentage}% of ${(errorRateCheck.threshold * 100).toFixed(0)}% limit)`,
					),
				);
			}
		}

		// Scenario 1: All LLM calls failed - show error and recovery hints
		if (scanState.llmFailures > 0 && scanState.llmFailures >= filesAttempted) {
			console.log(
				color(
					"red",
					`✗ LLM classification failed for all ${scanState.llmFailures} file(s). Using heuristic-only.`,
				),
			);
			if (scanState.lastLlmError) {
				console.log(emphasize.info(`   Error: ${scanState.lastLlmError}`));
			}
			console.log(
				emphasize.info(
					"   Check: 1) Claude API quota/auth, 2) Ollama running (ollama serve), 3) Model installed (ollama pull qwen2.5:14b)",
				),
			);
		}
		// Scenario 2: Some files used fallback - show warning
		else if (scanState.llmFallbacks > 0) {
			console.log(
				color(
					"yellow",
					`⚠ Claude unavailable for ${scanState.llmFallbacks} file(s), used local Ollama fallback.`,
				),
			);
			if (scanState.lastFallbackReason) {
				// Extract short reason (e.g., "Limit reached" from the full message)
				const shortReason = scanState.lastFallbackReason.includes("Limit")
					? "Limit reached"
					: scanState.lastFallbackReason.includes("timeout")
						? "Timeout"
						: scanState.lastFallbackReason.slice(0, 50);
				console.log(emphasize.info(`   Reason: ${shortReason}`));
			}
		}

		// Build metrics for return
		const llmUnavailable =
			scanState.llmFailures > 0 && scanState.llmFailures >= filesAttempted;

		// Check thresholds
		const thresholdsExceeded: string[] = [];
		if (scanThresholdCheck.exceeded) {
			thresholdsExceeded.push(
				`scanTotalMs (${scanThresholdCheck.percentage}% of ${scanThresholdCheck.threshold}ms)`,
			);
		}

		// Show threshold warnings
		if (thresholdsExceeded.length > 0) {
			console.log(
				color(
					"yellow",
					`⚠ Performance thresholds exceeded: ${thresholdsExceeded.join(", ")}`,
				),
			);
		}

		return {
			suggestions,
			metrics: {
				durationMs,
				filesProcessed: scanState.processed,
				skipped: scanState.skipped,
				errors: scanState.errors,
				llmFailures: scanState.llmFailures,
				llmFallbacks: scanState.llmFallbacks,
				llmUnavailable,
				thresholdsExceeded,
			},
		};
	} catch (error) {
		clearInterval(scanTicker);
		process.removeListener("SIGINT", cleanup);
		const durationMs = Date.now() - scanStarted;
		const errorMessage =
			error instanceof Error ? error.message : "unknown error";

		// KEEP user-facing output
		scanSpinner.error({
			text: `Scan failed: ${errorMessage}`,
		});

		// ADD observability alongside
		if (inboxLogger) {
			inboxLogger.error`Scan failed tool=cli:scanInbox cid=${cid} durationMs=${durationMs} success=false error=${errorMessage} timestamp=${new Date().toISOString()}`;
		}

		throw error;
	}
}

/**
 * Handle empty inbox case with helpful debugging info
 */
async function handleEmptyInbox(
	isJson: boolean,
	_sessionCid: string,
	_scanMetrics: ScanMetrics | null,
): Promise<CommandResult> {
	const metrics = await collectMetricsSummary();
	if (isJson) {
		console.log(
			JSON.stringify(
				withLogContext(
					{
						items: [],
						message: "No items to process",
						possibleCauses: [
							"No files match registered classifiers",
							"Files already in processed registry",
							"Inbox folder is empty",
						],
						debug: {
							scanVerbose: "para scan --verbose",
							registryList: "para registry list",
						},
					},
					metrics,
				),
				null,
				2,
			),
		);
	} else {
		console.log(color("yellow", "\nFound 0 classifiable files in Inbox/\n"));
		console.log(emphasize.info("Possible causes:"));
		console.log("  • No files match registered classifiers");
		console.log("  • Files already in processed registry");
		console.log("  • Inbox folder is empty\n");
		console.log(emphasize.info("Debug:"));
		console.log("  para scan --verbose    # Show why files were skipped");
		console.log("  para registry list     # Show processed files");
		if (metrics) {
			console.log(
				emphasize.info(
					`\nMetrics: total=${metrics.totalOperations ?? "?"}, failed=${metrics.failedOperations ?? "?"}`,
				),
			);
		}
	}
	return { success: true };
}

/**
 * Handle preview mode
 */
async function handlePreviewMode(
	suggestions: InboxSuggestion[],
	isJson: boolean,
	_sessionCid: string,
	_scanMetrics: ScanMetrics | null,
): Promise<CommandResult> {
	const metrics = await collectMetricsSummary();
	if (isJson) {
		console.log(
			JSON.stringify(
				withLogContext(
					{
						mode: "preview",
						items: suggestions,
						count: suggestions.length,
					},
					metrics,
				),
				null,
				2,
			),
		);
	} else {
		console.log(formatSuggestionsTable(suggestions));
		if (metrics) {
			console.log(
				emphasize.info(
					`Metrics: total=${metrics.totalOperations ?? "?"}, failed=${metrics.failedOperations ?? "?"}`,
				),
			);
		}
	}
	return { success: true };
}

/**
 * Handle auto mode (process all without interaction)
 *
 * By default, shows a preview and asks for confirmation before executing.
 * Use --confirm to skip the prompt, or --dry-run to only show what would happen.
 *
 * Items without destinations (untagged files) are filtered out - consistent with interactive mode.
 */
async function handleAutoMode(
	engine: ReturnType<typeof createInboxEngine>,
	suggestions: InboxSuggestion[],
	dryRun: boolean,
	skipConfirm: boolean,
	isJson: boolean,
	sessionCid: string,
	scanMetrics: ScanMetrics | null,
): Promise<CommandResult> {
	// Filter out unroutable suggestions (consistent with interactive mode)
	const routableSuggestions = suggestions.filter((s) => {
		if (s.action !== "create-note") return true;
		return s.suggestedDestination !== undefined;
	});

	const skippedCount = suggestions.length - routableSuggestions.length;

	// Report skipped items
	if (skippedCount > 0 && !isJson) {
		console.log(
			color(
				"yellow",
				`⚠ Skipped ${skippedCount} item(s) without routing tags. Tag in Obsidian and re-run.`,
			),
		);
	}

	// Handle empty after filtering
	if (routableSuggestions.length === 0) {
		const metrics = await collectMetricsSummary();
		if (isJson) {
			console.log(
				JSON.stringify(
					withLogContext(
						{
							success: true,
							mode: "auto",
							message: "No routable items. All files need area/project tags.",
							skippedForMissingTags: skippedCount,
							sessionCid,
						},
						metrics,
					),
					null,
					2,
				),
			);
		} else {
			console.log(
				color(
					"green",
					"✓ No routable items. All files need area/project tags in Obsidian.",
				),
			);
		}
		return { success: true };
	}

	// Dry-run: show what would happen without executing
	if (dryRun) {
		const metrics = await collectMetricsSummary();
		if (isJson) {
			console.log(
				JSON.stringify(
					withLogContext(
						{
							mode: "dry-run",
							wouldProcess: routableSuggestions.map((s) => s.id),
							count: routableSuggestions.length,
							skippedForMissingTags: skippedCount,
							success: true,
							sessionCid,
							scan: scanMetrics
								? {
										durationMs: scanMetrics.durationMs,
										filesProcessed: scanMetrics.filesProcessed,
										llmFailures: scanMetrics.llmFailures,
										llmFallbacks: scanMetrics.llmFallbacks,
										llmUnavailable: scanMetrics.llmUnavailable,
										thresholdsExceeded: scanMetrics.thresholdsExceeded,
									}
								: null,
						},
						metrics,
					),
					null,
					2,
				),
			);
		} else {
			console.log(
				color(
					"cyan",
					`[dry-run] Would process ${routableSuggestions.length} items:`,
				),
			);
			for (const suggestion of routableSuggestions) {
				console.log(`  - ${suggestion.source} → ${suggestion.action}`);
			}
			if (metrics) {
				console.log(
					emphasize.info(
						`Metrics: total=${metrics.totalOperations ?? "?"}, failed=${metrics.failedOperations ?? "?"}`,
					),
				);
			}
		}
		return { success: true };
	}

	// Default: show preview and ask for confirmation (unless --confirm is passed)
	if (!skipConfirm && !isJson) {
		console.log(
			color("cyan", `\nPreview (${routableSuggestions.length} items):\n`),
		);
		for (const suggestion of routableSuggestions) {
			console.log(`  ${color("green", "→")} ${suggestion.source}`);
			console.log(`    ${color("dim", suggestion.action)}`);
		}
		console.log();

		const proceed = await confirm({
			message: `Execute these ${routableSuggestions.length} moves?`,
			default: false,
		});

		if (!proceed) {
			console.log(emphasize.info("\nCancelled. No files were moved."));
			return { success: true };
		}
	}

	// Execute all suggestions
	let batchResult: BatchResult;
	let executeMetrics: ExecuteMetrics | null = null;
	if (isJson) {
		batchResult = await engine.execute(
			routableSuggestions.map((s) => s.id),
			{ sessionCid },
		);
		// TODO: Capture execute metrics from JSON mode
	} else {
		const result = await executeWithSpinner(
			engine,
			routableSuggestions,
			sessionCid,
		);
		batchResult = result.batchResult;
		executeMetrics = result.metrics;
	}

	// Aggregate results
	const successes = batchResult.summary.succeeded;
	const failures = batchResult.summary.failed;
	const metrics = await collectMetricsSummary();

	if (isJson) {
		console.log(
			JSON.stringify(
				withLogContext(
					{
						success: true,
						sessionCid,
						mode: "auto",
						results: batchResult.successful,
						successes,
						failures,
						scan: scanMetrics
							? {
									durationMs: scanMetrics.durationMs,
									filesProcessed: scanMetrics.filesProcessed,
									llmFailures: scanMetrics.llmFailures,
									llmFallbacks: scanMetrics.llmFallbacks,
									llmUnavailable: scanMetrics.llmUnavailable,
									thresholdsExceeded: scanMetrics.thresholdsExceeded,
								}
							: null,
						execute: executeMetrics
							? {
									durationMs: executeMetrics.durationMs,
									succeeded: executeMetrics.succeeded,
									failed: executeMetrics.failed,
									thresholdsExceeded: executeMetrics.thresholdsExceeded,
								}
							: null,
					},
					metrics,
				),
				null,
				2,
			),
		);
	} else {
		console.log(
			color(
				"green",
				`✓ Processed ${successes} of ${successes + failures} items`,
			),
		);
		for (const result of batchResult.successful) {
			if (result.success) {
				console.log(`  ${color("green", "✓")} ${result.suggestionId}`);
			} else {
				console.log(
					`  ${color("red", "✗")} ${result.suggestionId}: ${result.error}`,
				);
			}
		}
		if (metrics) {
			console.log(
				emphasize.info(
					`Metrics: total=${metrics.totalOperations ?? "?"}, failed=${metrics.failedOperations ?? "?"}`,
				),
			);
		}
		console.log(emphasize.dim(`Session ID: ${sessionCid}`));
	}

	return { success: true };
}

/**
 * Execute suggestions with progress spinner
 */
async function executeWithSpinner(
	engine: ReturnType<typeof createInboxEngine>,
	suggestions: InboxSuggestion[],
	sessionCid: string,
): Promise<{ batchResult: BatchResult; metrics: ExecuteMetrics }> {
	const cid = createCorrelationId();
	const total = suggestions.length;
	const execSpinner = createSpinner(renderProgressBar(0, 16)).start();
	const execStarted = Date.now();
	let errorCount = 0;

	const results = await engine.execute(
		suggestions.map((s) => s.id),
		{
			sessionCid,
			onProgress: ({
				percentComplete,
				suggestionId,
				success,
				error,
				runningSuccessRate,
			}) => {
				if (!success) errorCount++;

				const progressBar = renderProgressBar(percentComplete, 16);
				const status = success ? color("green", "✓") : color("red", "✗");
				const successRateDisplay =
					runningSuccessRate !== undefined
						? ` | Success: ${Math.round(runningSuccessRate * 100)}%`
						: "";
				const detail = error ? ` ${error}` : "";
				execSpinner.update({
					text: `${progressBar} ${status} ${suggestionId}${successRateDisplay}${detail}`,
				});
			},
		},
	);

	const durationMs = Date.now() - execStarted;
	const elapsed = (durationMs / 1000).toFixed(1);
	const finalBar = renderProgressBarFromCounts(
		results.summary.total,
		total,
		16,
	);
	const statsStr = errorCount > 0 ? ` (${errorCount} failed)` : "";

	// KEEP user-facing output
	execSpinner.success({
		text: `${finalBar}${statsStr} in ${elapsed}s`,
	});

	// ADD observability alongside
	if (inboxLogger) {
		inboxLogger.info`Execute completed tool=cli:executeInbox cid=${cid} durationMs=${durationMs} success=true total=${total} succeeded=${results.summary.succeeded} failed=${results.summary.failed} timestamp=${new Date().toISOString()}`;
	}

	// Check execute duration threshold
	const executeThresholdCheck = checkThreshold("executeTotalMs", durationMs);
	if (executeThresholdCheck.exceeded && inboxLogger) {
		inboxLogger.warn("MCP tool response", {
			tool: "cli:thresholdExceeded",
			sessionCid,
			durationMs,
			success: true,
			thresholdExceeded: true,
			thresholdName: "executeTotalMs",
			thresholdValue: executeThresholdCheck.threshold,
			thresholdPercentage: executeThresholdCheck.percentage,
			alertLevel:
				executeThresholdCheck.percentage > 150 ? "critical" : "warning",
		});
		// Surface in console for visibility
		console.log(
			color(
				executeThresholdCheck.percentage > 150 ? "red" : "yellow",
				`⚠ Execute duration exceeded threshold: ${(durationMs / 1000).toFixed(1)}s (${executeThresholdCheck.percentage}% of ${(executeThresholdCheck.threshold / 1000).toFixed(0)}s limit)`,
			),
		);
	}

	// Check SLO breach for execute success rate
	const successRate =
		total > 0 ? (results.summary.succeeded / total) * 100 : 100;
	const executeSLOCheck = await checkSLOBreach("execute_success", successRate);
	recordSLOEvent("execute_success", executeSLOCheck.breached, successRate);
	if (executeSLOCheck.breached && inboxLogger) {
		inboxLogger.error("SLO breach detected", {
			tool: "cli:sloBreached",
			sessionCid,
			sloName: "execute_success",
			breached: true,
			burnRate: executeSLOCheck.burnRate,
			currentValue: executeSLOCheck.currentValue,
			threshold: executeSLOCheck.slo.threshold,
			target: executeSLOCheck.slo.target,
			errorBudget: executeSLOCheck.slo.errorBudget,
		});
	}

	// Check thresholds for metrics
	const thresholdsExceeded: string[] = [];
	if (executeThresholdCheck.exceeded) {
		thresholdsExceeded.push(
			`executeTotalMs (${executeThresholdCheck.percentage}% of ${executeThresholdCheck.threshold}ms)`,
		);
	}

	// Show threshold warnings (already shown above, so skip duplicate)
	// Show session ID for tracing
	console.log(emphasize.dim(`Session ID: ${sessionCid}`));

	return {
		batchResult: results,
		metrics: {
			durationMs,
			succeeded: results.summary.succeeded,
			failed: results.summary.failed,
			thresholdsExceeded,
		},
	};
}

/**
 * Handle interactive mode
 */
async function handleInteractiveMode(
	engine: ReturnType<typeof createInboxEngine>,
	suggestions: InboxSuggestion[],
	dryRun: boolean,
	isJson: boolean,
	vaultPath: string,
	sessionCid: string,
	paraFolders?: Record<string, string>,
): Promise<CommandResult> {
	if (isJson) {
		const metrics = await collectMetricsSummary();
		console.log(
			JSON.stringify(
				withLogContext(
					{
						mode: "interactive",
						items: suggestions,
						count: suggestions.length,
						help: "Interactive mode requires TTY - use --auto or --preview for non-interactive",
					},
					metrics,
				),
				null,
				2,
			),
		);
		return { success: true };
	}

	// Filter out suggestions without destinations (untagged files)
	const routableSuggestions = suggestions.filter((s) => {
		// Only filter create-note suggestions
		if (s.action !== "create-note") return true;
		// Skip if no destination (user hasn't tagged in Obsidian yet)
		return s.suggestedDestination !== undefined;
	});

	const skippedCount = suggestions.length - routableSuggestions.length;

	// Show skip summary
	if (skippedCount > 0) {
		console.log(
			color(
				"yellow",
				`\n⚠ Skipped ${skippedCount} item(s) without routing tags. Tag in Obsidian and re-run.`,
			),
		);
	}

	// If no routable items, exit early
	if (routableSuggestions.length === 0) {
		console.log(color("green", "\n✓ No routable items. All files need tags."));
		return { success: true };
	}

	// Run interactive loop - returns approved IDs
	const { approvedIds } = await runInteractiveLoop({
		engine,
		suggestions: routableSuggestions,
		vaultPath,
		paraFolders,
	});

	// If user approved items, execute them
	if (approvedIds.length > 0) {
		if (dryRun) {
			console.log(
				color(
					"cyan",
					`\n[dry-run] Would execute ${approvedIds.length} item(s)`,
				),
			);
		} else {
			const total = approvedIds.length;
			const execSpinner = createSpinner(renderProgressBar(0, 16)).start();
			const execStarted = Date.now();
			let errorCount = 0;

			const batchResults = await engine.execute(approvedIds, {
				sessionCid,
				onProgress: ({
					percentComplete,
					suggestionId,
					success,
					error,
					runningSuccessRate,
				}) => {
					if (!success) errorCount++;

					const progressBar = renderProgressBar(percentComplete, 16);
					const status = success ? color("green", "✓") : color("red", "✗");
					const successRateDisplay =
						runningSuccessRate !== undefined
							? ` | Success: ${Math.round(runningSuccessRate * 100)}%`
							: "";
					const detail = error ? ` ${error}` : "";
					execSpinner.update({
						text: `${progressBar} ${status} ${suggestionId}${successRateDisplay}${detail}`,
					});
				},
			});

			const elapsed = ((Date.now() - execStarted) / 1000).toFixed(1);
			const finalBar = renderProgressBarFromCounts(
				batchResults.summary.total,
				total,
				16,
			);
			const statsStr = errorCount > 0 ? ` (${errorCount} failed)` : "";
			execSpinner.success({
				text: `${finalBar}${statsStr} in ${elapsed}s`,
			});
			displayResults(batchResults);

			const metrics = await collectMetricsSummary();
			if (metrics) {
				console.log(
					emphasize.info(
						`Metrics: total=${metrics.totalOperations ?? "?"}, failed=${metrics.failedOperations ?? "?"}`,
					),
				);
			}
		}
	} else {
		console.log(emphasize.info("\nNo items were approved."));
		console.log(emphasize.dim(`Session ID: ${sessionCid}`));
	}

	return { success: true };
}
