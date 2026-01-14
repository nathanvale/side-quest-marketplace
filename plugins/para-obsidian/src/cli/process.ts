/**
 * CLI command: para process
 *
 * Processes web clippings in inbox, converting them to properly typed notes.
 * Detects clipping type (YouTube, article, recipe, etc.), enriches with external data,
 * applies templates, and converts in-place.
 *
 * @module cli/process
 */

import { emphasize } from "@sidequest/core/terminal";
import { processAllClippings } from "../inbox/process/clipping-processor";
import type { ClippingType } from "../inbox/process/types";
import {
	createCorrelationId,
	inboxLogger,
	initLoggerWithNotice,
} from "../shared/logger";
import { startSession } from "./shared/session";
import type { CommandContext, CommandResult } from "./types";

/**
 * Handle the 'process' command.
 *
 * Processes all clipping notes in the inbox, converting them to typed notes
 * with enriched content.
 *
 * Usage:
 *   para process [--dry-run] [--verbose] [--skip-enrichment] [--format json|md]
 *   para p [--dry-run]  # Short alias
 *
 * @example
 * ```bash
 * # Process all clippings
 * para process
 *
 * # Preview without writing
 * para process --dry-run
 *
 * # Verbose output
 * para process --verbose
 *
 * # Skip external enrichment (YouTube, Firecrawl)
 * para process --skip-enrichment
 * ```
 */
export async function handleProcess(
	ctx: CommandContext,
): Promise<CommandResult> {
	const { isJson, flags } = ctx;

	// Start session tracking
	const session = startSession("para process", { silent: isJson });
	const sessionCid = session.sessionCid;

	await initLoggerWithNotice();
	const cid = createCorrelationId();

	// Parse options from flags
	const dryRun = flags.dryRun === true || flags["dry-run"] === true;
	const verbose = flags.verbose === true;
	const skipEnrichment = flags.skipEnrichment === true;

	const startTime = Date.now();

	try {
		if (inboxLogger) {
			inboxLogger.info`process:start cid=${cid} sessionCid=${sessionCid} dryRun=${dryRun} verbose=${verbose} skipEnrichment=${skipEnrichment}`;
		}

		if (!isJson) {
			console.log(emphasize.info("Processing clippings in inbox..."));
			if (dryRun) {
				console.log(emphasize.warn("DRY RUN - No files will be modified"));
			}
			console.log("");
		}

		// Process all clippings
		const result = await processAllClippings({
			dryRun,
			verbose,
			skipEnrichment,
		});

		const durationMs = Date.now() - startTime;

		if (inboxLogger) {
			inboxLogger.info`process:complete cid=${cid} sessionCid=${sessionCid} durationMs=${durationMs} processed=${result.processed} failed=${result.failed} skipped=${result.skipped}`;
		}

		// Display results
		if (isJson) {
			console.log(
				JSON.stringify(
					{
						success: result.failed === 0,
						processed: result.processed,
						failed: result.failed,
						skipped: result.skipped,
						byType: result.byType,
						durationMs,
						sessionCid,
					},
					null,
					2,
				),
			);
		} else {
			console.log(
				emphasize.success(
					`Done in ${(durationMs / 1000).toFixed(1)}s: ${result.processed} processed, ${result.failed} failed, ${result.skipped} skipped`,
				),
			);
			console.log("");

			// Show breakdown by type
			if (result.processed > 0) {
				console.log(emphasize.info("Processed by type:"));
				const types: ClippingType[] = [
					"youtube",
					"article",
					"recipe",
					"product",
					"github",
					"documentation",
					"social",
					"podcast",
					"book",
					"generic",
				];

				for (const type of types) {
					const count = result.byType[type];
					if (count > 0) {
						console.log(`  ${type}: ${count}`);
					}
				}
				console.log("");
			}

			// Show errors if any
			if (result.failed > 0) {
				console.log(emphasize.warn("Failed items:"));
				for (const res of result.results) {
					if (res.status === "failed") {
						console.log(`  - ${res.originalPath}`);
						if (res.error) {
							console.log(`    ${emphasize.error(res.error)}`);
						}
					}
				}
				console.log("");
			}
		}

		// Success if no failures
		const success = result.failed === 0;
		session.end({ success: success });

		return {
			success: success,
			exitCode: success ? 0 : 1,
		};
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		const durationMs = Date.now() - startTime;

		if (inboxLogger) {
			inboxLogger.error`process:error cid=${cid} sessionCid=${sessionCid} durationMs=${durationMs} error=${errorMsg}`;
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
