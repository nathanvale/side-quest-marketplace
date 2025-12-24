/**
 * Rollback utilities for inbox processing.
 *
 * Provides atomic rollback helper for cleaning up staging notes
 * and registry markers when operations fail.
 *
 * @module inbox/core/staging/rollback
 */

import { dirname, join } from "node:path";
import { sleepSync } from "@sidequest/core/utils";
import { executeLogger } from "../../../shared/logger";
import type { createRegistry } from "../../registry/processed-registry";

/**
 * Attempt to delete a file with retries.
 * Uses sync operations with small delays between attempts.
 *
 * @param fs - Node.js fs module
 * @param absolutePath - Absolute path to file to delete
 * @param maxAttempts - Maximum retry attempts (default: 3)
 * @param delayMs - Delay between retries in ms (default: 50)
 * @returns true if deleted successfully, false if all retries failed
 */
function unlinkWithRetry(
	fs: typeof import("node:fs"),
	absolutePath: string,
	maxAttempts = 3,
	delayMs = 50,
): boolean {
	let lastError: Error | undefined;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			fs.unlinkSync(absolutePath);
			return true; // Success
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			// Don't retry if file doesn't exist (already deleted)
			if ("code" in lastError && lastError.code === "ENOENT") {
				return true;
			}

			// If not the last attempt, wait before retrying
			if (attempt < maxAttempts) {
				sleepSync(delayMs);
			}
		}
	}

	// All retries failed
	if (executeLogger && lastError) {
		executeLogger.warn`File deletion failed after ${maxAttempts} attempts: ${lastError.message}`;
	}
	return false;
}

/**
 * Atomic rollback helper - cleans up staging note and registry marker.
 * Uses sync operations to ensure cleanup completes before returning control.
 *
 * Implements retry logic for file deletion to handle transient filesystem issues.
 * Failed deletions are logged as orphans for manual cleanup.
 *
 * @param vaultPath - Absolute path to the vault root (required for resolving staging paths)
 * @param stagingNotePath - Vault-relative path to the staging note to delete (if any)
 * @param sourceHash - Hash of the source file for registry cleanup
 * @param registry - Registry instance for clearing in-progress marker
 * @param cid - Correlation ID for logging
 */
export async function rollbackOperation(
	vaultPath: string,
	stagingNotePath: string | undefined,
	sourceHash: string,
	registry: ReturnType<typeof createRegistry>,
	cid: string,
): Promise<void> {
	if (stagingNotePath) {
		try {
			const fs = await import("node:fs");
			// Resolve staging path relative to vault, not CWD
			const stagingAbsolute = join(vaultPath, stagingNotePath);

			if (fs.existsSync(stagingAbsolute)) {
				const deleted = unlinkWithRetry(fs, stagingAbsolute);

				if (deleted) {
					// Ensure deletion is durable
					const dir = dirname(stagingAbsolute);
					const fd = fs.openSync(dir, "r");
					fs.fsyncSync(fd);
					fs.closeSync(fd);

					if (executeLogger) {
						executeLogger.info`Rolled back staging note=${stagingNotePath} ${cid}`;
					}
				} else {
					// Orphaned staging note - log for manual cleanup
					if (executeLogger) {
						executeLogger.error`ORPHANED STAGING NOTE (manual cleanup required): path=${stagingAbsolute} ${cid}`;
					}
				}
			} else if (executeLogger) {
				// Layer 2: Log warning if staging file not found (helps debug path issues)
				executeLogger.warn`Staging note not found during rollback path=${stagingAbsolute} ${cid}`;
			}
		} catch (rollbackError) {
			if (executeLogger) {
				executeLogger.error`Failed to rollback staging note: ${rollbackError instanceof Error ? rollbackError.message : "unknown"} ${cid}`;
			}
		}
	}

	// Clean up in-progress marker
	registry.clearInProgress(sourceHash);
	await registry.save();
}
