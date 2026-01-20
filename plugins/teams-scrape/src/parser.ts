/**
 * Teams clipboard parser.
 *
 * Parses raw text copied from Microsoft Teams chat into structured messages.
 *
 * @module teams-scrape/parser
 */

import { sha256 } from "@sidequest/core/hash";
import type { TeamsMessage } from "./types.js";

/**
 * Pattern to match AU date format: DD/MM/YYYY H:MM am/pm
 */
const AU_DATE_PATTERN =
	/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*([ap]m)$/i;

/**
 * Pattern to match reply reference blocks.
 */
const REPLY_START = "Begin Reference, preview of ";
const REPLY_END = "End Reference";

/**
 * Pattern to extract reply metadata from reference start.
 * "Begin Reference, preview of <message preview> by <author>"
 * Note: [^] matches any character including newlines (JS regex idiom)
 */
const REPLY_METADATA_PATTERN =
	/^Begin Reference, preview of (.+) by ([\s\S]+)$/;

/**
 * Parse Australian date format to ISO 8601.
 *
 * @param dateStr - Date string in DD/MM/YYYY H:MM am/pm format
 * @returns ISO 8601 timestamp string
 */
export function parseAUDateToISO(dateStr: string): string {
	const match = dateStr.trim().match(AU_DATE_PATTERN);
	if (!match) {
		// Return current time if parsing fails
		return new Date().toISOString();
	}

	const day = match[1];
	const month = match[2];
	const year = match[3];
	const hourStr = match[4];
	const minute = match[5];
	const meridiem = match[6];

	// Ensure all parts are defined
	if (!day || !month || !year || !hourStr || !minute || !meridiem) {
		return new Date().toISOString();
	}

	let hour = Number.parseInt(hourStr, 10);

	// Convert to 24-hour format
	if (meridiem.toLowerCase() === "pm" && hour !== 12) {
		hour += 12;
	} else if (meridiem.toLowerCase() === "am" && hour === 12) {
		hour = 0;
	}

	// Construct ISO date (assuming Melbourne/Australia timezone for now)
	const date = new Date(
		Number.parseInt(year, 10),
		Number.parseInt(month, 10) - 1, // Months are 0-indexed
		Number.parseInt(day, 10),
		hour,
		Number.parseInt(minute, 10),
	);

	return date.toISOString();
}

/**
 * Generate a stable message ID for deduplication.
 *
 * Creates a deterministic hash from author, timestamp, and content prefix.
 * This ensures the same message always gets the same ID.
 *
 * @param author - Message author
 * @param timestamp - ISO 8601 timestamp
 * @param content - Message content
 * @returns 12-character hex hash ID
 */
export function generateMessageId(
	author: string,
	timestamp: string,
	content: string,
): string {
	// Use first 100 chars of content to handle minor edits
	const contentPrefix = content.slice(0, 100).trim();
	const hashInput = `${author}|${timestamp}|${contentPrefix}`;
	return sha256(hashInput).slice(0, 12);
}

/**
 * Extract reactions from message content.
 *
 * @param content - Raw message content that may contain reaction blocks
 * @returns Tuple of [clean content, reactions array]
 */
function extractReactions(
	content: string,
): [string, TeamsMessage["reactions"]] {
	const reactions: NonNullable<TeamsMessage["reactions"]> = [];
	let cleanContent = content;

	// Find all reaction patterns at the end of content
	const lines = content.split("\n");
	let i = lines.length - 1;

	while (i >= 0) {
		const line = lines[i]?.trim() ?? "";
		const prevLine = i > 0 ? (lines[i - 1]?.trim() ?? "") : "";

		// Check for reaction pattern: "N emoji-name reactions."
		const reactionMatch = line.match(/^(\d+)\s+(\w+)\s+reactions?\.$/i);
		const countStr = reactionMatch?.[1];
		const nameStr = reactionMatch?.[2];
		if (reactionMatch && countStr && nameStr && prevLine) {
			reactions.unshift({
				emoji: prevLine,
				count: Number.parseInt(countStr, 10),
				name: nameStr.toLowerCase(),
			});
			i -= 2; // Skip both the emoji and count lines
		} else {
			break;
		}
	}

	if (reactions.length > 0) {
		// Rebuild content without reaction lines
		cleanContent = lines.slice(0, i + 1).join("\n");
	}

	return [cleanContent.trim(), reactions.length > 0 ? reactions : undefined];
}

