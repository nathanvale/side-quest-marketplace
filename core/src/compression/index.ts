/**
 * Compression module - Bun-native compression utilities
 *
 * Provides sync compression/decompression using Bun's built-in APIs.
 * Supports gzip, deflate, and zstd algorithms.
 *
 * @example
 * ```ts
 * import { gzip, gunzip, deflate, inflate } from "@sidequest/core/compression";
 *
 * // Compress and decompress
 * const compressed = gzip("Hello, World!");
 * const decompressed = gunzip(compressed); // "Hello, World!"
 * ```
 */

/** Compression level (1-9, where 1 is fastest and 9 is smallest) */
export type CompressionLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** Input types accepted by compression functions */
export type CompressInput = string | Uint8Array | ArrayBuffer;

/**
 * Compress data using gzip algorithm
 *
 * @param data - Data to compress (string or binary)
 * @param level - Compression level 1-9 (default: 6)
 * @returns Compressed data as Uint8Array
 *
 * @example
 * ```ts
 * const compressed = gzip("Hello, World!");
 * console.log(`Compressed ${compressed.length} bytes`);
 * ```
 */
export function gzip(
	data: CompressInput,
	level?: CompressionLevel,
): Uint8Array {
	const input = toUint8Array(data);
	return Bun.gzipSync(input as Uint8Array<ArrayBuffer>, { level });
}

/**
 * Decompress gzip data
 *
 * @param data - Gzip compressed data
 * @returns Decompressed data as Uint8Array
 *
 * @example
 * ```ts
 * const decompressed = gunzip(compressed);
 * const text = new TextDecoder().decode(decompressed);
 * ```
 */
export function gunzip(data: Uint8Array | ArrayBuffer): Uint8Array {
	const input = data instanceof Uint8Array ? data : new Uint8Array(data);
	return Bun.gunzipSync(input as Uint8Array<ArrayBuffer>);
}

/**
 * Compress data and return as string (convenience method)
 *
 * @param data - String data to compress
 * @param level - Compression level 1-9 (default: 6)
 * @returns Decompressed string
 *
 * @example
 * ```ts
 * const compressed = gzip("Hello, World!");
 * const text = gunzipString(compressed); // "Hello, World!"
 * ```
 */
export function gunzipString(data: Uint8Array | ArrayBuffer): string {
	const decompressed = gunzip(data);
	return new TextDecoder().decode(decompressed);
}

/**
 * Compress data using deflate algorithm (no gzip header)
 *
 * @param data - Data to compress
 * @param level - Compression level 1-9 (default: 6)
 * @returns Compressed data as Uint8Array
 *
 * @example
 * ```ts
 * const compressed = deflate("Hello, World!");
 * ```
 */
export function deflate(
	data: CompressInput,
	level?: CompressionLevel,
): Uint8Array {
	const input = toUint8Array(data);
	return Bun.deflateSync(input as Uint8Array<ArrayBuffer>, { level });
}

/**
 * Decompress deflate data
 *
 * @param data - Deflate compressed data
 * @returns Decompressed data as Uint8Array
 *
 * @example
 * ```ts
 * const decompressed = inflate(compressed);
 * ```
 */
export function inflate(data: Uint8Array | ArrayBuffer): Uint8Array {
	const input = data instanceof Uint8Array ? data : new Uint8Array(data);
	return Bun.inflateSync(input as Uint8Array<ArrayBuffer>);
}

/**
 * Decompress deflate data and return as string
 *
 * @param data - Deflate compressed data
 * @returns Decompressed string
 */
export function inflateString(data: Uint8Array | ArrayBuffer): string {
	const decompressed = inflate(data);
	return new TextDecoder().decode(decompressed);
}

/**
 * Compress data using zstd algorithm (faster than gzip, similar ratio)
 *
 * @param data - Data to compress
 * @param level - Compression level 1-22 (default: 3)
 * @returns Compressed data as Uint8Array
 *
 * @example
 * ```ts
 * const compressed = zstdCompress("Hello, World!");
 * // Zstd is typically 3-5x faster than gzip
 * ```
 */
export function zstdCompress(data: CompressInput, level?: number): Uint8Array {
	const input = toUint8Array(data);
	return Bun.zstdCompressSync(input as Uint8Array<ArrayBuffer>, { level });
}

