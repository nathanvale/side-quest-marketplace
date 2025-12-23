/**
 * Routing Module Types
 *
 * Handles moving notes from inbox to PARA destinations based on frontmatter.
 *
 * @module inbox/routing/types
 */

/**
 * Candidate note that can be routed from inbox to PARA folder.
 *
 * A note is routable if it has either `area` or `project` in frontmatter.
 */
export interface RoutingCandidate {
	/** Relative path to note in inbox (e.g., "00 Inbox/My Note.md") */
	readonly path: string;

	/** Note title from frontmatter */
	readonly title: string;

	/** Note type from frontmatter (e.g., "bookmark", "invoice") */
	readonly type?: string;

	/** Area from frontmatter (wikilink format: "[[Health]]") */
	readonly area?: string;

	/** Project from frontmatter (wikilink format: "[[Project Alpha]]") */
	readonly project?: string;

	/** Resolved destination path (e.g., "01 Projects/Project Alpha") */
	readonly destination: string;

	/**
	 * Information about folder colocatation needed for file-only areas/projects.
	 * When an area/project is a standalone .md file (not a folder), we need to:
	 * 1. Create a folder with that name
	 * 2. Move the area/project note into it
	 * 3. Then move the inbox note alongside it
	 */
	readonly colocate?: {
		/** The area/project note file to move (vault-relative path) */
		readonly sourceNotePath: string;
		/** The folder to create */
		readonly folderPath: string;
	};
}

/**
 * Result of moving a single note.
 */
export interface RoutingResult {
	/** Whether the move succeeded */
	readonly success: boolean;

	/** Source path (vault-relative) */
	readonly movedFrom: string;

	/** Destination path (vault-relative) */
	readonly movedTo: string;

	/** Error message if move failed */
	readonly error?: string;
}

/**
 * Result of scanning inbox for routable notes.
 */
export interface RoutingScanResult {
	/** Notes that can be routed (have area or project) */
	readonly candidates: RoutingCandidate[];

	/** Notes that were skipped and why */
	readonly skipped: ReadonlyArray<{ path: string; reason: string }>;
}
