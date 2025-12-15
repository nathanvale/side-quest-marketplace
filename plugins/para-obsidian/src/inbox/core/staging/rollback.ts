/**
 * Rollback utilities for inbox processing.
 *
 * Provides atomic rollback helper for cleaning up staging notes
 * and registry markers when operations fail.
 *
 * @module inbox/core/staging/rollback
 */

import { dirname, join } from "node:path";
import { executeLogger } from "../../../shared/logger";
import type { createRegistry } from "../../registry/processed-registry";

/**
 * Atomic rollback helper - cleans up staging note and registry marker.
 * Uses sync operations to ensure cleanup completes before returning control.
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
				fs.unlinkSync(stagingAbsolute);
				// Ensure deletion is durable
				const dir = dirname(stagingAbsolute);
				const fd = fs.openSync(dir, "r");
				fs.fsyncSync(fd);
				fs.closeSync(fd);

				if (executeLogger) {
					executeLogger.info`Rolled back staging note=${stagingNotePath} ${cid}`;
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
