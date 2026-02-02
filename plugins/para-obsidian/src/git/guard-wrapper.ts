/**
 * Para-obsidian wrapper around core git guard utilities.
 *
 * Wraps @sidequest/core/git guard functions with para-obsidian's
 * instrumentation layer (observe() and gitLogger).
 */

import {
	type GetUncommittedFilesOptions as CoreGetUncommittedFilesOptions,
	type GitGuardOptions as CoreGitGuardOptions,
	assertGitRepo as coreAssertGitRepo,
	ensureGitGuard as coreEnsureGitGuard,
	getUncommittedFiles as coreGetUncommittedFiles,
	gitStatus as coreGitStatus,
} from "@side-quest/core/git";
import type { ParaObsidianConfig } from "../config/index.js";
import { getManagedFolders } from "../shared/folders.js";
import { observe } from "../shared/instrumentation.js";
import { gitLogger } from "../shared/logger.js";

/**
 * Git guard logger adapter for core.
 *
 * Converts para-obsidian's tagged template literal logger to the
 * core's Record<string, unknown> logger interface.
 */
const guardLogger = {
	debug: (message: string, context?: Record<string, unknown>) => {
		if (context) {
			gitLogger.debug`${message} ${context}`;
		} else {
			gitLogger.debug`${message}`;
		}
	},
	info: (message: string, context?: Record<string, unknown>) => {
		if (context) {
			gitLogger.info`${message} ${context}`;
		} else {
			gitLogger.info`${message}`;
		}
	},
	error: (message: string, context?: Record<string, unknown>) => {
		if (context) {
			gitLogger.error`${message} ${context}`;
		} else {
			gitLogger.error`${message}`;
		}
	},
};

/**
 * Asserts that a directory is inside a git repository.
 *
 * Delegates to core implementation, no instrumentation needed
 * (fast operation, errors are self-explanatory).
 */
export async function assertGitRepo(dir: string): Promise<void> {
	return coreAssertGitRepo(dir);
}

/**
 * Checks the git status of a directory.
 *
 * Wraps core implementation with observe() for performance tracking.
 */
export async function gitStatus(dir: string): Promise<{ clean: boolean }> {
	return observe(gitLogger, "git:getRepoStatus", async () => {
		return coreGitStatus(dir, guardLogger);
	});
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
 * Wraps core implementation with observe() for performance tracking.
 */
export async function getUncommittedFiles(
	dir: string,
	options?: GetUncommittedFilesOptions,
): Promise<string[]> {
	return observe(
		gitLogger,
		"git:getUncommittedFiles",
		async () => {
			const coreOptions: CoreGetUncommittedFilesOptions = {
				dir,
				allFileTypes: options?.allFileTypes,
				logger: guardLogger,
			};
			return coreGetUncommittedFiles(coreOptions);
		},
		{
			context: {
				repoPath: dir,
				allFileTypes: options?.allFileTypes ?? false,
			},
		},
	);
}

/**
 * Ensures the vault is inside a git repository and has no uncommitted
 * changes in PARA-managed folders.
 *
 * Only checks folders managed by para-obsidian (00 Inbox, 01 Projects, etc.).
 * Files outside PARA folders (Templates/, _Sort/, etc.) are ignored.
 *
 * Wraps core implementation with para-obsidian specific logic:
 * - Managed folder detection via getManagedFolders()
 * - excludeInbox / excludeAttachments options
 * - Custom error messages with para-specific guidance
 *
 * @param config - Loaded para-obsidian configuration
 * @param options - Optional settings
 * @param options.checkAllFileTypes - If true, check all file types (not just .md). Default: false
 * @param options.excludeInbox - If true, exclude inbox folder from checks. Default: false
 * @param options.excludeAttachments - If true, exclude attachments folder from checks. Default: false
 * @throws Error when guard conditions are not met
 */
export async function ensureGitGuard(
	config: ParaObsidianConfig,
	options?: {
		checkAllFileTypes?: boolean;
		excludeInbox?: boolean;
		excludeAttachments?: boolean;
	},
): Promise<void> {
	return observe(
		gitLogger,
		"git:ensureGitGuard",
		async () => {
			const checkAllTypes = options?.checkAllFileTypes ?? false;
			const excludeInbox = options?.excludeInbox ?? false;
			const excludeAttachments = options?.excludeAttachments ?? false;

			// Get managed folders and apply exclusions
			const managedFolders = getManagedFolders(config);
			const inboxFolder = config.paraFolders?.inbox ?? "00 Inbox";
			const attachmentsFolder = "Attachments";
			const foldersToCheck = new Set([...managedFolders]);

			if (excludeInbox) {
				foldersToCheck.delete(inboxFolder);
			}
			if (excludeAttachments) {
				foldersToCheck.delete(attachmentsFolder);
			}

			// Convert to core options
			const coreOptions: CoreGitGuardOptions = {
				dir: config.vault,
				managedFolders: foldersToCheck,
				checkAllFileTypes: checkAllTypes,
				logger: guardLogger,
			};

			try {
				await coreEnsureGitGuard(coreOptions);
			} catch (error) {
				// Enhance error with para-obsidian specific guidance
				if (error instanceof Error) {
					const enhancedMessage = `${error.message}\n\nTo fix: Use para_commit MCP tool\n\nDO NOT use raw git commands or inspect the vault directly.`;
					throw new Error(enhancedMessage);
				}
				throw error;
			}
		},
		{
			context: {
				vaultPath: config.vault,
				checkAllFileTypes: options?.checkAllFileTypes ?? false,
				excludeInbox: options?.excludeInbox ?? false,
				excludeAttachments: options?.excludeAttachments ?? false,
			},
		},
	);
}
