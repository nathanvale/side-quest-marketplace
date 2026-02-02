/**
 * Shared types for the git worktree CLI.
 *
 * Defines the `.worktrees.json` config schema and all command output types.
 *
 * @module worktree/types
 */

/** Schema for `.worktrees.json` config file at repo root. */
export interface WorktreeConfig {
	/** Directory where worktrees are created, relative to repo root. */
	readonly directory: string;
	/** Glob patterns for files/dirs to copy from main worktree. */
	readonly copy: readonly string[];
	/** Directory names to exclude during recursive copy. */
	readonly exclude: readonly string[];
	/** Shell command to run after worktree creation (e.g., "bun install"). */
	readonly postCreate: string | null;
	/** Shell command to run before worktree deletion. */
	readonly preDelete: string | null;
	/** Branch name template with {type} and {description} placeholders. */
	readonly branchTemplate: string;
}

/** Output from `worktree list`. */
export interface WorktreeInfo {
	/** Git branch name. */
	readonly branch: string;
	/** Absolute path to the worktree directory. */
	readonly path: string;
	/** Short commit SHA at HEAD. */
	readonly head: string;
	/** Whether the worktree has uncommitted changes. */
	readonly dirty: boolean;
	/** Whether the branch is merged into the main branch. */
	readonly merged: boolean;
	/** Whether this is the main (bare) worktree. */
	readonly isMain: boolean;
}

/** Output from `worktree create`. */
export interface CreateResult {
	/** Branch name that was created/checked out. */
	readonly branch: string;
	/** Absolute path to the new worktree. */
	readonly path: string;
	/** Number of files copied from the main worktree. */
	readonly filesCopied: number;
	/** Output from the postCreate command, if any. */
	readonly postCreateOutput: string | null;
	/** Whether the config was auto-detected (no .worktrees.json). */
	readonly configAutoDetected: boolean;
}

/** Output from `worktree delete`. */
export interface DeleteResult {
	/** Branch name that was removed. */
	readonly branch: string;
	/** Path that was removed. */
	readonly path: string;
	/** Whether the git branch was also deleted. */
	readonly branchDeleted: boolean;
}
