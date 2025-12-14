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
import { pathExistsSync } from "@sidequest/core/fs";
import { spawnAndCollect } from "@sidequest/core/spawn";
import { discoverAttachments } from "../attachments/index";
import { DEFAULT_DESTINATIONS, DEFAULT_PARA_FOLDERS } from "../config/defaults";
import type { ParaObsidianConfig } from "../config/index";
import { resolveVaultPath } from "../shared/fs";

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
 * Gets all PARA-managed folders from configuration.
 *
 * Combines folders from:
 * - paraFolders (inbox, projects, areas, resources, archives)
 * - defaultDestinations (Tasks, Daily Notes, Weekly Notes, etc.)
 *
 * @param config - Para-obsidian configuration
 * @returns Set of unique folder names that para-obsidian manages
 *
 * @example
 * ```typescript
 * const folders = getManagedFolders(config);
 * // Set { "00 Inbox", "01 Projects", "02 Areas", "Tasks", ... }
 * ```
 */
export function getManagedFolders(config: ParaObsidianConfig): Set<string> {
	const folders = new Set<string>();

	// Add PARA folders (inbox, projects, areas, resources, archives)
	const paraFolders = config.paraFolders ?? DEFAULT_PARA_FOLDERS;
	for (const folder of Object.values(paraFolders)) {
		folders.add(folder);
	}

	// Add destination folders (Tasks, Daily Notes, Weekly Notes, etc.)
	const destinations = config.defaultDestinations ?? DEFAULT_DESTINATIONS;
	for (const folder of Object.values(destinations)) {
		folders.add(folder);
	}

	return folders;
}

/**
 * Checks if a file path is within a PARA-managed folder.
 *
 * @param filePath - Vault-relative file path
 * @param managedFolders - Set of managed folder names
 * @returns true if file is in a managed folder
 */
export function isInManagedFolder(
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
	// Use realpathSync to resolve symlinks (e.g., /var -> /private/var on macOS)
	const realRoot = pathExistsSync(root) ? fs.realpathSync(root) : root;
	const realDir = pathExistsSync(dir) ? fs.realpathSync(dir) : dir;
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
 * Options for getting uncommitted files.
 */
export interface GetUncommittedFilesOptions {
	/** If true, return all file types. If false (default), return only .md files. */
	readonly allFileTypes?: boolean;
}

/**
 * Gets all uncommitted files in a directory (staged and unstaged).
 *
 * Uses git status --porcelain to find modified, added, and untracked files.
 * By default, filters to only .md files. Use `allFileTypes: true` to include all files.
 *
 * @param dir - Directory to check
 * @param options - Options for filtering files
 * @returns Array of vault-relative paths to uncommitted files
 *
 * @example
 * ```typescript
 * // Get only markdown files (default)
 * const mdFiles = await getUncommittedFiles(config.vault);
 * // Returns: ['Projects/My Project.md', '00_Inbox/New Note.md']
 *
 * // Get all file types
 * const allFiles = await getUncommittedFiles(config.vault, { allFileTypes: true });
 * // Returns: ['Projects/My Project.md', '00_Inbox/doc.pdf', '00_Inbox/data.json']
 * ```
 */
export async function getUncommittedFiles(
	dir: string,
	options?: GetUncommittedFilesOptions,
): Promise<string[]> {
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
	const allFileTypes = options?.allFileTypes ?? false;

	for (const line of lines) {
		// Porcelain format: XY PATH (2 status chars + 1 space + path)
		// X = index status, Y = working tree status
		// Status codes: M (modified), A (added), ?? (untracked), etc.
		// Extract path after the "XY " prefix (3 chars)
		// Use match to handle any leading whitespace/status combo
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

	return files;
}

/**
 * Ensures the vault is inside a git repository and has no uncommitted
 * changes in PARA-managed folders.
 *
 * Only checks folders managed by para-obsidian (00 Inbox, 01 Projects, etc.).
 * Files outside PARA folders (Templates/, _Sort/, etc.) are ignored.
 *
 * @param config - Loaded para-obsidian configuration
 * @param options - Optional settings
 * @param options.checkAllFileTypes - If true, check all file types (not just .md). Default: false
 * @throws Error when guard conditions are not met
 *
 * @example
 * ```typescript
 * // Default: only check .md files
 * await ensureGitGuard(config);
 *
 * // Strict mode: check all file types (PDFs, JSON, etc.)
 * await ensureGitGuard(config, { checkAllFileTypes: true });
 * ```
 */
export async function ensureGitGuard(
	config: ParaObsidianConfig,
	options?: { checkAllFileTypes?: boolean },
): Promise<void> {
	await assertGitRepo(config.vault);

	// Get all uncommitted files and filter to PARA-managed folders only
	const checkAllTypes = options?.checkAllFileTypes ?? false;
	const allUncommitted = await getUncommittedFiles(config.vault, {
		allFileTypes: checkAllTypes,
	});

	const managedFolders = getManagedFolders(config);
	const uncommitted = allUncommitted.filter((file) =>
		isInManagedFolder(file, managedFolders),
	);

	if (uncommitted.length > 0) {
		const fileList = `\nUncommitted files:\n${uncommitted.map((f: string) => `  - ${f}`).join("\n")}`;
		throw new Error(
			`Vault has uncommitted changes in PARA folders. Commit or stash before writing.${fileList}\n\nSuggestion: Run 'para-obsidian git commit'`,
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
	const message = `docs: ${title}`;

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
}
