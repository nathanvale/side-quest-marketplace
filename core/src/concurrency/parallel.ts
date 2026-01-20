/**
 * Parallel processing utilities for chunked operations.
 *
 * Provides utilities for processing large collections in parallel chunks,
 * balancing throughput vs memory usage.
 *
 * ## Key Features
 *
 * - Process items in parallel chunks (default: 10 items)
 * - Early termination when maxResults reached
 * - Automatic result flattening (handles both single results and arrays)
 * - Error handling with optional callback or propagation
 * - Type-safe with full generic support
 *
 * ## Usage
 *
 * ```typescript
 * import { processInParallelChunks } from "@sidequest/core/concurrency";
 *
 * // Basic usage
 * const results = await processInParallelChunks({
 *   items: files,
 *   processor: (file) => processFile(file),
 * });
 *
 * // With error handling
 * const results = await processInParallelChunks({
 *   items: files,
 *   chunkSize: 5,
 *   maxResults: 100,
 *   processor: (file) => processFile(file),
 *   onError: (file, error) => {
 *     logger.error("Failed to process", { file, error });
 *     return []; // Return fallback
 *   }
 * });
 * ```
 *
 * @module core/concurrency/parallel
 */

/**
 * Options for parallel chunk processing.
 *
 * @template T - Type of input items
 * @template R - Type of output results
 */
export interface ParallelChunkOptions<T, R> {
	/**
	 * Items to process.
	 */
	items: T[];

	/**
	 * Number of items to process in parallel per chunk.
	 *
	 * @default 10
	 */
	chunkSize?: number;

	/**
	 * Stop after collecting this many results.
	 * If not specified, processes all items.
	 */
	maxResults?: number;

	/**
	 * Process a single item.
	 *
	 * Can return either a single result or an array of results.
	 * Results will be automatically flattened.
	 *
	 * @param item - Item to process
	 * @returns Processed result(s)
	 */
	processor: (item: T) => Promise<R[] | R>;

	/**
	 * Handle errors during processing.
	 *
	 * If provided, errors are caught and passed to this handler.
	 * The handler can return a fallback value or rethrow.
	 *
	 * If not provided, errors propagate to the caller.
	 *
	 * @param item - Item that failed to process
	 * @param error - Error that occurred
	 * @returns Fallback result(s) or rethrow
	 */
	onError?: (item: T, error: Error) => R[] | R;
}

/**
 * Process items in parallel chunks with optional early termination.
 *
 * Processes items in batches to balance throughput vs memory usage.
 * Results are collected incrementally and processing stops early
 * when maxResults is reached.
 *
 * ## Performance Characteristics
 *
 * - **Chunk Size**: Controls parallelism (default: 10)
 *   - Larger = more parallelism, more memory
 *   - Smaller = less parallelism, less memory
 * - **Early Termination**: Stops processing when maxResults reached
 * - **Flattening**: Automatically flattens results from processor
 *
 * ## Error Handling
 *
 * - **With onError**: Errors are caught and passed to handler
 * - **Without onError**: Errors propagate to caller immediately
 *
 * @template T - Type of input items
 * @template R - Type of output results
 * @param options - Processing options
 * @returns Array of processed results
 *
 * @example
 * ```typescript
 * // Process files in parallel with error handling
 * const matches = await processInParallelChunks({
 *   items: files,
 *   chunkSize: 10,
 *   maxResults: 100,
 *   processor: (filePath) => searchFile(filePath, pattern),
 *   onError: (filePath, error) => {
 *     logger.error("Error parsing file", { filePath, error });
 *     return []; // Skip failed files
 *   }
 * });
 * ```
 */
export async function processInParallelChunks<T, R>(
	options: ParallelChunkOptions<T, R>,
): Promise<R[]> {
	const { items, chunkSize = 10, maxResults, processor, onError } = options;

	const results: R[] = [];

	// Process items in chunks
	for (let i = 0; i < items.length; i += chunkSize) {
		// Early termination if we've hit maxResults
		if (maxResults !== undefined && results.length >= maxResults) {
			break;
		}

		// Get current chunk
		const chunk = items.slice(i, i + chunkSize);

		// Process chunk in parallel
		const chunkResults = await Promise.all(
			chunk.map(async (item) => {
				try {
					return await processor(item);
				} catch (error) {
					if (onError) {
						// Error handler provided - use it
						return onError(item, error as Error);
					}
					// No error handler - propagate
					throw error;
				}
			}),
		);

		// Flatten and collect results
		for (const itemResults of chunkResults) {
			// Handle both single results and arrays
			const resultsArray = Array.isArray(itemResults)
				? itemResults
				: [itemResults];

			for (const result of resultsArray) {
				results.push(result);
				// Check early termination after each result
				if (maxResults !== undefined && results.length >= maxResults) {
					break;
				}
			}

			// Early termination at chunk level
			if (maxResults !== undefined && results.length >= maxResults) {
				break;
			}
		}
	}

	// Slice to exact maxResults if specified
	return maxResults !== undefined ? results.slice(0, maxResults) : results;
}
