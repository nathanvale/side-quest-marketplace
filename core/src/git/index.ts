/**
 * Shared git utilities for bun-runner hooks.
 * Provides git-aware file tracking and change detection.
 */

import { realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnAndCollect } from "../spawn/index.js";

// Re-export guard utilities
export {
	assertGitRepo,
	ensureGitGuard,
	type GetUncommittedFilesOptions,
	type GitGuardLogger,
	type GitGuardOptions,
	getUncommittedFiles,
	gitStatus,
} from "./guard.js";
// Re-export path utilities
export { unescapeGitPath } from "./paths.js";

/**
 * Get the root directory of the current git repository.
 *
 * Why: We need the git root to determine if files are inside the repository
 * and to locate configuration files (biome.json, tsconfig.json).
 *
 * @returns The absolute path to the git root, or null if not in a git repo
 */
export async function getGitRoot(): Promise<string | null> {
	const { stdout, exitCode } = await spawnAndCollect([
		"git",
		"rev-parse",
		"--show-toplevel",
	]);

	if (exitCode !== 0) return null;
	return stdout.trim() || null;
}

/**
 * Check if a file path is inside the current git repository.
 * Returns true for any file inside the repo directory, including untracked files.
 *
 * Why: We use path-based checking instead of `git ls-files --error-unmatch` because
 * the latter fails on untracked files. This approach handles both tracked and
 * newly created files that haven't been staged yet.
 *
 * Note: We resolve symlinks to handle cases like /tmp → /private/tmp on macOS.
 *
 * @param filePath - Path to the file to check
 * @returns true if file is inside the git repo, false otherwise
 */
export async function isFileInRepo(filePath: string): Promise<boolean> {
	const gitRoot = await getGitRoot();
	if (!gitRoot) return false;

	// Resolve symlinks to handle /tmp → /private/tmp on macOS
	try {
		const realGitRoot = await realpath(gitRoot);
		const absolutePath = resolve(filePath);
		const realAbsolutePath = await realpath(absolutePath);
		return realAbsolutePath.startsWith(realGitRoot);
	} catch {
		// If realpath fails (file doesn't exist), fall back to string comparison
		const absolutePath = resolve(filePath);
		return absolutePath.startsWith(gitRoot);
	}
}

/**
 * Get list of files that have been modified, staged, or are untracked in git.
 * Used by Stop hooks for end-of-turn validation.
 *
 * Why: We run three git commands in parallel to collect all changed files:
 * - Staged files that will be committed
 * - Unstaged modifications to tracked files
 * - Untracked new files (not yet added to git)
 *
 * This ensures CI hooks validate ALL changes, not just committed ones.
 *
 * @param extensions - Optional array of file extensions to filter by
 * @returns Array of changed file paths
 */
export async function getChangedFiles(
	extensions?: string[],
): Promise<string[]> {
	// Run all three git commands in parallel for efficiency
	const [stagedResult, modifiedResult, untrackedResult] = await Promise.all([
		spawnAndCollect(["git", "diff", "--cached", "--name-only"]),
		spawnAndCollect(["git", "diff", "--name-only"]),
		spawnAndCollect(["git", "ls-files", "--others", "--exclude-standard"]),
	]);

	const files = new Set<string>();

	// Collect staged files
	for (const file of stagedResult.stdout.trim().split("\n")) {
		if (file) files.add(file);
	}

	// Collect unstaged modified files
	for (const file of modifiedResult.stdout.trim().split("\n")) {
		if (file) files.add(file);
	}

	// Collect untracked files
	for (const file of untrackedResult.stdout.trim().split("\n")) {
		if (file) files.add(file);
	}

	const allFiles = Array.from(files);

	// Filter by extensions if provided
	if (extensions && extensions.length > 0) {
		return allFiles.filter((file) =>
			extensions.some((ext) => file.endsWith(ext)),
		);
	}

	return allFiles;
}

/**
 * Check if any files with given extensions have been modified or staged.
 * Used by Stop hooks to decide whether to run project-wide checks.
 *
 * Why: Running full project checks (tsc, biome ci) is expensive. This function
 * allows hooks to skip validation when no relevant files have changed.
 *
 * @param extensions - Array of file extensions to check for
 * @returns true if any matching files have changed
 */
export async function hasChangedFiles(extensions: string[]): Promise<boolean> {
	const changedFiles = await getChangedFiles(extensions);
	return changedFiles.length > 0;
}

// ============================================================================
// Workspace utilities
// ============================================================================

/**
 * Check if the current project is a Bun/npm workspace.
 * Looks for `workspaces` field in package.json at specified path or cwd.
 *
 * Why: Some tools behave differently in workspaces vs standard projects.
 * For example, `bun --filter '*' typecheck` runs typecheck in all packages,
 * while `tsc --noEmit` only checks the current directory.
 *
 * @param rootPath - Optional root path to check (default: process.cwd())
 * @returns true if package.json has a non-empty workspaces array
 *
 * @example
 * ```ts
 * if (await isWorkspaceProject()) {
 *   // Run workspace-aware command
 *   await spawnAndCollect(["bun", "--filter", "*", "test"]);
 * } else {
 *   await spawnAndCollect(["bun", "test"]);
 * }
 * ```
 */
export async function isWorkspaceProject(rootPath?: string): Promise<boolean> {
	const { existsSync, readFileSync } = await import("node:fs");
	const { join } = await import("node:path");

	const pkgPath = join(rootPath ?? process.cwd(), "package.json");
	if (!existsSync(pkgPath)) return false;

	try {
		const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
		return Array.isArray(pkg.workspaces) && pkg.workspaces.length > 0;
	} catch {
		return false;
	}
}

/**
 * Get list of workspace packages from package.json workspaces field.
 *
 * @param rootPath - Optional root path (default: process.cwd())
 * @returns Array of workspace glob patterns, or empty array if not a workspace
 *
 * @example
 * ```ts
 * const packages = await getWorkspacePackages();
 * // ["packages/*", "apps/*"]
 * ```
 */
export async function getWorkspacePackages(
	rootPath?: string,
): Promise<string[]> {
	const { existsSync, readFileSync } = await import("node:fs");
	const { join } = await import("node:path");

	const pkgPath = join(rootPath ?? process.cwd(), "package.json");
	if (!existsSync(pkgPath)) return [];

	try {
		const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
		if (Array.isArray(pkg.workspaces)) {
			return pkg.workspaces;
		}
		return [];
	} catch {
		return [];
	}
}
