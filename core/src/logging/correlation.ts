/**
 * Correlation ID utilities for request tracing.
 *
 * Correlation IDs link related log entries across operations,
 * making it easy to trace a single request through the system.
 */

/**
 * Generate an 8-character correlation ID for tracing operations.
 *
 * Uses crypto.randomUUID() and takes the first 8 characters for brevity.
 * This provides ~4 billion unique IDs, sufficient for local logging.
 *
 * @returns Short UUID string (e.g., "a1b2c3d4")
 *
 * @example
 * ```typescript
 * const cid = createCorrelationId();
 * logger.info("Starting operation", { cid });
 * // ... later ...
 * logger.info("Operation complete", { cid, durationMs: 150 });
 * ```
 */
export function createCorrelationId(): string {
	return crypto.randomUUID().slice(0, 8);
}
