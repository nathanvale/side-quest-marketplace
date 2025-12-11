/**
 * Streams module - Bun-native stream utilities
 *
 * Provides utilities for consuming and transforming streams,
 * particularly useful for MCP tools that process HTTP responses.
 *
 * @example
 * ```ts
 * import { streamToText, streamToJson, streamToBytes } from "@sidequest/core/streams";
 *
 * const response = await fetch("https://api.example.com/data");
 * const text = await streamToText(response.body);
 * const json = await streamToJson(response.body);
 * ```
 */

// ============================================================================
// Stream consumption
// ============================================================================

/**
 * Convert a ReadableStream to text
 *
 * @param stream - ReadableStream to consume
 * @returns Promise resolving to text content
 *
 * @example
 * ```ts
 * const response = await fetch(url);
 * const text = await streamToText(response.body);
 * ```
 */
export async function streamToText(
	stream: ReadableStream<Uint8Array> | null,
): Promise<string> {
	if (!stream) return "";
	return Bun.readableStreamToText(stream);
}

/**
 * Convert a ReadableStream to JSON
 *
 * @param stream - ReadableStream to consume
 * @returns Promise resolving to parsed JSON
 *
 * @example
 * ```ts
 * const response = await fetch(url);
 * const data = await streamToJson<{ name: string }>(response.body);
 * ```
 */
export async function streamToJson<T = unknown>(
	stream: ReadableStream<Uint8Array> | null,
): Promise<T> {
	if (!stream) throw new Error("Stream is null");
	return Bun.readableStreamToJSON(stream) as Promise<T>;
}

/**
 * Convert a ReadableStream to Uint8Array
 *
 * @param stream - ReadableStream to consume
 * @returns Promise resolving to bytes
 *
 * @example
 * ```ts
 * const response = await fetch(url);
 * const bytes = await streamToBytes(response.body);
 * ```
 */
export async function streamToBytes(
	stream: ReadableStream<Uint8Array> | null,
): Promise<Uint8Array> {
	if (!stream) return new Uint8Array(0);
	return Bun.readableStreamToBytes(stream);
}

/**
 * Convert a ReadableStream to ArrayBuffer
 *
 * @param stream - ReadableStream to consume
 * @returns Promise resolving to ArrayBuffer
 */
export async function streamToArrayBuffer(
	stream: ReadableStream<Uint8Array> | null,
): Promise<ArrayBuffer> {
	if (!stream) return new ArrayBuffer(0);
	return Bun.readableStreamToArrayBuffer(stream);
}

/**
 * Convert a ReadableStream to Blob
 *
 * @param stream - ReadableStream to consume
 * @returns Promise resolving to Blob
 */
export async function streamToBlob(
	stream: ReadableStream<Uint8Array> | null,
): Promise<Blob> {
	if (!stream) return new Blob([]);
	return Bun.readableStreamToBlob(stream);
}

/**
 * Convert a ReadableStream to array of chunks
 *
 * @param stream - ReadableStream to consume
 * @returns Promise resolving to array of chunks
 */
export async function streamToArray<T = unknown>(
	stream: ReadableStream<T> | null,
): Promise<T[]> {
	if (!stream) return [];
	return Bun.readableStreamToArray(stream);
}

/**
 * Convert a ReadableStream to FormData
 *
 * @param stream - ReadableStream to consume
 * @param boundary - Multipart boundary (optional, for multipart/form-data)
 * @returns Promise resolving to FormData
 */
export async function streamToFormData(
	stream: ReadableStream<Uint8Array> | null,
	boundary?: string,
): Promise<FormData> {
	if (!stream) return new FormData();
	if (boundary) {
		return Bun.readableStreamToFormData(stream, boundary);
	}
	return Bun.readableStreamToFormData(stream);
}

// ============================================================================
// Safe stream consumption (with fallbacks)
// ============================================================================

/**
 * Safely consume a stream as text with fallback
 *
 * @param stream - ReadableStream to consume
 * @param fallback - Value to return on error
 * @returns Text content or fallback
 */
export async function safeStreamToText(
	stream: ReadableStream<Uint8Array> | null,
	fallback = "",
): Promise<string> {
	try {
		return await streamToText(stream);
	} catch {
		return fallback;
	}
}

