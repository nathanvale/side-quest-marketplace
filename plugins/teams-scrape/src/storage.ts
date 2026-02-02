/**
 * Storage layer for persisting Teams chat history.
 *
 * Provides atomic file writes, deduplication, and merge operations.
 *
 * @module teams-scrape/storage
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { withFileLock } from "@side-quest/core/concurrency";
import {
	ensureDir,
	pathExists,
	readDirAsync,
	readJsonFile,
	writeJsonFileAtomic,
} from "@side-quest/core/fs";
import { observe } from "@side-quest/core/instrumentation";
import { kebabCase } from "@side-quest/core/utils";
import { storageLogger } from "./logger.js";
import type {
	ListResult,
	ScrapeResult,
	StoredChat,
	TeamsMessage,
} from "./types.js";

/** Configuration directory for teams-scrape storage */
export const CONFIG_DIR = join(homedir(), ".config", "teams-scrape");

/**
 * Convert a target name to a kebab-case slug for filename.
 *
 * @param target - Target name (person or channel)
 * @returns Kebab-case slug
 */
export function targetToSlug(target: string): string {
	return kebabCase(target.trim());
}

/**
 * Get the storage file path for a target.
 *
 * @param target - Target name
 * @returns Full path to the JSON storage file
 */
export function getStoragePath(target: string): string {
	return join(CONFIG_DIR, `${targetToSlug(target)}.json`);
}

/**
 * Load stored chat history for a target.
 *
 * @param target - Target name to load
 * @returns StoredChat if exists, null otherwise
 */
export async function loadStoredChat(
	target: string,
): Promise<StoredChat | null> {
	const filePath = getStoragePath(target);

	const exists = await pathExists(filePath);
	if (!exists) {
		storageLogger.info("No existing chat found", { target, filePath });
		return null;
	}

	try {
		const chat = await readJsonFile<StoredChat>(filePath);
		storageLogger.info("Loaded existing chat", {
			target,
			messageCount: chat.messageCount,
			lastScrapedAt: chat.lastScrapedAt,
		});
		return chat;
	} catch (error) {
		storageLogger.error("Failed to load chat", {
			target,
			filePath,
			error: error instanceof Error ? error.message : String(error),
		});
		return null;
	}
}

/**
 * Save a chat to storage atomically.
 *
 * @param chat - StoredChat to save
 */
export async function saveChat(chat: StoredChat): Promise<void> {
	const filePath = getStoragePath(chat.target);

	// Ensure config directory exists
	await ensureDir(CONFIG_DIR);

	// Atomic write
	await writeJsonFileAtomic(filePath, chat);

	storageLogger.info("Saved chat", {
		target: chat.target,
		messageCount: chat.messageCount,
		filePath,
	});
}

/**
 * Merge new messages with existing chat and save.
 *
 * Performs deterministic deduplication by message ID and returns
 * only truly new messages.
 *
 * @param target - Target name
 * @param parsedMessages - Messages parsed from current clipboard
 * @param cid - Correlation ID for tracing
 * @returns ScrapeResult with new messages and totals
 */
export async function mergeAndSave(
	target: string,
	parsedMessages: TeamsMessage[],
	cid: string,
): Promise<ScrapeResult> {
	const storagePath = getStoragePath(target);
	const capturedAt = new Date().toISOString();

	return observe(
		storageLogger,
		"mergeAndSave",
		async () => {
			// Use file lock to prevent concurrent writes to same target
			return withFileLock(`teams-scrape-${targetToSlug(target)}`, async () => {
				// Load existing (inside lock to get latest)
				const existing = await loadStoredChat(target);
				const isNewScrape = existing === null;

				// Build set of existing IDs for O(1) deduplication
				const existingIds = new Set(existing?.messages.map((m) => m.id) ?? []);

				// Find truly new messages
				const newMessages = parsedMessages.filter(
					(m) => !existingIds.has(m.id),
				);

				// Merge: existing messages + new messages
				const allMessages = [...(existing?.messages ?? []), ...newMessages];

				// Sort by timestamp
				allMessages.sort(
					(a, b) =>
						new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
				);

				// Create updated chat
				const updatedChat: StoredChat = {
					target,
					targetSlug: targetToSlug(target),
					lastScrapedAt: capturedAt,
					messageCount: allMessages.length,
					messages: allMessages,
				};

				// Save atomically
				await saveChat(updatedChat);

				storageLogger.info("Merge completed", {
					cid,
					target,
					isNewScrape,
					existingCount: existing?.messageCount ?? 0,
					parsedCount: parsedMessages.length,
					newCount: newMessages.length,
					totalCount: allMessages.length,
				});

				return {
					target,
					capturedAt,
					isNewScrape,
					totalMessages: allMessages.length,
					newMessages,
					storagePath,
				};
			});
		},
		{
			onSuccess: (result) => {
				storageLogger.info("mergeAndSave succeeded", {
					cid,
					target,
					newMessages: result.newMessages.length,
				});
			},
			onError: (error) => {
				storageLogger.error("mergeAndSave failed", {
					cid,
					target,
					error: error instanceof Error ? error.message : String(error),
				});
			},
		},
	);
}

/**
 * List all stored chats.
 *
 * @returns ListResult with summary of all stored chats
 */
export async function listStoredChats(): Promise<ListResult> {
	// Ensure directory exists
	await ensureDir(CONFIG_DIR);

	const files = await readDirAsync(CONFIG_DIR);
	const jsonFiles = files.filter((f) => f.endsWith(".json"));

	const chats: ListResult["chats"] = [];

	for (const file of jsonFiles) {
		const filePath = join(CONFIG_DIR, file);
		try {
			const chat = await readJsonFile<StoredChat>(filePath);
			chats.push({
				target: chat.target,
				messageCount: chat.messageCount,
				lastScrapedAt: chat.lastScrapedAt,
				filePath,
			});
		} catch {
			// Skip invalid files
			storageLogger.warn("Skipping invalid chat file", { filePath });
		}
	}

	// Sort by last scraped (most recent first)
	chats.sort(
		(a, b) =>
			new Date(b.lastScrapedAt).getTime() - new Date(a.lastScrapedAt).getTime(),
	);

	return {
		count: chats.length,
		chats,
	};
}
