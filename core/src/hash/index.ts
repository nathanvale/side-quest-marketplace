/**
 * Hashing utilities using Bun's native crypto
 *
 * Provides both cryptographic (SHA256, MD5) and fast non-cryptographic
 * (xxHash64) hashing functions.
 */

/**
 * SHA256 hash of a string
 */
export function sha256(content: string): string {
	const hasher = new Bun.CryptoHasher("sha256");
	hasher.update(content);
	return hasher.digest("hex");
}

/**
 * SHA256 hash of binary data
 */
export function sha256Binary(content: ArrayBuffer | Uint8Array): string {
	const hasher = new Bun.CryptoHasher("sha256");
	hasher.update(content);
	return hasher.digest("hex");
}

/**
 * SHA256 hash of a file's contents
 */
export async function sha256File(filePath: string): Promise<string> {
	const buffer = await Bun.file(filePath).arrayBuffer();
	return sha256Binary(buffer);
}

/**
 * MD5 hash (useful for checksums, not security)
 */
export function md5(content: string): string {
	const hasher = new Bun.CryptoHasher("md5");
	hasher.update(content);
	return hasher.digest("hex");
}

/**
 * MD5 hash of binary data
 */
export function md5Binary(content: ArrayBuffer | Uint8Array): string {
	const hasher = new Bun.CryptoHasher("md5");
	hasher.update(content);
	return hasher.digest("hex");
}

/**
 * Fast non-cryptographic hash using xxHash64
 * Great for cache keys, content deduplication
 */
export function fastHash(content: string): bigint | number {
	return Bun.hash(content);
}

/**
 * Fast hash as hex string (easier to use as cache keys)
 */
export function fastHashHex(content: string): string {
	return Bun.hash(content).toString(16);
}

/**
 * Content-based ID generator (first 12 chars of sha256)
 * Useful for content-addressable storage
 */
export function contentId(content: string): string {
	return sha256(content).slice(0, 12);
}

/**
 * Generate a short hash for display/debugging
 */
export function shortHash(content: string, length = 8): string {
	return sha256(content).slice(0, length);
}
