/**
 * Safe file deletion with confirmation.
 *
 * This module provides a guarded delete operation that requires
 * explicit confirmation and supports dry-run previews. It also
 * cleans up empty parent directories after deletion.
 *
 * @module delete
 */
import path from "node:path";
import { pathExistsSync, readDir } from "@sidequest/core/fs";
import { spawnSyncCollect } from "@sidequest/core/spawn";

import type { ParaObsidianConfig } from "../config/index";
import { resolveVaultPath } from "../fs";

/**
 * Options for deleting a file.
 */
export interface DeleteOptions {
	/** Path to the file to delete (relative to vault). */
	readonly file: string;
	/** Must be true to proceed with deletion (safety guard). */
	readonly confirm: boolean;
	/** If true, report what would be deleted without actually deleting. */
	readonly dryRun?: boolean;
}

/**
 * Deletes a file from the vault with confirmation.
 *
 * This function:
 * 1. Requires explicit confirmation (safety guard)
 * 2. Validates the file exists
 * 3. Deletes the file (unless dry-run)
 * 4. Cleans up empty parent directories up to vault root
 *
 * @param config - Para-obsidian configuration
 * @param options - Delete options (file, confirm, dryRun)
 * @returns Result with deleted status and relative path
 * @throws Error if confirm is false or file doesn't exist
 *
 * @example
 * ```typescript
 * // Dry run first
 * deleteFile(config, { file: 'Projects/Old.md', confirm: true, dryRun: true });
 * // Then actually delete
 * deleteFile(config, { file: 'Projects/Old.md', confirm: true });
 * ```
 */
export function deleteFile(
	config: ParaObsidianConfig,
	options: DeleteOptions,
): { deleted: boolean; relative: string } {
	// Safety guard: require explicit confirmation
	if (!options.confirm) {
		throw new Error("delete requires --confirm");
	}

	const target = resolveVaultPath(config.vault, options.file);
	if (!pathExistsSync(target.absolute)) {
		throw new Error(`File not found: ${options.file}`);
	}

	if (!options.dryRun) {
		// Delete the file/directory
		const rm = spawnSyncCollect(["rm", "-rf", target.absolute]);
		if (rm.exitCode !== 0) {
			throw new Error(`Failed to delete: ${rm.stderr}`);
		}

		// Clean up empty parent directories up to vault root
		let dir = path.dirname(target.absolute);
		while (dir.startsWith(config.vault) && dir !== config.vault) {
			if (readDir(dir).length === 0) {
				spawnSyncCollect(["rmdir", dir]);
				dir = path.dirname(dir);
			} else {
				break;
			}
		}
	}

	return { deleted: !options.dryRun, relative: target.relative };
}
