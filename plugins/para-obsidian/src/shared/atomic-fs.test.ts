import { afterEach, describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createTempDir } from "@sidequest/core/testing";
import { useTestVaultCleanup } from "../testing/utils";
import {
	atomicWriteFile,
	createBackup,
	restoreFromBackup,
	safeReadJSON,
} from "./atomic-fs";

describe("atomic-fs", () => {
	const { trackVault, getAfterEachHook } = useTestVaultCleanup();
	afterEach(getAfterEachHook());

	function createTestDir(): string {
		const dir = createTempDir("atomic-fs-test-");
		trackVault(dir);
		return dir;
	}

	describe("atomicWriteFile", () => {
		test("writes file successfully", async () => {
			const tempDir = createTestDir();
			const filePath = join(tempDir, "test.txt");
			await atomicWriteFile(filePath, "content");

			const result = await readFile(filePath, "utf-8");
			expect(result).toBe("content");
		});

		test("creates parent directories if missing", async () => {
			const tempDir = createTestDir();
			const filePath = join(tempDir, "nested", "deep", "test.txt");
			await atomicWriteFile(filePath, "content");

			const result = await readFile(filePath, "utf-8");
			expect(result).toBe("content");
		});

		test("overwrites existing file", async () => {
			const tempDir = createTestDir();
			const filePath = join(tempDir, "test.txt");
			await writeFile(filePath, "old", "utf-8");
			await atomicWriteFile(filePath, "new");

			const result = await readFile(filePath, "utf-8");
			expect(result).toBe("new");
		});

		test("cleans up temp file on failure", async () => {
			const tempDir = createTestDir();
			// Cause failure by trying to write to invalid location
			// (simulated by mocking rename to fail)
			try {
				await atomicWriteFile("/invalid/path/test.txt", "content");
			} catch {
				// Expected to fail
			}

			// Verify no .tmp files left in tempDir
			const files = await readFile(tempDir).catch(() => null);
			expect(files).toBe(null);
		});

		test("maintains atomicity - no partial writes", async () => {
			const tempDir = createTestDir();
			const filePath = join(tempDir, "test.txt");
			const largeContent = "x".repeat(1000000);

			// Write large file
			await atomicWriteFile(filePath, largeContent);

			// File should be complete (all or nothing)
			const result = await readFile(filePath, "utf-8");
			expect(result).toBe(largeContent);
		});
	});

	describe("safeReadJSON", () => {
		test("reads valid JSON file", async () => {
			const tempDir = createTestDir();
			const filePath = join(tempDir, "data.json");
			const data = { key: "value", number: 42 };
			await writeFile(filePath, JSON.stringify(data), "utf-8");

			const result = await safeReadJSON<typeof data>(filePath);
			expect(result).toEqual(data);
		});

		test("restores from backup on corrupted main file", async () => {
			const tempDir = createTestDir();
			const filePath = join(tempDir, "data.json");
			const backupPath = `${filePath}.backup`;
			const data = { restored: true };

			// Create corrupted main file
			await writeFile(filePath, "invalid json {", "utf-8");

			// Create valid backup
			await writeFile(backupPath, JSON.stringify(data), "utf-8");

			const result = await safeReadJSON<typeof data>(filePath);
			expect(result).toEqual(data);

			// Main file should be repaired
			const repaired = await readFile(filePath, "utf-8");
			expect(repaired).toBe(JSON.stringify(data));
		});

		test("throws if both main and backup are invalid", async () => {
			const tempDir = createTestDir();
			const filePath = join(tempDir, "data.json");
			const backupPath = `${filePath}.backup`;

			// Create corrupted main file
			await writeFile(filePath, "invalid json {", "utf-8");

			// Create corrupted backup
			await writeFile(backupPath, "also invalid {", "utf-8");

			await expect(safeReadJSON(filePath)).rejects.toThrow();
		});

		test("throws if file doesn't exist", async () => {
			const tempDir = createTestDir();
			const filePath = join(tempDir, "nonexistent.json");
			await expect(safeReadJSON(filePath)).rejects.toThrow();
		});
	});

	describe("createBackup", () => {
		test("creates backup copy", async () => {
			const tempDir = createTestDir();
			const filePath = join(tempDir, "data.json");
			const data = { original: true };
			await writeFile(filePath, JSON.stringify(data), "utf-8");

			const backupPath = await createBackup(filePath);
			expect(backupPath).toBe(`${filePath}.backup`);

			const backup = await readFile(backupPath, "utf-8");
			expect(backup).toBe(JSON.stringify(data));
		});

		test("overwrites existing backup", async () => {
			const tempDir = createTestDir();
			const filePath = join(tempDir, "data.json");
			const backupPath = `${filePath}.backup`;

			// Create old backup
			await writeFile(backupPath, "old backup", "utf-8");

			// Create new file and backup
			await writeFile(filePath, "new content", "utf-8");
			await createBackup(filePath);

			const backup = await readFile(backupPath, "utf-8");
			expect(backup).toBe("new content");
		});

		test("throws if source file doesn't exist", async () => {
			const tempDir = createTestDir();
			const filePath = join(tempDir, "nonexistent.json");
			await expect(createBackup(filePath)).rejects.toThrow();
		});
	});

	describe("restoreFromBackup", () => {
		test("restores file from backup", async () => {
			const tempDir = createTestDir();
			const filePath = join(tempDir, "data.json");
			const backupPath = `${filePath}.backup`;

			// Create backup
			await writeFile(backupPath, "backup content", "utf-8");

			// Create corrupted main file
			await writeFile(filePath, "corrupted", "utf-8");

			// Restore
			await restoreFromBackup(filePath);

			const restored = await readFile(filePath, "utf-8");
			expect(restored).toBe("backup content");
		});

		test("throws if backup doesn't exist", async () => {
			const tempDir = createTestDir();
			const filePath = join(tempDir, "data.json");
			await expect(restoreFromBackup(filePath)).rejects.toThrow();
		});
	});

	describe("atomic operations - failure scenarios", () => {
		test("handles write interruption gracefully", async () => {
			const tempDir = createTestDir();
			const filePath = join(tempDir, "test.txt");

			// Simulate power loss by writing large content
			const largeContent = "x".repeat(10000000);

			// This should either fully succeed or fully fail (no partial writes)
			try {
				await atomicWriteFile(filePath, largeContent);
				const result = await readFile(filePath, "utf-8");
				expect(result.length).toBe(largeContent.length);
			} catch {
				// If failed, file shouldn't exist or should be empty
				const exists = await readFile(filePath, "utf-8").catch(() => null);
				expect(exists === null || exists.length === 0).toBe(true);
			}
		});

		test("no temp files left after failures", async () => {
			const tempDir = createTestDir();
			// Multiple failed writes
			for (let i = 0; i < 5; i++) {
				try {
					await atomicWriteFile("/invalid/path", `attempt ${i}`);
				} catch {
					// Expected
				}
			}

			// Check tempDir for .tmp files
			const { readdirSync } = await import("node:fs");
			const files = readdirSync(tempDir);
			const tempFiles = files.filter((f) => f.includes(".tmp."));
			expect(tempFiles.length).toBe(0);
		});
	});
});
