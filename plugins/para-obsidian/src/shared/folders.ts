/**
 * Folder management utilities for para-obsidian.
 */

import {
	DEFAULT_DESTINATIONS,
	DEFAULT_PARA_FOLDERS,
} from "../config/defaults.js";
import type { ParaObsidianConfig } from "../config/index.js";

/**
 * Gets all PARA-managed folders from configuration.
 *
 * Combines folders from:
 * - paraFolders (inbox, projects, areas, resources, archives)
 * - defaultDestinations (Tasks, Daily Notes, Weekly Notes, etc.)
 *
 * @param config - Para-obsidian configuration
 * @returns Set of unique folder names that para-obsidian manages
 *
 * @example
 * ```typescript
 * const folders = getManagedFolders(config);
 * // Set { "00 Inbox", "01 Projects", "02 Areas", "Tasks", ... }
 * ```
 */
export function getManagedFolders(config: ParaObsidianConfig): Set<string> {
	const folders = new Set<string>();

	// Add PARA folders (inbox, projects, areas, resources, archives)
	const paraFolders = config.paraFolders ?? DEFAULT_PARA_FOLDERS;
	for (const folder of Object.values(paraFolders)) {
		folders.add(folder);
	}

	// Add destination folders (Tasks, Daily Notes, Weekly Notes, etc.)
	const destinations = config.defaultDestinations ?? DEFAULT_DESTINATIONS;
	for (const folder of Object.values(destinations)) {
		folders.add(folder);
	}

	return folders;
}

/**
 * Checks if a file path is within a PARA-managed folder.
 *
 * @param filePath - Vault-relative file path
 * @param managedFolders - Set of managed folder names
 * @returns true if file is in a managed folder
 */
export function isInManagedFolder(
	filePath: string,
	managedFolders: Set<string>,
): boolean {
	// Get the top-level folder from the path
	const parts = filePath.split("/");
	if (parts.length < 2) return false; // File at root level, not managed

	const topFolder = parts[0];
	return managedFolders.has(topFolder ?? "");
}
