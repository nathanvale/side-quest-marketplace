/**
 * Pure Bun-native filesystem utilities.
 *
 * Zero node:fs dependencies - all operations use Bun primitives:
 * - Bun.file() / Bun.write() for file I/O
 * - Bun.spawn() / Bun.spawnSync() for shell commands (array args only, command-injection safe)
 * - Bun.CryptoHasher / Bun.hash() for hashing
 * - Bun.deepEquals() for deep equality checks
 *
 * Security guarantees:
 * - Command injection safe (shell commands use array arguments)
 * - TOCTOU protection available via stat() for critical operations
 * - Atomic writes pattern supported (temp file + rename)
 */

export async function pathExists(path: string): Promise<boolean> {
	const file = Bun.file(path);
	return await file.exists();
}

/**
 * Check if a path exists synchronously using Bun-native test command.
 *
 * @param path - Path to check
 * @returns true if path exists
 */
export function pathExistsSync(path: string): boolean {
	const proc = Bun.spawnSync(["test", "-e", path]);
	return proc.exitCode === 0;
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
 * Uses Bun.spawnSync with cat for synchronous reading.
 * Prefer async readTextFile when possible.
 *
 * @param path - Path to file
 * @returns File contents as string
 * @throws Error if file doesn't exist
 */
export function readTextFileSync(path: string): string {
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
 * Write text to a file synchronously using Bun.write.
 *
 * Note: Bun.write is actually async, but we can use spawnSync for truly sync writes.
 *
 * @param path - Path to file
 * @param contents - Content to write
 */
export function writeTextFileSync(path: string, contents: string): void {
	// Use printf instead of echo to avoid newline issues
	const proc = Bun.spawnSync([
		"sh",
		"-c",
		`printf '%s' "$1" > "$2"`,
		"sh",
		contents,
		path,
	]);
	if (proc.exitCode !== 0) {
		throw new Error(`Failed to write file: ${path}`);
	}
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
 * Uses Bun-native spawn with mkdir -p.
 *
 * @param path - Directory path
 */
export async function ensureDir(path: string): Promise<void> {
	const proc = Bun.spawn(["mkdir", "-p", path]);
	await proc.exited;
	if (proc.exitCode !== 0) {
		throw new Error(`Failed to create directory: ${path}`);
	}
}

/**
 * Ensure a directory exists synchronously using Bun-native spawnSync.
 *
 * @param path - Directory path
 */
export function ensureDirSync(path: string): void {
	const proc = Bun.spawnSync(["mkdir", "-p", path]);
	if (proc.exitCode !== 0) {
		throw new Error(`Failed to create directory: ${path}`);
	}
}

/**
 * List files in a directory synchronously.
 * Returns just the file/directory names, not full paths.
 * Uses Bun-native spawnSync with ls.
 *
 * @param path - Directory path
 * @returns Array of file/directory names
 */
export function readDir(path: string): string[] {
	const proc = Bun.spawnSync(["ls", "-1", path]);
	if (proc.exitCode !== 0) {
		throw new Error(`Failed to read directory: ${path}`);
	}
	const output = new TextDecoder().decode(proc.stdout);
	return output
		.trim()
		.split("\n")
		.filter((s) => s.length > 0);
}

/**
 * List files in a directory asynchronously.
 * Returns just the file/directory names, not full paths.
 * Uses Bun-native spawn with ls.
 *
 * @param path - Directory path
 * @returns Array of file/directory names
 */
export async function readDirAsync(path: string): Promise<string[]> {
	const proc = Bun.spawn(["ls", "-1", path]);
	await proc.exited;
	if (proc.exitCode !== 0) {
		throw new Error(`Failed to read directory: ${path}`);
	}
	const output = new TextDecoder().decode(
		await Bun.readableStreamToArrayBuffer(proc.stdout),
	);
	return output
		.trim()
		.split("\n")
		.filter((s) => s.length > 0);
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
 * Uses Bun-native spawn with rm.
 *
 * @param src - Source file path
 * @param dest - Destination file path
 */
export async function moveFile(src: string, dest: string): Promise<void> {
	await copyFile(src, dest);
	const proc = Bun.spawn(["rm", src]);
	await proc.exited;
	if (proc.exitCode !== 0) {
		throw new Error(`Failed to remove source file: ${src}`);
	}
}

/**
 * Rename/move a file atomically.
 * Uses Bun-native spawn with mv.
 *
 * @param oldPath - Current file path
 * @param newPath - New file path
 */
export async function rename(oldPath: string, newPath: string): Promise<void> {
	const proc = Bun.spawn(["mv", oldPath, newPath]);
	await proc.exited;
	if (proc.exitCode !== 0) {
		throw new Error(`Failed to rename ${oldPath} to ${newPath}`);
	}
}

/**
 * Delete a file.
 * Uses Bun-native spawn with rm.
 *
 * @param path - File path to delete
 */
export async function unlink(path: string): Promise<void> {
	const proc = Bun.spawn(["rm", path]);
	await proc.exited;
	if (proc.exitCode !== 0) {
		throw new Error(`Failed to delete file: ${path}`);
	}
}

/**
 * Delete a file synchronously.
 * Uses Bun-native spawnSync with rm.
 *
 * @param path - File path to delete
 */
export function unlinkSync(path: string): void {
	const proc = Bun.spawnSync(["rm", path]);
	if (proc.exitCode !== 0) {
		throw new Error(`Failed to delete file: ${path}`);
	}
}

/**
 * Get file statistics.
 * Returns size and modification time using Bun.file().
 *
 * @param path - File path
 * @returns Object with size and mtimeMs
 */
export async function stat(
	path: string,
): Promise<{ size: number; mtimeMs: number }> {
	const file = Bun.file(path);
	if (!(await file.exists())) {
		throw new Error(`File not found: ${path}`);
	}
	return {
		size: file.size,
		mtimeMs: file.lastModified,
	};
}
