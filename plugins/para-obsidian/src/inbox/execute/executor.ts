/**
 * Suggestion Execution Orchestrator
 *
 * Main entry point for executing inbox suggestions.
 * Handles:
 * - Multi-step execution flow
 * - Rollback on failure
 * - Registry updates
 *
 * @module inbox/execute/executor
 */

import { unlink } from "node:fs/promises";
import { basename, join } from "node:path";
import type { executeLogger } from "../../shared/logger";
import { hashFile } from "../registry/processed-registry";
import type { ExecutionResult, InboxSuggestion } from "../types";
import { isCreateNoteSuggestion } from "../types";
import { injectAttachmentLink } from "./attachment-linker";
import { moveAttachment } from "./attachment-mover";
import {
	createNoteFromSuggestion,
	movePreClassifiedNote,
} from "./note-creator";
import type { ExecutionContext } from "./types";

// Re-export helper functions for backward compatibility
export { generateHashedFilename } from "./attachment-mover";

/**
 * Rollback a created note (delete the file).
 *
 * Used when attachment move fails after note was created successfully.
 *
 * @param notePath - Vault-relative path to note
 * @param vaultPath - Absolute vault root
 * @param logger - Optional logger instance
 * @param cid - Correlation ID for logging
 */
export async function rollbackNote(
	notePath: string,
	vaultPath: string,
	logger: typeof executeLogger,
	cid: string,
): Promise<void> {
	try {
		const absolutePath = join(vaultPath, notePath);
		await unlink(absolutePath);
		if (logger) {
			logger.warn`Rolled back orphaned note: ${notePath} ${cid}`;
		}
	} catch (error) {
		if (logger) {
			logger.error`Failed to rollback note: ${error instanceof Error ? error.message : "unknown"} ${cid}`;
		}
	}
}

/**
 * Execute a single inbox suggestion.
 *
 * Execution flow (standard):
 * 1. Create note (if action is create-note) - FAIL EARLY
 * 2. Move attachment - ROLLBACK note if this fails
 * 3. Inject attachment link (non-fatal)
 * 4. Cleanup registry (remove entry to allow reprocessing)
 *
 * Execution flow (pre-classified from frontmatter):
 * 1. Move existing .md file to destination
 * 2. Cleanup registry (remove entry to allow reprocessing)
 * (No attachment moving or link injection - the .md IS the note)
 *
 * This order ensures:
 * - Inbox item stays in place if note creation fails
 * - Note is rolled back if attachment move fails
 * - Registry is cleaned after success to allow reprocessing if file re-added
 *
 * @param suggestion - Suggestion to execute
 * @param context - Execution context with config, registry, and cid
 * @param logger - Optional logger instance
 * @returns Execution result with success flag and paths
 */
