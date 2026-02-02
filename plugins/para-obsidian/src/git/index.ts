/**
 * Git integration for vault operations.
 *
 * This module provides:
 * - Git repository validation (vault must be in a git repo for writes)
 * - Status checking (clean/dirty working tree)
 * - Automatic commit after write operations
 *
 * Git integration is optional but recommended for version control
 * of vault content.
 *
 * @module git
 */
import fs from "node:fs";
import path from "node:path";
import { spawnAndCollect } from "@side-quest/core/spawn";
import { discoverAttachments } from "../attachments/index";
import type { ParaObsidianConfig } from "../config/index";
import { getManagedFolders, isInManagedFolder } from "../shared/folders.js";
import { resolveVaultPath } from "../shared/fs";
import { observe } from "../shared/instrumentation.js";
import { gitLogger } from "../shared/logger.js";
import { assertGitRepo, getUncommittedFiles } from "./guard-wrapper.js";

// Re-export from core for backward compatibility
export { unescapeGitPath } from "@side-quest/core/git";
// Re-export folder utilities
export { getManagedFolders, isInManagedFolder } from "../shared/folders.js";
// Re-export guard functions from wrapper (instrumented core implementations)
export {
	assertGitRepo,
	ensureGitGuard,
	type GetUncommittedFilesOptions,
	getUncommittedFiles,
	gitStatus,
} from "./guard-wrapper.js";

// getManagedFolders and isInManagedFolder moved to ../shared/folders.ts
// and re-exported above

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

// assertGitRepo, gitStatus, getUncommittedFiles, and ensureGitGuard
// moved to ./guard-wrapper.ts (which wraps @sidequest/core/git with instrumentation)
// and re-exported above

/**
 * Stages files for commit (new and modified files).
 *
 * @param dir - Git repository directory
 * @param paths - Paths to stage (relative to git root)
 * @throws Error if git add fails
 */
export async function gitAdd(dir: string, paths: string[]): Promise<void> {
	return observe(gitLogger, "git:stageFiles", async () => {
		const { exitCode, stderr } = await spawnAndCollect(
			["git", "add", "--", ...paths],
			{
				cwd: dir,
			},
		);
		if (exitCode !== 0) {
			throw new Error(`git add failed: ${stderr}`);
		}
	});
}

/**
 * Checks if a file is tracked by git (exists in the index).
 *
 * @param dir - Git repository directory
 * @param filePath - Path to check (relative to git root)
 * @returns true if the file is tracked
 */
async function isTrackedByGit(dir: string, filePath: string): Promise<boolean> {
	const { exitCode } = await spawnAndCollect(
		["git", "ls-files", "--error-unmatch", "--", filePath],
		{ cwd: dir },
	);
	return exitCode === 0;
}

/**
 * Checks if a file is staged for deletion.
 *
 * @param dir - Git repository directory
 * @param filePath - Path to check (relative to git root)
 * @returns true if the file is staged for deletion
 */
async function isStagedForDeletion(
	dir: string,
	filePath: string,
): Promise<boolean> {
	const { stdout } = await spawnAndCollect(
		["git", "diff", "--cached", "--name-only", "-z", "--diff-filter=D"],
		{ cwd: dir },
	);
	const stagedDeletions = stdout.split("\0").filter((p) => p.length > 0);
	return stagedDeletions.includes(filePath);
}

/**
 * Stages a file deletion using git rm.
 *
 * @param dir - Git repository directory
 * @param filePath - Path to remove (relative to git root)
 * @throws Error if git rm fails
 */
async function gitRm(dir: string, filePath: string): Promise<void> {
	const { exitCode, stderr } = await spawnAndCollect(
		["git", "rm", "--", filePath],
		{ cwd: dir },
	);
	if (exitCode !== 0) {
		throw new Error(`git rm failed: ${stderr}`);
	}
}

/**
 * Creates a git commit with the staged changes.
 *
 * @param dir - Git repository directory
 * @param message - Commit message
 * @returns Object with committed status (false if nothing to commit)
 */
export async function gitCommit(
	dir: string,
	message: string,
): Promise<{ committed: boolean }> {
	return observe(gitLogger, "git:createCommit", async () => {
		const { exitCode } = await spawnAndCollect(
			["git", "commit", "-m", message],
			{
				cwd: dir,
			},
		);
		// Non-zero exit code when nothing to commit is expected
		return { committed: exitCode === 0 };
	});
}

/**
 * Automatically commits changes to specified files.
 *
 * This function is used by write operations when autoCommit is enabled.
 * It stages the specified files and creates a commit using the
 * configured commit message template.
 *
 * @param config - Para-obsidian configuration with autoCommit settings
 * @param paths - Vault-relative paths to commit
 * @param summary - Short description for commit message (default: "update")
 * @returns Commit result with status and details
 *
 * @example
 * ```typescript
 * const result = await autoCommitChanges(
 *   config,
 *   ['Projects/Note.md'],
 *   'create project note'
 * );
 * if (result.committed) {
 *   console.log(`Committed: ${result.message}`);
 * }
 * ```
 */
