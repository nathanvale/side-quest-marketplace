/**
 * General utilities using Bun primitives
 *
 * Provides common utility functions built on Bun's native APIs.
 *
 * @example
 * ```ts
 * import { deepEquals, sleep, retry, debounce } from "@sidequest/core/utils";
 *
 * // Deep comparison
 * deepEquals({ a: 1 }, { a: 1 }); // true
 *
 * // Async sleep
 * await sleep(1000);
 *
 * // Retry with exponential backoff
 * const data = await retry(() => fetchData(), { maxAttempts: 3 });
 * ```
 */

// ============================================================================
// Type utilities
// ============================================================================

/** Function type for retry, debounce, throttle */
export type AnyFunction<T = unknown> = (...args: unknown[]) => T;

// ============================================================================
// Deep comparison & cloning
// ============================================================================

/**
 * Deep equality check using Bun's native deepEquals
 *
 * @param a - First value
 * @param b - Second value
 * @param strict - Use strict equality (===) for primitives (default: false)
 * @returns True if values are deeply equal
 *
 * @example
 * ```ts
 * deepEquals({ a: 1 }, { a: 1 }); // true
 * deepEquals([1, 2], [1, 2]); // true
 * deepEquals(1, "1"); // true (non-strict)
 * deepEquals(1, "1", true); // false (strict)
 * ```
 */
export function deepEquals(a: unknown, b: unknown, strict = false): boolean {
	return Bun.deepEquals(a, b, strict);
}

/**
 * Deep clone via JSON round-trip (fast for plain objects)
 *
 * Note: Does not preserve Date, Map, Set, functions, or circular references.
 *
 * @param value - Value to clone
 * @returns Deep clone of value
 *
 * @example
 * ```ts
 * const original = { a: { b: 1 } };
 * const cloned = deepClone(original);
 * cloned.a.b = 2; // original.a.b is still 1
 * ```
 */
export function deepClone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value));
}

/**
 * Structured clone (handles more types than JSON round-trip)
 *
 * Supports Date, Map, Set, ArrayBuffer, etc.
 *
 * @param value - Value to clone
 * @returns Deep clone of value
 */
export function structuredClone<T>(value: T): T {
	return globalThis.structuredClone(value);
}

// ============================================================================
// Timing & delays
// ============================================================================

/**
 * Sleep for a given number of milliseconds (async)
 *
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after delay
 *
 * @example
 * ```ts
 * await sleep(1000); // Wait 1 second
 * ```
 */
export function sleep(ms: number): Promise<void> {
	return Bun.sleep(ms);
}

/**
 * Sleep for a given number of milliseconds (sync/blocking)
 *
 * Warning: Blocks the event loop. Use sparingly.
 *
 * @param ms - Milliseconds to sleep
 *
 * @example
 * ```ts
 * sleepSync(100); // Block for 100ms
 * ```
 */
export function sleepSync(ms: number): void {
	Bun.sleepSync(ms);
}

// ============================================================================
// Promise utilities
// ============================================================================

/**
 * Peek at a promise's state without awaiting it
 *
 * Uses Bun.peek to check if promise is resolved/rejected without blocking.
 *
 * @param promise - Promise to peek at
 * @returns The resolved value if available, or the promise itself
 *
 * @example
 * ```ts
 * const promise = Promise.resolve(42);
 * await sleep(0); // Let microtasks run
 * const result = peekPromise(promise); // 42
 *
 * const pending = new Promise(() => {});
 * peekPromise(pending); // Returns the promise itself
 * ```
 */
export function peekPromise<T>(promise: Promise<T>): T | Promise<T> {
	return Bun.peek(promise);
}

/**
 * Check if a promise is resolved (not pending or rejected)
 *
 * @param promise - Promise to check
 * @returns True if promise is resolved
 *
 * @example
 * ```ts
 * const resolved = Promise.resolve(1);
 * const pending = new Promise(() => {});
 * await sleep(0);
 *
 * isPromiseResolved(resolved); // true
 * isPromiseResolved(pending); // false
 * ```
 */
export function isPromiseResolved<T>(promise: Promise<T>): boolean {
	const peeked = Bun.peek(promise);
	return peeked !== promise && !(peeked instanceof Error);
}

/**
 * Get the status of a promise
 *
 * @param promise - Promise to check
 * @returns Object with status and value/error if available
 */
export function getPromiseStatus<T>(promise: Promise<T>): {
	status: "pending" | "fulfilled" | "rejected";
	value?: T;
	reason?: Error;
} {
	const peeked = Bun.peek(promise);

	if (peeked === promise) {
		return { status: "pending" };
	}

	if (peeked instanceof Error) {
		return { status: "rejected", reason: peeked };
	}

	return { status: "fulfilled", value: peeked as T };
}

