/**
 * Resource Pool
 *
 * A simple cache for expensive resources that should be created once per key.
 * Thread-safe for single-threaded async operations - prevents duplicate
 * factory calls for the same key even when called concurrently.
 *
 * ## Use Cases
 *
 * - Parser instances (tree-sitter grammars)
 * - Database connections
 * - HTTP clients
 * - File handles
 * - Any expensive resource that should be created once per key
 *
 * ## Example
 *
 * ```typescript
 * import { ResourcePool } from "@sidequest/core/concurrency";
 *
 * const parserPool = new ResourcePool<string, Parser>();
 *
 * export async function getParser(language: string): Promise<Parser> {
 *   return parserPool.getOrCreate(language, async (lang) => {
 *     const parser = new Parser();
 *     const grammar = await loadGrammar(lang);
 *     parser.setLanguage(grammar);
 *     return parser;
 *   });
 * }
 * ```
 *
 * ## Thread Safety
 *
 * The pool uses a pending map to prevent concurrent factory calls for
 * the same key. If multiple callers request the same key simultaneously,
 * only one factory call is made and all callers receive the same result.
 *
 * @module core/concurrency/resource-pool
 */

/**
 * A simple cache for expensive resources that should be created once per key.
 * Prevents duplicate creation if called concurrently with same key.
 */
export class ResourcePool<K, V> {
	private cache = new Map<K, V>();
	private pending = new Map<K, Promise<V>>();

	/**
	 * Get a cached resource or create it using the factory.
	 * Prevents duplicate creation if called concurrently with same key.
	 *
	 * @param key - The resource key
	 * @param factory - Function to create the resource if not cached
	 * @returns The cached or newly created resource
	 */
	async getOrCreate(key: K, factory: (key: K) => Promise<V>): Promise<V> {
		// Return cached value if available
		if (this.cache.has(key)) {
			return this.cache.get(key)!;
		}

		// Return pending promise if factory is already running for this key
		if (this.pending.has(key)) {
			return this.pending.get(key)!;
		}

		// Create new resource
		const promise = factory(key);
		this.pending.set(key, promise);

		try {
			const value = await promise;
			this.cache.set(key, value);
			return value;
		} finally {
			// Always clean up pending promise, even if factory throws
			this.pending.delete(key);
		}
	}

	/**
	 * Check if a resource exists in the pool.
	 *
	 * @param key - The resource key
	 * @returns True if the resource is cached
	 */
	has(key: K): boolean {
		return this.cache.has(key);
	}

	/**
	 * Get a resource without creating (returns undefined if not cached).
	 *
	 * @param key - The resource key
	 * @returns The cached resource or undefined
	 */
	get(key: K): V | undefined {
		return this.cache.get(key);
	}

	/**
	 * Manually set a resource in the pool.
	 *
	 * @param key - The resource key
	 * @param value - The resource value
	 */
	set(key: K, value: V): void {
		this.cache.set(key, value);
	}

	/**
	 * Remove a resource from the pool.
	 *
	 * @param key - The resource key
	 * @returns True if the resource was removed, false if it didn't exist
	 */
	delete(key: K): boolean {
		return this.cache.delete(key);
	}

	/**
	 * Clear all cached resources.
	 */
	clear(): void {
		this.cache.clear();
		this.pending.clear();
	}

	/**
	 * Get the number of cached resources.
	 */
	get size(): number {
		return this.cache.size;
	}
}