export async function executeSuggestion(
	suggestion: InboxSuggestion,
	context: ExecutionContext,
	logger: typeof executeLogger,
): Promise<ExecutionResult> {
	const filename = basename(suggestion.source);
	const { cid, registry } = context;

	if (logger) {
		logger.debug`Executing suggestion id=${suggestion.id} action=${suggestion.action} source=${filename} ${cid}`;
	}

	// Handle pre-classified notes (detectionSource: 'frontmatter')
	// These are markdown notes that already have valid frontmatter and just need to be moved
	if (
		isCreateNoteSuggestion(suggestion) &&
		suggestion.detectionSource === "frontmatter"
	) {
		return executePreClassifiedNote(suggestion, context, logger, cid);
	}

	let createdNotePath: string | undefined;
	const { sessionCid } = context;

	// Check if this is a Type A document (markdown source of truth)
	// Type A documents embed content in note body - no attachment needed
	const isTypeA =
		isCreateNoteSuggestion(suggestion) &&
		suggestion.sourceOfTruth === "markdown" &&
		suggestion.suggestedContent;

	// Debug Type A detection - always log to stderr for debugging
	console.error(
		// biome-ignore lint/suspicious/noExplicitAny: Debug logging only - casting is safe for inspection
		`[executor] isCreateNote=${isCreateNoteSuggestion(suggestion)} sourceOfTruth=${isCreateNoteSuggestion(suggestion) ? (suggestion as any).sourceOfTruth : "n/a"} hasSuggestedContent=${isCreateNoteSuggestion(suggestion) ? !!(suggestion as any).suggestedContent : false} contentLen=${isCreateNoteSuggestion(suggestion) ? ((suggestion as any).suggestedContent?.length ?? 0) : 0} isTypeA=${isTypeA}`,
	);

	// Debug Type A detection
	if (logger && isCreateNoteSuggestion(suggestion)) {
		logger.debug`Type A check: sourceOfTruth=${suggestion.sourceOfTruth ?? "undefined"} hasSuggestedContent=${!!suggestion.suggestedContent} contentLength=${suggestion.suggestedContent?.length ?? 0} isTypeA=${isTypeA} ${cid}${sessionCid ? ` ${sessionCid}` : ""}`;
	}

	// Step 1: Create note FIRST (if needed) - fail early before touching inbox
	if (
		suggestion.action === "create-note" &&
		suggestion.suggestedNoteType &&
		suggestion.suggestedTitle
	) {
		const noteResult = await createNoteFromSuggestion(suggestion, logger, cid, {
			sessionCid,
		});

		if (!noteResult.success) {
			// Note creation failed - inbox item stays in place for retry
			return {
				suggestionId: suggestion.id,
				success: false,
				action: suggestion.action,
				error: `${noteResult.error}. Source file remains in inbox - fix the issue and retry.`,
			};
		}

		createdNotePath = noteResult.notePath;
	}

	// Step 2: Handle source file based on document type
	// Type A (markdown): Archive/delete source DOCX (content is embedded in note)
	// Type B (binary): Move attachment to Attachments folder
	if (isTypeA) {
		// Type A: Delete source file (content is now in the markdown note)
		// Future: Could archive to Archives/Source Files/ instead
		const sourcePath = join(context.vaultPath, suggestion.source);

		// Hash the file BEFORE deleting (for registry cleanup)
		const sourceHash = await hashFile(sourcePath).catch(() => null);

		try {
			await unlink(sourcePath);
			if (logger) {
				logger.info`Type A document: deleted source file=${basename(suggestion.source)} (content embedded in note) ${cid}`;
			}
		} catch (error) {
			// Non-fatal - log warning but continue
			if (logger) {
				logger.warn`Failed to delete source file: ${error instanceof Error ? error.message : "unknown"} ${cid}`;
			}
		}

		// Cleanup registry (using hash computed before deletion)
		if (sourceHash) {
			const removed = await registry.removeAndSave(sourceHash);
			if (removed && logger) {
				logger.debug`Registry cleaned for Type A: hash=${sourceHash.slice(0, 8)} ${cid}`;
			}
		}

		if (logger) {
			logger.info`Executed Type A suggestion id=${suggestion.id} createdNote=${createdNotePath ?? "none"} (no attachment) ${cid}`;
		}

		return {
			suggestionId: suggestion.id,
			success: true,
			action: suggestion.action,
			createdNote: createdNotePath,
			// No movedAttachment for Type A - content is embedded
		};
	}

	// Type B (binary): Move attachment - ROLLBACK note if this fails
	const moveResult = await moveAttachment(suggestion, context, logger, cid, {
		sessionCid,
	});

	if (!moveResult.success) {
		// Attachment move failed - rollback note if we created one
		if (createdNotePath) {
			await rollbackNote(createdNotePath, context.vaultPath, logger, cid);
		}

		if (logger) {
			logger.error`Failed to move attachment: ${moveResult.error} - ${createdNotePath ? "rolled back note, " : ""}attachment remains in inbox ${cid}`;
		}

		return {
			suggestionId: suggestion.id,
			success: false,
			action: suggestion.action,
			error: `Operation failed and ${createdNotePath ? "was rolled back" : "aborted"}: ${moveResult.error}. Attachment remains in inbox - fix the issue and retry.`,
		};
	}

	// Step 3: Inject attachment link (non-fatal - just log warnings)
	if (createdNotePath && moveResult.movedTo) {
		await injectAttachmentLink(
			createdNotePath,
			moveResult.movedTo,
			logger,
			cid,
			{ sessionCid },
		);
		// Note: Don't check result - link injection is non-fatal
	}

	// Step 4: Cleanup registry for moved attachments
	// Remove any existing registry entry to allow reprocessing if user re-adds the file
	// Registry is only used during scan to skip already-processed items
	// Use atomic removeAndSave() to prevent race conditions
	if (moveResult.movedTo && moveResult.hash) {
		const sourceHash = moveResult.hash;
		const removed = await registry.removeAndSave(sourceHash);

		if (removed && logger) {
			logger.debug`Registry cleaned: hash=${sourceHash.slice(0, 8)} file=${basename(suggestion.source)} ${cid}`;
		}
	}

	if (logger) {
		logger.info`Executed suggestion id=${suggestion.id} movedTo=${basename(moveResult.movedTo as string)} createdNote=${createdNotePath ?? "none"} ${cid}`;
	}

	return {
		suggestionId: suggestion.id,
		success: true,
		action: suggestion.action,
		createdNote: createdNotePath,
		movedAttachment: moveResult.movedTo,
	};
}