// ============================================================================
// ID generation
// ============================================================================

/**
 * Generate a UUID v4
 *
 * @returns UUID string
 *
 * @example
 * ```ts
 * uuid(); // "550e8400-e29b-41d4-a716-446655440000"
 * ```
 */
export function uuid(): string {
	return crypto.randomUUID();
}

/**
 * Generate a short random ID (URL-safe)
 *
 * @param length - Length of ID (default: 8)
 * @returns Short ID string
 *
 * @example
 * ```ts
 * shortId();    // "x4k9m2p1"
 * shortId(12);  // "x4k9m2p1a3b7"
 * ```
 */
export function shortId(length = 8): string {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
	const bytes = crypto.getRandomValues(new Uint8Array(length));
	return Array.from(bytes)
		.map((b) => chars[b % chars.length])
		.join("");
}

/**
 * Generate a nano ID (URL-safe, high entropy)
 *
 * Collision-resistant with 21 chars (default).
 *
 * @param length - Length of ID (default: 21)
 * @returns Nano ID string
 *
 * @example
 * ```ts
 * nanoId();    // "V1StGXR8_Z5jdHi6B-myT"
 * nanoId(10); // "IRFa-VaY2b"
 * ```
 */
export function nanoId(length = 21): string {
	const chars =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
	const bytes = crypto.getRandomValues(new Uint8Array(length));
	return Array.from(bytes)
		.map((b) => chars[b % chars.length])
		.join("");
}

// ============================================================================
// JSON utilities
// ============================================================================

/**
 * Safe JSON parse with fallback
 *
 * @param content - JSON string to parse
 * @param fallback - Value to return on parse error
 * @returns Parsed value or fallback
 *
 * @example
 * ```ts
 * safeJsonParse('{"a":1}', {}); // { a: 1 }
 * safeJsonParse('invalid', {}); // {}
 * ```
 */
export function safeJsonParse<T>(content: string, fallback: T): T {
	try {
		return JSON.parse(content);
	} catch {
		return fallback;
	}
}

/**
 * Safe JSON stringify with circular reference handling
 *
 * @param value - Value to stringify
 * @param indent - Indentation (default: none)
 * @returns JSON string or "[Circular]" for circular refs
 *
 * @example
 * ```ts
 * safeJsonStringify({ a: 1 }, 2); // "{\n  \"a\": 1\n}"
 *
 * const circular: any = { a: 1 };
 * circular.self = circular;
 * safeJsonStringify(circular); // Contains "[Circular]"
 * ```
 */
export function safeJsonStringify(value: unknown, indent?: number): string {
	const seen = new WeakSet();

	return JSON.stringify(
		value,
		(_key, val) => {
			if (typeof val === "object" && val !== null) {
				if (seen.has(val)) {
					return "[Circular]";
				}
				seen.add(val);
			}
			return val;
		},
		indent,
	);
}

// ============================================================================
// Environment detection
// ============================================================================

/**
 * Check if running in Bun
 *
 * @returns True if Bun runtime is detected
 */
export function isBun(): boolean {
	return typeof Bun !== "undefined";
}

/**
 * Get Bun version or null if not in Bun
 *
 * @returns Version string or null
 */
export function bunVersion(): string | null {
	return typeof Bun !== "undefined" ? Bun.version : null;
}

/**
 * Check if running in development mode
 *
 * Checks NODE_ENV and BUN_ENV environment variables.
 *
 * @returns True if in development mode
 */
export function isDev(): boolean {
	return (
		process.env.NODE_ENV === "development" ||
		process.env.BUN_ENV === "development"
	);
}

/**
 * Check if running in production mode
 *
 * @returns True if in production mode
 */
export function isProd(): boolean {
	return (
		process.env.NODE_ENV === "production" ||
		process.env.BUN_ENV === "production"
	);
}

/**
 * Check if running in test mode
 *
 * @returns True if in test mode
 */
export function isTest(): boolean {
	return (
		process.env.NODE_ENV === "test" ||
		process.env.BUN_ENV === "test" ||
		typeof Bun !== "undefined"
	);
}

// ============================================================================
// Retry & resilience
// ============================================================================

/** Options for retry function */
export interface RetryOptions {
	/** Maximum number of attempts (default: 3) */
	maxAttempts?: number;
	/** Initial delay between retries in ms (default: 100) */
	initialDelay?: number;
	/** Maximum delay between retries in ms (default: 10000) */
	maxDelay?: number;
	/** Backoff multiplier (default: 2) */
	backoff?: number;
	/** Whether to add jitter to delays (default: true) */
	jitter?: boolean;
	/** Predicate to determine if error should be retried */
	shouldRetry?: (error: Error) => boolean;
	/** Callback on each retry */
	onRetry?: (error: Error, attempt: number) => void;
}

