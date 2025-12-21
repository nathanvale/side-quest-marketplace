/**
 * VaultSession - Abstracts git operations from users.
 *
 * This module provides session-based git management that:
 * - Silently pre-commits existing uncommitted files before operations
 * - Tracks changes during a session
 * - Batches commits at session end for clean history
 * - Gracefully degrades if git operations fail (logs warning, continues)
 *
 * Users never see git errors - the CLI "just works".
 *
 * @module git/session
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ParaObsidianConfig } from "../config/index";
import { withFileLock } from "../shared/file-lock";
import { gitLogger } from "../shared/logger";
import {
	assertGitRepo,
	getManagedFolders,
	getUncommittedFiles,
	gitAdd,
	gitCommit,
	isInManagedFolder,
} from "./index";

// =============================================================================
// Types
// =============================================================================

/**
 * Result from ensuring clean state before a session.
 */
export interface PreCommitResult {
	/** Whether files were pre-committed */
	readonly preCommitted: boolean;
	/** Files that were committed (empty if none or failed) */
	readonly files: readonly string[];
	/** Warning message if pre-commit failed (operation continues) */
	readonly warning?: string;
}

/**
 * Result from finalizing a session (batch commit).
 */
export interface SessionCommitResult {
	/** Whether commit was successful */
	readonly committed: boolean;
	/** Commit message used */
	readonly message: string;
	/** Files included in commit */
	readonly files: readonly string[];
	/** Warning if commit failed */
	readonly warning?: string;
}

/**
 * A vault session tracks changes during a CLI command.
 */
