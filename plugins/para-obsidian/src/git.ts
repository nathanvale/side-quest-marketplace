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

import { spawnAndCollect } from "../../../core/src/spawn/index.js";
import { discoverAttachments } from "./attachments";
import type { ParaObsidianConfig } from "./config";
import { resolveVaultPath } from "./fs";

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
 * This is a safety guard to ensure write operations are version
 * controlled. Throws if the directory is not in a git repo.
 *
 * @param dir - Directory to check
 * @throws Error if directory is not inside a git repository
 *
 * @example
 * ```typescript
 * await assertGitRepo(config.vault);
 * // Proceed with write operations...
 * ```
 */
export async function assertGitRepo(dir: string): Promise<void> {
	const root = await getGitRootForDir(dir);
	if (!root) {
		throw new Error("Vault must be inside a git repository for writes.");
	}

	// Verify the directory is actually under the git root (handles symlinks)
	const realRoot = fs.existsSync(root)
		? fs.realpathSync(root)
		: path.resolve(root);
	const realDir = fs.existsSync(dir) ? fs.realpathSync(dir) : path.resolve(dir);
	if (!realDir.startsWith(realRoot)) {
		throw new Error("Vault must be inside a git repository for writes.");
	}
}

/**
 * Checks the git status of a directory.
 *
 * @param dir - Directory to check
 * @returns Object with clean status (true if no uncommitted changes)
 * @throws Error if git status command fails
 *
 * @example
 * ```typescript
 * const { clean } = await gitStatus(config.vault);
 * if (!clean) {
 *   console.warn('Warning: uncommitted changes in vault');
 * }
 * ```
 */
export async function gitStatus(dir: string): Promise<{ clean: boolean }> {
	const { stdout, exitCode } = await spawnAndCollect(
		["git", "status", "--porcelain"],
		{ cwd: dir },
	);
	if (exitCode !== 0) throw new Error("git status failed");
	const output = stdout.trim();
	return { clean: output.length === 0 };
}

/**
 * Gets all uncommitted files in a directory (staged and unstaged).
 *
 * Uses git status --porcelain to find modified, added, and untracked files.
 * Filters to only .md files and returns vault-relative paths.
 *
 * @param dir - Directory to check
 * @returns Array of vault-relative paths to uncommitted .md files
 *
 * @example
 * ```typescript
 * const uncommitted = await getUncommittedFiles(config.vault);
 * // Returns: ['Projects/My Project.md', '00_Inbox/New Note.md']
 * ```
 */
export async function getUncommittedFiles(dir: string): Promise<string[]> {
	const { stdout, exitCode } = await spawnAndCollect(
		["git", "status", "--porcelain", "-uall"],
		{ cwd: dir },
	);
	if (exitCode !== 0) throw new Error("git status failed");

	// Split first, then filter empty lines
	// Important: Don't trim() the whole stdout as it strips leading spaces
	// from git status format (e.g., " M file.md" becomes "M file.md")
	const lines = stdout.split("\n").filter((line) => line.length > 0);
	const files: string[] = [];

	for (const line of lines) {
		// Porcelain format: XY PATH (2 status chars + 1 space + path)
		// X = index status, Y = working tree status
		// Status codes: M (modified), A (added), ?? (untracked), etc.
		// Extract path after the "XY " prefix (3 chars)
		// Use match to handle any leading whitespace/status combo
		const match = line.match(/^.{2}\s(.+)$/);
		let filePath = match?.[1];
		// Git quotes filenames containing spaces, e.g. "Note 1.md"
		// Strip surrounding quotes if present
		if (filePath?.startsWith('"') && filePath.endsWith('"')) {
			filePath = filePath.slice(1, -1);
		}
		if (filePath?.endsWith(".md")) {
			files.push(filePath);
		}
	}

	return files;
}

/**
 * Ensures the vault is inside a git repository and optionally clean.
 *
 * Throws if the vault is not in a git repo or has uncommitted changes.
 *
 * @param config - Loaded para-obsidian configuration
 * @throws Error when guard conditions are not met
 */
export async function ensureGitGuard(
	config: ParaObsidianConfig,
): Promise<void> {
	await assertGitRepo(config.vault);
	const status = await gitStatus(config.vault);
	if (!status.clean) {
		const uncommitted = await getUncommittedFiles(config.vault);
		const fileList =
			uncommitted.length > 0
				? `\nUncommitted files:\n${uncommitted.map((f: string) => `  - ${f}`).join("\n")}`
				: "";
		throw new Error(
			`Vault has uncommitted changes. Commit or stash before writing.${fileList}\n\nSuggestion: Run 'para-obsidian git commit'`,
		);
	}
}

/**
 * Stages files for commit.
 *
 * @param dir - Git repository directory
 * @param paths - Paths to stage (relative to git root)
 * @throws Error if git add fails
 */
export async function gitAdd(dir: string, paths: string[]): Promise<void> {
	const { exitCode, stderr } = await spawnAndCollect(["git", "add", ...paths], {
		cwd: dir,
	});
	if (exitCode !== 0) {
		throw new Error(`git add failed: ${stderr}`);
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
	const { exitCode } = await spawnAndCollect(["git", "commit", "-m", message], {
		cwd: dir,
	});
	// Non-zero exit code when nothing to commit is expected
	return { committed: exitCode === 0 };
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
				const absolute = fs.realpathSync(resolved.absolute);
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
		config.gitCommitMessageTemplate ?? "chore: para-obsidian {summary}";
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
	await assertGitRepo(config.vault);
	const gitRoot = await getGitRootForDir(config.vault);
	if (!gitRoot) {
		throw new Error("Vault must be inside a git repository.");
	}

	// Discover attachments using both methods
	const linkedAttachments = extractLinkedAttachments(config.vault, notePath);
	const folderAttachments = discoverAttachments(config.vault, notePath);
	const allAttachments = Array.from(
		new Set([...linkedAttachments, ...folderAttachments]),
	);

	// Resolve paths relative to git root
	const realGitRoot = fs.realpathSync(gitRoot);
	const filesToCommit: string[] = [];

	// Add the note itself
	const noteResolved = resolveVaultPath(config.vault, notePath);
	const noteAbsolute = fs.realpathSync(noteResolved.absolute);
	filesToCommit.push(path.relative(realGitRoot, noteAbsolute));

	// Add all attachments
	for (const attachment of allAttachments) {
		const attachmentResolved = resolveVaultPath(config.vault, attachment);
		if (fs.existsSync(attachmentResolved.absolute)) {
			const attachmentAbsolute = fs.realpathSync(attachmentResolved.absolute);
			filesToCommit.push(path.relative(realGitRoot, attachmentAbsolute));
		}
	}

	// Stage files
	await gitAdd(gitRoot, filesToCommit);

	// Build commit message from note title (filename without .md)
	const title = path.basename(notePath, ".md");
	const message = `chore: ${title}`;

	// Commit
	const { committed } = await gitCommit(gitRoot, message);
	return { committed, message, files: filesToCommit };
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
	const uncommitted = await getUncommittedFiles(config.vault);
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
}
