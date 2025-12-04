/**
 * TypeScript configuration detection utilities.
 * Checks for tsconfig.json to ensure hooks don't run without config.
 */

import { exists } from "node:fs/promises";
import { join } from "node:path";
import { getGitRoot } from "@sidequest/core/git";

/**
 * Valid TypeScript configuration file names.
 * TypeScript looks for tsconfig.json by default.
 * We also check for:
 * - jsconfig.json (used by JS projects with TS tooling)
 */
export const TSC_CONFIG_FILES = ["tsconfig.json", "jsconfig.json"] as const;

/**
 * Result of checking for TypeScript configuration.
 */
export interface TscConfigResult {
	/** Whether a valid TSC config file was found */
	found: boolean;
	/** Path to the config file if found */
	configPath?: string;
	/** The git root where we searched (for error messages) */
	searchPath?: string;
}

/**
 * Check if a TypeScript configuration file exists in the git repository root.
 *
 * Searches for tsconfig.json or jsconfig.json at the repository root.
 * This ensures consistent behavior - we only run tsc when the project
 * has explicitly opted in with a config file.
 *
 * @returns TscConfigResult with found status and paths
 *
 * @example
 * ```ts
 * const result = await hasTscConfig();
 * if (!result.found) {
 *   console.log(`No tsconfig.json in ${result.searchPath}`);
 *   process.exit(0);
 * }
 * ```
 */
export async function hasTscConfig(): Promise<TscConfigResult> {
	const gitRoot = await getGitRoot();

	// If not in a git repo, we can't reliably find the config
	// Return not found - the git-aware checks will skip anyway
	if (!gitRoot) {
		return { found: false };
	}

	// Check for each possible config file
	for (const configFile of TSC_CONFIG_FILES) {
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
 * Result of finding the nearest TypeScript configuration file.
 */
export interface NearestTsConfigResult {
	/** Whether a valid TSC config file was found */
	found: boolean;
	/** Path to the config file if found */
	configPath?: string;
	/** Directory containing the tsconfig (for running tsc from) */
	configDir?: string;
}

/**
 * Find the nearest TypeScript configuration file by walking up from a file path.
 *
 * Searches for tsconfig.json or jsconfig.json starting from the file's directory
 * and walking up to the git root. This allows running tsc from the correct directory
 * for proper module resolution in monorepos and multi-package projects.
 *
 * @param filePath - Path to the file to start searching from
 * @returns NearestTsConfigResult with found status and paths
 *
 * @example
 * ```ts
 * const result = await findNearestTsConfig("/path/to/package/src/index.ts");
 * if (result.found) {
 *   // Run tsc from result.configDir
 *   await spawn(["bunx", "tsc", "--noEmit"], { cwd: result.configDir });
 * }
 * ```
 */
export async function findNearestTsConfig(
	filePath: string,
): Promise<NearestTsConfigResult> {
	const gitRoot = await getGitRoot();
	if (!gitRoot) {
		return { found: false };
	}

	// Start at file's directory
	let currentDir = join(filePath, "..");

	// Walk up until we find a config or hit git root
	while (currentDir.startsWith(gitRoot)) {
		// Check for each possible config file
		for (const configFile of TSC_CONFIG_FILES) {
			const configPath = join(currentDir, configFile);
			if (await exists(configPath)) {
				return {
					found: true,
					configPath,
					configDir: currentDir,
				};
			}
		}

		// Move up one directory
		const parentDir = join(currentDir, "..");

		// If we haven't moved up (reached root), stop
		if (parentDir === currentDir) {
			break;
		}

		currentDir = parentDir;
	}

	return { found: false };
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