/**
 * Extract reply reference from message content.
 *
 * @param content - Raw message content that may contain reply reference
 * @returns Tuple of [clean content, replyTo object or undefined]
 */
function extractReply(content: string): [string, TeamsMessage["replyTo"]] {
	const beginIndex = content.indexOf(REPLY_START);
	if (beginIndex === -1) {
		return [content, undefined];
	}

	const endIndex = content.indexOf(REPLY_END);
	if (endIndex === -1 || endIndex < beginIndex) {
		return [content, undefined];
	}

	// Extract the reference block
	const referenceBlock = content.slice(beginIndex, endIndex + REPLY_END.length);
	const firstLine = referenceBlock.split("\n")[0];

	// Parse "Begin Reference, preview of <preview> by <author>"
	const match = firstLine?.match(REPLY_METADATA_PATTERN);
	const previewMatch = match?.[1];
	const authorMatch = match?.[2];

	let replyTo: TeamsMessage["replyTo"];
	if (previewMatch && authorMatch) {
		replyTo = {
			preview: previewMatch.trim(),
			author: authorMatch.trim(),
		};
	}

	// Remove the reference block from content
	const cleanContent = (
		content.slice(0, beginIndex) + content.slice(endIndex + REPLY_END.length)
	).trim();

	return [cleanContent, replyTo];
}

/**
 * Extract attachments from message content.
 *
 * @param content - Raw message content that may contain attachment indicators
 * @returns Tuple of [clean content, attachments array]
 */
function extractAttachments(
	content: string,
): [string, TeamsMessage["attachments"]] {
	const attachments: NonNullable<TeamsMessage["attachments"]> = [];
	let cleanContent = content;

	// URL Preview pattern
	const urlPreviewPattern = /Url Preview for (https?:\/\/[^\s]+)/g;
	let match: RegExpExecArray | null;

	// biome-ignore lint/suspicious/noAssignInExpressions: Standard pattern for iterating regex matches
	while ((match = urlPreviewPattern.exec(content)) !== null) {
		attachments.push({
			type: "url",
			url: match[1],
		});
	}
	cleanContent = cleanContent.replace(urlPreviewPattern, "").trim();

	// GIF pattern
	if (content.includes("(GIF Image)") || content.includes("GIF Image")) {
		attachments.push({ type: "gif" });
		cleanContent = cleanContent
			.replace(/\(GIF Image\)/g, "")
			.replace(/GIF Image/g, "")
			.trim();
	}

	// Image pattern
	if (content.includes("(Image)")) {
		attachments.push({ type: "image" });
		cleanContent = cleanContent.replace(/\(Image\)/g, "").trim();
	}

	// File attachment pattern
	const filePattern = /has an attachment:\s*([^\n]+)/g;
	// biome-ignore lint/suspicious/noAssignInExpressions: Standard pattern for iterating regex matches
	while ((match = filePattern.exec(content)) !== null) {
		const fileName = match[1];
		if (fileName) {
			attachments.push({
				type: "file",
				name: fileName.trim(),
			});
		}
	}
	cleanContent = cleanContent.replace(filePattern, "").trim();

	// Loop Component pattern
	if (content.includes("Loop Component")) {
		attachments.push({ type: "loop" });
		cleanContent = cleanContent.replace(/Loop Component/g, "").trim();
	}

	return [cleanContent, attachments.length > 0 ? attachments : undefined];
}

/**
 * Check if message content indicates an edit.
 *
 * @param content - Message content
 * @returns True if message was edited
 */
