/**
 * CLI command: para enrich
 *
 * Enriches markdown notes with external data based on their type.
 * Router pattern supports multiple actions (youtube, bookmark, etc.)
 *
 * @module cli/enrich
 */

import { join } from "node:path";
import { confirm } from "@inquirer/prompts";
import { readTextFile } from "@sidequest/core/fs";
import { globFiles } from "@sidequest/core/glob";
import { emphasize } from "@sidequest/core/terminal";
import { parseFrontmatter } from "../frontmatter/parse";
import {
	createEnrichmentPipeline,
	DEFAULT_ENRICHMENT_STRATEGIES,
} from "../inbox/enrich/pipeline";
import { createInboxFile } from "../inbox/scan/extractors";
import { checkSLOBreach, recordSLOEvent } from "../inbox/shared/slos";
import {
	createCorrelationId,
	enrichLogger,
	initLoggerWithNotice,
} from "../shared/logger";
import { validatePathSafety } from "../shared/validation";
import { startSession } from "./shared/session";
import type { CommandContext, CommandResult } from "./types";

/**
 * Enrichment action types supported by the router
 */
type EnrichAction = "youtube";

/**
 * Metrics collected during enrichment
 */
interface EnrichMetrics {
	total: number;
	success: number;
	failed: number;
	skipped: number;
	durationMs: number;
}

/**
 * Handle the 'enrich' command with router pattern.
 *
 * Routes to specific enrichment handlers based on action argument.
 * Supports: youtube (more coming soon)
 *
 * Usage:
 *   para enrich youtube <file>       # Enrich specific file
 *   para enrich youtube --all        # Enrich all eligible notes
 */
export async function handleEnrich(
	ctx: CommandContext,
): Promise<CommandResult> {
	const action = ctx.positional[0] as EnrichAction | undefined;

	if (!action) {
		return showEnrichUsage(ctx);
	}

	switch (action) {
		case "youtube":
			return handleEnrichYouTube(ctx);
		default:
			return {
				success: false,
				error: `Unknown enrich action: ${action}. Use "youtube" or run without args for help.`,
				exitCode: 1,
			};
	}
}

/**
 * Show enrichment usage information
 */
function showEnrichUsage(ctx: CommandContext): CommandResult {
	const { isJson } = ctx;

	if (isJson) {
		console.log(
			JSON.stringify(
				{
					success: false,
					error: "No action specified",
					availableActions: ["youtube"],
					usage: {
						youtube: "para enrich youtube <file> | --all",
					},
					examples: [
						"para enrich youtube video.md",
						"para enrich youtube --all",
					],
				},
				null,
				2,
			),
		);
	} else {
		console.log(emphasize.error("No action specified."));
		console.log("");
		console.log(emphasize.info("Available actions:"));
		console.log("  youtube - Fetch YouTube video transcripts");
		console.log("");
		console.log(emphasize.info("Usage:"));
		console.log("  para enrich youtube <file>   # Enrich specific file");
		console.log("  para enrich youtube --all    # Enrich all eligible notes");
		console.log("");
		console.log(emphasize.info("Examples:"));
		console.log("  para enrich youtube video.md");
		console.log("  para enrich youtube --all");
	}

	return { success: false, exitCode: 1 };
}

/**
 * Validate enrichment target specification.
 *
 * Ensures either a file path or --all flag is provided.
 */
function validateEnrichTarget(
	target: string | undefined,
	isAll: boolean,
): { valid: true } | { valid: false; error: string } {
	if (!target && !isAll) {
		return {
			valid: false,
			error: "Specify a file path or use --all flag",
		};
	}
	return { valid: true };
}

/**
 * Candidate file for enrichment.
 */
interface EnrichCandidate {
	path: string;
	absolutePath: string;
}

/**
 * Find enrichment candidates based on target specification.
 *
 * Scans for YouTube notes without enrichedAt field.
 * Returns either all eligible notes (--all) or validates a specific file.
 */
