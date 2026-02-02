/**
 * Filesystem utilities - hybrid Bun native + node:fs approach
 *
 * Async operations use Bun.file()/Bun.write() for performance
 * Sync operations use node:fs (native in Bun, no process spawning)
 *
 * Bun-specific utilities (hashing, deepEquals) provide unique value-add.
 */

import {
	appendFileSync,
	existsSync,
	copyFileSync as fsCopyFileSync,
	renameSync as fsRenameSync,
	unlinkSync as fsUnlinkSync,
	mkdirSync,
	statSync as nodeStatSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import {
	appendFile,
	copyFile as fsCopyFile,
	rename as fsRename,
	stat as fsStat,
	unlink as fsUnlink,
	mkdir,
	readdir,
	rm,
} from "node:fs/promises";
import path from "node:path";

// ============================================
// ASYNC OPERATIONS - Bun native where beneficial
// ============================================

/**
 * Check if a path exists asynchronously.
 * Works for both files and directories.
 *
 * Note: Bun.file().exists() only works for files, not directories.
 * We use fsStat which handles both.
 *
 * @param filePath - Path to check
 * @returns true if path exists (file or directory)
 */
export async function pathExists(filePath: string): Promise<boolean> {
	try {
		await fsStat(filePath);
		return true;
	} catch {
		return false;
	}
}

/**
 * Read file contents asynchronously using Bun's native file API.
 *
 * @param filePath - Path to file
 * @returns File contents as string
 * @throws Error if file doesn't exist
 */
export async function readTextFile(filePath: string): Promise<string> {
	const file = Bun.file(filePath);
	if (!(await file.exists())) {
		throw new Error(`File not found: ${filePath}`);
	}
	return file.text();
}

/**
 * Read JSON file asynchronously using Bun's native file API.
 *
 * @param filePath - Path to JSON file
 * @returns Parsed JSON content
 */
export async function readJsonFile<T>(filePath: string): Promise<T> {
	const file = Bun.file(filePath);
	if (!(await file.exists())) {
		throw new Error(`File not found: ${filePath}`);
	}
	return file.json();
}

/**
 * Read binary file asynchronously using Bun's native file API.
 *
 * @param filePath - Path to file
 * @returns File contents as ArrayBuffer
 */
export async function readBinaryFile(filePath: string): Promise<ArrayBuffer> {
	return Bun.file(filePath).arrayBuffer();
}

/**
 * Write text to a file asynchronously using Bun's native write.
 *
 * @param filePath - Path to file
 * @param content - Content to write
 */
export async function writeTextFile(
	filePath: string,
	content: string,
): Promise<void> {
	await Bun.write(filePath, content);
}

/**
 * Write JSON to a file asynchronously.
 *
 * @param filePath - Path to file
 * @param value - Value to serialize as JSON
 * @param space - Indentation spaces (default: 2)
 */
export async function writeJsonFile(
	filePath: string,
	value: unknown,
	space = 2,
): Promise<void> {
	await Bun.write(filePath, `${JSON.stringify(value, null, space)}\n`);
}

/**
 * Write binary data to a file asynchronously.
 *
 * @param filePath - Path to file
 * @param content - Binary content to write
 */
export async function writeBinaryFile(
	filePath: string,
	content: ArrayBuffer | Uint8Array,
): Promise<void> {
	await Bun.write(filePath, content);
}

/**
 * Ensure a directory exists, creating it if necessary.
 *
 * @param dirPath - Directory path
 */
export async function ensureDir(dirPath: string): Promise<void> {
	await mkdir(dirPath, { recursive: true });
}

/**
 * Ensure parent directory exists for a file path.
 *
 * @param filePath - File path
 */
export async function ensureParentDir(filePath: string): Promise<void> {
	await mkdir(path.dirname(filePath), { recursive: true });
}

/**
 * Copy a file using Bun's zero-copy optimization.
 *
 * @param src - Source file path
 * @param dest - Destination file path
 */
export async function copyFile(src: string, dest: string): Promise<void> {
	await Bun.write(dest, Bun.file(src));
}

/**
 * Move/rename a file.
 *
 * @param src - Source file path
 * @param dest - Destination file path
 */
export async function moveFile(src: string, dest: string): Promise<void> {
	await fsRename(src, dest);
}

/**
 * Rename a file (alias for moveFile).
 *
 * @param oldPath - Current file path
 * @param newPath - New file path
 */
export async function rename(oldPath: string, newPath: string): Promise<void> {
	await fsRename(oldPath, newPath);
}

/**
 * Delete a file.
 *
 * @param filePath - File path to delete
 */
export async function unlink(filePath: string): Promise<void> {
	await fsUnlink(filePath);
}

/**
 * Remove a directory recursively.
 *
 * @param dirPath - Directory to remove
 * @param options - Options (force: ignore errors)
 */
export async function removeDir(
	dirPath: string,
	options?: { recursive?: boolean; force?: boolean },
): Promise<void> {
	await rm(dirPath, { recursive: true, ...options });
}

/**
 * List files in a directory asynchronously.
 *
 * @param dirPath - Directory path
 * @returns Array of file/directory names
 */
export async function readDirAsync(dirPath: string): Promise<string[]> {
	return readdir(dirPath);
}

/**
 * List files in a directory recursively.
 *
 * @param dirPath - Directory path
 * @returns Array of relative file paths
 */
export async function readDirRecursive(dirPath: string): Promise<string[]> {
	return readdir(dirPath, { recursive: true }) as Promise<string[]>;
}

/**
 * Append content to a file.
 *
 * @param filePath - Path to file
 * @param content - Content to append
 */
export async function appendToFile(
	filePath: string,
	content: string,
): Promise<void> {
	await appendFile(filePath, content);
}

/**
 * Get file info using Bun's file API.
 *
 * @param filePath - File path
 * @returns Object with size, lastModified, and type
 */
export async function getFileInfo(
	filePath: string,
): Promise<{ size: number; lastModified: number; type: string }> {
	const file = Bun.file(filePath);
	if (!(await file.exists())) {
		throw new Error(`File not found: ${filePath}`);
	}
	return {
		size: file.size,
		lastModified: file.lastModified,
		type: file.type,
	};
}

/**
 * Get file statistics.
 *
 * @param filePath - File path
 * @returns Object with size and mtimeMs
 */
export async function stat(
	filePath: string,
): Promise<{ size: number; mtimeMs: number }> {
	const s = await fsStat(filePath);
	return {
		size: s.size,
		mtimeMs: s.mtimeMs,
	};
}

// ============================================
// SYNC OPERATIONS - node:fs (native in Bun)
// ============================================

/**
 * Check if a path exists synchronously.
 *
 * @param filePath - Path to check
 * @returns true if path exists
 */
export function pathExistsSync(filePath: string): boolean {
	return existsSync(filePath);
}

/**
 * Read file contents synchronously.
 *
 * @param filePath - Path to file
 * @returns File contents as string
 * @throws Error if file doesn't exist
 */
export function readTextFileSync(filePath: string): string {
	try {
		return readFileSync(filePath, "utf8");
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") {
			throw new Error(`File not found: ${filePath}`);
		}
		throw err;
	}
}