/**
 * Retry a function with exponential backoff
 *
 * @param fn - Async function to retry
 * @param options - Retry options
 * @returns Result of successful function call
 * @throws Last error if all retries fail
 *
 * @example
 * ```ts
 * const data = await retry(
 *   () => fetch("https://api.example.com/data").then(r => r.json()),
 *   {
 *     maxAttempts: 5,
 *     initialDelay: 100,
 *     onRetry: (err, attempt) => console.log(`Attempt ${attempt} failed: ${err.message}`)
 *   }
 * );
 * ```
 */
export async function retry<T>(
	fn: () => Promise<T>,
	options?: RetryOptions,
): Promise<T> {
	const {
		maxAttempts = 3,
		initialDelay = 100,
		maxDelay = 10000,
		backoff = 2,
		jitter = true,
		shouldRetry = () => true,
		onRetry,
	} = options ?? {};

	let lastError: Error | null = null;
	let delay = initialDelay;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			if (attempt === maxAttempts || !shouldRetry(lastError)) {
				throw lastError;
			}

			onRetry?.(lastError, attempt);

			// Add jitter
			const jitterAmount = jitter ? Math.random() * delay * 0.2 : 0;
			await sleep(delay + jitterAmount);

			// Increase delay with backoff
			delay = Math.min(delay * backoff, maxDelay);
		}
	}

	throw lastError;
}

// ============================================================================
// Debounce & throttle
// ============================================================================

/**
 * Debounce a function (delay execution until calls stop)
 *
 * @param fn - Function to debounce
 * @param wait - Wait time in ms
 * @returns Debounced function
 *
 * @example
 * ```ts
 * const debouncedSearch = debounce((query: string) => {
 *   console.log("Searching:", query);
 * }, 300);
 *
 * debouncedSearch("a");
 * debouncedSearch("ab");
 * debouncedSearch("abc"); // Only this one fires, after 300ms
 * ```
 */
export function debounce<T extends AnyFunction>(
	fn: T,
	wait: number,
): (...args: Parameters<T>) => void {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	return (...args: Parameters<T>) => {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}

		timeoutId = setTimeout(() => {
			fn(...args);
			timeoutId = null;
		}, wait);
	};
}

/**
 * Throttle a function (limit execution rate)
 *
 * @param fn - Function to throttle
 * @param limit - Minimum time between calls in ms
 * @returns Throttled function
 *
 * @example
 * ```ts
 * const throttledScroll = throttle(() => {
 *   console.log("Scroll event");
 * }, 100);
 *
 * // Even if called 100 times in 1 second, only fires ~10 times
 * window.addEventListener("scroll", throttledScroll);
 * ```
 */
export function throttle<T extends AnyFunction>(
	fn: T,
	limit: number,
): (...args: Parameters<T>) => void {
	let lastRun = 0;
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	return (...args: Parameters<T>) => {
		const now = Date.now();
		const timeSinceLastRun = now - lastRun;

		if (timeSinceLastRun >= limit) {
			lastRun = now;
			fn(...args);
		} else if (!timeoutId) {
			timeoutId = setTimeout(() => {
				lastRun = Date.now();
				timeoutId = null;
				fn(...args);
			}, limit - timeSinceLastRun);
		}
	};
}

// ============================================================================
// Object utilities
// ============================================================================

/**
 * Pick properties from an object
 *
 * @param obj - Source object
 * @param keys - Keys to pick
 * @returns New object with picked properties
 *
 * @example
 * ```ts
 * pick({ a: 1, b: 2, c: 3 }, ["a", "c"]); // { a: 1, c: 3 }
 * ```
 */
export function pick<T extends object, K extends keyof T>(
	obj: T,
	keys: K[],
): Pick<T, K> {
	const result = {} as Pick<T, K>;
	for (const key of keys) {
		if (key in obj) {
			result[key] = obj[key];
		}
	}
	return result;
}

/**
 * Omit properties from an object
 *
 * @param obj - Source object
 * @param keys - Keys to omit
 * @returns New object without omitted properties
 *
 * @example
 * ```ts
 * omit({ a: 1, b: 2, c: 3 }, ["b"]); // { a: 1, c: 3 }
 * ```
 */
export function omit<T extends object, K extends keyof T>(
	obj: T,
	keys: K[],
): Omit<T, K> {
	const result = { ...obj };
	for (const key of keys) {
		delete result[key];
	}
	return result;
}

/**
 * Check if value is a plain object
 *
 * @param value - Value to check
 * @returns True if value is a plain object
 */
export function isPlainObject(
	value: unknown,
): value is Record<string, unknown> {
	if (typeof value !== "object" || value === null) {
		return false;
	}
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}

// ============================================================================
// Array utilities
// ============================================================================

