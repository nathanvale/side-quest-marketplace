/**
 * Generic configuration file detection utilities.
 *
 * Provides reusable functions for finding tool configuration files
 * (tsconfig.json, biome.json, etc.) in project directories.
 * Used by runner plugins to detect whether a tool is configured.
 */

import { exists } from "node:fs/promises";
import { join } from "node:path";
import { getGitRoot } from "../git/index.js";

/** Result of checking for a config file at the repository root. */
export interface ConfigAtRootResult {
	/** Whether a config file was found */
	found: boolean;
	/** Absolute path to the config file if found */
	configPath?: string;
	/** The git root directory that was searched */
	searchPath?: string;
}

/** Result of finding the nearest config file by walking up directories. */
export interface NearestConfigResult {
	/** Whether a config file was found */
	found: boolean;
	/** Absolute path to the config file if found */
	configPath?: string;
	/** Directory containing the config file (for running tools from) */
	configDir?: string;
}

/**
 * Check if any config file exists at the git repository root.
 *
 * Searches for config files in order at the repo root. Returns on first match.
 * Used by hooks to decide whether to run (e.g., skip Biome if no biome.json).
 *
 * @param configNames - Config file names to search for, checked in order
 * @returns Result with found status and paths
 */
export async function hasConfigAtRoot(
	configNames: readonly string[],
): Promise<ConfigAtRootResult> {
	const gitRoot = await getGitRoot();

	if (!gitRoot) {
		return { found: false };
	}

	for (const configFile of configNames) {
		const configPath = join(gitRoot, configFile);
		if (await exists(configPath)) {
			return { found: true, configPath, searchPath: gitRoot };
		}
	}

	return { found: false, searchPath: gitRoot };
}

/**
 * Find the nearest config file by walking up from a file path to git root.
 *
 * Starts at the file's parent directory and walks up until it finds a config
 * file or reaches the git root boundary. Critical for monorepo support where
 * each package has its own config (e.g., tsconfig.json per workspace).
 *
 * @param filePath - Path to start searching from (typically the edited file)
 * @param configNames - Config file names to search for, checked in order at each level
 * @returns Result with found status and paths
 */
export async function findNearestConfig(
	filePath: string,
	configNames: readonly string[],
): Promise<NearestConfigResult> {
	const gitRoot = await getGitRoot();
	if (!gitRoot) {
		return { found: false };
	}

	let currentDir = join(filePath, "..");

	while (currentDir.startsWith(gitRoot)) {
		for (const configFile of configNames) {
			const configPath = join(currentDir, configFile);
			if (await exists(configPath)) {
				return { found: true, configPath, configDir: currentDir };
			}
		}

		const parentDir = join(currentDir, "..");
		if (parentDir === currentDir) break;
		currentDir = parentDir;
	}

	return { found: false };
}
