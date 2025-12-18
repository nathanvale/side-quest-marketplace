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
import { isCreateNoteSuggestion } from "../inbox/types";
import { getLogFile, initLoggerWithNotice } from "../shared/logger";
import type { CommandContext, CommandResult } from "./types";

type MetricsSummary = ReturnType<MetricsCollector["getSummary"]>;

async function collectMetricsSummary(): Promise<MetricsSummary | null> {
	try {
		const collector = new MetricsCollector();
		await collector.collect();
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
		case "hash":
			return "hashing";
		case "extract":
			return "extracting";
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

	await initLoggerWithNotice();
	if (!isJson) {
		console.log(emphasize.info(`Logs: ${getLogFile()}`));
	}

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
	if (isJson) {
		suggestions = await engine.scan();
	} else {
		suggestions = await scanWithSpinner(engine, llmModel);
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
		return handleEmptyInbox(isJson);
	}

	// Preview mode: just display suggestions
	if (previewMode) {
		return handlePreviewMode(filteredSuggestions, isJson);
	}

	// Auto mode: process all without interaction
	if (autoMode) {
		return handleAutoMode(
			engine,
			filteredSuggestions,
			dryRun,
			skipConfirm,
			isJson,
		);
	}

	// Interactive mode: run the interactive approval loop
	return handleInteractiveMode(
		engine,
		filteredSuggestions,
		dryRun,
		isJson,
		config.vault,
		config.paraFolders,
	);
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
 * Render a visual progress bar
 * @param processed - Number of items processed
 * @param total - Total number of items
 * @param width - Width of the bar in characters (default: 20)
 * @returns Formatted progress bar string like "[████████░░░░░░░░] 8/20"
 */
function renderProgressBar(
	processed: number,
	total: number,
	width = 20,
): string {
	if (total === 0) return `[${"░".repeat(width)}] 0/?`;

	const ratio = Math.min(processed / total, 1);
	const filled = Math.round(ratio * width);
	const empty = width - filled;

	const bar = "█".repeat(filled) + "░".repeat(empty);
	return `[${bar}] ${processed}/${total}`;
}

/**
 * Scan inbox with progress spinner
 */
async function scanWithSpinner(
	engine: ReturnType<typeof createInboxEngine>,
	llmModel: string,
): Promise<InboxSuggestion[]> {
	const scanSpinner = createSpinner("Scanning inbox...").start();
	const scanStarted = Date.now();
	const scanState = {
		total: 0,
		processed: 0,
		skipped: 0,
		errors: 0,
		llmFailures: 0,
		llmFallbacks: 0,
		lastFallbackReason: undefined as string | undefined,
		lastLlmError: undefined as string | undefined,
		currentFile: "",
		stage: "hash" as "hash" | "extract" | "llm" | "skip" | "done" | "error",
		stageStartedAt: Date.now(),
	};

	const updateScanText = () => {
		const elapsedMs = Date.now() - scanStarted;
		const elapsedStage = (
			(Date.now() - scanState.stageStartedAt) /
			1000
		).toFixed(1);
		const eta = calculateEta(scanState.processed, scanState.total, elapsedMs);

		// Build visual progress bar with stats
		const progressBar = renderProgressBar(
			scanState.processed,
			scanState.total || 0,
			16,
		);
		const stats =
			scanState.skipped > 0 || scanState.errors > 0
				? ` (${scanState.skipped} skipped, ${scanState.errors} errors)`
				: "";
		const etaDisplay = scanState.total > 0 ? ` ~${eta}` : "";

		// Stage indicator (what we're doing now)
		const stageInfo =
			scanState.currentFile === ""
				? ""
				: ` ${stageLabel(scanState.stage, scanState.stage === "llm" ? llmModel : undefined)} ${elapsedStage}s`;

		scanSpinner.update({
			text: `${progressBar}${stats}${etaDisplay}${stageInfo}`,
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
			onProgress: (progress) => {
				const { total, filename, stage } = progress;
				scanState.total = total;
				if (stage === "skip") {
					scanState.skipped += 1;
					scanState.processed += 1;
				} else if (stage === "done") {
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
				} else if (stage === "llm") {
					// Track fallback reason when fallback is triggered
					if (progress.isFallback && progress.fallbackReason) {
						scanState.lastFallbackReason = progress.fallbackReason;
					}
				} else if (stage === "error") {
					scanState.errors += 1;
					scanState.processed += 1;
					// Error message with progress bar
					const progressBar = renderProgressBar(
						scanState.processed,
						scanState.total || 0,
						16,
					);
					scanSpinner.update({
						text: `${progressBar} error: ${filename} - ${progress.error}`,
					});
					return;
				}
				// Update current file and stage for in-progress stages
				if (stage === "hash" || stage === "extract" || stage === "llm") {
					scanState.currentFile = filename;
					scanState.stage = stage;
					scanState.stageStartedAt = Date.now();
				}
				updateScanText();
			},
		});
		clearInterval(scanTicker);
		process.removeListener("SIGINT", cleanup);
		const elapsed = ((Date.now() - scanStarted) / 1000).toFixed(1);
		const finalBar = renderProgressBar(
			scanState.processed,
			scanState.total || suggestions.length,
			16,
		);
		const finalStats = [];
		if (scanState.skipped > 0) finalStats.push(`${scanState.skipped} skipped`);
		if (scanState.errors > 0) finalStats.push(`${scanState.errors} errors`);
		const statsStr = finalStats.length > 0 ? ` (${finalStats.join(", ")})` : "";
		scanSpinner.success({
			text: `${finalBar}${statsStr} in ${elapsed}s`,
		});

		// Show LLM status messages
		const filesAttempted = scanState.processed - scanState.skipped;

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

		return suggestions;
	} catch (error) {
		clearInterval(scanTicker);
		process.removeListener("SIGINT", cleanup);
		scanSpinner.error({
			text: `Scan failed: ${error instanceof Error ? error.message : "unknown error"}`,
		});
		throw error;
	}
}

/**
 * Handle empty inbox case with helpful debugging info
 */
async function handleEmptyInbox(isJson: boolean): Promise<CommandResult> {
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
 */
async function handleAutoMode(
	engine: ReturnType<typeof createInboxEngine>,
	suggestions: InboxSuggestion[],
	dryRun: boolean,
	skipConfirm: boolean,
	isJson: boolean,
): Promise<CommandResult> {
	// Dry-run: show what would happen without executing
	if (dryRun) {
		const metrics = await collectMetricsSummary();
		if (isJson) {
			console.log(
				JSON.stringify(
					withLogContext(
						{
							mode: "dry-run",
							wouldProcess: suggestions.map((s) => s.id),
							count: suggestions.length,
						},
						metrics,
					),
					null,
					2,
				),
			);
		} else {
			console.log(
				color("cyan", `[dry-run] Would process ${suggestions.length} items:`),
			);
			for (const suggestion of suggestions) {
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
		console.log(color("cyan", `\nPreview (${suggestions.length} items):\n`));
		for (const suggestion of suggestions) {
			console.log(`  ${color("green", "→")} ${suggestion.source}`);
			console.log(`    ${color("dim", suggestion.action)}`);
		}
		console.log();

		const proceed = await confirm({
			message: `Execute these ${suggestions.length} moves?`,
			default: false,
		});

		if (!proceed) {
			console.log(emphasize.info("\nCancelled. No files were moved."));
			return { success: true };
		}
	}

	// Execute all suggestions
	let batchResult: BatchResult;
	if (isJson) {
		batchResult = await engine.execute(suggestions.map((s) => s.id));
	} else {
		batchResult = await executeWithSpinner(engine, suggestions);
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
						mode: "auto",
						results: batchResult.successful,
						successes,
						failures,
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
	}

	return { success: true };
}

/**
 * Execute suggestions with progress spinner
 */
async function executeWithSpinner(
	engine: ReturnType<typeof createInboxEngine>,
	suggestions: InboxSuggestion[],
): Promise<BatchResult> {
	const total = suggestions.length;
	const execSpinner = createSpinner(renderProgressBar(0, total, 16)).start();
	const execStarted = Date.now();
	let errorCount = 0;

	const results = await engine.execute(
		suggestions.map((s) => s.id),
		{
			onProgress: ({ processed, total, suggestionId, success, error }) => {
				if (!success) errorCount++;

				const progressBar = renderProgressBar(processed, total, 16);
				const status = success ? color("green", "✓") : color("red", "✗");
				const detail = error ? ` ${error}` : "";
				execSpinner.update({
					text: `${progressBar} ${status} ${suggestionId}${detail}`,
				});
			},
		},
	);

	const elapsed = ((Date.now() - execStarted) / 1000).toFixed(1);
	const finalBar = renderProgressBar(results.summary.total, total, 16);
	const statsStr = errorCount > 0 ? ` (${errorCount} failed)` : "";
	execSpinner.success({
		text: `${finalBar}${statsStr} in ${elapsed}s`,
	});

	return results;
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

	// Run interactive loop - returns approved IDs and modified suggestions
	const { approvedIds, updatedSuggestions } = await runInteractiveLoop({
		engine,
		suggestions: suggestions,
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
			const execSpinner = createSpinner(
				renderProgressBar(0, total, 16),
			).start();
			const execStarted = Date.now();
			let errorCount = 0;

			const batchResults = await engine.execute(approvedIds, {
				updatedSuggestions, // Pass CLI-modified suggestions to ensure destination changes are respected
				onProgress: ({ processed, total, suggestionId, success, error }) => {
					if (!success) errorCount++;

					const progressBar = renderProgressBar(processed, total, 16);
					const status = success ? color("green", "✓") : color("red", "✗");
					const detail = error ? ` ${error}` : "";
					execSpinner.update({
						text: `${progressBar} ${status} ${suggestionId}${detail}`,
					});
				},
			});

			const elapsed = ((Date.now() - execStarted) / 1000).toFixed(1);
			const finalBar = renderProgressBar(batchResults.summary.total, total, 16);
			const statsStr = errorCount > 0 ? ` (${errorCount} failed)` : "";
			execSpinner.success({
				text: `${finalBar}${statsStr} in ${elapsed}s`,
			});
			displayResults(batchResults.successful);

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
	}

	return { success: true };
}