/**
 * Safely consume a stream as JSON with fallback
 *
 * @param stream - ReadableStream to consume
 * @param fallback - Value to return on error
 * @returns Parsed JSON or fallback
 */
export async function safeStreamToJson<T>(
	stream: ReadableStream<Uint8Array> | null,
	fallback: T,
): Promise<T> {
	try {
		if (!stream) return fallback;
		return (await Bun.readableStreamToJSON(stream)) as T;
	} catch {
		return fallback;
	}
}

// ============================================================================
// Stream creation helpers
// ============================================================================

/**
 * Create a ReadableStream from a string
 *
 * @param text - Text to stream
 * @returns ReadableStream
 */
export function textToStream(text: string): ReadableStream<Uint8Array> {
	return new Blob([text]).stream();
}

/**
 * Create a ReadableStream from bytes
 *
 * @param bytes - Bytes to stream
 * @returns ReadableStream
 */
export function bytesToStream(
	bytes: Uint8Array | ArrayBuffer,
): ReadableStream<Uint8Array> {
	return new Blob([bytes]).stream();
}

/**
 * Create a ReadableStream from JSON
 *
 * @param value - Value to serialize and stream
 * @returns ReadableStream
 */
export function jsonToStream(value: unknown): ReadableStream<Uint8Array> {
	return new Blob([JSON.stringify(value)]).stream();
}

// ============================================================================
// Stream utilities
// ============================================================================

/**
 * Collect all chunks from a stream into an array
 *
 * @param stream - ReadableStream to collect
 * @returns Array of chunks
 */
export async function collectStream<T>(
	stream: ReadableStream<T>,
): Promise<T[]> {
	const chunks: T[] = [];
	const reader = stream.getReader();

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}

	return chunks;
}

/**
 * Count bytes in a stream without consuming it
 *
 * Note: This creates a tee of the stream.
 *
 * @param stream - ReadableStream to measure
 * @returns Object with byteCount and the original stream
 */
export async function countStreamBytes(
	stream: ReadableStream<Uint8Array>,
): Promise<{ byteCount: number; stream: ReadableStream<Uint8Array> }> {
	const [countStream, returnStream] = stream.tee();

	let byteCount = 0;
	const reader = countStream.getReader();

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			byteCount += value.length;
		}
	} finally {
		reader.releaseLock();
	}

	return { byteCount, stream: returnStream };
}

/**
 * Pipe a stream through a transform function
 *
 * @param stream - Source stream
 * @param transform - Transform function for each chunk
 * @returns Transformed stream
 */
export function transformStream<T, U>(
	stream: ReadableStream<T>,
	transform: (chunk: T) => U | Promise<U>,
): ReadableStream<U> {
	return new ReadableStream<U>({
		async start(controller) {
			const reader = stream.getReader();

			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) {
						controller.close();
						break;
					}
					const transformed = await transform(value);
					controller.enqueue(transformed);
				}
			} catch (error) {
				controller.error(error);
			} finally {
				reader.releaseLock();
			}
		},
	});
}

/**
 * Create a stream that emits values from an async generator
 *
 * @param generator - Async generator function
 * @returns ReadableStream
 */
export function generatorToStream<T>(
	generator: () => AsyncGenerator<T, void, unknown>,
): ReadableStream<T> {
	return new ReadableStream<T>({
		async start(controller) {
			try {
				for await (const value of generator()) {
					controller.enqueue(value);
				}
				controller.close();
			} catch (error) {
				controller.error(error);
			}
		},
	});
}

/**
 * Merge multiple streams into one
 *
 * @param streams - Streams to merge
 * @returns Merged stream (chunks interleaved)
 */
export function mergeStreams<T>(
	...streams: ReadableStream<T>[]
): ReadableStream<T> {
	return new ReadableStream<T>({
		async start(controller) {
			let activeReaders = streams.length;

			const readFromStream = async (stream: ReadableStream<T>) => {
				const reader = stream.getReader();
				try {
					while (true) {
						const { done, value } = await reader.read();
						if (done) {
							activeReaders--;
							if (activeReaders === 0) {
								controller.close();
							}
							return;
						}
						controller.enqueue(value);
					}
				} catch (error) {
					controller.error(error);
				} finally {
					reader.releaseLock();
				}
			};

			// Start reading from all streams concurrently
			await Promise.all(streams.map((s) => readFromStream(s)));
		},
	});
}