export async function autoCommitChanges(
	config: ParaObsidianConfig,
	paths: ReadonlyArray<string>,
	summary = "update",
): Promise<{
	committed: boolean;
	skipped: boolean;
	message: string;
	paths: ReadonlyArray<string>;
}> {
	// Skip if auto-commit is disabled
	if (!config.autoCommit) {
		return { committed: false, skipped: true, message: "", paths: [] };
	}

	// Verify vault is in a git repo
	await assertGitRepo(config.vault);
	const gitRoot = await getGitRootForDir(config.vault);
	if (!gitRoot) {
		throw new Error("Vault must be inside a git repository for auto-commit.");
	}

	const realGitRoot = fs.realpathSync(gitRoot);

	// Normalize paths relative to git root (handles vault subdir case)
	const normalizedPaths = Array.from(
		new Set(
			paths.map((p) => {
				const resolved = resolveVaultPath(config.vault, p);
				// Use path.resolve instead of realpath for deleted files
				const absolute = fs.existsSync(resolved.absolute)
					? fs.realpathSync(resolved.absolute)
					: path.resolve(resolved.absolute);
				return path.relative(realGitRoot, absolute);
			}),
		),
	).filter(Boolean);

	if (normalizedPaths.length === 0) {
		return { committed: false, skipped: false, message: "", paths: [] };
	}

	// Stage files and commit
	await gitAdd(gitRoot, normalizedPaths);

	// Build commit message from template
	const template =
		config.gitCommitMessageTemplate ?? "docs: para-obsidian {summary}";
	const message = template
		.replace("{summary}", summary)
		.replace("{files}", normalizedPaths.join(", "));

	const { committed } = await gitCommit(gitRoot, message);
	return { committed, skipped: false, message, paths: normalizedPaths };
}

/**
 * Extracts linked attachments from a note.
 *
 * Reads the note content and extracts embedded image/file links:
 * - Wikilinks: ![[image.png]]
 * - Markdown: ![](path/to/file.pdf)
 *
 * Resolves paths relative to vault and returns array of vault-relative
 * paths to existing attachments. Skips .md files (those are notes, not attachments).
 *
 * @param vault - Absolute path to vault root
 * @param notePath - Vault-relative path to note
 * @returns Array of vault-relative paths to existing attachments
 *
 * @example
 * ```typescript
 * const attachments = extractLinkedAttachments(vault, 'Projects/My Project.md');
 * // Returns: ['Projects/assets/diagram.png', 'Resources/document.pdf']
 * ```
 */
export function extractLinkedAttachments(
	vault: string,
	notePath: string,
): string[] {
	const { absolute } = resolveVaultPath(vault, notePath);
	if (!fs.existsSync(absolute)) return [];

	const content = fs.readFileSync(absolute, "utf-8");
	const noteDir = path.dirname(absolute);
	const attachments: string[] = [];

	// Match wikilink embeds: ![[file.ext]]
	const wikilinkRegex = /!\[\[([^\]]+)\]\]/g;
	let match: RegExpExecArray | null = wikilinkRegex.exec(content);
	while (match !== null) {
		const linkPath = match[1];
		if (linkPath && !linkPath.endsWith(".md")) {
			// Try resolving relative to note directory first
			const resolved = path.resolve(noteDir, linkPath);
			if (fs.existsSync(resolved)) {
				const vaultRelative = path.relative(vault, resolved);
				attachments.push(vaultRelative);
			}
		}
		match = wikilinkRegex.exec(content);
	}

	// Match markdown embeds: ![alt](path/to/file.ext)
	const markdownRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
	match = markdownRegex.exec(content);
	while (match !== null) {
		const linkPath = match[2];
		if (linkPath && !linkPath.endsWith(".md")) {
			// Try resolving relative to note directory
			const resolved = path.resolve(noteDir, linkPath);
			if (fs.existsSync(resolved)) {
				const vaultRelative = path.relative(vault, resolved);
				attachments.push(vaultRelative);
			}
		}
		match = markdownRegex.exec(content);
	}

	// Deduplicate and return
	return Array.from(new Set(attachments));
}

/**
 * Result from committing a single note.
 */
export interface CommitNoteResult {
	/** Whether commit was successful */
	committed: boolean;
	/** Commit message used */
	message: string;
	/** Files included in commit (note + attachments) */
	files: string[];
}

/**
 * Commits a single note with its linked attachments.
 *
 * Discovers attachments using:
 * 1. extractLinkedAttachments (embedded links in note content)
 * 2. discoverAttachments (folder-based discovery from attachments.ts)
 *
 * Stages the note and all discovered attachments, then commits with
 * message: `chore: <note title>` (title from filename without .md).
 *
 * @param config - Para-obsidian configuration
 * @param notePath - Vault-relative path to .md file
 * @returns Commit result with status, message, and files
 *
 * @example
 * ```typescript
 * const result = await commitNote(config, 'Projects/My Project.md');
 * if (result.committed) {
 *   console.log(`Committed ${result.files.length} files`);
 * }
 * ```
 */
