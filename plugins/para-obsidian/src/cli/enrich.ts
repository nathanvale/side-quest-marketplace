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
import { DEFAULT_PARA_FOLDERS } from "../config/defaults";
import { parseFrontmatter } from "../frontmatter/parse";
import {
	createEnrichmentPipeline,
	DEFAULT_ENRICHMENT_STRATEGIES,
} from "../inbox/enrich/pipeline";
import { createInboxFile } from "../inbox/scan/extractors";
import { checkSLOBreach, recordSLOEvent } from "../inbox/shared/slo-tracker.js";
import {
	createCorrelationId,
	enrichLogger,
	initLoggerWithNotice,
} from "../shared/logger";
import { startSession } from "./shared/session";
import type { CommandContext, CommandResult } from "./types";

/**
 * Helper to check if frontmatter attributes represent a YouTube note.
 * Accepts both `type: "youtube"` and `type: "clipping"` with `resource_type: "youtube"`.
 */
function isYouTubeNote(attributes: Record<string, unknown>): boolean {
	const type = attributes.type as string | undefined;
	const resourceType = attributes.resource_type as string | undefined;
	return (
		type === "youtube" || (type === "clipping" && resourceType === "youtube")
	);
}

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
	const action = ctx.subcommand as EnrichAction | undefined;

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
 * Handle YouTube enrichment action.
 *
 * Finds YouTube notes with transcript_status: pending, shows preview,
 * and enriches after confirmation (markdown mode) or auto-executes (JSON mode).
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
	const target = ctx.positional[0]; // file path or undefined
	const isAll = flags.all === true;

	// Validate target specification
	if (!target && !isAll) {
		session.end({
			error: "Specify a file path or use --all flag",
		});
		return {
			success: false,
			error: "Specify a file path or use --all flag",
			exitCode: 1,
		};
	}

	// Initialize startTime after validation (Bug ENRICH-CLI-001 fix)
	let startTime = Date.now();

	try {
		const vaultPath = config.vault;
		const inboxPath = join(vaultPath, DEFAULT_PARA_FOLDERS.inbox!);

		if (enrichLogger) {
			enrichLogger.info`enrich:youtube:start cid=${cid} sessionCid=${sessionCid} target=${target ?? "all"} isAll=${isAll}`;
		}

		if (!isJson) {
			console.log(emphasize.info("Scanning for YouTube notes to enrich..."));
			console.log("");
		}

		// Find candidate files
		const candidates: Array<{ path: string; absolutePath: string }> = [];

		if (isAll) {
			// Scan all markdown files
			const files = await globFiles("**/*.md", inboxPath);

			for (const file of files) {
				// globFiles returns absolute paths, use directly
				const absolutePath = file;
				// Extract relative path from inbox for display
				const relativePath = absolutePath.startsWith(inboxPath)
					? absolutePath.slice(inboxPath.length + 1)
					: absolutePath;

				try {
					const content = await readTextFile(absolutePath);
					const { attributes } = parseFrontmatter(content);

					const transcriptStatus = attributes.transcript_status as
						| string
						| undefined;

					// Only enrich YouTube notes with pending transcripts
					if (isYouTubeNote(attributes) && transcriptStatus === "pending") {
						candidates.push({
							path: join("00 Inbox", relativePath),
							absolutePath,
						});
					}
				} catch (error) {
					// Bug ENRICH-CLI-003 fix: Log when files fail to read
					if (enrichLogger) {
						enrichLogger.warn`enrich:youtube:checkFailed cid=${cid} sessionCid=${sessionCid} file=${absolutePath} error=${error instanceof Error ? error.message : "Unknown error"}`;
					}
					// Continue to skip file
				}
			}
		} else {
			// Validate specific target file (guaranteed to exist due to validation above)
			const targetPath = target as string;

			// Bug ENRICH-CLI-004 fix: Validate path - prevent traversal
			// Note: Check for "../" specifically, not ".." which would block filenames with ellipsis
			if (targetPath.includes("../") || targetPath.startsWith("~")) {
				const errorMsg =
					"Path contains traversal pattern (../) or starts with ~";
				if (enrichLogger) {
					enrichLogger.warn`enrich:youtube:pathBlocked cid=${cid} sessionCid=${sessionCid} target=${targetPath}`;
				}
				session.end({ error: errorMsg });
				return { success: false, error: errorMsg, exitCode: 1 };
			}

			const absolutePath = targetPath.startsWith("/")
				? targetPath
				: join(vaultPath, targetPath);

			try {
				const content = await readTextFile(absolutePath);
				const { attributes } = parseFrontmatter(content);

				const type = attributes.type as string | undefined;
				const resourceType = attributes.resource_type as string | undefined;
				const transcriptStatus = attributes.transcript_status as
					| string
					| undefined;

				if (!isYouTubeNote(attributes)) {
					const typeInfo =
						type === "clipping"
							? `clipping/${resourceType ?? "none"}`
							: (type ?? "none");
					const errorMsg = `File is not a YouTube note (type: ${typeInfo})`;

					if (enrichLogger) {
						enrichLogger.warn`enrich:youtube:invalidType cid=${cid} sessionCid=${sessionCid} target=${targetPath} type=${type ?? "none"}`;
					}

					if (isJson) {
						console.log(
							JSON.stringify(
								{
									success: false,
									error: errorMsg,
									sessionCid,
									type: type ?? "none",
									resource_type: resourceType,
								},
								null,
								2,
							),
						);
					} else {
						console.log(emphasize.error(errorMsg));
					}

					session.end({ error: errorMsg });
					return { success: false, error: errorMsg, exitCode: 1 };
				}

				if (transcriptStatus !== "pending") {
					const msg = `Already enriched (transcript_status: ${transcriptStatus ?? "none"})`;

					if (enrichLogger) {
						enrichLogger.info`enrich:youtube:alreadyProcessed cid=${cid} sessionCid=${sessionCid} target=${targetPath} status=${transcriptStatus}`;
					}

					if (isJson) {
						console.log(
							JSON.stringify(
								{
									success: true,
									enriched: false,
									message: msg,
									sessionCid,
									transcriptStatus,
								},
								null,
								2,
							),
						);
					} else {
						console.log(emphasize.info(msg));
					}

					session.end({ success: true });
					return { success: true };
				}

				candidates.push({ path: targetPath, absolutePath });
			} catch (error) {
				const errorMsg =
					error instanceof Error ? error.message : "Unknown error";
				const fullErrorMsg = `Failed to read target file: ${errorMsg}`;

				if (enrichLogger) {
					enrichLogger.error`enrich:youtube:readFailed cid=${cid} sessionCid=${sessionCid} target=${targetPath} error=${errorMsg}`;
				}

				if (isJson) {
					console.log(
						JSON.stringify(
							{
								success: false,
								error: fullErrorMsg,
								sessionCid,
								target: targetPath,
							},
							null,
							2,
						),
					);
				} else {
					console.log(emphasize.error(fullErrorMsg));
				}

				session.end({ error: fullErrorMsg });
				return { success: false, error: fullErrorMsg, exitCode: 1 };
			}
		}

		// Check for empty candidates
		if (candidates.length === 0) {
			const durationMs = Date.now() - startTime;

			if (enrichLogger) {
				enrichLogger.info`enrich:youtube:noCandidates cid=${cid} sessionCid=${sessionCid} durationMs=${durationMs}`;
			}

			if (isJson) {
				console.log(
					JSON.stringify(
						{
							success: true,
							enriched: 0,
							message: "No YouTube notes ready to enrich",
							hint: "Notes need type: youtube and transcript_status: pending",
							sessionCid,
							durationMs,
						},
						null,
						2,
					),
				);
			} else {
				console.log(emphasize.warn("No YouTube notes ready to enrich."));
				console.log("Notes need type: youtube and transcript_status: pending.");
			}

			session.end({ success: true });
			return { success: true };
		}

		// In JSON mode, auto-execute (no confirmation prompt)
		// For preview-only, user should use --dry-run flag
		const isDryRun = flags.dryRun === true || flags["dry-run"] === true;

		if (isDryRun) {
			// Dry run: just show candidates
			console.log(
				JSON.stringify(
					{
						dryRun: true,
						candidates: candidates.map((c) => ({ path: c.path })),
						count: candidates.length,
						sessionCid,
					},
					null,
					2,
				),
			);
			session.end({ success: true });
			return { success: true };
		}

		// In JSON mode, skip confirmation and execute directly
		// In markdown mode, show preview and confirm
		if (!isJson) {
			console.log(
				emphasize.success(
					`Found ${candidates.length} YouTube note(s) to enrich:`,
				),
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
				session.end({ success: true });
				return { success: true };
			}
		}

		// Start timing (after confirmation in markdown mode)
		startTime = Date.now();

		// Create enrichment pipeline
		const pipeline = createEnrichmentPipeline({
			strategies: DEFAULT_ENRICHMENT_STRATEGIES,
			vaultPath,
		});

		// Execute enrichments with progress feedback
		const metrics: EnrichMetrics = {
			total: candidates.length,
			success: 0,
			failed: 0,
			skipped: 0,
			durationMs: 0,
		};

		const errors: string[] = [];

		for (let i = 0; i < candidates.length; i++) {
			const candidate = candidates[i];
			if (!candidate) continue; // Should never happen but satisfies type checker

			if (!isJson) {
				console.log("");
				console.log(
					emphasize.info(
						`Enriching ${i + 1}/${candidates.length}: ${candidate.path}...`,
					),
				);
			}

			try {
				// Create InboxFile for the pipeline
				const inboxFile = createInboxFile(candidate.absolutePath);

				// Process through pipeline
				const result = await pipeline.processFile(inboxFile);

				if (result.enriched) {
					if (!isJson) {
						console.log(emphasize.success("✓ Enriched successfully"));
					}
					metrics.success++;
				} else {
					// Extract reason from result
					const reason =
						result.result?.type === "none"
							? result.result.reason
							: "No matching strategy";
					if (!isJson) {
						console.log(emphasize.warn(`- Skipped: ${reason}`));
					}
					metrics.skipped++;
				}
			} catch (error) {
				const msg =
					error instanceof Error ? error.message : "Unknown error occurred";
				if (!isJson) {
					console.log(emphasize.error(`✗ Error: ${msg}`));
				}
				errors.push(`${candidate.path}: ${msg}`);
				metrics.failed++;
			}
		}

		metrics.durationMs = Date.now() - startTime;

		// Check SLO for enrichment latency (per-file average)
		const avgEnrichmentMs = metrics.durationMs / metrics.total;
		const enrichmentSLOCheck = await checkSLOBreach(
			"enrichment_latency",
			avgEnrichmentMs,
		);
		recordSLOEvent(
			"enrichment_latency",
			enrichmentSLOCheck.breached,
			avgEnrichmentMs,
		);

		if (enrichLogger) {
			enrichLogger.info`enrich:youtube:complete cid=${cid} sessionCid=${sessionCid} durationMs=${metrics.durationMs} total=${metrics.total} success=${metrics.success} failed=${metrics.failed} skipped=${metrics.skipped} avgMs=${avgEnrichmentMs} sloBreached=${enrichmentSLOCheck.breached}`;
		}

		// Display summary
		if (isJson) {
			// JSON output with structured metrics
			console.log(
				JSON.stringify(
					{
						success: errors.length === 0,
						metrics: {
							total: metrics.total,
							success: metrics.success,
							failed: metrics.failed,
							skipped: metrics.skipped,
							durationMs: metrics.durationMs,
						},
						errors: errors.length > 0 ? errors : undefined,
						sloBreached: enrichmentSLOCheck.breached,
						sessionCid,
					},
					null,
					2,
				),
			);
		} else {
			console.log("");
			console.log(
				emphasize.info(
					`Done in ${(metrics.durationMs / 1000).toFixed(1)}s: ${metrics.success} enriched, ${metrics.failed} failed, ${metrics.skipped} skipped (${metrics.total} total)`,
				),
			);

			// Show SLO warning if breached
			if (enrichmentSLOCheck.breached) {
				console.log(
					emphasize.warn(
						`⚠ Enrichment latency SLO breached: ${avgEnrichmentMs.toFixed(0)}ms avg (threshold: ${enrichmentSLOCheck.slo.threshold}ms)`,
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
			}
		}

		if (errors.length > 0) {
			session.end({ error: `${errors.length} enrichment(s) failed` });
			return { success: false, exitCode: 1 };
		}

		session.end({ success: true });
		return { success: true };
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		const durationMs = Date.now() - startTime;

		if (enrichLogger) {
			enrichLogger.error`enrich:youtube:error cid=${cid} sessionCid=${sessionCid} durationMs=${durationMs} error=${errorMsg}`;
		}

		if (isJson) {
			console.log(
				JSON.stringify(
					{
						success: false,
						error: errorMsg,
						sessionCid,
						durationMs,
					},
					null,
					2,
				),
			);
		} else {
			console.log(emphasize.error(`Error: ${errorMsg}`));
		}

		session.end({ error: errorMsg });
		return { success: false, error: errorMsg, exitCode: 1 };
	}
}
