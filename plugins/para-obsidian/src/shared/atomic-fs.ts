/**
 * Atomic file operations using temp + rename pattern
 *
 * Prevents partial writes from corrupting data by writing to a temp file
 * first, then atomically renaming it to the target path. OS-level rename
 * operations are atomic on POSIX systems.
 *
 * @module shared/atomic-fs
 */

import { randomUUID } from "node:crypto";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { ensureParentDir } from "@sidequest/core/fs";
import { observe } from "./instrumentation.js";
import { fsLogger } from "./logger.js";

/**
 * Atomically write file using temp + rename pattern.
 * Prevents partial writes from corrupting data.
 *
 * @param filePath - Target file path
 * @param content - Content to write
 * @throws Error if write or rename fails
 *
 * @example
 * ```ts
 * // Safe write - no partial corruption even if interrupted
 * await atomicWriteFile('/vault/registry.json', JSON.stringify(data));
 * ```
 */
export async function atomicWriteFile(
	filePath: string,
	content: string,
): Promise<void> {
	return observe(
		fsLogger,
		"fs:atomicWriteFile",
		async () => {
			const tempPath = `${filePath}.tmp.${randomUUID()}`;

			try {
				// Ensure parent directory exists
				await ensureParentDir(filePath);

				// Write to temp file
				await writeFile(tempPath, content, "utf-8");

				// Atomic rename (OS-level operation)
				await rename(tempPath, filePath);
			} catch (error) {
				// Clean up temp file on failure
				await unlink(tempPath).catch(() => {
					// Ignore cleanup errors
				});
				throw error;
			}
		},
		{ context: { filePath, contentLength: content.length } },
	);
}

/**
 * Safely read JSON with backup restoration on corruption.
 * Falls back to .backup file if main file is corrupted.
 *
 * @param filePath - Path to JSON file
 * @returns Parsed JSON data
 * @throws Error if both main and backup files are invalid
 *
 * @example
 * ```ts
 * const registry = await safeReadJSON<RegistryData>('/vault/registry.json');
 * ```
 */
export async function safeReadJSON<T>(filePath: string): Promise<T> {
	return observe(
		fsLogger,
		"fs:safeReadJSON",
		async () => {
			try {
				const content = await readFile(filePath, "utf-8");
				return JSON.parse(content) as T;
			} catch (error) {
				// Try backup if main file corrupted
				const backupPath = `${filePath}.backup`;
				const backup = await readFile(backupPath, "utf-8").catch(() => null);

				if (backup) {
					console.warn(`Restored ${filePath} from backup`);
					await atomicWriteFile(filePath, backup);
					return JSON.parse(backup) as T;
				}

				throw error;
			}
		},
		{ context: { filePath } },
	);
}

/**
 * Create a backup copy of a file before modifying it.
 * Useful for rollback operations.
 *
 * @param filePath - Path to file to backup
 * @returns Path to backup file
 * @throws Error if backup creation fails
 *
 * @example
 * ```ts
 * const backupPath = await createBackup('/vault/registry.json');
 * // Later: restore from backupPath if needed
 * ```
 */
export async function createBackup(filePath: string): Promise<string> {
	return observe(
		fsLogger,
		"fs:createBackup",
		async () => {
			const backupPath = `${filePath}.backup`;
			const content = await readFile(filePath, "utf-8");
			await atomicWriteFile(backupPath, content);
			return backupPath;
		},
		{ context: { filePath } },
	);
}

/**
 * Restore a file from its backup.
 *
 * @param filePath - Original file path
 * @throws Error if backup doesn't exist or restore fails
 *
 * @example
 * ```ts
 * await restoreFromBackup('/vault/registry.json');
 * ```
 */
export async function restoreFromBackup(filePath: string): Promise<void> {
	return observe(
		fsLogger,
		"fs:restoreFromBackup",
		async () => {
			const backupPath = `${filePath}.backup`;
			const content = await readFile(backupPath, "utf-8");
			await atomicWriteFile(filePath, content);
		},
		{ context: { filePath } },
	);
}