export interface VaultSession {
	/** Unique session identifier */
	readonly id: string;
	/** When session started */
	readonly startedAt: Date;
	/** Files modified during this session */
	readonly modifiedFiles: Set<string>;
	/** Files pre-committed at session start */
	readonly preCommittedFiles: readonly string[];
	/** Whether session has been finalized */
	finalized: boolean;
	/** Vault path for this session */
	readonly vaultPath: string;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Generate a short session ID.
 */
function generateSessionId(): string {
	return crypto.randomUUID().slice(0, 8);
}

/**
 * Gets the git repository root for a given directory.
 */
async function getGitRoot(dir: string): Promise<string | null> {
	const { spawnAndCollect } = await import("@sidequest/core/spawn");
	const { stdout, exitCode } = await spawnAndCollect(
		["git", "rev-parse", "--show-toplevel"],
		{ cwd: dir },
	);
	if (exitCode !== 0) return null;
	return stdout.trim() || null;
}

// =============================================================================
// Pre-Session: Silent Pre-Commit
// =============================================================================

/**
 * Silently commits existing uncommitted PARA files before a session.
 *
 * This ensures any previous work is saved before new operations.
 * Never throws - logs warnings and continues on failure.
 *
 * @param config - Para-obsidian configuration with vault path
 * @returns Result with pre-commit status and files
 *
 * @example
 * ```typescript
 * const result = await ensureCleanState(config);
 * if (result.preCommitted) {
 *   console.log(`Auto-saved ${result.files.length} files`);
 * }
 * if (result.warning) {
 *   console.warn(result.warning);
 * }
 * // Continue with operation - never blocks
 * ```
 */
export async function ensureCleanState(
	config: Pick<
		ParaObsidianConfig,
		"vault" | "paraFolders" | "defaultDestinations"
	>,
): Promise<PreCommitResult> {
	if (gitLogger) {
		gitLogger.debug`Checking for uncommitted PARA files vault=${config.vault}`;
	}

	// Check if in a git repo - gracefully handle non-git vaults
	try {
		await assertGitRepo(config.vault);
	} catch {
		if (gitLogger) {
			gitLogger.debug`Vault is not in a git repo - skipping pre-commit`;
		}
		return { preCommitted: false, files: [] };
	}

	const gitRoot = await getGitRoot(config.vault);
	if (!gitRoot) {
		if (gitLogger) {
			gitLogger.debug`Could not determine git root - skipping pre-commit`;
		}
		return { preCommitted: false, files: [] };
	}

	// Get uncommitted files (all types to include attachments, PDFs, etc.)
	let allUncommitted: string[];
	try {
		allUncommitted = await getUncommittedFiles(config.vault, {
			allFileTypes: true,
		});
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		if (gitLogger) {
			gitLogger.warn`Failed to get uncommitted files (continuing): ${msg}`;
		}
		return { preCommitted: false, files: [], warning: msg };
	}

	// Filter to PARA-managed folders only
	const managedFolders = getManagedFolders(config);
	const paraFiles = allUncommitted.filter((f) =>
		isInManagedFolder(f, managedFolders),
	);

	if (paraFiles.length === 0) {
		if (gitLogger) {
			gitLogger.debug`Vault is clean, no pre-commit needed`;
		}
		return { preCommitted: false, files: [] };
	}

	if (gitLogger) {
		gitLogger.info`Found ${paraFiles.length} uncommitted PARA files, auto-saving`;
		gitLogger.debug`Files to pre-commit: ${paraFiles.slice(0, 5).join(", ")}${paraFiles.length > 5 ? ` (+${paraFiles.length - 5} more)` : ""}`;
	}

	// Convert vault-relative paths to git-root-relative paths
	const realGitRoot = fs.realpathSync(gitRoot);
	const realVault = fs.realpathSync(config.vault);
	const gitRelativePaths = paraFiles.map((p) => {
		const absolute = path.join(realVault, p);
		return path.relative(realGitRoot, absolute);
	});

	try {
		await gitAdd(gitRoot, gitRelativePaths);
		await gitCommit(gitRoot, "chore(para-obsidian): auto-save before session");
		if (gitLogger) {
			gitLogger.info`Pre-commit successful: ${paraFiles.length} files saved`;
		}
		return { preCommitted: true, files: paraFiles };
	} catch (error) {
		// Log warning but DON'T block - user's operation continues
		const msg = error instanceof Error ? error.message : String(error);
		if (gitLogger) {
			gitLogger.warn`Pre-commit failed (continuing anyway): ${msg}`;
		}
		return { preCommitted: false, files: [], warning: msg };
	}
}

// =============================================================================
// Session Management
// =============================================================================

/**
 * Starts a new vault session.
 *
 * Sessions track changes during a CLI command and enable batched commits.
 * Before starting, silently pre-commits any existing uncommitted files.
 *
 * @param config - Para-obsidian configuration
 * @returns New session with pre-commit results
 */
export async function startSession(
	config: Pick<
		ParaObsidianConfig,
		"vault" | "paraFolders" | "defaultDestinations"
	>,
): Promise<VaultSession> {
	const id = generateSessionId();
	if (gitLogger) {
		gitLogger.debug`Starting vault session id=${id}`;
	}

	// Pre-commit existing changes
	const preCommitResult = await ensureCleanState(config);

	const session: VaultSession = {
		id,
		startedAt: new Date(),
		modifiedFiles: new Set(),
		preCommittedFiles: preCommitResult.files,
		finalized: false,
		vaultPath: config.vault,
	};

	if (gitLogger) {
		gitLogger.info`Session ${id} started preCommitted=${preCommitResult.preCommitted} files=${preCommitResult.files.length}`;
	}

	return session;
}

/**
 * Tracks a file change in the current session.
 *
 * **Security**: Uses file locking to prevent concurrent writes corrupting the session state.
 * Multiple async operations may call trackChange concurrently during inbox processing.
 *
 * @param session - Active session
 * @param filePath - Vault-relative path to modified file
 */
export async function trackChange(
	session: VaultSession,
	filePath: string,
): Promise<void> {
	if (session.finalized) {
		if (gitLogger) {
			gitLogger.warn`Attempted to track change on finalized session id=${session.id}`;
		}
		return;
	}

	// File-level locking prevents concurrent modification corruption
	// Multiple suggestions may execute in parallel and track changes simultaneously
	const lockId = `session:${session.id}`;
	await withFileLock(lockId, async () => {
		session.modifiedFiles.add(filePath);
		if (gitLogger) {
			gitLogger.debug`Session ${session.id} tracking: ${filePath}`;
		}
	});
}

/**
 * Finalizes a session by committing all tracked changes.
 *
 * Creates a single commit with all files modified during the session.
 * Never throws - logs warnings and continues on failure.
 *
 * @param session - Session to finalize
 * @param summary - Commit message summary (e.g., "inbox: processed 5 items")
 * @param config - Para-obsidian configuration (for auto-commit setting)
 * @returns Commit result
 */
export async function finalizeSession(
	session: VaultSession,
	summary: string,
	config?: Pick<ParaObsidianConfig, "autoCommit">,
): Promise<SessionCommitResult> {
	if (session.finalized) {
		if (gitLogger) {
			gitLogger.warn`Session ${session.id} already finalized`;
		}
		return { committed: false, message: "", files: [] };
	}

	session.finalized = true;

	// Skip if auto-commit is disabled
	if (config?.autoCommit === false) {
		if (gitLogger) {
			gitLogger.debug`Session ${session.id}: auto-commit disabled, skipping`;
		}
		return { committed: false, message: "", files: [] };
	}

	const files = Array.from(session.modifiedFiles);
	if (files.length === 0) {
		if (gitLogger) {
			gitLogger.debug`Session ${session.id} finalized: no changes to commit`;
		}
		return { committed: false, message: "", files: [] };
	}

	if (gitLogger) {
		gitLogger.info`Session ${session.id} finalizing: ${files.length} files`;
	}

	// Check git repo
	try {
		await assertGitRepo(session.vaultPath);
	} catch {
		if (gitLogger) {
			gitLogger.debug`Vault is not in a git repo - skipping session commit`;
		}
		return { committed: false, message: "", files: [] };
	}

	const gitRoot = await getGitRoot(session.vaultPath);
	if (!gitRoot) {
		if (gitLogger) {
			gitLogger.warn`Could not determine git root - skipping session commit`;
		}
		return { committed: false, message: "", files: [] };
	}

	// Convert vault-relative paths to git-root-relative paths
	const realGitRoot = fs.realpathSync(gitRoot);
	const realVault = fs.realpathSync(session.vaultPath);
	const gitRelativePaths = files.map((p) => {
		const absolute = path.join(realVault, p);
		// Handle deleted files (use resolve instead of realpath)
		if (fs.existsSync(absolute)) {
			return path.relative(realGitRoot, fs.realpathSync(absolute));
		}
		return path.relative(realGitRoot, path.resolve(realVault, p));
	});

	const message = `docs(para-obsidian): ${summary}`;

	try {
		await gitAdd(gitRoot, gitRelativePaths);
		const { committed } = await gitCommit(gitRoot, message);

		if (committed) {
			if (gitLogger) {
				gitLogger.info`Session ${session.id} committed: ${summary}`;
			}
		} else {
			if (gitLogger) {
				gitLogger.debug`Session ${session.id}: nothing to commit (files already committed?)`;
			}
		}

		return { committed, message, files };
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		if (gitLogger) {
			gitLogger.warn`Session ${session.id} commit failed (changes saved to disk): ${msg}`;
		}
		return { committed: false, message: "", files: [], warning: msg };
	}
}

/**
 * Aborts a session without committing.
 *
 * Use this when an operation fails and you don't want to commit partial changes.
 * Note: File changes on disk are NOT rolled back - only the session is abandoned.
 *
 * @param session - Session to abort
 */
export function abortSession(session: VaultSession): void {
	if (session.finalized) {
		if (gitLogger) {
			gitLogger.warn`Session ${session.id} already finalized, cannot abort`;
		}
		return;
	}

	session.finalized = true;
	if (gitLogger) {
		gitLogger.info`Session ${session.id} aborted: ${session.modifiedFiles.size} uncommitted changes`;
	}
}
