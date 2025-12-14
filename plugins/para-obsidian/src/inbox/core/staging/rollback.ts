/**
 * Rollback utilities for inbox processing.
 *
 * Provides atomic rollback helper for cleaning up staging notes
 * and registry markers when operations fail.
 *
 * @module inbox/core/staging/rollback
 */

import path from "node:path";
import { executeLogger } from "../../../shared/logger";
import type { createRegistry } from "../../registry/processed-registry";

/**
 * Atomic rollback helper - cleans up staging note and registry marker.
 * Uses sync operations to ensure cleanup completes before returning control.
 *
 * @param stagingNotePath - Path to the staging note to delete (if any)
 * @param sourceHash - Hash of the source file for registry cleanup
 * @param registry - Registry instance for clearing in-progress marker
 * @param cid - Correlation ID for logging
 */
export async function rollbackOperation(
	stagingNotePath: string | undefined,
	sourceHash: string,
	registry: ReturnType<typeof createRegistry>,
	cid: string,
): Promise<void> {
	if (stagingNotePath) {
		try {
			const fs = await import("node:fs");
			const stagingAbsolute = path.resolve(stagingNotePath);

			if (fs.existsSync(stagingAbsolute)) {
				fs.unlinkSync(stagingAbsolute);
				// Ensure deletion is durable
				const dir = path.dirname(stagingAbsolute);
				const fd = fs.openSync(dir, "r");
				fs.fsyncSync(fd);
				fs.closeSync(fd);

				if (executeLogger) {
					executeLogger.info`Rolled back staging note=${stagingNotePath} ${cid}`;
				}
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