/**
 * Read JSON file synchronously.
 *
 * @param filePath - Path to JSON file
 * @returns Parsed JSON content
 */
export function readJsonFileSync<T>(filePath: string): T {
	const text = readTextFileSync(filePath);
	return JSON.parse(text) as T;
}

/**
 * Read binary file synchronously.
 *
 * @param filePath - Path to file
 * @returns File contents as Buffer
 */
export function readBinaryFileSync(filePath: string): Buffer {
	return readFileSync(filePath);
}

/**
 * Write text to a file synchronously.
 *
 * @param filePath - Path to file
 * @param content - Content to write
 */
export function writeTextFileSync(filePath: string, content: string): void {
	writeFileSync(filePath, content, "utf8");
}

/**
 * Write JSON to a file synchronously.
 *
 * @param filePath - Path to file
 * @param value - Value to serialize as JSON
 * @param space - Indentation spaces (default: 2)
 */
export function writeJsonFileSync(
	filePath: string,
	value: unknown,
	space = 2,
): void {
	writeFileSync(filePath, `${JSON.stringify(value, null, space)}\n`, "utf8");
}

/**
 * Write binary data to a file synchronously.
 *
 * @param filePath - Path to file
 * @param content - Binary content to write
 */
export function writeBinaryFileSync(
	filePath: string,
	content: Buffer | Uint8Array,
): void {
	writeFileSync(filePath, content);
}

