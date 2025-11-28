/**
 * Biome configuration detection utilities.
 * Checks for biome.json/biome.jsonc to ensure hooks don't run without config.
 */

import { exists } from "node:fs/promises";
import { join } from "node:path";
import { getGitRoot } from "./git-utils";

/**
 * Valid Biome configuration file names.
 * Biome looks for these in the project root.
 */
export const BIOME_CONFIG_FILES = ["biome.json", "biome.jsonc"] as const;

/**
 * Result of checking for Biome configuration.
 */
export interface BiomeConfigResult {
	/** Whether a valid Biome config file was found */
	found: boolean;
	/** Path to the config file if found */
	configPath?: string;
	/** The git root where we searched (for error messages) */
	searchPath?: string;
}

/**
 * Check if a Biome configuration file exists in the git repository root.
 *
 * Searches for biome.json or biome.jsonc at the repository root.
 * This ensures consistent behavior - we only run Biome when the project
 * has explicitly opted in with a config file.
 *
 * @returns BiomeConfigResult with found status and paths
 *
 * @example
 * ```ts
 * const result = await hasBiomeConfig();
 * if (!result.found) {
 *   console.log(`No biome.json in ${result.searchPath}`);
 *   process.exit(0);
 * }
 * ```
 */
export async function hasBiomeConfig(): Promise<BiomeConfigResult> {
	const gitRoot = await getGitRoot();

	// If not in a git repo, we can't reliably find the config
	// Return not found - the git-aware checks will skip anyway
	if (!gitRoot) {
		return { found: false };
	}

	// Check for each possible config file
	for (const configFile of BIOME_CONFIG_FILES) {
		const configPath = join(gitRoot, configFile);
		if (await exists(configPath)) {
			return {
				found: true,
				configPath,
				searchPath: gitRoot,
			};
		}
	}

	return {
		found: false,
		searchPath: gitRoot,
	};
}

/**
 * Log a message suggesting the user add a Biome config.
 * Uses a consistent format for all bun-runner hooks.
 *
 * @param searchPath - Where we looked for the config (for context)
 */
export function logMissingConfigHint(searchPath?: string): void {
	const location = searchPath ? ` in ${searchPath}` : "";
	console.log(
		`[bun-runner] No biome.json found${location}. Skipping Biome checks.`,
	);
	console.log("[bun-runner] To enable: bunx @biomejs/biome init");
}