function checkEdited(content: string): boolean {
	return content.trim().endsWith("Edited.");
}

/**
 * Extract mentions from message content.
 *
 * @param content - Message content
 * @returns Array of mentioned names, or undefined if none
 */
function extractMentions(content: string): string[] | undefined {
	// Teams mentions appear as plain names in the text
	// We can detect @mentions or "Everyone" mentions
	const mentions: string[] = [];

	if (content.includes("Everyone")) {
		mentions.push("Everyone");
	}

	// Note: Individual @mentions are harder to detect reliably
	// as they appear as plain names. Would need context from the contact list.

	return mentions.length > 0 ? mentions : undefined;
}

/**
 * Split raw clipboard text into individual message blocks.
 *
 * @param raw - Raw clipboard text from Teams
 * @returns Array of message block strings
 */
function splitIntoMessageBlocks(raw: string): string[] {
	const blocks: string[] = [];
	const lines = raw.split("\n");

	let currentBlock: string[] = [];
	let i = 0;

	while (i < lines.length) {
		const line = lines[i] ?? "";
		const nextLine = lines[i + 1] ?? "";

		// Check if this line + next line match the message start pattern
		const isMessageStart =
			/^[A-Za-z][A-Za-z\s'-]+$/.test(line.trim()) &&
			AU_DATE_PATTERN.test(nextLine.trim());

		if (isMessageStart && currentBlock.length > 0) {
			// Save current block and start new one
			blocks.push(currentBlock.join("\n"));
			currentBlock = [line];
		} else {
			currentBlock.push(line);
		}

		i++;
	}

	// Add final block
	if (currentBlock.length > 0) {
		blocks.push(currentBlock.join("\n"));
	}

	return blocks.filter((block) => block.trim().length > 0);
}

/**
 * Parse a single message block into a TeamsMessage.
 *
 * @param block - Raw message block text
 * @returns Parsed TeamsMessage or null if invalid
 */
function parseMessageBlock(block: string): TeamsMessage | null {
	const lines = block.split("\n");

	// First line should be author
	const authorLine = lines[0];
	if (!authorLine) return null;
	const author = authorLine.trim();
	if (!author) return null;

	// Second line should be timestamp
	const timestampLine = lines[1];
	if (!timestampLine) return null;
	const timestampRaw = timestampLine.trim();
	if (!timestampRaw || !AU_DATE_PATTERN.test(timestampRaw)) return null;

	const timestamp = parseAUDateToISO(timestampRaw);

	// Rest is content
	let content = lines.slice(2).join("\n").trim();

	// Extract various elements from content
	const edited = checkEdited(content);
	if (edited) {
		content = content.replace(/\s*Edited\.\s*$/, "").trim();
	}

	const [afterReply, replyTo] = extractReply(content);
	const [afterAttachments, attachments] = extractAttachments(afterReply);
	const [finalContent, reactions] = extractReactions(afterAttachments);
	const mentions = extractMentions(finalContent);

	// Generate stable ID
	const id = generateMessageId(author, timestamp, finalContent);

	return {
		id,
		author,
		timestamp,
		content: finalContent,
		...(replyTo && { replyTo }),
		...(reactions && { reactions }),
		...(attachments && { attachments }),
		...(mentions && { mentions }),
		...(edited && { edited }),
	};
}

/**
 * Parse raw Teams clipboard text into an array of structured messages.
 *
 * @param raw - Raw clipboard text from Teams (via pbpaste or macos-automator)
 * @returns Array of parsed TeamsMessage objects, sorted by timestamp
 */
export function parseTeamsClipboard(raw: string): TeamsMessage[] {
	if (!raw || raw.trim().length === 0) {
		return [];
	}

	const blocks = splitIntoMessageBlocks(raw);
	const messages: TeamsMessage[] = [];

	for (const block of blocks) {
		const message = parseMessageBlock(block);
		if (message) {
			messages.push(message);
		}
	}

	// Sort by timestamp (oldest first)
	messages.sort(
		(a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
	);

	return messages;
}
