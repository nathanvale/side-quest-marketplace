/**
 * Lightweight filesystem helpers using Bun primitives.
 *
 * These helpers avoid Node's fs module and lean on Bun.file/Bun.write
 * so other packages can share async file access without reimplementing
 * existence checks or JSON handling.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";

export async function pathExists(path: string): Promise<boolean> {
	const file = Bun.file(path);
	return await file.exists();
}

/**
 * Check if a path exists synchronously.
 *
 * @param path - Path to check
 * @returns true if path exists
 */
export function pathExistsSync(path: string): boolean {
	return existsSync(path);
}

export async function readTextFile(path: string): Promise<string> {
	const file = Bun.file(path);
	if (!(await file.exists())) {
		throw new Error(`File not found: ${path}`);
	}
	return file.text();
}

/**
 * Read file contents synchronously.
 *
 * Uses Bun.file() with synchronous text extraction.
 * Prefer async readTextFile when possible.
 *
 * @param path - Path to file
 * @returns File contents as string
 * @throws Error if file doesn't exist
 */
export function readTextFileSync(path: string): string {
	// Bun.file().text() returns a Promise, so for sync reading we use spawnSync
	const proc = Bun.spawnSync(["cat", path]);
	if (proc.exitCode !== 0) {
		throw new Error(`File not found: ${path}`);
	}
	return new TextDecoder().decode(proc.stdout);
}

export async function readJsonFile<T>(path: string): Promise<T> {
	const text = await readTextFile(path);
	return JSON.parse(text) as T;
}

/**
 * Read JSON file synchronously.
 *
 * @param path - Path to JSON file
 * @returns Parsed JSON content
 */
export function readJsonFileSync<T>(path: string): T {
	const text = readTextFileSync(path);
	return JSON.parse(text) as T;
}

export async function writeTextFile(
	path: string,
	contents: string,
): Promise<void> {
	await Bun.write(path, contents);
}

/**
 * Write text to a file synchronously.
 *
 * @param path - Path to file
 * @param contents - Content to write
 */
export function writeTextFileSync(path: string, contents: string): void {
	writeFileSync(path, contents, "utf-8");
}

export async function writeJsonFile(
	path: string,
	value: unknown,
	space = 2,
): Promise<void> {
	await writeTextFile(path, `${JSON.stringify(value, null, space)}\n`);
}

/**
 * Write JSON to a file synchronously.
 *
 * @param path - Path to file
 * @param value - Value to serialize as JSON
 * @param space - Indentation spaces (default: 2)
 */
export function writeJsonFileSync(
	path: string,
	value: unknown,
	space = 2,
): void {
	writeTextFileSync(path, `${JSON.stringify(value, null, space)}\n`);
}

/**
 * Ensure a directory exists, creating it if necessary.
 *
 * @param path - Directory path
 */
export async function ensureDir(path: string): Promise<void> {
	await mkdir(path, { recursive: true });
}

/**
 * Ensure a directory exists synchronously.
 *
 * @param path - Directory path
 */
export function ensureDirSync(path: string): void {
	mkdirSync(path, { recursive: true });
}

/**
 * Calculate SHA256 hash of a string using Bun's native hashing.
 *
 * @param content - Content to hash
 * @returns Hexadecimal hash string
 */
export function sha256(content: string): string {
	const hasher = new Bun.CryptoHasher("sha256");
	hasher.update(content);
	return hasher.digest("hex");
}

/**
 * Calculate a fast non-cryptographic hash for cache keys.
 *
 * Uses Bun.hash (xxHash64) which is much faster than SHA256
 * but not suitable for security purposes.
 *
 * @param content - Content to hash
 * @returns Hash as bigint (or number for small values)
 */
export function fastHash(content: string): bigint | number {
	return Bun.hash(content);
}

/**
 * Deep equality check using Bun's native deepEquals.
 *
 * @param a - First value
 * @param b - Second value
 * @param strict - If true, don't allow undefined properties to match missing ones
 * @returns true if values are deeply equal
 */
export function deepEquals(a: unknown, b: unknown, strict = false): boolean {
	return Bun.deepEquals(a, b, strict);
}

/**
 * Calculate SHA256 hash of a file's contents using Bun's native hashing.
 * Useful for content-based deduplication and cache invalidation.
 *
 * @param filePath - Path to the file to hash
 * @returns Hex-encoded SHA256 hash
 */
export async function sha256File(filePath: string): Promise<string> {
	const file = Bun.file(filePath);
	const buffer = await file.arrayBuffer();
	const hasher = new Bun.CryptoHasher("sha256");
	hasher.update(buffer);
	return hasher.digest("hex");
}

/**
 * Copy a file using Bun's native file API.
 * Creates parent directories if they don't exist.
 *
 * @param src - Source file path
 * @param dest - Destination file path
 */
export async function copyFile(src: string, dest: string): Promise<void> {
	await Bun.write(dest, Bun.file(src));
}

/**
 * Move a file (copy then delete source).
 * Handles cross-filesystem moves where rename() would fail.
 *
 * @param src - Source file path
 * @param dest - Destination file path
 */
export async function moveFile(src: string, dest: string): Promise<void> {
	await copyFile(src, dest);
	const { unlink } = await import("node:fs/promises");
	await unlink(src);
}
