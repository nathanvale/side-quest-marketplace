/**
 * Git guard utilities for safe operations.
 *
 * Ensures operations only proceed when the working tree is clean,
 * preventing accidental loss of uncommitted changes. Used by
 * destructive operations like LLM processing, bulk modifications, etc.
 *
 * ## Features
 *
 * - **Repository validation** - Ensures directory is in a git repo
 * - **Clean tree checks** - Detects uncommitted changes
 * - **Folder scoping** - Only checks specified folders
 * - **Optional logging** - Instrumentation via optional logger
 *
 * @module core/git/guard
 */

import fs from "node:fs";
import { pathExistsSync } from "../fs/index.js";
import { spawnAndCollect } from "../spawn/index.js";

/**
 * Options for git guard checks.
 */
export interface GitGuardOptions {
	/**
	 * Directory to check (usually a git repository root or subdirectory).
	 */
	dir: string;

	/**
	 * Set of folder names to check for uncommitted changes.
	 * Only files within these folders are validated.
	 * If empty, all files are checked.
	 *
	 * @example ["01 Projects", "02 Areas", "03 Resources"]
	 */
	managedFolders?: Set<string>;

	/**
	 * If true, check all file types. If false (default), only check .md files.
	 * @default false
	 */
	checkAllFileTypes?: boolean;

	/**
	 * Optional logger for instrumentation.
	 */
	logger?: GitGuardLogger;
}

/**
 * Logger interface for git guard operations.
 */
export interface GitGuardLogger {
	debug?(message: string, context?: Record<string, unknown>): void;
	info?(message: string, context?: Record<string, unknown>): void;
	error?(message: string, context?: Record<string, unknown>): void;
}

/**
 * Unescapes git's C-style quoted paths.
 *
 * Git escapes non-ASCII UTF-8 bytes as octal sequences when core.quotepath=true (default).
 * Example: 🧾 (U+1F9FE) = UTF-8 bytes [F0 9F A7 BE] = \360\237\247\276 in git output
 *
 * Also handles standard C escape sequences: \n, \t, \r, \\, \"
 *
 * @param gitPath - Path from git status output (after quote stripping)
 * @returns Properly decoded UTF-8 path
 *
 * @example
 * ```typescript
 * unescapeGitPath("\\360\\237\\247\\276 Invoice.md") // "🧾 Invoice.md"
 * unescapeGitPath("file\\twith\\ttabs.md") // "file\twith\ttabs.md"
 * ```
 */
export function unescapeGitPath(gitPath: string): string {
	const bytes: number[] = [];
	let i = 0;

	while (i < gitPath.length) {
		if (gitPath[i] === "\\" && i + 1 < gitPath.length) {
			const nextChar = gitPath[i + 1];

			// Check for octal escape \ooo (3 octal digits)
			if (i + 3 < gitPath.length) {
				const nextThree = gitPath.substring(i + 1, i + 4);
				if (/^[0-7]{3}$/.test(nextThree)) {
					bytes.push(Number.parseInt(nextThree, 8));
					i += 4;
					continue;
				}
			}

			// Check for single-char escapes
			switch (nextChar) {
				case "n":
					bytes.push(10);
					i += 2;
					continue;
				case "t":
					bytes.push(9);
					i += 2;
					continue;
				case "r":
					bytes.push(13);
					i += 2;
					continue;
				case "\\":
					bytes.push(92);
					i += 2;
					continue;
				case '"':
					bytes.push(34);
					i += 2;
					continue;
			}
		}

		// Regular ASCII character - add its char code
		bytes.push(gitPath.charCodeAt(i));
		i++;
	}

	// Decode UTF-8 bytes to string
	return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
}

/**
 * Gets the git repository root for a given directory.
 *
 * @param dir - Directory to check
 * @returns Absolute path to git root, or null if not in a git repo
 */
async function getGitRootForDir(dir: string): Promise<string | null> {
	const { stdout, exitCode } = await spawnAndCollect(
		["git", "rev-parse", "--show-toplevel"],
		{ cwd: dir },
	);
	if (exitCode !== 0) return null;
	return stdout.trim() || null;
}

