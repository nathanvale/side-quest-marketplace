/**
 * Trace context propagation using AsyncLocalStorage.
 *
 * Provides automatic correlation ID propagation across async boundaries,
 * enabling W3C Trace Context-compatible parent-child span relationships
 * without manual context passing.
 *
 * ## Usage
 *
 * ```typescript
 * import { runWithContext, getCurrentContext, createTraceContext } from "@sidequest/core/instrumentation";
 *
 * // Create a new trace context
 * const ctx = createTraceContext();
 *
 * // Run operations within context
 * await runWithContext(ctx, async () => {
 *   // All nested calls can access the context
 *   const current = getCurrentContext();
 *   console.log(current?.cid); // The current span ID
 *
 *   // Nested operations automatically inherit context
 *   await nestedOperation(); // Can call getCurrentContext() too
 * });
 * ```
 *
 * ## W3C Trace Context Compatibility
 *
 * The context structure follows W3C Trace Context semantics:
 * - `cid` (span_id): Unique identifier for the current operation
 * - `parentCid` (parent_span_id): Links to the parent operation
 * - `sessionCid` (trace_id): Session-level identifier for the entire trace
 *
 * @module core/instrumentation/context
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

/**
 * Trace context for correlation ID propagation.
 *
 * Follows W3C Trace Context semantics:
 * - `cid`: Current span identifier (unique per operation)
 * - `parentCid`: Parent span identifier (links to parent operation)
 * - `sessionCid`: Trace identifier (session-level, shared across all spans)
 */
export interface TraceContext {
	/** Current operation's correlation ID (span_id in W3C terms) */
	cid: string;
	/** Parent operation's correlation ID (parent_span_id in W3C terms) */
	parentCid?: string;
	/** Session-level correlation ID (trace_id in W3C terms) */
	sessionCid?: string;
}

/**
 * AsyncLocalStorage instance for trace context propagation.
 * This enables automatic context inheritance across async boundaries.
 */
const asyncLocalStorage = new AsyncLocalStorage<TraceContext>();

/**
 * Generate a short correlation ID suitable for logging.
 *
 * Returns an 8-character hex string derived from a UUID.
 * This is shorter than a full UUID but still provides sufficient uniqueness
 * for correlation within a session.
 *
 * @returns 8-character hex correlation ID
 *
 * @example
 * ```typescript
 * const cid = generateCorrelationId(); // "a1b2c3d4"
 * ```
 */
export function generateCorrelationId(): string {
	return randomUUID().replace(/-/g, "").slice(0, 8);
}

/**
 * Create a new trace context.
 *
 * If called within an existing context, the new context will automatically
 * inherit the parent's `cid` as its `parentCid`, and the parent's `sessionCid`.
 *
 * @param options - Optional overrides for the trace context
 * @returns New trace context with correlation IDs
 *
 * @example
 * ```typescript
 * // Create root context (no parent)
 * const rootCtx = createTraceContext();
 *
 * // Create child context (inherits parent)
 * await runWithContext(rootCtx, () => {
 *   const childCtx = createTraceContext();
 *   // childCtx.parentCid === rootCtx.cid
 *   // childCtx.sessionCid === rootCtx.sessionCid
 * });
 *
 * // Override session ID for new session
 * const sessionCtx = createTraceContext({ sessionCid: "my-session" });
 * ```
 */
export function createTraceContext(
	options?: Partial<TraceContext>,
): TraceContext {
	const currentContext = asyncLocalStorage.getStore();
	const cid = options?.cid ?? generateCorrelationId();

	// Inherit from current context if available
	const parentCid = options?.parentCid ?? currentContext?.cid;
	const sessionCid = options?.sessionCid ?? currentContext?.sessionCid ?? cid; // Root context uses cid as sessionCid

	return { cid, parentCid, sessionCid };
}

/**
 * Get the current trace context from AsyncLocalStorage.
 *
 * Returns `undefined` if not running within a `runWithContext` block.
 * This is the primary way to access correlation IDs for logging.
 *
 * @returns Current trace context or undefined if outside context
 *
 * @example
 * ```typescript
 * function logOperation(message: string) {
 *   const ctx = getCurrentContext();
 *   logger.info(message, {
 *     cid: ctx?.cid,
 *     parentCid: ctx?.parentCid,
 *     sessionCid: ctx?.sessionCid,
 *   });
 * }
 * ```
 */
export function getCurrentContext(): TraceContext | undefined {
	return asyncLocalStorage.getStore();
}

/**
 * Run a function within a trace context.
 *
 * All code executed within the callback (including async operations)
 * will have access to the context via `getCurrentContext()`.
 *
 * @template T - Return type of the function
 * @param context - Trace context to make available
 * @param fn - Function to execute within the context
 * @returns Result of the function
 *
 * @example
 * ```typescript
 * const ctx = createTraceContext();
 *
 * const result = await runWithContext(ctx, async () => {
 *   // getCurrentContext() returns ctx here
 *   await someAsyncOperation();
 *   // Still returns ctx after async boundary
 *   return computeResult();
 * });
 * ```
 */
export function runWithContext<T>(context: TraceContext, fn: () => T): T {
	return asyncLocalStorage.run(context, fn);
}

/**
 * Run an async function within a trace context.
 *
 * Convenience wrapper for `runWithContext` that properly handles async functions.
 *
 * @template T - Return type of the async function
 * @param context - Trace context to make available
 * @param fn - Async function to execute within the context
 * @returns Promise resolving to the function result
 *
 * @example
 * ```typescript
 * const ctx = createTraceContext();
 *
 * const result = await runWithContextAsync(ctx, async () => {
 *   const data = await fetchData();
 *   return processData(data);
 * });
 * ```
 */
export async function runWithContextAsync<T>(
	context: TraceContext,
	fn: () => Promise<T>,
): Promise<T> {
	return asyncLocalStorage.run(context, fn);
}

/**
 * Create a child context and run a function within it.
 *
 * This is a convenience function that creates a new trace context
 * (inheriting from the current context) and runs the function within it.
 *
 * @template T - Return type of the function
 * @param fn - Function to execute within the child context
 * @returns Result of the function
 *
 * @example
 * ```typescript
 * await runWithContext(rootCtx, async () => {
 *   // Create child span for sub-operation
 *   await withChildContext(async () => {
 *     const ctx = getCurrentContext();
 *     // ctx.parentCid === rootCtx.cid
 *     await performSubOperation();
 *   });
 * });
 * ```
 */
export function withChildContext<T>(fn: () => T): T {
	const childContext = createTraceContext();
	return runWithContext(childContext, fn);
}

/**
 * Async version of withChildContext.
 *
 * @template T - Return type of the async function
 * @param fn - Async function to execute within the child context
 * @returns Promise resolving to the function result
 */
export async function withChildContextAsync<T>(
	fn: () => Promise<T>,
): Promise<T> {
	const childContext = createTraceContext();
	return runWithContextAsync(childContext, fn);
}
