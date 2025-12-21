/**
 * Shared operation context for threading correlation IDs through async operations.
 *
 * @property sessionCid - Session-level trace ID (W3C trace_id equivalent)
 */
export interface OperationContext {
	/**
	 * Session correlation ID for distributed tracing.
	 * Should be present in all operations to enable end-to-end trace correlation.
	 */
	readonly sessionCid?: string;
}
