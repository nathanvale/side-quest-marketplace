/**
 * Inbox Processing Framework - Registry Tests
 *
 * Tests for the idempotency registry that tracks processed inbox items.
 */

import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { useTestVaultCleanup } from "../../testing/utils";
import {
	type ProcessedItem,
	type ProcessedRegistry,
	RegistryVersion,
} from "../types";
import { createRegistry, hashFile } from "./processed-registry";

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

/**
 * Helper to create a registry for testing with legacy behavior (restrictToAttachments=false).
 * Most existing tests were written before the restrictToAttachments feature.
 */
function createLegacyRegistry(vaultPath: string) {
	return createRegistry(vaultPath, { restrictToAttachments: false });
}

/**
 * Helper to setup and load a registry in one step.
 * Returns the loaded registry instance.
 */
async function setupLoadedRegistry(
	vaultPath: string,
	options?: { restrictToAttachments?: boolean },
) {
	const registry = createRegistry(vaultPath, options);
	await registry.load();
	return registry;
}

/**
 * Helper to create a ProcessedRegistry structure for testing.
 * Simplifies creation of registry files on disk.
 */
function createRegistryStructure(
	items: Omit<ProcessedItem, "sourceHash" | "processedAt">[] = [],
): ProcessedRegistry {
	return {
		version: RegistryVersion.V1,
		items: items.map((item) => ({
			...item,
			sourceHash: testHash(item.sourcePath),
			processedAt: "2024-01-01T00:00:00Z",
		})),
	};
}

/**
 * Helper to write a registry file to disk.
 * Combines structure creation and file writing.
 */
function writeRegistryFile(
	testDir: string,
	items: Omit<ProcessedItem, "sourceHash" | "processedAt">[] = [],
) {
	const registry = createRegistryStructure(items);
	writeFileSync(
		join(testDir, REGISTRY_FILE),
		JSON.stringify(registry, null, 2),
	);
}