/**
 * Execute a pre-classified note suggestion.
 *
 * Pre-classified notes are markdown files that already have valid frontmatter
 * with a known type field. They just need to be moved to their destination.
 *
 * Simplified flow:
 * 1. Move the existing .md file to destination
 * 2. Update registry with source file hash
 *
 * No attachment moving or link injection needed - the .md IS the note.
 *
 * @param suggestion - Pre-classified CreateNoteSuggestion
 * @param context - Execution context
 * @param logger - Logger instance
 * @param cid - Correlation ID
 * @returns Execution result
 */
async function executePreClassifiedNote(
	suggestion: import("../types").CreateNoteSuggestion,
	context: ExecutionContext,
	logger: typeof executeLogger,
	cid: string,
): Promise<ExecutionResult> {
	const filename = basename(suggestion.source);

	if (logger) {
		logger.debug`Executing pre-classified note id=${suggestion.id} source=${filename} ${cid}`;
	}

	// Hash the source file before moving (for registry)
	const sourceAbsPath = join(context.vaultPath, suggestion.source);
	const sourceHash = await hashFile(sourceAbsPath);
	const { sessionCid } = context;

	// Move the existing .md file to destination
	const moveResult = await movePreClassifiedNote(
		suggestion,
		context.vaultPath,
		logger,
		cid,
		{ sessionCid },
	);

	if (!moveResult.success) {
		if (logger) {
			logger.error`Failed to move pre-classified note: ${moveResult.error} ${cid}`;
		}
		return {
			suggestionId: suggestion.id,
			success: false,
			action: suggestion.action,
			error: `${moveResult.error}. Note remains in inbox - fix the issue and retry.`,
		};
	}

	// Cleanup registry - remove entry to allow reprocessing if file re-added
	// Use atomic removeAndSave() to prevent race conditions
	const removed = await context.registry.removeAndSave(sourceHash);
	if (removed && logger) {
		logger.debug`Registry cleaned for pre-classified note: hash=${sourceHash.slice(0, 8)} ${cid}`;
	}

	if (logger) {
		logger.info`Executed pre-classified note id=${suggestion.id} movedTo=${moveResult.notePath} ${cid}`;
	}

	return {
		suggestionId: suggestion.id,
		success: true,
		action: suggestion.action,
		createdNote: moveResult.notePath,
		// No movedAttachment for pre-classified notes
	};
}
