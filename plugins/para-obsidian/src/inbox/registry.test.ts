/**
 * Inbox Processing Framework - Registry Tests
 *
 * Tests for the idempotency registry that tracks processed inbox items.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanupTestDir, createTempDir } from "@sidequest/core/testing";
import { createRegistry, hashFile } from "./processed-registry";
import type { ProcessedItem, ProcessedRegistry } from "./types";

const REGISTRY_FILE = ".inbox-processed.json";

/**
 * Generate a valid 64-char hex string from a short test identifier.
 * This satisfies the SHA256 hash validation while keeping tests readable.
 * Converts the identifier to hex and pads with zeros.
 */
function testHash(shortId: string): string {
	// Convert shortId to hex string to ensure valid hash characters
	const hexId = Buffer.from(shortId, "utf-8").toString("hex");
	return hexId.padEnd(64, "0");
}

describe("inbox/registry", () => {
	let TEST_DIR: string;

	beforeEach(() => {
		TEST_DIR = createTempDir("inbox-registry-test-");
	});

	afterEach(() => {
		cleanupTestDir(TEST_DIR);
	});

	// =========================================================================
	// hashFile Tests
	// =========================================================================

	describe("hashFile", () => {
		test("should generate SHA256 hash of file contents", async () => {
			const testFile = join(TEST_DIR, "test.txt");
			writeFileSync(testFile, "hello world");

			const hash = await hashFile(testFile);

			// SHA256 of "hello world" is known
			expect(hash).toBe(
				"b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
			);
		});

		test("should return different hashes for different contents", async () => {
			const file1 = join(TEST_DIR, "file1.txt");
			const file2 = join(TEST_DIR, "file2.txt");
			writeFileSync(file1, "content one");
			writeFileSync(file2, "content two");

			const hash1 = await hashFile(file1);
			const hash2 = await hashFile(file2);

			expect(hash1).not.toBe(hash2);
		});

		test("should return same hash for identical contents", async () => {
			const file1 = join(TEST_DIR, "file1.txt");
			const file2 = join(TEST_DIR, "file2.txt");
			writeFileSync(file1, "identical content");
			writeFileSync(file2, "identical content");

			const hash1 = await hashFile(file1);
			const hash2 = await hashFile(file2);

			expect(hash1).toBe(hash2);
		});

		test("should throw error for non-existent file", async () => {
			const nonExistent = join(TEST_DIR, "does-not-exist.txt");

			await expect(hashFile(nonExistent)).rejects.toThrow();
		});

		test("should handle empty files", async () => {
			const emptyFile = join(TEST_DIR, "empty.txt");
			writeFileSync(emptyFile, "");

			const hash = await hashFile(emptyFile);

			// SHA256 of empty string
			expect(hash).toBe(
				"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
			);
		});

		test("should handle binary files", async () => {
			const binaryFile = join(TEST_DIR, "binary.bin");
			writeFileSync(binaryFile, Buffer.from([0x00, 0xff, 0x42, 0x13]));

			const hash = await hashFile(binaryFile);

			expect(hash).toHaveLength(64); // SHA256 produces 64 hex characters
		});
	});

	// =========================================================================
	// createRegistry Tests
	// =========================================================================

	describe("createRegistry", () => {
		test("should create a registry manager for a vault path", () => {
			const registry = createRegistry(TEST_DIR);

			expect(registry).toBeDefined();
			expect(typeof registry.load).toBe("function");
			expect(typeof registry.save).toBe("function");
			expect(typeof registry.isProcessed).toBe("function");
			expect(typeof registry.markProcessed).toBe("function");
			expect(typeof registry.getItem).toBe("function");
		});
	});

	// =========================================================================
	// registry.load Tests
	// =========================================================================

	describe("registry.load", () => {
		test("should create empty registry if file does not exist", async () => {
			const registry = createRegistry(TEST_DIR);

			await registry.load();

			// File should not be created on load
			expect(existsSync(join(TEST_DIR, REGISTRY_FILE))).toBe(false);
		});

		test("should load existing registry from disk", async () => {
			const existingRegistry: ProcessedRegistry = {
				version: 1,
				items: [
					{
						sourceHash: testHash("abc123"),
						sourcePath: "/inbox/test.pdf",
						processedAt: "2024-01-01T00:00:00Z",
						createdNote: "/notes/test.md",
					},
				],
			};
			writeFileSync(
				join(TEST_DIR, REGISTRY_FILE),
				JSON.stringify(existingRegistry, null, 2),
			);

			const registry = createRegistry(TEST_DIR);
			await registry.load();

			expect(registry.isProcessed(testHash("abc123"))).toBe(true);
			expect(registry.getItem(testHash("abc123"))).toEqual(
				existingRegistry.items[0],
			);
		});

		test("should handle corrupt JSON gracefully and recover with empty registry", async () => {
			writeFileSync(join(TEST_DIR, REGISTRY_FILE), "{ invalid json }");

			const registry = createRegistry(TEST_DIR);
			await registry.load();

			// Should recover with empty registry
			expect(registry.isProcessed(testHash("anything"))).toBe(false);
		});

		test("should handle invalid registry structure gracefully", async () => {
			// Missing version or items
			writeFileSync(
				join(TEST_DIR, REGISTRY_FILE),
				JSON.stringify({ foo: "bar" }),
			);

			const registry = createRegistry(TEST_DIR);
			await registry.load();

			// Should recover with empty registry
			expect(registry.isProcessed(testHash("anything"))).toBe(false);
		});

		test("should handle registry with wrong version gracefully", async () => {
			writeFileSync(
				join(TEST_DIR, REGISTRY_FILE),
				JSON.stringify({ version: 999, items: [] }),
			);

			const registry = createRegistry(TEST_DIR);
			await registry.load();

			// Should recover with empty registry for unsupported version
			expect(registry.isProcessed(testHash("anything"))).toBe(false);
		});
	});

	// =========================================================================
	// registry.save Tests
	// =========================================================================

	describe("registry.save", () => {
		test("should save registry to disk", async () => {
			const registry = createRegistry(TEST_DIR);
			await registry.load();
			registry.markProcessed({
				sourceHash: testHash("hash123"),
				sourcePath: "/inbox/file.pdf",
				processedAt: "2024-01-15T10:30:00Z",
			});

			await registry.save();

			const saved = JSON.parse(
				await Bun.file(join(TEST_DIR, REGISTRY_FILE)).text(),
			) as ProcessedRegistry;
			expect(saved.version).toBe(1);
			expect(saved.items).toHaveLength(1);
			expect(saved.items[0]?.sourceHash).toBe(testHash("hash123"));
		});

		test("should overwrite existing registry file", async () => {
			const existingRegistry: ProcessedRegistry = {
				version: 1,
				items: [
					{
						sourceHash: testHash("old"),
						sourcePath: "/inbox/old.pdf",
						processedAt: "2024-01-01T00:00:00Z",
					},
				],
			};
			writeFileSync(
				join(TEST_DIR, REGISTRY_FILE),
				JSON.stringify(existingRegistry),
			);

			const registry = createRegistry(TEST_DIR);
			await registry.load();
			registry.markProcessed({
				sourceHash: testHash("new"),
				sourcePath: "/inbox/new.pdf",
				processedAt: "2024-01-15T00:00:00Z",
			});
			await registry.save();

			const saved = JSON.parse(
				await Bun.file(join(TEST_DIR, REGISTRY_FILE)).text(),
			) as ProcessedRegistry;
			expect(saved.items).toHaveLength(2);
			expect(saved.items.some((i) => i.sourceHash === testHash("old"))).toBe(
				true,
			);
			expect(saved.items.some((i) => i.sourceHash === testHash("new"))).toBe(
				true,
			);
		});

		test("should create parent directories if they do not exist", async () => {
			const nestedDir = join(TEST_DIR, "nested", "vault");

			const registry = createRegistry(nestedDir);
			await registry.load();
			registry.markProcessed({
				sourceHash: testHash("test"),
				sourcePath: "/inbox/test.pdf",
				processedAt: "2024-01-15T00:00:00Z",
			});
			await registry.save();

			expect(existsSync(join(nestedDir, REGISTRY_FILE))).toBe(true);
		});
	});

	// =========================================================================
	// registry.isProcessed Tests
	// =========================================================================

	describe("registry.isProcessed", () => {
		test("should return false for unknown hash", async () => {
			const registry = createRegistry(TEST_DIR);
			await registry.load();

			expect(registry.isProcessed(testHash("unknown-hash"))).toBe(false);
		});

		test("should return true for known hash", async () => {
			const registry = createRegistry(TEST_DIR);
			await registry.load();
			registry.markProcessed({
				sourceHash: testHash("known-hash"),
				sourcePath: "/inbox/file.pdf",
				processedAt: new Date().toISOString(),
			});

			expect(registry.isProcessed(testHash("known-hash"))).toBe(true);
		});

		test("should return true for hash loaded from disk", async () => {
			const existingRegistry: ProcessedRegistry = {
				version: 1,
				items: [
					{
						sourceHash: testHash("disk-hash"),
						sourcePath: "/inbox/disk.pdf",
						processedAt: "2024-01-01T00:00:00Z",
					},
				],
			};
			writeFileSync(
				join(TEST_DIR, REGISTRY_FILE),
				JSON.stringify(existingRegistry),
			);

			const registry = createRegistry(TEST_DIR);
			await registry.load();

			expect(registry.isProcessed(testHash("disk-hash"))).toBe(true);
		});
	});

	// =========================================================================
	// registry.markProcessed Tests
	// =========================================================================

	describe("registry.markProcessed", () => {
		test("should add item to registry", async () => {
			const registry = createRegistry(TEST_DIR);
			await registry.load();

			const item: ProcessedItem = {
				sourceHash: testHash("new-hash"),
				sourcePath: "/inbox/new.pdf",
				processedAt: "2024-01-15T12:00:00Z",
				createdNote: "/notes/new.md",
				movedAttachment: "/attachments/new.pdf",
			};

			registry.markProcessed(item);

			expect(registry.isProcessed(testHash("new-hash"))).toBe(true);
			expect(registry.getItem(testHash("new-hash"))).toEqual(item);
		});

		test("should update existing item with same hash", async () => {
			const registry = createRegistry(TEST_DIR);
			await registry.load();

			const item1: ProcessedItem = {
				sourceHash: testHash("same-hash"),
				sourcePath: "/inbox/v1.pdf",
				processedAt: "2024-01-01T00:00:00Z",
			};
			const item2: ProcessedItem = {
				sourceHash: testHash("same-hash"),
				sourcePath: "/inbox/v2.pdf",
				processedAt: "2024-01-15T00:00:00Z",
				createdNote: "/notes/v2.md",
			};

			registry.markProcessed(item1);
			registry.markProcessed(item2);

			// Should update, not duplicate
			expect(registry.getItem(testHash("same-hash"))).toEqual(item2);
		});
	});

	// =========================================================================
	// registry.getItem Tests
	// =========================================================================

	describe("registry.getItem", () => {
		test("should return undefined for unknown hash", async () => {
			const registry = createRegistry(TEST_DIR);
			await registry.load();

			expect(registry.getItem(testHash("unknown"))).toBeUndefined();
		});

		test("should return item for known hash", async () => {
			const registry = createRegistry(TEST_DIR);
			await registry.load();

			const item: ProcessedItem = {
				sourceHash: testHash("item-hash"),
				sourcePath: "/inbox/item.pdf",
				processedAt: "2024-01-15T00:00:00Z",
			};
			registry.markProcessed(item);

			expect(registry.getItem(testHash("item-hash"))).toEqual(item);
		});

		test("should return item loaded from disk", async () => {
			const item: ProcessedItem = {
				sourceHash: testHash("disk-item"),
				sourcePath: "/inbox/disk.pdf",
				processedAt: "2024-01-01T00:00:00Z",
				createdNote: "/notes/disk.md",
			};
			const existingRegistry: ProcessedRegistry = {
				version: 1,
				items: [item],
			};
			writeFileSync(
				join(TEST_DIR, REGISTRY_FILE),
				JSON.stringify(existingRegistry),
			);

			const registry = createRegistry(TEST_DIR);
			await registry.load();

			expect(registry.getItem(testHash("disk-item"))).toEqual(item);
		});
	});

	// =========================================================================
	// Concurrent Access Tests
	// =========================================================================

	describe("concurrent access", () => {
		test("should handle multiple registries reading same file", async () => {
			const existingRegistry: ProcessedRegistry = {
				version: 1,
				items: [
					{
						sourceHash: testHash("shared"),
						sourcePath: "/inbox/shared.pdf",
						processedAt: "2024-01-01T00:00:00Z",
					},
				],
			};
			writeFileSync(
				join(TEST_DIR, REGISTRY_FILE),
				JSON.stringify(existingRegistry),
			);

			// Load in parallel
			const registry1 = createRegistry(TEST_DIR);
			const registry2 = createRegistry(TEST_DIR);
			await Promise.all([registry1.load(), registry2.load()]);

			expect(registry1.isProcessed(testHash("shared"))).toBe(true);
			expect(registry2.isProcessed(testHash("shared"))).toBe(true);
		});

		test("should re-read from disk on load to get latest state", async () => {
			const registry1 = createRegistry(TEST_DIR);
			const registry2 = createRegistry(TEST_DIR);

			// Load both
			await registry1.load();
			await registry2.load();

			// registry1 adds an item and saves
			registry1.markProcessed({
				sourceHash: testHash("from-r1"),
				sourcePath: "/inbox/r1.pdf",
				processedAt: "2024-01-15T00:00:00Z",
			});
			await registry1.save();

			// registry2 should not see it yet
			expect(registry2.isProcessed(testHash("from-r1"))).toBe(false);

			// After reload, registry2 should see it
			await registry2.load();
			expect(registry2.isProcessed(testHash("from-r1"))).toBe(true);
		});
	});

	// =========================================================================
	// Edge Cases
	// =========================================================================

	describe("edge cases", () => {
		test("should handle empty items array in registry", async () => {
			const emptyRegistry: ProcessedRegistry = {
				version: 1,
				items: [],
			};
			writeFileSync(
				join(TEST_DIR, REGISTRY_FILE),
				JSON.stringify(emptyRegistry),
			);

			const registry = createRegistry(TEST_DIR);
			await registry.load();

			expect(registry.isProcessed(testHash("any"))).toBe(false);
		});

		test("should handle many items in registry", async () => {
			const registry = createRegistry(TEST_DIR);
			await registry.load();

			// Add 1000 items
			for (let i = 0; i < 1000; i++) {
				registry.markProcessed({
					sourceHash: testHash(`hash-${i}`),
					sourcePath: `/inbox/file-${i}.pdf`,
					processedAt: new Date().toISOString(),
				});
			}

			await registry.save();

			// Create new registry and load
			const registry2 = createRegistry(TEST_DIR);
			await registry2.load();

			// Spot check
			expect(registry2.isProcessed(testHash("hash-0"))).toBe(true);
			expect(registry2.isProcessed(testHash("hash-500"))).toBe(true);
			expect(registry2.isProcessed(testHash("hash-999"))).toBe(true);
			expect(registry2.isProcessed(testHash("hash-1000"))).toBe(false);
		});

		test("should handle special characters in paths", async () => {
			const registry = createRegistry(TEST_DIR);
			await registry.load();

			const item: ProcessedItem = {
				sourceHash: testHash("special"),
				sourcePath: "/inbox/file with spaces & special (chars).pdf",
				processedAt: "2024-01-15T00:00:00Z",
			};
			registry.markProcessed(item);
			await registry.save();

			const registry2 = createRegistry(TEST_DIR);
			await registry2.load();

			expect(registry2.getItem(testHash("special"))?.sourcePath).toBe(
				item.sourcePath,
			);
		});
	});
});
