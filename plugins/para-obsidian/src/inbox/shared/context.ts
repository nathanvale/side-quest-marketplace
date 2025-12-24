/**
 * Shared operation context for threading correlation IDs through async operations.
 *
 * @property sessionCid - Session-level trace ID (W3C trace_id equivalent)
 * @property vaultPath - Vault root path for security validation (absolute path)
 */
export interface OperationContext {
	/**
	 * Session correlation ID for distributed tracing.
	 * Should be present in all operations to enable end-to-end trace correlation.
	 */
	readonly sessionCid?: string;

	/**
	 * Vault root path for path traversal validation.
	 * When present, extractors validate that file paths stay within vault boundaries.
	 */
	readonly vaultPath?: string;
}