/**
 * Ensure a directory exists synchronously.
 *
 * @param dirPath - Directory path
 */
export function ensureDirSync(dirPath: string): void {
	mkdirSync(dirPath, { recursive: true });
}

/**
 * Ensure parent directory exists synchronously.
 *
 * @param filePath - File path
 */
export function ensureParentDirSync(filePath: string): void {
	mkdirSync(path.dirname(filePath), { recursive: true });
}

/**
 * Copy a file synchronously.
 *
 * @param src - Source file path
 * @param dest - Destination file path
 */
export function copyFileSync(src: string, dest: string): void {
	fsCopyFileSync(src, dest);
}

/**
 * Move/rename a file synchronously.
 *
 * @param src - Source file path
 * @param dest - Destination file path
 */
export function moveFileSync(src: string, dest: string): void {
	fsRenameSync(src, dest);
}

/**
 * Rename a file synchronously (alias for moveFileSync).
 *
 * @param oldPath - Current file path
 * @param newPath - New file path
 */
export function renameSync(oldPath: string, newPath: string): void {
	fsRenameSync(oldPath, newPath);
}

/**
 * Delete a file synchronously.
 *
 * @param filePath - File path to delete
 */
export function unlinkSync(filePath: string): void {
	fsUnlinkSync(filePath);
}

/**
 * Remove a directory recursively (sync).
 *
 * @param dirPath - Directory to remove
 * @param options - Options (force: ignore errors)
 */
export function removeDirSync(
	dirPath: string,
	options?: { recursive?: boolean; force?: boolean },
): void {
	rmSync(dirPath, { recursive: true, ...options });
}

/**
 * List files in a directory synchronously.
 *
 * @param dirPath - Directory path
 * @returns Array of file/directory names
 */
export function readDir(dirPath: string): string[] {
	return readdirSync(dirPath);
}

/**
 * List files in a directory recursively (sync).
 *
 * @param dirPath - Directory path
 * @returns Array of relative file paths
 */
export function readDirRecursiveSync(dirPath: string): string[] {
	return readdirSync(dirPath, { recursive: true }) as string[];
}

/**
 * Append content to a file synchronously.
 *
 * @param filePath - Path to file
 * @param content - Content to append
 */
export function appendToFileSync(filePath: string, content: string): void {
	appendFileSync(filePath, content, "utf8");
}

/**
 * Check if path is a directory.
 *
 * @param filePath - Path to check
 * @returns true if path is a directory
 */
export function isDirectorySync(filePath: string): boolean {
	return existsSync(filePath) && nodeStatSync(filePath).isDirectory();
}

/**
 * Check if path is a file.
 *
 * @param filePath - Path to check
 * @returns true if path is a file
 */
export function isFileSync(filePath: string): boolean {
	return existsSync(filePath) && nodeStatSync(filePath).isFile();
}

/**
 * Get file statistics synchronously.
 *
 * @param filePath - File path
 * @returns Stats object
 */
export function statSync(filePath: string): {
	size: number;
	mtimeMs: number;
	isDirectory: () => boolean;
	isFile: () => boolean;
	isSymbolicLink: () => boolean;
} {
	return nodeStatSync(filePath);
}

// ============================================
// BUN-SPECIFIC UTILITIES - Re-exports from specialized modules
// These are kept here for backwards compatibility
// Prefer importing from @sidequest/core/hash and @sidequest/core/utils
// ============================================

// Re-export hash functions for backwards compatibility
export {
	fastHash,
	sha256,
	sha256File,
} from "../hash/index.js";