/**
 * Chunk an array into smaller arrays
 *
 * @param arr - Array to chunk
 * @param size - Chunk size
 * @returns Array of chunks
 *
 * @example
 * ```ts
 * chunk([1, 2, 3, 4, 5], 2); // [[1, 2], [3, 4], [5]]
 * ```
 */
export function chunk<T>(arr: T[], size: number): T[][] {
	const result: T[][] = [];
	for (let i = 0; i < arr.length; i += size) {
		result.push(arr.slice(i, i + size));
	}
	return result;
}

/**
 * Get unique values from an array
 *
 * @param arr - Array with potential duplicates
 * @returns Array with unique values
 *
 * @example
 * ```ts
 * unique([1, 2, 2, 3, 1]); // [1, 2, 3]
 * ```
 */
export function unique<T>(arr: T[]): T[] {
	return [...new Set(arr)];
}

/**
 * Group array items by a key
 *
 * @param arr - Array to group
 * @param keyFn - Function to extract group key
 * @returns Object with grouped items
 *
 * @example
 * ```ts
 * const users = [
 *   { name: "Alice", age: 25 },
 *   { name: "Bob", age: 30 },
 *   { name: "Charlie", age: 25 }
 * ];
 * groupBy(users, u => u.age);
 * // { 25: [{ name: "Alice", ... }, { name: "Charlie", ... }], 30: [...] }
 * ```
 */
export function groupBy<T, K extends string | number>(
	arr: T[],
	keyFn: (item: T) => K,
): Record<K, T[]> {
	const result = {} as Record<K, T[]>;
	for (const item of arr) {
		const key = keyFn(item);
		if (!result[key]) {
			result[key] = [];
		}
		result[key].push(item);
	}
	return result;
}

/**
 * Shuffle an array (Fisher-Yates)
 *
 * @param arr - Array to shuffle
 * @returns New shuffled array
 *
 * @example
 * ```ts
 * shuffle([1, 2, 3, 4, 5]); // e.g., [3, 1, 5, 2, 4]
 * ```
 */
export function shuffle<T>(arr: T[]): T[] {
	const result = [...arr];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[result[i], result[j]] = [result[j] as T, result[i] as T];
	}
	return result;
}

// ============================================================================
// String utilities
// ============================================================================

export { capitalize } from "./string.js";

/**
 * Truncate a string to a maximum length
 *
 * @param str - String to truncate
 * @param maxLength - Maximum length
 * @param suffix - Suffix to add (default: "...")
 * @returns Truncated string
 *
 * @example
 * ```ts
 * truncate("Hello, World!", 8); // "Hello..."
 * truncate("Hello, World!", 8, "…"); // "Hello, …"
 * ```
 */
export function truncate(
	str: string,
	maxLength: number,
	suffix = "...",
): string {
	if (str.length <= maxLength) {
		return str;
	}
	return str.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Convert string to camelCase
 *
 * @param str - String to convert
 * @returns camelCase string
 *
 * @example
 * ```ts
 * camelCase("hello-world"); // "helloWorld"
 * camelCase("hello_world"); // "helloWorld"
 * ```
 */
export function camelCase(str: string): string {
	return str
		.replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
		.replace(/^./, (c) => c.toLowerCase());
}

/**
 * Convert string to kebab-case
 *
 * @param str - String to convert
 * @returns kebab-case string
 *
 * @example
 * ```ts
 * kebabCase("helloWorld"); // "hello-world"
 * kebabCase("HelloWorld"); // "hello-world"
 * ```
 */
export function kebabCase(str: string): string {
	return str
		.replace(/([a-z])([A-Z])/g, "$1-$2")
		.replace(/[\s_]+/g, "-")
		.toLowerCase();
}

/**
 * Convert string to snake_case
 *
 * @param str - String to convert
 * @returns snake_case string
 *
 * @example
 * ```ts
 * snakeCase("helloWorld"); // "hello_world"
 * snakeCase("hello-world"); // "hello_world"
 * ```
 */
export function snakeCase(str: string): string {
	return str
		.replace(/([a-z])([A-Z])/g, "$1_$2")
		.replace(/[-\s]+/g, "_")
		.toLowerCase();
}

// ============================================================================
// Error utilities
// ============================================================================

/**
 * Extract error message from unknown error type
 *
 * Safe utility for extracting error messages in catch blocks where
 * the error type is unknown. Handles Error instances and other types.
 *
 * @param error - Unknown error value (from catch block)
 * @returns Human-readable error message
 *
 * @example
 * ```ts
 * try {
 *   throw new Error("Something went wrong");
 * } catch (error) {
 *   console.error(getErrorMessage(error)); // "Something went wrong"
 * }
 *
 * try {
 *   throw "string error";
 * } catch (error) {
 *   console.error(getErrorMessage(error)); // "string error"
 * }
 * ```
 */
export function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	return String(error);
}
