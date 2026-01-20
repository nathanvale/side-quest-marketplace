/**
 * Type definitions for Teams chat scraping and persistence.
 *
 * @module teams-scrape/types
 */

/**
 * A single message extracted from Microsoft Teams chat.
 */
export interface TeamsMessage {
	/** Generated stable hash ID for deduplication (hash of author + timestamp + content prefix) */
	id: string;
	/** Message author's display name */
	author: string;
	/** Message timestamp in ISO 8601 format */
	timestamp: string;
	/** Message content (may span multiple lines) */
	content: string;
	/** Reply context if this message is a reply */
	replyTo?: {
		/** Original message author */
		author: string;
		/** Preview snippet of the original message */
		preview: string;
	};
	/** Reactions on this message */
	reactions?: {
		/** Emoji character */
		emoji: string;
		/** Number of this reaction */
		count: number;
		/** Reaction name (e.g., "like", "heart") */
		name: string;
	}[];
	/** Attachments on this message */
	attachments?: {
		/** Attachment type */
		type: "gif" | "image" | "file" | "url" | "loop";
		/** Attachment name or filename */
		name?: string;
		/** URL for URL-type attachments */
		url?: string;
	}[];
	/** Mentioned users in this message */
	mentions?: string[];
	/** Whether this message has been edited */
	edited?: boolean;
}

/**
 * Stored chat history for a specific target (person or channel).
 */
export interface StoredChat {
	/** Original target name (person or channel) */
	target: string;
	/** Kebab-case filename slug derived from target */
	targetSlug: string;
	/** ISO 8601 timestamp of last scrape */
	lastScrapedAt: string;
	/** Total number of messages stored */
	messageCount: number;
	/** All captured messages, sorted by timestamp */
	messages: TeamsMessage[];
}

/**
 * Result of a scrape operation, including diff information.
 */
export interface ScrapeResult {
	/** Target name that was scraped */
	target: string;
	/** ISO 8601 timestamp when capture occurred */
	capturedAt: string;
	/** Whether this is the first scrape for this target */
	isNewScrape: boolean;
	/** Total messages after merge */
	totalMessages: number;
	/** Messages that are new since last scrape */
	newMessages: TeamsMessage[];
	/** Path to the storage file */
	storagePath: string;
}

/**
 * CLI command types for the teams-scrape tool.
 */
export type CliCommand = "process" | "load" | "list";

/**
 * Output from the list command showing all stored chats.
 */
export interface ListResult {
	/** Total number of stored chats */
	count: number;
	/** Individual chat summaries */
	chats: {
		/** Target name */
		target: string;
		/** Number of messages */
		messageCount: number;
		/** Last scrape timestamp */
		lastScrapedAt: string;
		/** Storage file path */
		filePath: string;
	}[];
}