/**
 * Asserts that a directory is inside a git repository.
 *
 * This is a safety guard to ensure operations are version controlled.
 * Throws if the directory is not in a git repo.
 *
 * @param dir - Directory to check
 * @throws Error if directory is not inside a git repository
 *
 * @example
 * ```typescript
 * await assertGitRepo("/path/to/vault");
 * // Proceed with operations...
 * ```
 */
export async function assertGitRepo(dir: string): Promise<void> {
	const root = await getGitRootForDir(dir);
	if (!root) {
		throw new Error("Directory must be inside a git repository.");
	}

	// Verify the directory is actually under the git root (handles symlinks)
	// Use realpathSync to resolve symlinks (e.g., /var -> /private/var on macOS)
	const realRoot = pathExistsSync(root) ? fs.realpathSync(root) : root;
	const realDir = pathExistsSync(dir) ? fs.realpathSync(dir) : dir;
	if (!realDir.startsWith(realRoot)) {
		throw new Error("Directory must be inside a git repository.");
	}
}

/**
 * Checks if a file path is within a managed folder.
 *
 * @param filePath - File path (relative to directory root)
 * @param managedFolders - Set of managed folder names
 * @returns true if file is in a managed folder
 */
function isInManagedFolder(
	filePath: string,
	managedFolders: Set<string>,
): boolean {
	// Get the top-level folder from the path
	const parts = filePath.split("/");
	if (parts.length < 2) return false; // File at root level, not managed

	const topFolder = parts[0];
	return managedFolders.has(topFolder ?? "");
}

/**
 * Options for getting uncommitted files.
 */
export interface GetUncommittedFilesOptions {
	/**
	 * Directory to check.
	 */
	dir: string;

	/**
	 * If true, return all file types. If false (default), return only .md files.
	 * @default false
	 */
	allFileTypes?: boolean;

	/**
	 * Optional logger for instrumentation.
	 */
	logger?: GitGuardLogger;
}

/**
 * Gets all uncommitted files in a directory (staged and unstaged).
 *
 * Uses git status --porcelain to find modified, added, and untracked files.
 * By default, filters to only .md files. Use `allFileTypes: true` to include all files.
 *
 * @param options - Configuration options
 * @returns Array of directory-relative paths to uncommitted files
 *
 * @example
 * ```typescript
 * // Get only markdown files (default)
 * const mdFiles = await getUncommittedFiles({ dir: "/path/to/vault" });
 * // Returns: ['Projects/My Project.md', '00 Inbox/New Note.md']
 *
 * // Get all file types
 * const allFiles = await getUncommittedFiles({
 *   dir: "/path/to/vault",
 *   allFileTypes: true
 * });
 * // Returns: ['Projects/My Project.md', '00 Inbox/doc.pdf', '00 Inbox/data.json']
 * ```
 */
export async function getUncommittedFiles(
	options: GetUncommittedFilesOptions,
): Promise<string[]> {
	const { dir, allFileTypes = false, logger } = options;

	logger?.debug?.("git:getUncommittedFiles:start", { dir, allFileTypes });

	const { stdout, exitCode } = await spawnAndCollect(
		["git", "status", "--porcelain", "-uall"],
		{ cwd: dir },
	);

	if (exitCode !== 0) {
		const error = new Error("git status failed");
		logger?.error?.("git:getUncommittedFiles:error", { error: error.message });
		throw error;
	}

	// Split first, then filter empty lines
	// Important: Don't trim() the whole stdout as it strips leading spaces
	// from git status format (e.g., " M file.md" becomes "M file.md")
	const lines = stdout.split("\n").filter((line) => line.length > 0);
	const files: string[] = [];

	for (const line of lines) {
		// Porcelain format: XY PATH (2 status chars + 1 space + path)
		// X = index status, Y = working tree status
		// Status codes: M (modified), A (added), ?? (untracked), etc.
		const match = line.match(/^.{2}\s(.+)$/);
		let filePath = match?.[1];

		// Git quotes filenames containing spaces or special chars, e.g. "Note 1.md"
		// It also escapes non-ASCII UTF-8 bytes as octal sequences, e.g. \360\237\247\276 for 🧾
		// Strip surrounding quotes and decode escape sequences
		if (filePath?.startsWith('"') && filePath.endsWith('"')) {
			filePath = filePath.slice(1, -1);
			filePath = unescapeGitPath(filePath);
		}

		if (!filePath) continue;

		// Filter by file type if not including all
		if (allFileTypes || filePath.endsWith(".md")) {
			files.push(filePath);
		}
	}

	logger?.debug?.("git:getUncommittedFiles:complete", {
		filesFound: files.length,
	});

	return files;
}

