/**
 * Package manager detection from lockfile presence.
 *
 * Checks for lockfiles in priority order (bun > yarn > pnpm > npm)
 * and returns the appropriate install command.
 *
 * @module worktree/detect-pm
 */

import path from "node:path";
import { pathExistsSync } from "@sidequest/core/fs";

/** Lockfile-to-install-command mapping, ordered by priority. */
const LOCKFILE_MAP: ReadonlyArray<readonly [string, string]> = [
	["bun.lock", "bun install"],
	["bun.lockb", "bun install"],
	["yarn.lock", "yarn install"],
	["pnpm-lock.yaml", "pnpm install"],
	["package-lock.json", "npm install"],
];

/**
 * Detect the package manager install command for a directory.
 *
 * Checks for lockfiles in priority order: bun > yarn > pnpm > npm.
 * Returns null if no lockfile is found.
 *
 * @param dir - Directory to check for lockfiles
 * @returns Install command string, or null if no lockfile found
 */
export function detectInstallCommand(dir: string): string | null {
	for (const [lockfile, command] of LOCKFILE_MAP) {
		if (pathExistsSync(path.join(dir, lockfile))) {
			return command;
		}
	}
	return null;
}