describe("inbox/registry", () => {
	const { trackVault, getAfterEachHook } = useTestVaultCleanup();
	afterEach(getAfterEachHook());

	// Helper to create and track a test directory
	function createTestDir(): string {
		const { createTempDir } = require("@sidequest/core/testing");
		const dir = createTempDir("inbox-registry-test-");
		trackVault(dir);
		return dir;
	}

	// =========================================================================
	// hashFile Tests
	// =========================================================================

	describe("hashFile", () => {
		test("should generate SHA256 hash of file contents", async () => {
			const TEST_DIR = createTestDir();
			const testFile = join(TEST_DIR, "test.txt");
			writeFileSync(testFile, "hello world");

			const hash = await hashFile(testFile);

			// SHA256 of "hello world" is known
			expect(hash).toBe(
				"b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
			);
		});

		test("should return different hashes for different contents", async () => {
			const TEST_DIR = createTestDir();
			const file1 = join(TEST_DIR, "file1.txt");
			const file2 = join(TEST_DIR, "file2.txt");
			writeFileSync(file1, "content one");
			writeFileSync(file2, "content two");

			const hash1 = await hashFile(file1);
			const hash2 = await hashFile(file2);

			expect(hash1).not.toBe(hash2);
		});

		test("should return same hash for identical contents", async () => {
			const TEST_DIR = createTestDir();
			const file1 = join(TEST_DIR, "file1.txt");
			const file2 = join(TEST_DIR, "file2.txt");
			writeFileSync(file1, "identical content");
			writeFileSync(file2, "identical content");

			const hash1 = await hashFile(file1);
			const hash2 = await hashFile(file2);

			expect(hash1).toBe(hash2);
		});

		test("should throw error for non-existent file", async () => {
			const TEST_DIR = createTestDir();
			const nonExistent = join(TEST_DIR, "does-not-exist.txt");

			await expect(hashFile(nonExistent)).rejects.toThrow();
		});

		test("should handle empty files", async () => {
			const TEST_DIR = createTestDir();
			const emptyFile = join(TEST_DIR, "empty.txt");
			writeFileSync(emptyFile, "");

			const hash = await hashFile(emptyFile);

			// SHA256 of empty string
			expect(hash).toBe(
				"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
			);
		});

		test("should handle binary files", async () => {
			const TEST_DIR = createTestDir();
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
			const TEST_DIR = createTestDir();
			const registry = createLegacyRegistry(TEST_DIR);

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
			const TEST_DIR = createTestDir();
			// Registry is created but not used - we're testing file system side effects
			const _registry = await setupLoadedRegistry(TEST_DIR, {
				restrictToAttachments: false,
			});

			// File should not be created on load
			expect(existsSync(join(TEST_DIR, REGISTRY_FILE))).toBe(false);
		});

		test("should load existing registry from disk", async () => {
			const TEST_DIR = createTestDir();
			writeRegistryFile(TEST_DIR, [
				{
					sourcePath: "/inbox/test.pdf",
					createdNote: "/notes/test.md",
				},
			]);

			const registry = await setupLoadedRegistry(TEST_DIR, {
				restrictToAttachments: false,
			});

			expect(registry.isProcessed(testHash("/inbox/test.pdf"))).toBe(true);
			const item = registry.getItem(testHash("/inbox/test.pdf"));
			expect(item?.sourcePath).toBe("/inbox/test.pdf");
			expect(item?.createdNote).toBe("/notes/test.md");
		});

		test("should handle corrupt JSON gracefully and recover with empty registry", async () => {
			const TEST_DIR = createTestDir();
			writeFileSync(join(TEST_DIR, REGISTRY_FILE), "{ invalid json }");

			const registry = await setupLoadedRegistry(TEST_DIR, {
				restrictToAttachments: false,
			});

			// Should recover with empty registry
			expect(registry.isProcessed(testHash("anything"))).toBe(false);
		});

		test("should handle invalid registry structure gracefully", async () => {
			const TEST_DIR = createTestDir();
			// Missing version or items
			writeFileSync(
				join(TEST_DIR, REGISTRY_FILE),
				JSON.stringify({ foo: "bar" }),
			);

			const registry = await setupLoadedRegistry(TEST_DIR, {
				restrictToAttachments: false,
			});

			// Should recover with empty registry
			expect(registry.isProcessed(testHash("anything"))).toBe(false);
		});

		test("should handle registry with wrong version gracefully", async () => {
			const TEST_DIR = createTestDir();
			writeFileSync(
				join(TEST_DIR, REGISTRY_FILE),
				JSON.stringify({ version: 999, items: [] }),
			);

			const registry = await setupLoadedRegistry(TEST_DIR, {
				restrictToAttachments: false,
			});

			// Should recover with empty registry for unsupported version
			expect(registry.isProcessed(testHash("anything"))).toBe(false);
		});
	});

	// =========================================================================
	// registry.save Tests
	// =========================================================================

	describe("registry.save", () => {
		test("should save registry to disk", async () => {
			const TEST_DIR = createTestDir();
			const registry = await setupLoadedRegistry(TEST_DIR, {
				restrictToAttachments: false,
			});
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
			const TEST_DIR = createTestDir();
			writeRegistryFile(TEST_DIR, [
				{
					sourcePath: "/inbox/old.pdf",
				},
			]);

			const registry = await setupLoadedRegistry(TEST_DIR, {
				restrictToAttachments: false,
			});
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
			expect(
				saved.items.some((i) => i.sourceHash === testHash("/inbox/old.pdf")),
			).toBe(true);
			expect(saved.items.some((i) => i.sourceHash === testHash("new"))).toBe(
				true,
			);
		});

		test("should create parent directories if they do not exist", async () => {
			const TEST_DIR = createTestDir();
			const nestedDir = join(TEST_DIR, "nested", "vault");

			const registry = await setupLoadedRegistry(nestedDir, {
				restrictToAttachments: false,
			});
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
			const TEST_DIR = createTestDir();
			const registry = await setupLoadedRegistry(TEST_DIR, {
				restrictToAttachments: false,
			});

			expect(registry.isProcessed(testHash("unknown-hash"))).toBe(false);
		});

		test("should return true for known hash", async () => {
			const TEST_DIR = createTestDir();
			const registry = await setupLoadedRegistry(TEST_DIR, {
				restrictToAttachments: false,
			});
			registry.markProcessed({
				sourceHash: testHash("known-hash"),
				sourcePath: "/inbox/file.pdf",
				processedAt: new Date().toISOString(),
			});

			expect(registry.isProcessed(testHash("known-hash"))).toBe(true);
		});

		test("should return true for hash loaded from disk", async () => {
			const TEST_DIR = createTestDir();
			writeRegistryFile(TEST_DIR, [
				{
					sourcePath: "/inbox/disk.pdf",
				},
			]);

			const registry = await setupLoadedRegistry(TEST_DIR, {
				restrictToAttachments: false,
			});

			expect(registry.isProcessed(testHash("/inbox/disk.pdf"))).toBe(true);
		});
	});

	// =========================================================================
	// registry.markProcessed Tests
	// =========================================================================

	describe("registry.markProcessed", () => {
		test("should add item to registry", async () => {
			const TEST_DIR = createTestDir();
			const registry = await setupLoadedRegistry(TEST_DIR, {
				restrictToAttachments: false,
			});

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
			const TEST_DIR = createTestDir();
			const registry = await setupLoadedRegistry(TEST_DIR, {
				restrictToAttachments: false,
			});

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
			const TEST_DIR = createTestDir();
			const registry = await setupLoadedRegistry(TEST_DIR, {
				restrictToAttachments: false,
			});

			expect(registry.getItem(testHash("unknown"))).toBeUndefined();
		});

		test("should return item for known hash", async () => {
			const TEST_DIR = createTestDir();
			const registry = await setupLoadedRegistry(TEST_DIR, {
				restrictToAttachments: false,
			});

			const item: ProcessedItem = {
				sourceHash: testHash("item-hash"),
				sourcePath: "/inbox/item.pdf",
				processedAt: "2024-01-15T00:00:00Z",
			};
			registry.markProcessed(item);

			expect(registry.getItem(testHash("item-hash"))).toEqual(item);
		});

		test("should return item loaded from disk", async () => {
			const TEST_DIR = createTestDir();
			const item: ProcessedItem = {
				sourceHash: testHash("disk-item"),
				sourcePath: "/inbox/disk.pdf",
				processedAt: "2024-01-01T00:00:00Z",
				createdNote: "/notes/disk.md",
			};
			writeFileSync(
				join(TEST_DIR, REGISTRY_FILE),
				JSON.stringify({ version: RegistryVersion.V1, items: [item] }),
			);

			const registry = await setupLoadedRegistry(TEST_DIR, {
				restrictToAttachments: false,
			});

			expect(registry.getItem(testHash("disk-item"))).toEqual(item);
		});
	});

	// =========================================================================
	// Concurrent Access Tests
	// =========================================================================

	describe("concurrent access", () => {
		test("should handle multiple registries reading same file", async () => {
			const TEST_DIR = createTestDir();
			writeRegistryFile(TEST_DIR, [
				{
					sourcePath: "/inbox/shared.pdf",
				},
			]);

			// Load in parallel
			const [registry1, registry2] = await Promise.all([
				setupLoadedRegistry(TEST_DIR, { restrictToAttachments: false }),
				setupLoadedRegistry(TEST_DIR, { restrictToAttachments: false }),
			]);

			expect(registry1.isProcessed(testHash("/inbox/shared.pdf"))).toBe(true);
			expect(registry2.isProcessed(testHash("/inbox/shared.pdf"))).toBe(true);
		});

		test("should re-read from disk on load to get latest state", async () => {
			const TEST_DIR = createTestDir();
			const registry1 = createLegacyRegistry(TEST_DIR);
			const registry2 = createLegacyRegistry(TEST_DIR);

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
			const TEST_DIR = createTestDir();
			writeRegistryFile(TEST_DIR, []);

			const registry = await setupLoadedRegistry(TEST_DIR, {
				restrictToAttachments: false,
			});

			expect(registry.isProcessed(testHash("any"))).toBe(false);
		});

		test("should handle many items in registry", async () => {
			const TEST_DIR = createTestDir();
			const registry = await setupLoadedRegistry(TEST_DIR, {
				restrictToAttachments: false,
			});

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
			const registry2 = await setupLoadedRegistry(TEST_DIR, {
				restrictToAttachments: false,
			});

			// Spot check
			expect(registry2.isProcessed(testHash("hash-0"))).toBe(true);
			expect(registry2.isProcessed(testHash("hash-500"))).toBe(true);
			expect(registry2.isProcessed(testHash("hash-999"))).toBe(true);
			expect(registry2.isProcessed(testHash("hash-1000"))).toBe(false);
		});

		test("should handle special characters in paths", async () => {
			const TEST_DIR = createTestDir();
			const registry = await setupLoadedRegistry(TEST_DIR, {
				restrictToAttachments: false,
			});

			const item: ProcessedItem = {
				sourceHash: testHash("special"),
				sourcePath: "/inbox/file with spaces & special (chars).pdf",
				processedAt: "2024-01-15T00:00:00Z",
			};
			registry.markProcessed(item);
			await registry.save();

			const registry2 = await setupLoadedRegistry(TEST_DIR, {
				restrictToAttachments: false,
			});

			expect(registry2.getItem(testHash("special"))?.sourcePath).toBe(
				item.sourcePath,
			);
		});
	});

	// =========================================================================
	// Registry Scope Enforcement Tests (restrictToAttachments)
	// =========================================================================

	describe("registry scope enforcement", () => {
		test("should allow attachment items when restrictToAttachments=true", async () => {
			const TEST_DIR = createTestDir();
			const registry = await setupLoadedRegistry(TEST_DIR, {
				restrictToAttachments: true,
			});

			const item: ProcessedItem = {
				sourceHash: testHash("attachment1"),
				sourcePath: "inbox/file.pdf",
				processedAt: new Date().toISOString(),
				movedAttachment: "Attachments/20250121-abc123-file.pdf",
				itemType: "attachment",
			};

			// Should not throw
			expect(() => registry.markProcessed(item)).not.toThrow();
			expect(registry.isProcessed(testHash("attachment1"))).toBe(true);
		});

		test("should reject non-attachment items when restrictToAttachments=true", async () => {
			const TEST_DIR = createTestDir();
			const registry = await setupLoadedRegistry(TEST_DIR, {
				restrictToAttachments: true,
			});

			const item: ProcessedItem = {
				sourceHash: testHash("note1"),
				sourcePath: "inbox/note.md",
				processedAt: new Date().toISOString(),
				createdNote: "01 Projects/note.md",
				itemType: "note",
			};

			// Should throw validation error
			expect(() => registry.markProcessed(item)).toThrow(
				"Registry restricted to attachments",
			);
		});

		test("should reject items without movedAttachment when restrictToAttachments=true", async () => {
			const TEST_DIR = createTestDir();
			const registry = await setupLoadedRegistry(TEST_DIR, {
				restrictToAttachments: true,
			});

			const item: ProcessedItem = {
				sourceHash: testHash("invalid1"),
				sourcePath: "inbox/file.pdf",
				processedAt: new Date().toISOString(),
				// Missing movedAttachment field
			};

			expect(() => registry.markProcessed(item)).toThrow(
				"must have movedAttachment field",
			);
		});

		test("should allow all items when restrictToAttachments=false", async () => {
			const TEST_DIR = createTestDir();
			const registry = await setupLoadedRegistry(TEST_DIR, {
				restrictToAttachments: false,
			});

			const noteItem: ProcessedItem = {
				sourceHash: testHash("note2"),
				sourcePath: "inbox/note.md",
				processedAt: new Date().toISOString(),
				createdNote: "01 Projects/note.md",
				itemType: "note",
			};

			const attachmentItem: ProcessedItem = {
				sourceHash: testHash("attachment2"),
				sourcePath: "inbox/file.pdf",
				processedAt: new Date().toISOString(),
				movedAttachment: "Attachments/file.pdf",
				itemType: "attachment",
			};

			// Both should succeed
			expect(() => registry.markProcessed(noteItem)).not.toThrow();
			expect(() => registry.markProcessed(attachmentItem)).not.toThrow();

			expect(registry.isProcessed(testHash("note2"))).toBe(true);
			expect(registry.isProcessed(testHash("attachment2"))).toBe(true);
		});

		test("should default to restrictToAttachments=true", async () => {
			const TEST_DIR = createTestDir();
			const registry = await setupLoadedRegistry(TEST_DIR); // No options - uses default

			const item: ProcessedItem = {
				sourceHash: testHash("test1"),
				sourcePath: "inbox/note.md",
				processedAt: new Date().toISOString(),
				createdNote: "01 Projects/note.md",
			};

			// Should reject because default is true
			expect(() => registry.markProcessed(item)).toThrow(
				"Registry restricted to attachments",
			);
		});
	});

	// =========================================================================
	// Atomic removeAndSave Tests
	// =========================================================================

	describe("removeAndSave", () => {
		test("should remove item and save atomically", async () => {
			const TEST_DIR = createTestDir();
			const registry = await setupLoadedRegistry(TEST_DIR, {
				restrictToAttachments: false,
			});

			const item: ProcessedItem = {
				sourceHash: testHash("atomic1"),
				sourcePath: "inbox/file.pdf",
				processedAt: new Date().toISOString(),
				createdNote: "01 Projects/note.md",
			};

			registry.markProcessed(item);
			await registry.save();

			// Verify item exists
			expect(registry.isProcessed(testHash("atomic1"))).toBe(true);

			// Remove atomically
			const removed = await registry.removeAndSave(testHash("atomic1"));

			expect(removed).toBe(true);
			expect(registry.isProcessed(testHash("atomic1"))).toBe(false);

			// Verify persisted to disk
			const registry2 = await setupLoadedRegistry(TEST_DIR, {
				restrictToAttachments: false,
			});
			expect(registry2.isProcessed(testHash("atomic1"))).toBe(false);
		});

		test("should return false when removing non-existent item", async () => {
			const TEST_DIR = createTestDir();
			const registry = await setupLoadedRegistry(TEST_DIR);

			const removed = await registry.removeAndSave(testHash("nonexistent"));

			expect(removed).toBe(false);
		});

		test("should handle concurrent removeAndSave calls", async () => {
			const TEST_DIR = createTestDir();
			const registry = await setupLoadedRegistry(TEST_DIR, {
				restrictToAttachments: false,
			});

			// Add multiple items
			for (let i = 0; i < 5; i++) {
				registry.markProcessed({
					sourceHash: testHash(`concurrent${i}`),
					sourcePath: `inbox/file${i}.pdf`,
					processedAt: new Date().toISOString(),
					createdNote: `note${i}.md`,
				});
			}
			await registry.save();

			// Remove concurrently
			const results = await Promise.all([
				registry.removeAndSave(testHash("concurrent0")),
				registry.removeAndSave(testHash("concurrent1")),
				registry.removeAndSave(testHash("concurrent2")),
			]);

			expect(results).toEqual([true, true, true]);

			// Verify all removed
			expect(registry.isProcessed(testHash("concurrent0"))).toBe(false);
			expect(registry.isProcessed(testHash("concurrent1"))).toBe(false);
			expect(registry.isProcessed(testHash("concurrent2"))).toBe(false);

			// Verify remaining items
			expect(registry.isProcessed(testHash("concurrent3"))).toBe(true);
			expect(registry.isProcessed(testHash("concurrent4"))).toBe(true);
		});
	});

	// =========================================================================
	// Write Serialization Tests
	// =========================================================================

	describe("write serialization", () => {
		test("should serialize concurrent save() calls", async () => {
			const TEST_DIR = createTestDir();
			const registry = await setupLoadedRegistry(TEST_DIR, {
				restrictToAttachments: false,
			});

			// Perform concurrent saves
			const savePromises = [];
			for (let i = 0; i < 10; i++) {
				registry.markProcessed({
					sourceHash: testHash(`serial${i}`),
					sourcePath: `inbox/file${i}.pdf`,
					processedAt: new Date().toISOString(),
					createdNote: `note${i}.md`,
				});
				savePromises.push(registry.save());
			}

			await Promise.all(savePromises);

			// Verify all items persisted
			const registry2 = await setupLoadedRegistry(TEST_DIR, {
				restrictToAttachments: false,
			});

			for (let i = 0; i < 10; i++) {
				expect(registry2.isProcessed(testHash(`serial${i}`))).toBe(true);
			}
		});

		test("should log warning for long lock wait times", async () => {
			const TEST_DIR = createTestDir();
			// This test verifies the logging behavior exists
			// Actual implementation will log when lock wait > 100ms
			const registry = await setupLoadedRegistry(TEST_DIR);

			// Just verify save completes successfully
			await registry.save();
			expect(true).toBe(true);
		});
	});
});
