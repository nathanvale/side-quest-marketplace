/**
 * Biome configuration detection utilities.
 * Delegates to generic config detection from @sidequest/core/fs.
 */

import { type ConfigAtRootResult, hasConfigAtRoot } from "@sidequest/core/fs";

/**
 * Valid Biome configuration file names.
 * Biome looks for these in the project root.
 */
export const BIOME_CONFIG_FILES = ["biome.json", "biome.jsonc"] as const;

/** Result of checking for Biome configuration. */
export type BiomeConfigResult = ConfigAtRootResult;

/**
 * Check if a Biome configuration file exists at the git repository root.
 *
 * @returns BiomeConfigResult with found status and paths
 */
export async function hasBiomeConfig(): Promise<BiomeConfigResult> {
	return hasConfigAtRoot(BIOME_CONFIG_FILES);
}

/**
 * Log a message suggesting the user add a Biome config.
 * Uses a consistent format for all biome-runner hooks.
 *
 * @param searchPath - Where we looked for the config (for context)
 */
export function logMissingConfigHint(searchPath?: string): void {
	const location = searchPath ? ` in ${searchPath}` : "";
	console.log(
		`[biome-runner] No biome.json found${location}. Skipping Biome checks.`,
	);
	console.log("[biome-runner] To enable: bunx @biomejs/biome init");
}
