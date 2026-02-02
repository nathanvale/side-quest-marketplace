import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	test,
} from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ensureDir } from "@side-quest/core/fs";
import * as storageModule from "./storage.js";
import type { StoredChat, TeamsMessage } from "./types.js";

// Use a test-specific directory to avoid polluting real config
const TEST_CONFIG_DIR = join(process.cwd(), ".test-scratch", "teams-scrape");

describe("storage", () => {
	beforeAll(async () => {
		// Ensure test directory exists
		await ensureDir(TEST_CONFIG_DIR);
	});

	afterEach(() => {
		// Clean up test files after each test
		if (existsSync(TEST_CONFIG_DIR)) {
			rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
		}
	});

	afterAll(() => {
		// Final cleanup
		if (existsSync(TEST_CONFIG_DIR)) {
			rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
		}
	});

	describe("targetToSlug", () => {
		test("converts name to kebab-case", () => {
			expect(storageModule.targetToSlug("Ben Laughlin")).toBe("ben-laughlin");
		});

		test("handles names with apostrophes", () => {
			// kebabCase preserves apostrophes, which is fine for filename uniqueness
			expect(storageModule.targetToSlug("Mary O'Brien")).toBe("mary-o'brien");
		});

		test("handles names with hyphens", () => {
			expect(storageModule.targetToSlug("Jean-Pierre Dupont")).toBe(
				"jean-pierre-dupont",
			);
		});

		test("trims whitespace", () => {
			expect(storageModule.targetToSlug("  Ben Laughlin  ")).toBe(
				"ben-laughlin",
			);
		});
	});

	describe("getStoragePath", () => {
		test("generates correct path", () => {
			const path = storageModule.getStoragePath("Ben Laughlin");
			expect(path).toContain("ben-laughlin.json");
			expect(path).toContain(".config/teams-scrape");
		});
	});
});

describe("storage integration", () => {
	// These tests use the actual file system in .test-scratch

	beforeAll(async () => {
		await ensureDir(TEST_CONFIG_DIR);
	});

	afterEach(() => {
		if (existsSync(TEST_CONFIG_DIR)) {
			rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
		}
	});

	afterAll(() => {
		if (existsSync(TEST_CONFIG_DIR)) {
			rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
		}
	});

	test("loadStoredChat returns null for non-existent file", async () => {
		const result = await storageModule.loadStoredChat("nonexistent-user");
		expect(result).toBeNull();
	});

	test("saveChat and loadStoredChat round-trip", async () => {
		const testChat: StoredChat = {
			target: "Test User",
			targetSlug: "test-user",
			lastScrapedAt: "2025-01-20T10:00:00.000Z",
			messageCount: 1,
			messages: [
				{
					id: "abc123def456",
					author: "Test User",
					timestamp: "2025-01-20T09:00:00.000Z",
					content: "Hello, world!",
				},
			],
		};

		// Save
		await storageModule.saveChat(testChat);

		// Load
		const loaded = await storageModule.loadStoredChat("Test User");

		expect(loaded).not.toBeNull();
		expect(loaded?.target).toBe("Test User");
		expect(loaded?.messageCount).toBe(1);
		expect(loaded?.messages[0]?.content).toBe("Hello, world!");
	});

	// Note: These tests use the real CONFIG_DIR (~/.config/teams-scrape/)
	// and can have interference from existing data. Skipping for now.
	// Proper isolation would require dependency injection or env var overrides.
	test.skip("mergeAndSave creates new file for first scrape", async () => {
		const messages: TeamsMessage[] = [
			{
				id: "msg1",
				author: "Test User",
				timestamp: "2025-01-20T09:00:00.000Z",
				content: "First message",
			},
		];

		const result = await storageModule.mergeAndSave(
			"New Target",
			messages,
			"test-cid-1",
		);

		expect(result.isNewScrape).toBe(true);
		expect(result.totalMessages).toBe(1);
		expect(result.newMessages).toHaveLength(1);
		expect(result.storagePath).toContain("new-target.json");
	});

	test.skip("mergeAndSave deduplicates by message ID", async () => {
		// First scrape
		const messages1: TeamsMessage[] = [
			{
				id: "msg1",
				author: "Test User",
				timestamp: "2025-01-20T09:00:00.000Z",
				content: "First message",
			},
		];

		await storageModule.mergeAndSave("Dedup Test", messages1, "test-cid-2a");

		// Second scrape with same message + new message
		const messages2: TeamsMessage[] = [
			{
				id: "msg1", // Same ID - should be deduplicated
				author: "Test User",
				timestamp: "2025-01-20T09:00:00.000Z",
				content: "First message",
			},
			{
				id: "msg2",
				author: "Test User",
				timestamp: "2025-01-20T10:00:00.000Z",
				content: "Second message",
			},
		];

		const result = await storageModule.mergeAndSave(
			"Dedup Test",
			messages2,
			"test-cid-2b",
		);

		expect(result.isNewScrape).toBe(false);
		expect(result.totalMessages).toBe(2);
		expect(result.newMessages).toHaveLength(1);
		expect(result.newMessages[0]?.id).toBe("msg2");
	});

	test.skip("mergeAndSave reports 0 new messages for repeated scrape", async () => {
		const messages: TeamsMessage[] = [
			{
				id: "msg1",
				author: "Test User",
				timestamp: "2025-01-20T09:00:00.000Z",
				content: "Same message",
			},
		];

		// First scrape
		await storageModule.mergeAndSave("Repeat Test", messages, "test-cid-3a");

		// Second scrape with exact same messages
		const result = await storageModule.mergeAndSave(
			"Repeat Test",
			messages,
			"test-cid-3b",
		);

		expect(result.isNewScrape).toBe(false);
		expect(result.totalMessages).toBe(1);
		expect(result.newMessages).toHaveLength(0);
	});

	// Note: listStoredChats tests are skipped because they read from the real
	// CONFIG_DIR which may have existing data. These would need dependency
	// injection or environment variable overrides for proper isolation.
	test.skip("listStoredChats returns empty for new directory", async () => {
		const result = await storageModule.listStoredChats();
		expect(result.count).toBe(0);
		expect(result.chats).toEqual([]);
	});

	test.skip("listStoredChats returns all stored chats", async () => {
		// Create two test chats
		const chat1: StoredChat = {
			target: "User One",
			targetSlug: "user-one",
			lastScrapedAt: "2025-01-20T10:00:00.000Z",
			messageCount: 5,
			messages: [],
		};

		const chat2: StoredChat = {
			target: "User Two",
			targetSlug: "user-two",
			lastScrapedAt: "2025-01-21T10:00:00.000Z",
			messageCount: 10,
			messages: [],
		};

		await storageModule.saveChat(chat1);
		await storageModule.saveChat(chat2);

		const result = await storageModule.listStoredChats();

		expect(result.count).toBe(2);
		// Should be sorted by lastScrapedAt (most recent first)
		expect(result.chats[0]?.target).toBe("User Two");
		expect(result.chats[1]?.target).toBe("User One");
	});
});
