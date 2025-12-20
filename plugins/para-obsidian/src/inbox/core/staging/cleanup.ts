/**
 * Staging cleanup utilities for inbox processing.
 *
 * Detects and cleans up orphaned staging files from interrupted operations.
 *
 * @module inbox/core/staging/cleanup
 */

import { dirname, join } from "node:path";
import {
	ensureDirSync,
	moveFile,
	pathExistsSync,
	readDir,
	readTextFileSync,
} from "@sidequest/core/fs";
import { loadConfig } from "../../../config/index";
import { parseFrontmatter } from "../../../frontmatter/parse";
import { inboxLogger } from "../../../shared/logger";
import type { createRegistry } from "../../registry/processed-registry";
import type { OperationContext } from "../../shared/context";
import type { ProcessedItem } from "../../types";

/**
 * Cleanup orphaned staging files from interrupted operations.
 *
 * Detects notes left in .inbox-staging and moves them to final destination
 * or deletes them if they're truly orphaned (no registry entry).
 *
 * @param vaultPath - Absolute path to vault root
 * @param registry - Registry instance for checking processed items
 * @param options - Operation context with sessionCid for tracing
 */
export async function cleanupOrphanedStaging(
	vaultPath: string,
	registry: ReturnType<typeof createRegistry>,
	options?: OperationContext,
): Promise<void> {
	const { sessionCid } = options ?? {};
	const stagingDir = join(vaultPath, ".inbox-staging");
	if (!pathExistsSync(stagingDir)) return;

	try {
		const files = readDir(stagingDir).filter((f) => f.endsWith(".md"));
		if (files.length === 0) return;

		if (inboxLogger) {
			inboxLogger.info`Found ${files.length} orphaned files in staging, attempting cleanup${sessionCid ? ` ${sessionCid}` : ""}`;
		}

		for (const file of files) {
			const stagingPath = join(stagingDir, file);

			// Check if this file has a registry entry with orphanedInStaging flag
			const allItems = registry.getAllItems();
			const matchingEntry = allItems.find(
				(item: ProcessedItem) =>
					item.createdNote?.includes(file) && item.orphanedInStaging === true,
			);

			if (matchingEntry) {
				// Found registry entry - try to move to final destination
				if (inboxLogger) {
					inboxLogger.info`Recovering orphaned staging file: ${file}${sessionCid ? ` ${sessionCid}` : ""}`;
				}

				// Determine final destination from note type
				try {
					const config = loadConfig();
					const content = readTextFileSync(stagingPath);
					const { attributes } = parseFrontmatter(content);
					const noteType = attributes.note_type as string | undefined;

					let finalDest = "";
					if (noteType && config.defaultDestinations?.[noteType]) {
						finalDest = config.defaultDestinations[noteType];
					}

					const finalPath = join(vaultPath, finalDest, file);
					ensureDirSync(dirname(finalPath));
					await moveFile(stagingPath, finalPath);

					// Update registry with final path (orphanedInStaging will be overridden)
					const updatedItem: ProcessedItem = {
						sourceHash: matchingEntry.sourceHash,
						sourcePath: matchingEntry.sourcePath,
						processedAt: matchingEntry.processedAt,
						createdNote: join(finalDest, file),
						movedAttachment: matchingEntry.movedAttachment,
						orphanedInStaging: false,
					};
					registry.markProcessed(updatedItem);

					if (inboxLogger) {
						inboxLogger.info`Recovered orphaned file to final destination: ${finalPath}${sessionCid ? ` ${sessionCid}` : ""}`;
					}
				} catch (error) {
					if (inboxLogger) {
						inboxLogger.warn`Failed to recover orphaned file ${file}: ${error instanceof Error ? error.message : "unknown"}${sessionCid ? ` ${sessionCid}` : ""}`;
					}
				}
			} else {
				// No registry entry - truly orphaned, delete after 24 hours
				try {
					const stats = await Bun.file(stagingPath).stat();
					const ageMs = Date.now() - stats.mtime.getTime();
					const oneDayMs = 24 * 60 * 60 * 1000;

					if (ageMs > oneDayMs) {
						const fs = await import("node:fs");
						fs.unlinkSync(stagingPath);
						if (inboxLogger) {
							inboxLogger.info`Deleted stale orphaned file (>24h): ${file}${sessionCid ? ` ${sessionCid}` : ""}`;
						}
					}
				} catch (error) {
					if (inboxLogger) {
						inboxLogger.warn`Failed to check/delete orphaned file ${file}: ${error instanceof Error ? error.message : "unknown"}${sessionCid ? ` ${sessionCid}` : ""}`;
					}
				}
			}
		}

		await registry.save();
	} catch (error) {
		if (inboxLogger) {
			inboxLogger.warn`Failed to cleanup orphaned staging files: ${error instanceof Error ? error.message : "unknown"}${sessionCid ? ` ${sessionCid}` : ""}`;
		}
	}
}
