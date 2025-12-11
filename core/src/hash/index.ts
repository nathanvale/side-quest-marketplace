/**
 * Hashing module - Bun-native cryptographic and fast hashing
 *
 * Provides both cryptographic (SHA256, SHA512, MD5, BLAKE2b) and fast
 * non-cryptographic (xxHash64) hashing functions using Bun's native APIs.
 *
 * @example
 * ```ts
 * import { sha256, fastHash, hmacSha256 } from "@sidequest/core/hash";
 *
 * // Cryptographic hash
 * const hash = sha256("Hello, World!");
 *
 * // Fast hash for cache keys
 * const key = fastHashHex(JSON.stringify(data));
 *
 * // HMAC for authentication
 * const signature = hmacSha256("secret-key", "message");
 * ```
 */

// ============================================================================
// SHA256 functions
// ============================================================================

/**
 * SHA256 hash of a string
 *
 * @param content - String to hash
 * @returns Hex-encoded SHA256 hash
 *
 * @example
 * ```ts
 * sha256("Hello"); // "185f8db32271fe25f561a6fc938b2e264306ec304eda518007d1764826381969"
 * ```
 */
export function sha256(content: string): string {
	const hasher = new Bun.CryptoHasher("sha256");
	hasher.update(content);
	return hasher.digest("hex");
}

/**
 * SHA256 hash of binary data
 *
 * @param content - Binary data to hash
 * @returns Hex-encoded SHA256 hash
 */
export function sha256Binary(content: ArrayBuffer | Uint8Array): string {
	const hasher = new Bun.CryptoHasher("sha256");
	hasher.update(content);
	return hasher.digest("hex");
}

/**
 * SHA256 hash of a file's contents
 *
 * @param filePath - Path to file
 * @returns Hex-encoded SHA256 hash
 *
 * @example
 * ```ts
 * const hash = await sha256File("./package.json");
 * ```
 */
export async function sha256File(filePath: string): Promise<string> {
	const buffer = await Bun.file(filePath).arrayBuffer();
	return sha256Binary(buffer);
}

// ============================================================================
// SHA512 functions
// ============================================================================

/**
 * SHA512 hash of a string
 *
 * @param content - String to hash
 * @returns Hex-encoded SHA512 hash
 */
export function sha512(content: string): string {
	const hasher = new Bun.CryptoHasher("sha512");
	hasher.update(content);
	return hasher.digest("hex");
}

/**
 * SHA512 hash of binary data
 *
 * @param content - Binary data to hash
 * @returns Hex-encoded SHA512 hash
 */
export function sha512Binary(content: ArrayBuffer | Uint8Array): string {
	const hasher = new Bun.CryptoHasher("sha512");
	hasher.update(content);
	return hasher.digest("hex");
}

// ============================================================================
// BLAKE2b functions
// ============================================================================

/**
 * BLAKE2b-256 hash (faster than SHA256 with similar security)
 *
 * @param content - String to hash
 * @returns Hex-encoded BLAKE2b-256 hash
 */
export function blake2b256(content: string): string {
	const hasher = new Bun.CryptoHasher("blake2b256");
	hasher.update(content);
	return hasher.digest("hex");
}

/**
 * BLAKE2b-512 hash
 *
 * @param content - String to hash
 * @returns Hex-encoded BLAKE2b-512 hash
 */
export function blake2b512(content: string): string {
	const hasher = new Bun.CryptoHasher("blake2b512");
	hasher.update(content);
	return hasher.digest("hex");
}

// ============================================================================
// MD5 functions (checksums, not security)
// ============================================================================

/**
 * MD5 hash (useful for checksums, NOT for security)
 *
 * @param content - String to hash
 * @returns Hex-encoded MD5 hash
 */
export function md5(content: string): string {
	const hasher = new Bun.CryptoHasher("md5");
	hasher.update(content);
	return hasher.digest("hex");
}

/**
 * MD5 hash of binary data
 *
 * @param content - Binary data to hash
 * @returns Hex-encoded MD5 hash
 */
export function md5Binary(content: ArrayBuffer | Uint8Array): string {
	const hasher = new Bun.CryptoHasher("md5");
	hasher.update(content);
	return hasher.digest("hex");
}

// ============================================================================
// HMAC functions (message authentication)
// ============================================================================

/**
 * HMAC-SHA256 for message authentication
 *
 * @param key - Secret key
 * @param message - Message to authenticate
 * @returns Hex-encoded HMAC
 *
 * @example
 * ```ts
 * const signature = hmacSha256("my-secret-key", "message to sign");
 * ```
 */
export function hmacSha256(key: string, message: string): string {
	const hasher = new Bun.CryptoHasher("sha256", key);
	hasher.update(message);
	return hasher.digest("hex");
}

/**
 * HMAC-SHA512 for message authentication
 *
 * @param key - Secret key
 * @param message - Message to authenticate
 * @returns Hex-encoded HMAC
 */