async function findEnrichmentCandidates(
	vaultPath: string,
	target: string | undefined,
	isAll: boolean,
): Promise<
	| { success: true; candidates: EnrichCandidate[] }
	| { success: false; error: string }
> {
	const inboxPath = join(vaultPath, "00 Inbox");
	const candidates: EnrichCandidate[] = [];

	if (isAll) {
		// Scan all markdown files
		const files = await globFiles("**/*.md", inboxPath);

		for (const file of files) {
			const absolutePath = join(inboxPath, file);
			try {
				const content = await readTextFile(absolutePath);
				const { attributes } = parseFrontmatter(content);

				const type = attributes.type as string | undefined;
				const enrichedAt = attributes.enrichedAt as string | undefined;

				// Only enrich YouTube notes that haven't been enriched
				if (type === "youtube" && !enrichedAt) {
					candidates.push({
						path: join("00 Inbox", file),
						absolutePath,
					});
				}
			} catch {
				// Skip files that can't be read or parsed
			}
		}
	} else {
		// Validate specific target file
		const targetPath = target as string; // Guaranteed to exist by validateEnrichTarget

		// Security: Validate path to prevent traversal attacks
		try {
			validatePathSafety(targetPath, vaultPath);
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : "Invalid path";
			return {
				success: false,
				error: `Path validation failed: ${errorMsg}`,
			};
		}

		const absolutePath = targetPath.startsWith("/")
			? targetPath
			: join(vaultPath, targetPath);

		try {
			const content = await readTextFile(absolutePath);
			const { attributes } = parseFrontmatter(content);

			const type = attributes.type as string | undefined;
			const enrichedAt = attributes.enrichedAt as string | undefined;

			if (type !== "youtube") {
				return {
					success: false,
					error: `File is not a YouTube note (type: ${type ?? "none"})`,
				};
			}

			if (enrichedAt) {
				return {
					success: false,
					error: "File already enriched (enrichedAt exists)",
				};
			}

			candidates.push({ path: targetPath, absolutePath });
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : "Unknown error";
			return {
				success: false,
				error: `Failed to read target file: ${errorMsg}`,
			};
		}
	}

	return { success: true, candidates };
}

/**
 * Display candidates and get user confirmation.
 *
 * In JSON mode, outputs candidate list and returns immediately.
 * In markdown mode, shows preview and prompts for confirmation.
 */
async function displayCandidatesAndConfirm(
	candidates: EnrichCandidate[],
	isJson: boolean,
	sessionCid: string,
): Promise<{ proceed: true } | { proceed: false }> {
	// JSON mode: show preview only
	if (isJson) {
		console.log(
			JSON.stringify(
				{
					candidates: candidates.map((c) => ({ path: c.path })),
					count: candidates.length,
					sessionCid,
				},
				null,
				2,
			),
		);
		return { proceed: false }; // JSON mode doesn't execute
	}

	// Markdown mode: show preview and confirm
	console.log(
		emphasize.success(`Found ${candidates.length} YouTube note(s) to enrich:`),
	);
	console.log("");

	for (const c of candidates) {
		console.log(`  - ${c.path}`);
	}
	console.log("");

	const proceed = await confirm({
		message: "Enrich these notes?",
		default: true,
	});

	if (!proceed) {
		console.log(emphasize.warn("Cancelled."));
		return { proceed: false };
	}

	return { proceed: true };
}

/**
 * Execute enrichment pipeline on all candidates.
 *
 * Processes each candidate through the enrichment pipeline,
 * tracking successes, failures, and skipped items.
 */