export async function commitNote(
	config: ParaObsidianConfig,
	notePath: string,
): Promise<CommitNoteResult> {
	return observe(
		gitLogger,
		"git:commitNote",
		async () => {
			await assertGitRepo(config.vault);
			const gitRoot = await getGitRootForDir(config.vault);
			if (!gitRoot) {
				throw new Error("Vault must be inside a git repository.");
			}

			// Discover attachments using both methods
			const linkedAttachments = extractLinkedAttachments(
				config.vault,
				notePath,
			);
			const folderAttachments = discoverAttachments(config.vault, notePath);
			const allAttachments = Array.from(
				new Set([...linkedAttachments, ...folderAttachments]),
			);

			// Resolve paths relative to git root
			const realGitRoot = fs.realpathSync(gitRoot);
			const realVaultPath = fs.realpathSync(config.vault);
			const filesToCommit: string[] = [];

			// Add the note itself (handle deleted files that don't exist on disk)
			const noteResolved = resolveVaultPath(config.vault, notePath);
			const noteAbsolute = fs.existsSync(noteResolved.absolute)
				? fs.realpathSync(noteResolved.absolute)
				: path.resolve(realVaultPath, noteResolved.relative);
			filesToCommit.push(path.relative(realGitRoot, noteAbsolute));

			// Add all attachments
			for (const attachment of allAttachments) {
				const attachmentResolved = resolveVaultPath(config.vault, attachment);
				if (fs.existsSync(attachmentResolved.absolute)) {
					const attachmentAbsolute = fs.realpathSync(
						attachmentResolved.absolute,
					);
					filesToCommit.push(path.relative(realGitRoot, attachmentAbsolute));
				}
			}

			// Stage files - handle existing vs deleted separately
			const existingFiles: string[] = [];
			const filesToDelete: string[] = [];

			for (const relativePath of filesToCommit) {
				const absolute = path.join(realGitRoot, relativePath);
				if (fs.existsSync(absolute)) {
					existingFiles.push(relativePath);
				} else {
					// File doesn't exist - check if it's already staged for deletion
					const alreadyStaged = await isStagedForDeletion(
						gitRoot,
						relativePath,
					);
					if (alreadyStaged) {
						// Already staged, nothing to do
						continue;
					}

					// Check if it's tracked (needs git rm) or never existed (error)
					const isTracked = await isTrackedByGit(gitRoot, relativePath);
					if (isTracked) {
						filesToDelete.push(relativePath);
					} else {
						throw new Error(
							`Cannot commit: note does not exist. Ask the user to check their vault. DO NOT debug with git commands.`,
						);
					}
				}
			}

			// Stage existing files (new + modified)
			if (existingFiles.length > 0) {
				await gitAdd(gitRoot, existingFiles);
			}

			// Stage deletions
			for (const filePath of filesToDelete) {
				await gitRm(gitRoot, filePath);
			}

			// Build commit message from note title (filename without .md)
			const title = path.basename(notePath, ".md");
			const message = `docs: ${title}`;

			// Commit
			const { committed } = await gitCommit(gitRoot, message);
			return { committed, message, files: filesToCommit };
		},
		{
			context: {
				vaultPath: config.vault,
				notePath,
			},
		},
	);
}

/**
 * Result from committing all uncommitted notes.
 */
export interface CommitAllResult {
	/** Total number of uncommitted notes found */
	total: number;
	/** Number of notes successfully committed */
	committed: number;
	/** Individual commit results for each note */
	results: CommitNoteResult[];
}

/**
 * Commits all uncommitted .md files in the vault.
 *
 * Gets all uncommitted .md files and calls commitNote for each.
 * Each note is committed individually with its own commit message
 * and discovered attachments.
 *
 * @param config - Para-obsidian configuration
 * @returns Summary of commits (total, committed count, individual results)
 *
 * @example
 * ```typescript
 * const result = await commitAllNotes(config);
 * console.log(`Committed ${result.committed} of ${result.total} notes`);
 * ```
 */
export async function commitAllNotes(
	config: ParaObsidianConfig,
): Promise<CommitAllResult> {
	return observe(
		gitLogger,
		"git:commitAllNotes",
		async () => {
			const allUncommitted = await getUncommittedFiles(config.vault);

			// Filter to only PARA-managed folders
			const managedFolders = getManagedFolders(config);
			const uncommitted = allUncommitted.filter((file) =>
				isInManagedFolder(file, managedFolders),
			);

			const results: CommitNoteResult[] = [];
			let committedCount = 0;

			for (const notePath of uncommitted) {
				const result = await commitNote(config, notePath);
				results.push(result);
				if (result.committed) {
					committedCount++;
				}
			}

			return {
				total: uncommitted.length,
				committed: committedCount,
				results,
			};
		},
		{
			context: {
				vaultPath: config.vault,
			},
		},
	);
}
