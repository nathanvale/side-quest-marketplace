/**
 * Execution Module Types
 *
 * Types used during inbox suggestion execution:
 * - Configuration for execution
 * - Execution context with vault paths
 * - Result types for individual operations
 *
 * @module inbox/execute/types
 */

/**
 * Configuration for executing a suggestion
 */
export interface ExecutionConfig {
	/** Absolute path to vault root */
	vaultPath: string;
	/** Relative path to inbox folder */
	inboxFolder: string;
	/** Relative path to attachments folder */
	attachmentsFolder: string;
	/** Relative path to templates folder */
	templatesFolder: string;
}

/**
 * Extended execution context with registry and correlation ID
 */
export interface ExecutionContext extends ExecutionConfig {
	/** Registry instance for tracking processed items */
	registry: ReturnType<typeof import("../registry").createRegistry>;
	/** Correlation ID for logging */
	cid: string;
	/** Session correlation ID for distributed tracing */
	sessionCid?: string;
}

/**
 * Result of moving an attachment
 */
export interface AttachmentMoveResult {
	/** Success flag */
	success: boolean;
	/** Error message if failed */
	error?: string;
	/** Final destination path (vault-relative) */
	movedTo?: string;
	/** Hash of the file */
	hash?: string;
}

/**
 * Result of creating a note from template
 */
export interface NoteCreationResult {
	/** Success flag */
	success: boolean;
	/** Error message if failed */
	error?: string;
	/** Path to created note (vault-relative) */
	notePath?: string;
}

/**
 * Result of injecting attachment link
 */
export interface AttachmentLinkResult {
	/** Success flag */
	success: boolean;
	/** Error message if failed */
	error?: string;
	/** Warning messages (non-fatal) */
	warnings?: string[];
}