export function hmacSha512(key: string, message: string): string {
	const hasher = new Bun.CryptoHasher("sha512", key);
	hasher.update(message);
	return hasher.digest("hex");
}

/**
 * Verify an HMAC (constant-time comparison)
 *
 * @param key - Secret key
 * @param message - Original message
 * @param hmac - HMAC to verify
 * @param algorithm - Hash algorithm (default: sha256)
 * @returns True if HMAC is valid
 */
export function verifyHmac(
	key: string,
	message: string,
	hmac: string,
	algorithm: "sha256" | "sha512" = "sha256",
): boolean {
	const expected =
		algorithm === "sha256"
			? hmacSha256(key, message)
			: hmacSha512(key, message);

	// Constant-time comparison
	if (expected.length !== hmac.length) return false;

	let result = 0;
	for (let i = 0; i < expected.length; i++) {
		result |= expected.charCodeAt(i) ^ hmac.charCodeAt(i);
	}
	return result === 0;
}

// ============================================================================
// Fast hashing (xxHash64 - non-cryptographic)
// ============================================================================

/**
 * Fast non-cryptographic hash using xxHash64
 *
 * Great for cache keys, content deduplication, hash tables.
 * NOT suitable for security purposes.
 *
 * @param content - String to hash
 * @returns Hash as number or bigint
 *
 * @example
 * ```ts
 * const hash = fastHash(JSON.stringify(data));
 * ```
 */
export function fastHash(content: string): bigint | number {
	return Bun.hash(content);
}

/**
 * Fast hash as hex string (easier to use as cache keys)
 *
 * @param content - String to hash
 * @returns Hex-encoded hash
 *
 * @example
 * ```ts
 * const cacheKey = `data:${fastHashHex(url)}`;
 * ```
 */
export function fastHashHex(content: string): string {
	return Bun.hash(content).toString(16);
}

/**
 * Fast hash of multiple values (for compound cache keys)
 *
 * @param values - Values to hash together
 * @returns Hex-encoded hash
 *
 * @example
 * ```ts
 * const key = fastHashMulti(userId, endpoint, timestamp);
 * ```
 */
export function fastHashMulti(...values: unknown[]): string {
	return fastHashHex(JSON.stringify(values));
}

// ============================================================================
// Convenience functions
// ============================================================================

/**
 * Content-based ID generator (first 12 chars of sha256)
 *
 * Useful for content-addressable storage.
 *
 * @param content - Content to generate ID for
 * @returns 12-character content ID
 *
 * @example
 * ```ts
 * const id = contentId(fileContents); // "a1b2c3d4e5f6"
 * ```
 */
export function contentId(content: string): string {
	return sha256(content).slice(0, 12);
}

/**
 * Generate a short hash for display/debugging
 *
 * @param content - Content to hash
 * @param length - Length of output (default: 8)
 * @returns Short hash string
 */
export function shortHash(content: string, length = 8): string {
	return sha256(content).slice(0, length);
}

/**
 * Hash object to string (for caching/comparison)
 *
 * @param obj - Object to hash
 * @returns SHA256 hash of JSON-stringified object
 *
 * @example
 * ```ts
 * const hash = hashObject({ a: 1, b: 2 });
 * ```
 */
export function hashObject(obj: unknown): string {
	return sha256(JSON.stringify(obj));
}

// ============================================================================
// Streaming hash support
// ============================================================================

/** Supported hash algorithms */
export type HashAlgorithm =
	| "sha256"
	| "sha512"
	| "sha384"
	| "sha1"
	| "md5"
	| "blake2b256"
	| "blake2b512";

/**
 * Create a streaming hasher for large data
 *
 * @param algorithm - Hash algorithm to use
 * @param hmacKey - Optional HMAC key
 * @returns Hasher object with update/digest methods
 *
 * @example
 * ```ts
 * const hasher = createHasher("sha256");
 * hasher.update("chunk 1");
 * hasher.update("chunk 2");
 * const hash = hasher.digest("hex");
 * ```
 */
export function createHasher(
	algorithm: HashAlgorithm,
	hmacKey?: string,
): Bun.CryptoHasher {
	return hmacKey
		? new Bun.CryptoHasher(algorithm, hmacKey)
		: new Bun.CryptoHasher(algorithm);
}

/**
 * Hash a readable stream
 *
 * @param stream - ReadableStream to hash
 * @param algorithm - Hash algorithm (default: sha256)
 * @returns Promise resolving to hex-encoded hash
 *
 * @example
 * ```ts
 * const hash = await hashStream(response.body, "sha256");
 * ```
 */
export async function hashStream(
	stream: ReadableStream<Uint8Array>,
	algorithm: HashAlgorithm = "sha256",
): Promise<string> {
	const hasher = createHasher(algorithm);
	const reader = stream.getReader();

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			hasher.update(value);
		}
	} finally {
		reader.releaseLock();
	}

	return hasher.digest("hex");
}
