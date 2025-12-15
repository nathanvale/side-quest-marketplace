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
export { generateDatedFilename } from "./attachment-mover";

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
 * 4. Update registry
 *
 * Execution flow (pre-classified from frontmatter):
 * 1. Move existing .md file to destination
 * 2. Update registry
 * (No attachment moving or link injection - the .md IS the note)
 *
 * This order ensures:
 * - Inbox item stays in place if note creation fails
 * - Note is rolled back if attachment move fails
 * - Registry only updated on full success
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

	// Step 1: Create note FIRST (if needed) - fail early before touching inbox
	if (
		suggestion.action === "create-note" &&
		suggestion.suggestedNoteType &&
		suggestion.suggestedTitle
	) {
		const noteResult = await createNoteFromSuggestion(suggestion, logger, cid);

		if (!noteResult.success) {
			// Note creation failed - inbox item stays in place for retry
			return {
				suggestionId: suggestion.id,
				success: false,
				action: suggestion.action,
				error: `${noteResult.error}. Attachment remains in inbox - fix the issue and retry.`,
			};
		}

		createdNotePath = noteResult.notePath;
	}

	// Step 2: Move attachment - ROLLBACK note if this fails
	const moveResult = await moveAttachment(suggestion, context, logger, cid);

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
		);
		// Note: Don't check result - link injection is non-fatal
	}

	// Step 4: Update registry - only reached on full success
	registry.markProcessed({
		sourceHash: moveResult.hash as string,
		sourcePath: suggestion.source,
		processedAt: new Date().toISOString(),
		createdNote: createdNotePath,
		movedAttachment: moveResult.movedTo as string,
	});

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

	// Move the existing .md file to destination
	const moveResult = await movePreClassifiedNote(
		suggestion,
		context.vaultPath,
		logger,
		cid,
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

	// Update registry
	context.registry.markProcessed({
		sourceHash,
		sourcePath: suggestion.source,
		processedAt: new Date().toISOString(),
		createdNote: moveResult.notePath,
		// No movedAttachment - the .md file WAS the source and is now the note
	});

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
