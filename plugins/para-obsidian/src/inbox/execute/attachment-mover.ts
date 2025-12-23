/**
 * Attachment Moving Logic
 *
 * Handles moving attachments with hash-based filenames:
 * - Generate filename with hash prefix (YYYYMMDD-hash4-description.ext)
 * - Hash guarantees uniqueness, no collision counters needed
 * - Move with TOCTOU protection
 *
 * @module inbox/execute/attachment-mover
 */

import { basename, dirname, join } from "node:path";
import { ensureDirSync, moveFile, pathExistsSync } from "@sidequest/core/fs";
import type { executeLogger } from "../../shared/logger";
import {
	generateSmartAttachmentName,
	getHashPrefix,
} from "../core/engine-utils";
import { hashFile } from "../registry";
import type { OperationContext } from "../shared/context";
import type { InboxSuggestion } from "../types";
import type { AttachmentMoveResult } from "./types";

/**
 * Generate a smart filename for an attachment.
 *
 * Strategy (collision-aware):
 * 1. Try ideal name from extracted fields (date-type-provider.ext)
 * 2. If ideal name exists in attachments folder, add hash suffix
 * 3. Hash suffix only added when needed to prevent collisions
 *
 * @param suggestion - Suggestion containing source path and optional attachment name
 * @param hash - SHA256 hash of the file contents
 * @param attachmentsDir - Absolute path to attachments folder (for collision check)
 * @returns Smart filename (with hash only if needed)
 */
export function generateHashedFilename(
	suggestion: InboxSuggestion,
	hash: string,
	attachmentsDir?: string,
): string {
	// Extract available data from suggestion
	const noteType =
		"suggestedNoteType" in suggestion
			? suggestion.suggestedNoteType
			: undefined;
	const fields =
		"extractedFields" in suggestion ? suggestion.extractedFields : undefined;

	// Use smart naming that only adds hash on collision
	return generateSmartAttachmentName(
		suggestion.source,
		hash,
		noteType,
		fields,
		attachmentsDir,
	);
}

/**
 * Move an attachment to the attachments folder with a hash-based filename.
 *
 * Steps:
 * 1. Hash source file (provides unique ID)
 * 2. Generate filename with hash prefix (guarantees uniqueness)
 * 3. TOCTOU check: verify source still exists
 * 4. Move file
 *
 * @param suggestion - Suggestion containing source path
 * @param config - Vault configuration
 * @param logger - Optional logger instance
 * @param cid - Correlation ID for logging
 * @param options - Optional operation context
 * @returns Result with movedTo path and hash, or error
 */
export async function moveAttachment(
	suggestion: InboxSuggestion,
	config: { vaultPath: string; inboxFolder: string; attachmentsFolder: string },
	logger: typeof executeLogger,
	cid: string,
	options?: OperationContext,
): Promise<AttachmentMoveResult> {
	const { sessionCid } = options ?? {};
	const sourcePath = join(config.vaultPath, suggestion.source);
	const filename = basename(suggestion.source);

	if (logger) {
		logger.debug`Moving attachment source=${filename} ${cid}${sessionCid ? ` ${sessionCid}` : ""}`;
	}

	// Hash source file FIRST - this provides our unique ID
	let hash: string;
	try {
		hash = await hashFile(sourcePath);
	} catch (error) {
		return {
			success: false,
			error: `Failed to hash source file: ${error instanceof Error ? error.message : "unknown"}`,
		};
	}

	// Generate filename - uses ideal name, only adds hash on collision
	const attachmentsDir = join(config.vaultPath, config.attachmentsFolder);
	const hashedFilename = generateHashedFilename(
		suggestion,
		hash,
		attachmentsDir,
	);
	const finalDest = join(
		config.vaultPath,
		config.attachmentsFolder,
		hashedFilename,
	);
	const vaultRelativePath = join(config.attachmentsFolder, hashedFilename);

	if (logger) {
		logger.debug`Generated filename=${hashedFilename} hash=${getHashPrefix(hash)} ${cid}${sessionCid ? ` ${sessionCid}` : ""}`;
	}

	// TOCTOU protection: Check file still exists before moving
	if (!pathExistsSync(sourcePath)) {
		return {
			success: false,
			error: `Source file no longer exists: ${sourcePath}. It may have been moved or deleted by another process.`,
		};
	}

	// Ensure destination directory exists
	ensureDirSync(dirname(finalDest));

	// Move the file
	try {
		await moveFile(sourcePath, finalDest);
	} catch (error) {
		if (logger) {
			logger.error`Failed to move attachment: ${error instanceof Error ? error.message : "unknown"} ${cid}${sessionCid ? ` ${sessionCid}` : ""}`;
		}
		return {
			success: false,
			error: `Failed to move file: ${error instanceof Error ? error.message : "unknown"}`,
		};
	}

	// Post-move hash verification
	let postMoveHash: string;
	try {
		postMoveHash = await hashFile(finalDest);
	} catch (error) {
		if (logger) {
			logger.error`Failed to verify moved file hash: ${error instanceof Error ? error.message : "unknown"} ${cid}${sessionCid ? ` ${sessionCid}` : ""}`;
		}
		return {
			success: false,
			error: `Failed to verify file after move: ${error instanceof Error ? error.message : "unknown"}`,
		};
	}

	// Verify hash matches (corruption check)
	if (postMoveHash !== hash) {
		if (logger) {
			logger.error`Hash mismatch after move! Expected ${getHashPrefix(hash)}, got ${getHashPrefix(postMoveHash)} ${cid}${sessionCid ? ` ${sessionCid}` : ""}`;
		}

		// Delete the incorrectly moved file (safer than trying to move it back)
		try {
			const { unlink } = await import("node:fs/promises");
			await unlink(finalDest);
			if (logger) {
				logger.warn`Deleted corrupted file at ${vaultRelativePath} ${cid}${sessionCid ? ` ${sessionCid}` : ""}`;
			}
		} catch (deleteError) {
			if (logger) {
				logger.error`Failed to delete corrupted file: ${deleteError instanceof Error ? deleteError.message : "unknown"} ${cid}${sessionCid ? ` ${sessionCid}` : ""}`;
			}
		}

		return {
			success: false,
			error: `Hash verification failed after move. File may have been corrupted during transfer. Original file remains in inbox.`,
		};
	}

	if (logger) {
		logger.info`Moved attachment to=${vaultRelativePath} hash verified ${cid}${sessionCid ? ` ${sessionCid}` : ""}`;
	}

	return {
		success: true,
		movedTo: vaultRelativePath,
		hash,
	};
}
