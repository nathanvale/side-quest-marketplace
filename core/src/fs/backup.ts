/**
 * Backup and restoration utilities for safe file operations.
 *
 * Provides utilities to create backup copies before modifying files,
 * and restore from backups if operations fail. Useful for atomic
 * operations that need rollback capability.
 *
 * @module fs/backup
 */

import { readFile, writeFile } from "node:fs/promises";
import { writeTextFileAtomic } from "./index.js";

/**
 * Create a backup copy of a file before modifying it.
 *
 * The backup is stored at `${filePath}.backup` using atomic write
 * to prevent corruption during backup creation.
 *
 * @param filePath - Path to file to backup
 * @returns Path to backup file (always `${filePath}.backup`)
 * @throws Error if backup creation fails (file doesn't exist or can't be read)
 *
 * @example
 * ```typescript
 * const backupPath = await createBackup('/vault/registry.json');
 * // backupPath = '/vault/registry.json.backup'
 *
 * try {
 *   // Modify the file...
 *   await modifyFile('/vault/registry.json');
 * } catch (error) {
 *   // Restore from backup on failure
 *   await restoreFromBackup('/vault/registry.json');
 * }
 * ```
 */
export async function createBackup(filePath: string): Promise<string> {
	const backupPath = `${filePath}.backup`;
	const content = await readFile(filePath, "utf-8");
	await writeTextFileAtomic(backupPath, content);
	return backupPath;
}

/**
 * Restore a file from its backup copy.
 *
 * Reads from `${filePath}.backup` and atomically restores to the original path.
 *
 * @param filePath - Original file path (backup is at `${filePath}.backup`)
 * @throws Error if backup doesn't exist or restore fails
 *
 * @example
 * ```typescript
 * await restoreFromBackup('/vault/registry.json');
 * // Restores from /vault/registry.json.backup
 * ```
 */
export async function restoreFromBackup(filePath: string): Promise<void> {
	const backupPath = `${filePath}.backup`;
	const content = await readFile(backupPath, "utf-8");
	await writeTextFileAtomic(filePath, content);
}

/**
 * Safely read and parse JSON file with automatic backup restoration on corruption.
 *
 * If the main file is corrupted or has invalid JSON, automatically attempts
 * to restore from `${filePath}.backup` and parse that instead.
 *
 * @param filePath - Path to JSON file
 * @returns Parsed JSON data
 * @throws Error if both main and backup files are invalid or missing
 *
 * @example
 * ```typescript
 * interface Registry {
 *   version: number;
 *   items: string[];
 * }
 *
 * try {
 *   const registry = await safeReadJSON<Registry>('/vault/registry.json');
 *   console.log(registry.items);
 * } catch (error) {
 *   console.error('Both main and backup files are corrupted');
 * }
 * ```
 */
export async function safeReadJSON<T>(filePath: string): Promise<T> {
	try {
		// Try to read and parse main file
		const content = await readFile(filePath, "utf-8");
		return JSON.parse(content) as T;
	} catch (error) {
		// Try backup if main file corrupted
		const backupPath = `${filePath}.backup`;
		const backup = await readFile(backupPath, "utf-8").catch(() => null);

		if (backup) {
			// Restore from backup and return parsed data
			console.warn(`Restored ${filePath} from backup`);
			await writeFile(filePath, backup, "utf-8");
			return JSON.parse(backup) as T;
		}

		// Both main and backup failed
		throw error;
	}
}