/**
 * Ensures a directory is in a git repository and has no uncommitted changes
 * in managed folders.
 *
 * This is a safety guard for operations that process files (LLM, bulk edits, etc.)
 * to prevent accidentally losing uncommitted work.
 *
 * @param options - Configuration options
 * @throws Error when guard conditions are not met
 *
 * @example
 * ```typescript
 * // Default: only check .md files in all folders
 * await ensureGitGuard({ dir: "/path/to/vault" });
 *
 * // Strict mode: check all file types
 * await ensureGitGuard({
 *   dir: "/path/to/vault",
 *   checkAllFileTypes: true
 * });
 *
 * // Scoped to specific folders
 * await ensureGitGuard({
 *   dir: "/path/to/vault",
 *   managedFolders: new Set(["Projects", "Areas"]),
 *   checkAllFileTypes: true
 * });
 * ```
 */
export async function ensureGitGuard(options: GitGuardOptions): Promise<void> {
	const {
		dir,
		managedFolders = new Set(),
		checkAllFileTypes = false,
		logger,
	} = options;

	logger?.info?.("git:ensureGitGuard:start", {
		dir,
		checkAllFileTypes,
		folderCount: managedFolders.size,
	});

	// Check that directory is in a git repo
	await assertGitRepo(dir);

	// Get all uncommitted files
	const allUncommitted = await getUncommittedFiles({
		dir,
		allFileTypes: checkAllFileTypes,
		logger,
	});

	// Filter to managed folders if specified
	const uncommitted =
		managedFolders.size > 0
			? allUncommitted.filter((file) => isInManagedFolder(file, managedFolders))
			: allUncommitted;

	if (uncommitted.length > 0) {
		const fileList = `\nUncommitted files:\n${uncommitted.map((f: string) => `  - ${f}`).join("\n")}`;
		const error = new Error(
			`Directory has uncommitted changes. Commit before proceeding.${fileList}`,
		);
		logger?.error?.("git:ensureGitGuard:error", {
			error: error.message,
			uncommittedCount: uncommitted.length,
		});
		throw error;
	}

	logger?.info?.("git:ensureGitGuard:complete", { clean: true });
}

/**
 * Checks the git status of a directory.
 *
 * @param dir - Directory to check
 * @param logger - Optional logger for instrumentation
 * @returns Object with clean status (true if no uncommitted changes)
 * @throws Error if git status command fails
 *
 * @example
 * ```typescript
 * const { clean } = await gitStatus("/path/to/vault");
 * if (!clean) {
 *   console.warn('Warning: uncommitted changes in directory');
 * }
 * ```
 */
export async function gitStatus(
	dir: string,
	logger?: GitGuardLogger,
): Promise<{ clean: boolean }> {
	logger?.debug?.("git:getRepoStatus:start", { dir });

	const { stdout, exitCode } = await spawnAndCollect(
		["git", "status", "--porcelain"],
		{ cwd: dir },
	);

	if (exitCode !== 0) {
		const error = new Error("git status failed");
		logger?.error?.("git:getRepoStatus:error", { error: error.message });
		throw error;
	}

	const output = stdout.trim();
	const clean = output.length === 0;

	logger?.debug?.("git:getRepoStatus:complete", { clean });

	return { clean };
}
