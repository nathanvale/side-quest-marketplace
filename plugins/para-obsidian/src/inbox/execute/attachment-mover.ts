/**
 * Attachment Moving Logic
 *
 * Handles moving attachments with dated filenames:
 * - Generate dated filename (YYYYMMDD-HHMM-description.ext)
 * - Move with TOCTOU protection
 * - Handle collisions with unique paths
 *
 * @module inbox/execute/attachment-mover
 */

import { basename, dirname, extname, join } from "node:path";
import { ensureDirSync, moveFile, pathExistsSync } from "@sidequest/core/fs";
import type { executeLogger } from "../../shared/logger";
import { generateFilename, generateUniquePath } from "../core/engine-utils";
import { hashFile } from "../registry";
import type { InboxSuggestion } from "../types";
import type { AttachmentMoveResult } from "./types";

/**
 * Generate a dated filename for an attachment.
 *
 * Format: YYYYMMDD-HHMM-description.ext
 *
 * @param suggestion - Suggestion containing source path and optional attachment name
 * @returns Dated filename
 */
export function generateDatedFilename(suggestion: InboxSuggestion): string {
	// Extract suggestedAttachmentName if present
	const suggestedName =
		"suggestedAttachmentName" in suggestion
			? suggestion.suggestedAttachmentName
			: undefined;

	if (suggestedName) {
		// LLM provided a clean description - use it directly
		const ext = extname(suggestion.source);
		const timestamp = new Date();
		const year = timestamp.getFullYear();
		const month = String(timestamp.getMonth() + 1).padStart(2, "0");
		const day = String(timestamp.getDate()).padStart(2, "0");
		const hour = String(timestamp.getHours()).padStart(2, "0");
		const minute = String(timestamp.getMinutes()).padStart(2, "0");
		const timestampPrefix = `${year}${month}${day}-${hour}${minute}`;
		return `${timestampPrefix}-${suggestedName}${ext}`;
	}

	// Fallback: extract description from messy filename
	return generateFilename(suggestion.source);
}

/**
 * Move an attachment to the attachments folder with a dated filename.
 *
 * Steps:
 * 1. Generate dated filename
 * 2. Hash source file
 * 3. Check for collisions and generate unique path if needed
 * 4. TOCTOU check: verify source still exists
 * 5. Move file
 *
 * @param suggestion - Suggestion containing source path
 * @param config - Vault configuration
 * @param logger - Optional logger instance
 * @param cid - Correlation ID for logging
 * @returns Result with movedTo path and hash, or error
 */
export async function moveAttachment(
	suggestion: InboxSuggestion,
	config: { vaultPath: string; inboxFolder: string; attachmentsFolder: string },
	logger: typeof executeLogger,
	cid: string,
): Promise<AttachmentMoveResult> {
	const sourcePath = join(config.vaultPath, suggestion.source);
	const filename = basename(suggestion.source);

	if (logger) {
		logger.debug`Moving attachment source=${filename} ${cid}`;
	}

	// Generate dated filename
	const datedFilename = generateDatedFilename(suggestion);
	const intendedDest = join(
		config.vaultPath,
		config.attachmentsFolder,
		datedFilename,
	);

	// Generate unique path to prevent overwriting
	const finalDest = generateUniquePath(intendedDest);
	const actualFilename = basename(finalDest);
	const vaultRelativePath = join(config.attachmentsFolder, actualFilename);

	if (finalDest !== intendedDest && logger) {
		logger.warn`File collision detected - using unique name: ${actualFilename} ${cid}`;
	}

	// Hash source file BEFORE moving
	let hash: string;
	try {
		hash = await hashFile(sourcePath);
	} catch (error) {
		return {
			success: false,
			error: `Failed to hash source file: ${error instanceof Error ? error.message : "unknown"}`,
		};
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
			logger.error`Failed to move attachment: ${error instanceof Error ? error.message : "unknown"} ${cid}`;
		}
		return {
			success: false,
			error: `Failed to move file: ${error instanceof Error ? error.message : "unknown"}`,
		};
	}

	if (logger) {
		logger.info`Moved attachment to=${vaultRelativePath} ${cid}`;
	}

	return {
		success: true,
		movedTo: vaultRelativePath,
		hash,
	};
}