/**
 * Decompress zstd data
 *
 * @param data - Zstd compressed data
 * @returns Decompressed data as Uint8Array
 *
 * @example
 * ```ts
 * const decompressed = zstdDecompress(compressed);
 * ```
 */
export function zstdDecompress(data: Uint8Array | ArrayBuffer): Uint8Array {
	const input = data instanceof Uint8Array ? data : new Uint8Array(data);
	return Bun.zstdDecompressSync(input as Uint8Array<ArrayBuffer>);
}

/**
 * Decompress zstd data and return as string
 *
 * @param data - Zstd compressed data
 * @returns Decompressed string
 */
export function zstdDecompressString(data: Uint8Array | ArrayBuffer): string {
	const decompressed = zstdDecompress(data);
	return new TextDecoder().decode(decompressed);
}

/**
 * Compress data to base64 string (useful for JSON/text storage)
 *
 * @param data - Data to compress
 * @param algorithm - Compression algorithm (default: gzip)
 * @returns Base64 encoded compressed data
 *
 * @example
 * ```ts
 * const encoded = compressToBase64("Hello, World!");
 * // Store in JSON, database, etc.
 * ```
 */
export function compressToBase64(
	data: CompressInput,
	algorithm: "gzip" | "deflate" | "zstd" = "gzip",
): string {
	const compressed =
		algorithm === "gzip"
			? gzip(data)
			: algorithm === "deflate"
				? deflate(data)
				: zstdCompress(data);

	return Buffer.from(compressed).toString("base64");
}

/**
 * Decompress base64 encoded data
 *
 * @param base64 - Base64 encoded compressed data
 * @param algorithm - Compression algorithm used (default: gzip)
 * @returns Decompressed string
 *
 * @example
 * ```ts
 * const text = decompressFromBase64(encoded);
 * ```
 */
export function decompressFromBase64(
	base64: string,
	algorithm: "gzip" | "deflate" | "zstd" = "gzip",
): string {
	const compressed = Buffer.from(base64, "base64");

	const decompressed =
		algorithm === "gzip"
			? gunzip(compressed)
			: algorithm === "deflate"
				? inflate(compressed)
				: zstdDecompress(compressed);

	return new TextDecoder().decode(decompressed);
}

/**
 * Get compression ratio for data
 *
 * @param original - Original data
 * @param compressed - Compressed data
 * @returns Compression ratio (0-1, lower is better)
 *
 * @example
 * ```ts
 * const ratio = compressionRatio("Hello, World!", gzip("Hello, World!"));
 * console.log(`Compressed to ${(ratio * 100).toFixed(1)}% of original`);
 * ```
 */
export function compressionRatio(
	original: CompressInput,
	compressed: Uint8Array,
): number {
	const originalSize =
		typeof original === "string"
			? new TextEncoder().encode(original).length
			: original instanceof Uint8Array
				? original.length
				: original.byteLength;

	return compressed.length / originalSize;
}

/**
 * Compare compression algorithms on data
 *
 * @param data - Data to test
 * @returns Object with size and ratio for each algorithm
 *
 * @example
 * ```ts
 * const comparison = compareCompression(largeText);
 * console.log(comparison);
 * // { gzip: { size: 1234, ratio: 0.45 }, deflate: { size: 1200, ratio: 0.43 }, ... }
 * ```
 */
export function compareCompression(data: CompressInput): {
	original: number;
	gzip: { size: number; ratio: number };
	deflate: { size: number; ratio: number };
	zstd: { size: number; ratio: number };
} {
	const input = toUint8Array(data);
	const originalSize = input.length;

	const gzipped = gzip(data);
	const deflated = deflate(data);
	const zstdCompressed = zstdCompress(data);

	return {
		original: originalSize,
		gzip: {
			size: gzipped.length,
			ratio: gzipped.length / originalSize,
		},
		deflate: {
			size: deflated.length,
			ratio: deflated.length / originalSize,
		},
		zstd: {
			size: zstdCompressed.length,
			ratio: zstdCompressed.length / originalSize,
		},
	};
}

// Internal helper
function toUint8Array(data: CompressInput): Uint8Array {
	if (typeof data === "string") {
		return new TextEncoder().encode(data);
	}
	if (data instanceof Uint8Array) {
		return data;
	}
	return new Uint8Array(data);
}