// Re-export utils functions for backwards compatibility
export { deepEquals, safeJsonParse } from "../utils/index.js";

// ============================================
// TEMP FILES - useful for CLI tools
// ============================================

/**
 * Create a temporary directory with a unique name.
 *
 * @param prefix - Prefix for the directory name
 * @returns Path to the created temp directory
 */
export function createTempDir(prefix = "temp"): string {
	const dir = path.join(
		process.env.TMPDIR || "/tmp",
		`${prefix}-${crypto.randomUUID()}`,
	);
	mkdirSync(dir, { recursive: true });
	return dir;
}

/**
 * Run a function with a temporary directory, cleaning up after.
 *
 * @param fn - Async function that receives the temp directory path
 * @param prefix - Prefix for the directory name
 * @returns Result of the function
 */
export async function withTempDir<T>(
	fn: (tempDir: string) => Promise<T>,
	prefix = "temp",
): Promise<T> {
	const dir = createTempDir(prefix);
	try {
		return await fn(dir);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

/**
 * Run a sync function with a temporary directory, cleaning up after.
 *
 * @param fn - Sync function that receives the temp directory path
 * @param prefix - Prefix for the directory name
 * @returns Result of the function
 */
export function withTempDirSync<T>(
	fn: (tempDir: string) => T,
	prefix = "temp",
): T {
	const dir = createTempDir(prefix);
	try {
		return fn(dir);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

/**
 * Generate a temp file path (doesn't create the file).
 *
 * @param prefix - Prefix for the file name
 * @param ext - File extension
 * @returns Path to the temp file
 */
export function createTempFilePath(prefix = "temp", ext = ""): string {
	const dir = process.env.TMPDIR || "/tmp";
	return path.join(dir, `${prefix}-${crypto.randomUUID()}${ext}`);
}

/**
 * Execute an operation that writes JSON output to a temp file.
 * Handles creation, cleanup, and error recovery automatically.
 *
 * @param prefix - Prefix for temp file name
 * @param fn - Function that receives temp path and returns execution result
 * @returns Parsed JSON content from temp file
 * @throws Error if exit code non-zero or output file not found
 */
export {
	type TempFileExecutionResult,
	withTempJsonFile,
	withTempJsonFileSync,
} from "./temp-json.js";

// ============================================
// ATOMIC WRITES - safe for concurrent access
// ============================================

/**
 * Write text file atomically (write to temp, then rename).
 * Safe for concurrent access and prevents partial writes.
 *
 * @param filePath - Target file path
 * @param content - Content to write
 */
export async function writeTextFileAtomic(
	filePath: string,
	content: string,
): Promise<void> {
	const tempPath = `${filePath}.${crypto.randomUUID()}.tmp`;
	await Bun.write(tempPath, content);
	await fsRename(tempPath, filePath);
}

/**
 * Write JSON file atomically.
 *
 * @param filePath - Target file path
 * @param value - Value to serialize as JSON
 * @param space - Indentation spaces (default: 2)
 */
export async function writeJsonFileAtomic(
	filePath: string,
	value: unknown,
	space = 2,
): Promise<void> {
	await writeTextFileAtomic(
		filePath,
		`${JSON.stringify(value, null, space)}\n`,
	);
}

/**
 * Write text file atomically (sync version).
 *
 * @param filePath - Target file path
 * @param content - Content to write
 */
export function writeTextFileSyncAtomic(
	filePath: string,
	content: string,
): void {
	const tempPath = `${filePath}.${crypto.randomUUID()}.tmp`;
	writeFileSync(tempPath, content, "utf8");
	fsRenameSync(tempPath, filePath);
}

/**
 * Write JSON file atomically (sync version).
 *
 * @param filePath - Target file path
 * @param value - Value to serialize as JSON
 * @param space - Indentation spaces (default: 2)
 */
export function writeJsonFileSyncAtomic(
	filePath: string,
	value: unknown,
	space = 2,
): void {
	writeTextFileSyncAtomic(filePath, `${JSON.stringify(value, null, space)}\n`);
}

// ============================================
// ADDITIONAL HELPERS - useful for CLI tools
// ============================================

/**
 * Read JSON file, returning default value if file doesn't exist or is invalid.
 *
 * @param filePath - Path to JSON file
 * @param defaultValue - Value to return on error
 * @returns Parsed JSON or default value
 */
export function readJsonFileOrDefault<T>(filePath: string, defaultValue: T): T {
	if (!existsSync(filePath)) return defaultValue;
	try {
		return readJsonFileSync(filePath);
	} catch {
		return defaultValue;
	}
}

/**
 * Find a file by walking up directories (like finding package.json).
 *
 * @param filename - Name of file to find
 * @param startDir - Directory to start search (default: cwd)
 * @returns Full path to file, or null if not found
 */
export function findUpSync(
	filename: string,
	startDir = process.cwd(),
): string | null {
	let dir = startDir;
	while (true) {
		const filePath = path.join(dir, filename);
		if (existsSync(filePath)) return filePath;
		const parent = path.dirname(dir);
		if (parent === dir) return null;
		dir = parent;
	}
}

/**
 * Get project root (directory containing package.json).
 *
 * @param startDir - Directory to start search (default: cwd)
 * @returns Path to project root, or null if not found
 */
export function findProjectRoot(startDir = process.cwd()): string | null {
	const pkgPath = findUpSync("package.json", startDir);
	return pkgPath ? path.dirname(pkgPath) : null;
}

/**
 * Ensure file exists with default content.
 *
 * @param filePath - Path to file
 * @param defaultContent - Content to write if file doesn't exist
 */
export function ensureFileSync(filePath: string, defaultContent = ""): void {
	if (!existsSync(filePath)) {
		ensureParentDirSync(filePath);
		writeFileSync(filePath, defaultContent, "utf8");
	}
}

/**
 * Read lines from a file as array (empty lines filtered out).
 *
 * @param filePath - Path to file
 * @returns Array of non-empty lines
 */
export function readLinesSync(filePath: string): string[] {
	return readTextFileSync(filePath).split("\n").filter(Boolean);
}

/**
 * Write lines to a file.
 *
 * @param filePath - Path to file
 * @param lines - Lines to write
 */
export function writeLinesSync(filePath: string, lines: string[]): void {
	writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

// Note: safeJsonParse is re-exported from utils above for backwards compatibility

// ============================================
// RE-EXPORTS - convenience for common node:fs functions
// ============================================

export {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	writeFileSync,
	rmSync,
	fsCopyFileSync as nodeCopyFileSync,
	fsRenameSync as nodeRenameSync,
	fsUnlinkSync as nodeUnlinkSync,
};

export {
	mkdir,
	readdir,
	rm,
	fsCopyFile as nodeCopyFile,
	fsRename as nodeRename,
	fsUnlink as nodeUnlink,
	fsStat as nodeStat,
};

// ============================================
// RE-EXPORTS - New utility modules
// ============================================

// Backup and restore utilities
export {
	createBackup,
	restoreFromBackup,
	safeReadJSON,
} from "./backup.js";
// Cache directory utilities
export {
	ensureCacheDir,
	getCacheStats,
	isCachePopulated,
} from "./cache.js";
// Config file detection utilities
export {
	type ConfigAtRootResult,
	findNearestConfig,
	hasConfigAtRoot,
	type NearestConfigResult,
} from "./config.js";
// Path utilities
export {
	expandTilde,
	matchesDir,
	normalizePath,
	normalizePathFragment,
} from "./path.js";
// Path safety and validation utilities
export {
	sanitizePattern,
	validateFilePath,
	validatePathSafety,
} from "./safety.js";
// Sandbox path security utilities
export {
	resolveSandboxedPath,
	type SandboxedPath,
	validateConfigPath,
	validateFilenameForSubprocess,
} from "./sandbox.js";
// File statistics utilities
export {
	getFileAgeHours,
	getFileSizeMB,
	isFileStale,
} from "./stats.js";
// Directory walking utilities
export {
	type FileVisitor,
	type WalkDirectoryOptions,
	walkDirectory,
} from "./walk.js";
