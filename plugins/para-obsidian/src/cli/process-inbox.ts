/**
 * Process inbox command handler for PARA Obsidian CLI
 */

import { MetricsCollector } from "@sidequest/core/logging";
import { color, emphasize } from "@sidequest/core/terminal";
import { createSpinner } from "nanospinner";
import { DEFAULT_MODEL } from "../config/defaults";
import type { ExecutionResult, InboxSuggestion } from "../inbox";
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
		return handleAutoMode(engine, filteredSuggestions, dryRun, isJson);
	}

	// Interactive mode: run the interactive approval loop
	return handleInteractiveMode(engine, filteredSuggestions, dryRun, isJson);
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
		const totals = `Scanning ${scanState.processed}/${scanState.total || "?"} (skipped ${scanState.skipped}, errors ${scanState.errors}) ETA ${eta}`;
		const detail =
			scanState.currentFile === ""
				? ""
				: ` | ${scanState.currentFile} ${stageLabel(scanState.stage, scanState.stage === "llm" ? llmModel : undefined)} ${elapsedStage}s`;
		scanSpinner.update({ text: `${totals}${detail}` });
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
					// Error message is required on ErrorProgress
					scanSpinner.update({
						text: `Scanning ${scanState.processed}/${scanState.total || "?"} (skipped ${scanState.skipped}, errors ${scanState.errors}) | ${filename} error - ${progress.error}`,
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
		scanSpinner.success({
			text: `Scan complete (${scanState.processed}/${scanState.total || suggestions.length} scanned, skipped ${scanState.skipped}, errors ${scanState.errors}) in ${elapsed}s`,
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
 * Handle empty inbox case
 */
async function handleEmptyInbox(isJson: boolean): Promise<CommandResult> {
	const metrics = await collectMetricsSummary();
	if (isJson) {
		console.log(
			JSON.stringify(
				withLogContext({ items: [], message: "No items to process" }, metrics),
				null,
				2,
			),
		);
	} else {
		console.log(color("cyan", "No items to process in inbox"));
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
 */
async function handleAutoMode(
	engine: ReturnType<typeof createInboxEngine>,
	suggestions: InboxSuggestion[],
	dryRun: boolean,
	isJson: boolean,
): Promise<CommandResult> {
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

	// Execute all suggestions
	let results: ExecutionResult[];
	if (isJson) {
		results = await engine.execute(suggestions.map((s) => s.id));
	} else {
		results = await executeWithSpinner(engine, suggestions);
	}

	// Aggregate results
	const successes = results.filter((r) => r.success).length;
	const failures = results.filter((r) => !r.success).length;
	const metrics = await collectMetricsSummary();

	if (isJson) {
		console.log(
			JSON.stringify(
				withLogContext(
					{
						mode: "auto",
						results: results,
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
		for (const result of results) {
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
): Promise<ExecutionResult[]> {
	const execSpinner = createSpinner(
		`Executing ${suggestions.length} item(s)...`,
	).start();
	const execStarted = Date.now();

	const results = await engine.execute(
		suggestions.map((s) => s.id),
		{
			onProgress: ({ processed, total, suggestionId, success, error }) => {
				const status = success ? color("green", "✓") : color("red", "✗");
				const detail = error ? ` - ${error}` : "";
				execSpinner.update({
					text: `${status} ${processed}/${total} ${suggestionId}${detail}`,
				});
				console.log(`${status} ${processed}/${total} ${suggestionId}${detail}`);
			},
		},
	);

	const elapsed = ((Date.now() - execStarted) / 1000).toFixed(1);
	execSpinner.success({
		text: `Executed ${results.length} item(s) in ${elapsed}s`,
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

	// Run interactive loop - returns approved IDs
	const approvedIds = await runInteractiveLoop({
		engine,
		suggestions: suggestions,
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
			const execSpinner = createSpinner(
				`Executing ${approvedIds.length} item(s)...`,
			).start();
			const execStarted = Date.now();

			const results = await engine.execute(approvedIds, {
				onProgress: ({ processed, total, suggestionId, success, error }) => {
					const status = success ? color("green", "✓") : color("red", "✗");
					const detail = error ? ` - ${error}` : "";
					execSpinner.update({
						text: `${status} ${processed}/${total} ${suggestionId}${detail}`,
					});
					console.log(
						`${status} ${processed}/${total} ${suggestionId}${detail}`,
					);
				},
			});

			const elapsed = ((Date.now() - execStarted) / 1000).toFixed(1);
			execSpinner.success({
				text: `Executed ${results.length} item(s) in ${elapsed}s`,
			});
			displayResults(results);

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
