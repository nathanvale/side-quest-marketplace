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
import { generateFilename, getHashPrefix } from "../core/engine-utils";
import { hashFile } from "../registry";
import type { OperationContext } from "../shared/context";
import type { InboxSuggestion } from "../types";
import type { AttachmentMoveResult } from "./types";

/**
 * Generate a hash-based filename for an attachment.
 *
 * Format: YYYYMMDD-hash4-description.ext
 *
 * The hash prefix guarantees uniqueness and links to the corresponding note.
 *
 * @param suggestion - Suggestion containing source path and optional attachment name
 * @param hash - SHA256 hash of the file contents
 * @returns Hash-based filename
 */
export function generateHashedFilename(
	suggestion: InboxSuggestion,
	hash: string,
): string {
	// Use pre-generated attachment name if available (from scan phase)
	const suggestedName =
		"suggestedAttachmentName" in suggestion
			? suggestion.suggestedAttachmentName
			: undefined;

	if (suggestedName) {
		return suggestedName;
	}

	// Fallback: generate filename using available suggestion data
	const noteType =
		"suggestedNoteType" in suggestion
			? suggestion.suggestedNoteType
			: undefined;
	const fields =
		"extractedFields" in suggestion ? suggestion.extractedFields : undefined;

	return generateFilename(suggestion.source, hash, noteType, fields);
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

	// Generate filename with hash prefix - guaranteed unique
	const hashedFilename = generateHashedFilename(suggestion, hash);
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

	if (logger) {
		logger.info`Moved attachment to=${vaultRelativePath} ${cid}${sessionCid ? ` ${sessionCid}` : ""}`;
	}

	return {
		success: true,
		movedTo: vaultRelativePath,
		hash,
	};
}
