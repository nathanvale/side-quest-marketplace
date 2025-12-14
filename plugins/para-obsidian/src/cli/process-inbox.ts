/**
 * Process inbox command handler for PARA Obsidian CLI
 */

import { MetricsCollector } from "@sidequest/core/logging";
import { color, emphasize } from "@sidequest/core/terminal";
import { createSpinner } from "nanospinner";
import type { ExecutionResult, InboxSuggestion } from "../inbox";
import {
	createInboxEngine,
	displayResults,
	formatSuggestionsTable,
	runInteractiveLoop,
} from "../inbox";
import { isCreateNoteSuggestion } from "../inbox/types";
import { getLogFile, initLoggerWithNotice } from "../logger";
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
function stageLabel(stage: string): string {
	switch (stage) {
		case "hash":
			return "hashing";
		case "extract":
			return "extracting";
		case "llm":
			return "LLM";
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

	// Create engine with config
	const engine = createInboxEngine({
		vaultPath: config.vault,
		inboxFolder: "00 Inbox",
		attachmentsFolder: "Attachments",
		templatesFolder: config.templatesDir,
	});

	// Scan inbox for suggestions
	let suggestions: InboxSuggestion[];
	if (isJson) {
		suggestions = await engine.scan();
	} else {
		suggestions = await scanWithSpinner(engine);
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

/**
 * Scan inbox with progress spinner
 */
async function scanWithSpinner(
	engine: ReturnType<typeof createInboxEngine>,
): Promise<InboxSuggestion[]> {
	const scanSpinner = createSpinner("Scanning inbox...").start();
	const scanStarted = Date.now();
	const scanState = {
		total: 0,
		processed: 0,
		skipped: 0,
		errors: 0,
		currentFile: "",
		stage: "hash" as "hash" | "extract" | "llm" | "skip" | "done" | "error",
		stageStartedAt: Date.now(),
	};

	const updateScanText = () => {
		const elapsedStage = (
			(Date.now() - scanState.stageStartedAt) /
			1000
		).toFixed(1);
		const totals = `Scanning ${scanState.processed}/${scanState.total || "?"} (skipped ${scanState.skipped}, errors ${scanState.errors})`;
		const detail =
			scanState.currentFile === ""
				? ""
				: ` | ${scanState.currentFile} ${stageLabel(scanState.stage)} ${elapsedStage}s`;
		scanSpinner.update({ text: `${totals}${detail}` });
	};

	const scanTicker = setInterval(updateScanText, 500);

	try {
		const suggestions = await engine.scan({
			onProgress: ({ total, filename, stage, error }) => {
				scanState.total = total;
				if (stage === "skip") {
					scanState.skipped += 1;
					scanState.processed += 1;
				} else if (stage === "done") {
					scanState.processed += 1;
				} else if (stage === "error") {
					scanState.errors += 1;
					scanState.processed += 1;
				} else {
					scanState.currentFile = filename;
					scanState.stage = stage;
					scanState.stageStartedAt = Date.now();
				}
				if (error) {
					scanSpinner.update({
						text: `Scanning ${scanState.processed}/${scanState.total || "?"} (skipped ${scanState.skipped}, errors ${scanState.errors + 1}) | ${filename} error - ${error}`,
					});
					return;
				}
				updateScanText();
			},
		});
		clearInterval(scanTicker);
		const elapsed = ((Date.now() - scanStarted) / 1000).toFixed(1);
		scanSpinner.success({
			text: `Scan complete (${scanState.processed}/${scanState.total || suggestions.length} scanned, skipped ${scanState.skipped}, errors ${scanState.errors}) in ${elapsed}s`,
		});
		return suggestions;
	} catch (error) {
		clearInterval(scanTicker);
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
