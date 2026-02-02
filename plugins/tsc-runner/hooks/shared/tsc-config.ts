/**
 * TypeScript configuration detection utilities.
 * Delegates to generic config detection from @sidequest/core/fs.
 */

import {
	type ConfigAtRootResult,
	findNearestConfig,
	hasConfigAtRoot,
	type NearestConfigResult,
} from "@side-quest/core/fs";

/**
 * Valid TypeScript configuration file names.
 * TypeScript looks for tsconfig.json by default.
 * We also check for:
 * - jsconfig.json (used by JS projects with TS tooling)
 */
export const TSC_CONFIG_FILES = ["tsconfig.json", "jsconfig.json"] as const;

/** Result of checking for TypeScript configuration. */
export type TscConfigResult = ConfigAtRootResult;

/** Result of finding the nearest TypeScript configuration file. */
export type NearestTsConfigResult = NearestConfigResult;

/**
 * Check if a TypeScript configuration file exists at the git repository root.
 *
 * @returns TscConfigResult with found status and paths
 */
export async function hasTscConfig(): Promise<TscConfigResult> {
	return hasConfigAtRoot(TSC_CONFIG_FILES);
}

/**
 * Find the nearest TypeScript configuration file by walking up from a file path.
 *
 * @param filePath - Path to the file to start searching from
 * @returns NearestTsConfigResult with found status and paths
 */
export async function findNearestTsConfig(
	filePath: string,
): Promise<NearestTsConfigResult> {
	return findNearestConfig(filePath, TSC_CONFIG_FILES);
}

/**
 * Log a message suggesting the user add a TypeScript config.
 * Uses a consistent format for all tsc-runner hooks.
 *
 * @param searchPath - Where we looked for the config (for context)
 */
export function logMissingTscConfigHint(searchPath?: string): void {
	const location = searchPath ? ` in ${searchPath}` : "";
	console.log(
		`[tsc-runner] No tsconfig.json found${location}. Skipping TypeScript checks.`,
	);
	console.log("[tsc-runner] To enable: bunx tsc --init");
}
