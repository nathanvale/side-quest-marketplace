/**
 * CLI command: para inbox move
 *
 * Moves notes from inbox to PARA destinations based on frontmatter.
 * Only moves notes that have area or project fields set.
 *
 * @module cli/inbox-move
 */

import { join } from "node:path";
import { confirm } from "@inquirer/prompts";
import { isDirectorySync } from "@sidequest/core/fs";
import { emphasize } from "@sidequest/core/terminal";
import type { RoutingContext } from "../inbox/routing";
import { moveNote, scanForRoutableNotes } from "../inbox/routing";
import {
	createCorrelationId,
	initLogger,
	routingLogger,
} from "../shared/logger";
import { startSession } from "./shared";
import type { CommandContext, CommandResult } from "./types";

/**
 * Handle the 'inbox move' command.
 *
 * Scans the inbox for notes with area or project frontmatter,
 * shows a preview, and moves them after confirmation.
 */
export async function handleInboxMove(
	ctx: CommandContext,
): Promise<CommandResult> {
	const { config, isJson } = ctx;
	const vaultPath = config.vault;

	// Initialize logging
	await initLogger();

	// Start session with correlation ID tracking
	const session = startSession("para move", { silent: isJson });
	const routingCtx: RoutingContext = {
		sessionCid: session.sessionCid,
	};

	// Log command start
	if (routingLogger) {
		routingLogger.info("Para move command started", {
			cid: createCorrelationId(),
			sessionCid: session.sessionCid,
			tool: "cli:move",
			vaultPath,
			isJson,
			timestamp: new Date().toISOString(),
		});
	}

	// Validate inbox folder exists
	const inboxPath = join(vaultPath, "00 Inbox");
	if (!isDirectorySync(inboxPath)) {
		if (isJson) {
			console.log(
				JSON.stringify(
					{ success: false, error: "Inbox folder '00 Inbox' not found" },
					null,
					2,
				),
			);
		} else {
			console.log(
				emphasize.error("Inbox folder '00 Inbox' not found in vault."),
			);
		}
		session.end({ success: false });
		return { success: false, exitCode: 1 };
	}

	if (!isJson) {
		console.log(emphasize.info("Scanning inbox for routable notes..."));
		console.log("");
	}

	// Scan inbox
	const { candidates, skipped } = await scanForRoutableNotes(
		vaultPath,
		"00 Inbox",
		routingCtx,
	);

	// Early exit if no candidates
	if (candidates.length === 0) {
		if (routingLogger) {
			routingLogger.info("No routable notes found", {
				cid: createCorrelationId(),
				sessionCid: session.sessionCid,
				tool: "cli:move",
				skippedCount: skipped.length,
				timestamp: new Date().toISOString(),
			});
		}

		if (isJson) {
			console.log(
				JSON.stringify(
					{
						success: true,
						moved: 0,
						message: "No notes ready to move",
						hint: "Notes need area or project in frontmatter to be routable",
					},
					null,
					2,
				),
			);
		} else {
			console.log(emphasize.warn("No notes ready to move."));
			console.log("Notes need area or project in frontmatter to be routable.");
		}
		session.end({ success: true });
		return { success: true };
	}

	// Show preview
	// NOTE: JSON mode is preview-only and does not perform the move.
	// Use markdown mode (default) for interactive confirmation and execution.
	if (isJson) {
		if (routingLogger) {
			routingLogger.info("Preview mode (JSON)", {
				cid: createCorrelationId(),
				sessionCid: session.sessionCid,
				tool: "cli:move",
				candidateCount: candidates.length,
				timestamp: new Date().toISOString(),
			});
		}

		console.log(
			JSON.stringify(
				{
					candidates: candidates.map((c) => ({
						title: c.title,
						from: c.path,
						to: join(c.destination, `${c.title}.md`),
						area: c.area,
						project: c.project,
						colocate: c.colocate ?? null,
					})),
					count: candidates.length,
				},
				null,
				2,
			),
		);
		session.end({ success: true });
		return { success: true };
	}

	// Markdown output: show preview
	console.log(
		emphasize.success(`Found ${candidates.length} note(s) ready to move:`),
	);
	console.log("");

	for (let i = 0; i < candidates.length; i++) {
		const c = candidates[i];
		if (!c) continue; // Type guard for array access
		console.log(emphasize.info(`${i + 1}. ${c.title}`));
		console.log(`   ${c.path} → ${join(c.destination, `${c.title}.md`)}`);
		if (c.colocate) {
			console.log(
				emphasize.warn(
					`   📁 Will create folder and move ${c.colocate.sourceNotePath} into it`,
				),
			);
		}
		console.log("");
	}

	// Confirm
	const proceed = await confirm({
		message: "Move these notes?",
		default: true,
	});

	if (!proceed) {
		if (routingLogger) {
			routingLogger.info("Move cancelled by user", {
				cid: createCorrelationId(),
				sessionCid: session.sessionCid,
				tool: "cli:move",
				candidateCount: candidates.length,
				timestamp: new Date().toISOString(),
			});
		}
		console.log(emphasize.warn("Cancelled."));
		session.end({ success: true });
		return { success: true };
	}

	// Execute moves
	const executeStartTime = Date.now();
	let successCount = 0;
	const errors: string[] = [];

	if (routingLogger) {
		routingLogger.info("Starting move execution", {
			cid: createCorrelationId(),
			sessionCid: session.sessionCid,
			tool: "cli:move",
			candidateCount: candidates.length,
			timestamp: new Date().toISOString(),
		});
	}

	for (const candidate of candidates) {
		const result = await moveNote(candidate, vaultPath, routingCtx);
		if (result.success) {
			console.log(emphasize.success(`✓ Moved: ${result.movedTo}`));
			successCount++;
		} else {
			const msg = `✗ Failed: ${candidate.path} - ${result.error}`;
			console.log(emphasize.error(msg));
			errors.push(msg);
		}
	}

	const executeDurationMs = Date.now() - executeStartTime;

	console.log("");
	console.log(
		emphasize.info(`Done. Moved ${successCount}/${candidates.length} notes.`),
	);

	if (errors.length > 0) {
		if (routingLogger) {
			routingLogger.error("Move execution completed with errors", {
				cid: createCorrelationId(),
				sessionCid: session.sessionCid,
				tool: "cli:move",
				durationMs: executeDurationMs,
				success: false,
				total: candidates.length,
				succeeded: successCount,
				failed: errors.length,
				errors,
				timestamp: new Date().toISOString(),
			});
		}

		console.log("");
		console.log(emphasize.warn("Errors:"));
		for (const err of errors) {
			console.log(`  ${err}`);
		}
		session.end({ success: false });
		return { success: false, exitCode: 1 };
	}

	if (routingLogger) {
		routingLogger.info("Move execution completed successfully", {
			cid: createCorrelationId(),
			sessionCid: session.sessionCid,
			tool: "cli:move",
			durationMs: executeDurationMs,
			success: true,
			total: candidates.length,
			succeeded: successCount,
			failed: 0,
			timestamp: new Date().toISOString(),
		});
	}

	session.end({ success: true });
	return { success: true };
}
