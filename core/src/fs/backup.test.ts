import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import path from "node:path";
import { createBackup, restoreFromBackup, safeReadJSON } from "./backup.js";
import { pathExists, readTextFile, writeTextFile } from "./index.js";

describe("backup utilities", () => {
	let tempDir: string;
	let testFile: string;

	beforeEach(() => {
		tempDir = path.join(
			process.env.TMPDIR || "/tmp",
			`backup-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		testFile = path.join(tempDir, "test.json");
		Bun.spawnSync(["mkdir", "-p", tempDir]);
	});

	afterEach(async () => {
		try {
			Bun.spawnSync(["rm", "-rf", tempDir]);
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("createBackup", () => {
		test("creates backup file with .backup extension", async () => {
			// Arrange
			const content = "original content";
			await writeTextFile(testFile, content);

			// Act
			const backupPath = await createBackup(testFile);

			// Assert
			expect(backupPath).toBe(`${testFile}.backup`);
			expect(await pathExists(backupPath)).toBe(true);
			expect(await readTextFile(backupPath)).toBe(content);
		});

		test("backup contains exact copy of original file", async () => {
			// Arrange
			const jsonData = { version: 1, items: ["a", "b", "c"] };
			await writeTextFile(testFile, JSON.stringify(jsonData, null, 2));

			// Act
			const backupPath = await createBackup(testFile);

			// Assert
			const backupContent = await readTextFile(backupPath);
			expect(JSON.parse(backupContent)).toEqual(jsonData);
		});

		test("throws error if source file does not exist", async () => {
			// Act & Assert
			await expect(createBackup(testFile)).rejects.toThrow();
		});

		test("overwrites existing backup file", async () => {
			// Arrange
			await writeTextFile(testFile, "first version");
			const backupPath = await createBackup(testFile);

			// Modify original and create new backup
			await writeTextFile(testFile, "second version");

			// Act
			await createBackup(testFile);

			// Assert
			expect(await readTextFile(backupPath)).toBe("second version");
		});
	});

	describe("restoreFromBackup", () => {
		test("restores file from backup", async () => {
			// Arrange
			const originalContent = "original";
			await writeTextFile(testFile, originalContent);
			await createBackup(testFile);

			// Corrupt the original file
			await writeTextFile(testFile, "corrupted");

			// Act
			await restoreFromBackup(testFile);

			// Assert
			expect(await readTextFile(testFile)).toBe(originalContent);
		});

		test("throws error if backup does not exist", async () => {
			// Act & Assert
			await expect(restoreFromBackup(testFile)).rejects.toThrow();
		});

		test("restores JSON structure correctly", async () => {
			// Arrange
			const jsonData = { status: "active", count: 42 };
			await writeTextFile(testFile, JSON.stringify(jsonData));
			await createBackup(testFile);

			// Corrupt original
			await writeTextFile(testFile, "{invalid json}");

			// Act
			await restoreFromBackup(testFile);

			// Assert
			const restored = JSON.parse(await readTextFile(testFile));
			expect(restored).toEqual(jsonData);
		});
	});

	describe("safeReadJSON", () => {
		test("reads valid JSON file successfully", async () => {
			// Arrange
			const data = { version: 1, items: ["a", "b"] };
			await writeTextFile(testFile, JSON.stringify(data));

			// Act
			const result = await safeReadJSON<typeof data>(testFile);

			// Assert
			expect(result).toEqual(data);
		});

		test("falls back to backup when main file is corrupted", async () => {
			// Arrange
			const validData = { version: 1, items: ["backup"] };
			await writeTextFile(testFile, JSON.stringify(validData));
			await createBackup(testFile);

			// Corrupt main file
			await writeTextFile(testFile, "{invalid json");

			// Act
			const result = await safeReadJSON<typeof validData>(testFile);

			// Assert
			expect(result).toEqual(validData);
		});

		test("restores main file from backup after successful read", async () => {
			// Arrange
			const validData = { restored: true };
			await writeTextFile(testFile, JSON.stringify(validData));
			await createBackup(testFile);

			// Corrupt main file
			await writeTextFile(testFile, "corrupted");

			// Act
			await safeReadJSON(testFile);

			// Assert - main file should be restored
			const mainContent = await readTextFile(testFile);
			expect(JSON.parse(mainContent)).toEqual(validData);
		});

		test("throws error if both main and backup are invalid", async () => {
			// Arrange
			await writeTextFile(testFile, "{invalid json");
			await writeTextFile(`${testFile}.backup`, "{also invalid");

			// Act & Assert
			await expect(safeReadJSON(testFile)).rejects.toThrow();
		});

		test("throws error if main file missing and no backup exists", async () => {
			// Act & Assert
			await expect(safeReadJSON(testFile)).rejects.toThrow();
		});

		test("handles complex nested JSON structures", async () => {
			// Arrange
			const complexData = {
				metadata: { version: 2, created: "2024-01-01" },
				items: [{ id: 1, nested: { value: "test" } }],
			};
			await writeTextFile(testFile, JSON.stringify(complexData));
			await createBackup(testFile);

			// Corrupt main
			await writeTextFile(testFile, "corrupted");

			// Act
			const result = await safeReadJSON<typeof complexData>(testFile);

			// Assert
			expect(result).toEqual(complexData);
		});

		test("preserves type information through generic parameter", async () => {
			// Arrange
			interface TestData {
				count: number;
				items: string[];
			}
			const data: TestData = { count: 3, items: ["a", "b", "c"] };
			await writeTextFile(testFile, JSON.stringify(data));

			// Act
			const result = await safeReadJSON<TestData>(testFile);

			// Assert
			expect(result.count).toBe(3);
			expect(result.items).toHaveLength(3);
		});
	});

	describe("integration scenarios", () => {
		test("backup-modify-restore workflow", async () => {
			// Arrange
			const original = { value: 100 };
			await writeTextFile(testFile, JSON.stringify(original));

			// Act
			await createBackup(testFile);
			await writeTextFile(testFile, JSON.stringify({ value: 200 }));
			await restoreFromBackup(testFile);

			// Assert
			const restored = await safeReadJSON<typeof original>(testFile);
			expect(restored.value).toBe(100);
		});

		test("multiple backup cycles", async () => {
			// Arrange
			await writeTextFile(testFile, "version 1");

			// Act - create multiple backups
			await createBackup(testFile);
			await writeTextFile(testFile, "version 2");
			await createBackup(testFile);
			await writeTextFile(testFile, "version 3");

			// Restore from backup
			await restoreFromBackup(testFile);

			// Assert - should have version 2 (last backup)
			expect(await readTextFile(testFile)).toBe("version 2");
		});

		test("safeReadJSON with multiple corruption attempts", async () => {
			// Arrange
			const validData = { attempts: 0 };
			await writeTextFile(testFile, JSON.stringify(validData));
			await createBackup(testFile);

			// Act - corrupt multiple times
			for (let i = 0; i < 3; i++) {
				await writeTextFile(testFile, "corrupted");
				const result = await safeReadJSON<typeof validData>(testFile);
				expect(result).toEqual(validData);
			}
		});
	});
});