async function executeEnrichments(
	candidates: EnrichCandidate[],
	vaultPath: string,
): Promise<{
	success: number;
	failed: number;
	skipped: number;
	errors: string[];
}> {
	const pipeline = createEnrichmentPipeline({
		strategies: DEFAULT_ENRICHMENT_STRATEGIES,
		vaultPath,
	});

	const result = {
		success: 0,
		failed: 0,
		skipped: 0,
		errors: [] as string[],
	};

	for (let i = 0; i < candidates.length; i++) {
		const candidate = candidates[i];
		if (!candidate) continue; // Should never happen but satisfies type checker

		console.log("");
		console.log(
			emphasize.info(
				`Enriching ${i + 1}/${candidates.length}: ${candidate.path}...`,
			),
		);

		try {
			// Create InboxFile for the pipeline
			const inboxFile = createInboxFile(candidate.absolutePath);

			// Process through pipeline
			const pipelineResult = await pipeline.processFile(inboxFile);

			if (pipelineResult.enriched) {
				console.log(emphasize.success("✓ Enriched successfully"));
				result.success++;
			} else {
				// Extract reason from result
				const reason =
					pipelineResult.result?.type === "none"
						? pipelineResult.result.reason
						: "No matching strategy";
				console.log(emphasize.warn(`- Skipped: ${reason}`));
				result.skipped++;
			}
		} catch (error) {
			const msg =
				error instanceof Error ? error.message : "Unknown error occurred";
			console.log(emphasize.error(`✗ Error: ${msg}`));
			result.errors.push(`${candidate.path}: ${msg}`);
			result.failed++;
		}
	}

	return result;
}

/**
 * Calculate and record SLO metrics.
 *
 * Checks enrichment latency SLO and records the event.
 */
async function buildEnrichMetrics(
	totalFiles: number,
	durationMs: number,
): Promise<{
	avgEnrichmentMs: number;
	sloBreached: boolean;
	burnRate: number;
}> {
	const avgEnrichmentMs = durationMs / totalFiles;
	const enrichmentSLOCheck = await checkSLOBreach(
		"enrichment_latency",
		avgEnrichmentMs,
	);
	recordSLOEvent(
		"enrichment_latency",
		enrichmentSLOCheck.breached,
		avgEnrichmentMs,
	);

	return {
		avgEnrichmentMs,
		sloBreached: enrichmentSLOCheck.breached,
		burnRate: enrichmentSLOCheck.burnRate,
	};
}

/**
 * Display enrichment summary and results.
 *
 * Shows completion metrics, SLO warnings, and any errors.
 */
function displayEnrichSummary(
	metrics: EnrichMetrics,
	sloMetrics: {
		avgEnrichmentMs: number;
		sloBreached: boolean;
		burnRate: number;
	},
	errors: string[],
): CommandResult {
	console.log("");
	console.log(
		emphasize.info(
			`Done. Enriched ${metrics.success}/${metrics.total} notes in ${(metrics.durationMs / 1000).toFixed(1)}s.`,
		),
	);

	// Show SLO warning if breached
	if (sloMetrics.sloBreached) {
		console.log(
			emphasize.warn(
				`⚠ Enrichment latency SLO breached: ${sloMetrics.avgEnrichmentMs.toFixed(0)}ms avg`,
			),
		);
	}

	// Display errors if any
	if (errors.length > 0) {
		console.log("");
		console.log(emphasize.warn("Errors:"));
		for (const err of errors) {
			console.log(`  ${err}`);
		}
		return { success: false, exitCode: 1 };
	}

	return { success: true };
}

/**
 * Handle YouTube enrichment action.
 *
 * Orchestrates the enrichment workflow:
 * 1. Validate target specification
 * 2. Find eligible candidates
 * 3. Display preview and get confirmation
 * 4. Execute enrichments
 * 5. Display results and metrics
 */
async function handleEnrichYouTube(
	ctx: CommandContext,
): Promise<CommandResult> {
	const { config, isJson, flags } = ctx;

	// Start session tracking
	const session = startSession("para enrich youtube", { silent: isJson });
	const sessionCid = session.sessionCid;

	await initLoggerWithNotice();
	const cid = createCorrelationId();

	// Parse target specification
	const target = ctx.positional[1]; // file path or undefined
	const isAll = flags.all === true;

	// Validate target specification
	const validation = validateEnrichTarget(target, isAll);
	if (!validation.valid) {
		session.end({ error: validation.error });
		return {
			success: false,
			error: validation.error,
			exitCode: 1,
		};
	}

	const startTime = Date.now();

	try {
		const vaultPath = config.vault;

		if (enrichLogger) {
			enrichLogger.info("YouTube enrichment started", {
				event: "enrich_youtube_started",
				cid,
				sessionCid,
				target: target ?? "all",
				isAll,
				timestamp: new Date().toISOString(),
			});
		}

		if (!isJson) {
			console.log(emphasize.info("Scanning for YouTube notes to enrich..."));
			console.log("");
		}

		// Find candidate files
		const candidateResult = await findEnrichmentCandidates(
			vaultPath,
			target,
			isAll,
		);

		if (!candidateResult.success) {
			session.end({ error: candidateResult.error });
			return {
				success: false,
				error: candidateResult.error,
				exitCode: 1,
			};
		}

		const { candidates } = candidateResult;

		// Check for empty candidates
		if (candidates.length === 0) {
			const durationMs = Date.now() - startTime;

			if (enrichLogger) {
				enrichLogger.info("No candidates found", {
					event: "enrich_youtube_completed",
					cid,
					sessionCid,
					durationMs,
					total: 0,
					success: 0,
					failed: 0,
					skipped: 0,
					timestamp: new Date().toISOString(),
				});
			}

			if (isJson) {
				console.log(
					JSON.stringify(
						{
							success: true,
							enriched: 0,
							message: "No YouTube notes ready to enrich",
							hint: "Notes need type: youtube in frontmatter (and not already enriched)",
							sessionCid,
							durationMs,
						},
						null,
						2,
					),
				);
			} else {
				console.log(emphasize.warn("No YouTube notes ready to enrich."));
				console.log(
					"Notes need type: youtube in frontmatter (and not already enriched).",
				);
			}

			session.end({ success: true });
			return { success: true };
		}

		// Display candidates and get confirmation
		const confirmation = await displayCandidatesAndConfirm(
			candidates,
			isJson,
			sessionCid,
		);

		if (!confirmation.proceed) {
			session.end({ success: true });
			return { success: true };
		}

		// Execute enrichments
		const executionResult = await executeEnrichments(candidates, vaultPath);

		const metrics: EnrichMetrics = {
			total: candidates.length,
			success: executionResult.success,
			failed: executionResult.failed,
			skipped: executionResult.skipped,
			durationMs: Date.now() - startTime,
		};

		// Calculate SLO metrics
		const sloMetrics = await buildEnrichMetrics(
			metrics.total,
			metrics.durationMs,
		);

		if (enrichLogger) {
			enrichLogger.info("YouTube enrichment completed", {
				event: "enrich_youtube_completed",
				cid,
				sessionCid,
				durationMs: metrics.durationMs,
				total: metrics.total,
				success: metrics.success,
				failed: metrics.failed,
				skipped: metrics.skipped,
				avgEnrichmentMs: sloMetrics.avgEnrichmentMs,
				sloBreached: sloMetrics.sloBreached,
				burnRate: sloMetrics.burnRate,
				timestamp: new Date().toISOString(),
			});
		}

		// Display summary
		const result = displayEnrichSummary(
			metrics,
			sloMetrics,
			executionResult.errors,
		);

		session.end(result.success ? { success: true } : { error: "Failed" });
		return result;
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		const durationMs = Date.now() - startTime;

		if (enrichLogger) {
			enrichLogger.error("YouTube enrichment failed", {
				event: "enrich_youtube_failed",
				cid,
				sessionCid,
				durationMs,
				error: errorMsg,
				timestamp: new Date().toISOString(),
			});
		}

		session.end({ error: errorMsg });
		throw error;
	}
}
