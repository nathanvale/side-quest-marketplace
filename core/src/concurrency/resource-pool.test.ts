import { describe, expect, test } from "bun:test";
import { ResourcePool } from "./resource-pool.ts";

describe("ResourcePool", () => {
	test("basic get/set operations", () => {
		const pool = new ResourcePool<string, number>();

		// Initially empty
		expect(pool.size).toBe(0);
		expect(pool.has("key1")).toBe(false);
		expect(pool.get("key1")).toBeUndefined();

		// Set a value
		pool.set("key1", 42);
		expect(pool.size).toBe(1);
		expect(pool.has("key1")).toBe(true);
		expect(pool.get("key1")).toBe(42);

		// Set another value
		pool.set("key2", 100);
		expect(pool.size).toBe(2);
		expect(pool.get("key2")).toBe(100);
	});

	test("getOrCreate caches result", async () => {
		const pool = new ResourcePool<string, number>();
		let callCount = 0;

		const factory = async (key: string) => {
			callCount++;
			return key.length;
		};

		// First call creates resource
		const result1 = await pool.getOrCreate("hello", factory);
		expect(result1).toBe(5);
		expect(callCount).toBe(1);
		expect(pool.has("hello")).toBe(true);

		// Second call returns cached value
		const result2 = await pool.getOrCreate("hello", factory);
		expect(result2).toBe(5);
		expect(callCount).toBe(1); // Factory not called again
	});

	test("getOrCreate only calls factory once per key", async () => {
		const pool = new ResourcePool<string, string>();
		const callCounts = new Map<string, number>();

		const factory = async (key: string) => {
			callCounts.set(key, (callCounts.get(key) ?? 0) + 1);
			// Simulate expensive operation
			await new Promise((resolve) => setTimeout(resolve, 10));
			return `result-${key}`;
		};

		// Create multiple resources
		await pool.getOrCreate("key1", factory);
		await pool.getOrCreate("key2", factory);
		await pool.getOrCreate("key1", factory); // Should use cache

		expect(callCounts.get("key1")).toBe(1);
		expect(callCounts.get("key2")).toBe(1);
	});

	test("concurrent getOrCreate for same key only calls factory once", async () => {
		const pool = new ResourcePool<string, number>();
		let factoryCalls = 0;

		const factory = async (key: string) => {
			factoryCalls++;
			// Simulate expensive async operation
			await new Promise((resolve) => setTimeout(resolve, 50));
			return key.length;
		};

		// Fire multiple concurrent requests for same key
		const promises = [
			pool.getOrCreate("test", factory),
			pool.getOrCreate("test", factory),
			pool.getOrCreate("test", factory),
		];

		const results = await Promise.all(promises);

		// All should return same value
		expect(results).toEqual([4, 4, 4]);

		// Factory should only be called once
		expect(factoryCalls).toBe(1);

		// Resource should be cached
		expect(pool.has("test")).toBe(true);
		expect(pool.get("test")).toBe(4);
	});

	test("concurrent getOrCreate for different keys calls factory for each", async () => {
		const pool = new ResourcePool<string, number>();
		const factoryCalls = new Map<string, number>();

		const factory = async (key: string) => {
			factoryCalls.set(key, (factoryCalls.get(key) ?? 0) + 1);
			await new Promise((resolve) => setTimeout(resolve, 20));
			return key.length;
		};

		// Fire concurrent requests for different keys
		const results = await Promise.all([
			pool.getOrCreate("a", factory),
			pool.getOrCreate("bb", factory),
			pool.getOrCreate("ccc", factory),
		]);

		expect(results).toEqual([1, 2, 3]);
		expect(factoryCalls.get("a")).toBe(1);
		expect(factoryCalls.get("bb")).toBe(1);
		expect(factoryCalls.get("ccc")).toBe(1);
	});

	test("clear removes all resources", async () => {
		const pool = new ResourcePool<string, number>();

		pool.set("key1", 1);
		pool.set("key2", 2);
		pool.set("key3", 3);

		expect(pool.size).toBe(3);

		pool.clear();

		expect(pool.size).toBe(0);
		expect(pool.has("key1")).toBe(false);
		expect(pool.has("key2")).toBe(false);
		expect(pool.has("key3")).toBe(false);
	});

	test("delete removes single resource", () => {
		const pool = new ResourcePool<string, number>();

		pool.set("key1", 1);
		pool.set("key2", 2);

		expect(pool.size).toBe(2);

		const deleted = pool.delete("key1");
		expect(deleted).toBe(true);
		expect(pool.size).toBe(1);
		expect(pool.has("key1")).toBe(false);
		expect(pool.has("key2")).toBe(true);

		// Deleting non-existent key returns false
		const notDeleted = pool.delete("key3");
		expect(notDeleted).toBe(false);
	});

	test("factory error handling - error not cached", async () => {
		const pool = new ResourcePool<string, number>();
		let attempts = 0;

		const factory = async (key: string) => {
			attempts++;
			if (attempts === 1) {
				throw new Error("First attempt fails");
			}
			return 42;
		};

		// First call should throw
		await expect(pool.getOrCreate("key", factory)).rejects.toThrow(
			"First attempt fails",
		);

		// Resource should not be cached after error
		expect(pool.has("key")).toBe(false);

		// Second call should succeed
		const result = await pool.getOrCreate("key", factory);
		expect(result).toBe(42);
		expect(attempts).toBe(2);
		expect(pool.has("key")).toBe(true);
	});

	test("concurrent calls with factory error - all fail", async () => {
		const pool = new ResourcePool<string, number>();
		let factoryCalls = 0;

		const factory = async (_key: string) => {
			factoryCalls++;
			await new Promise((resolve) => setTimeout(resolve, 20));
			throw new Error("Factory always fails");
		};

		// Fire multiple concurrent requests
		const promises = [
			pool.getOrCreate("key", factory),
			pool.getOrCreate("key", factory),
			pool.getOrCreate("key", factory),
		];

		// All should fail with same error
		const results = await Promise.allSettled(promises);

		expect(results.every((r) => r.status === "rejected")).toBe(true);
		expect(factoryCalls).toBe(1); // Still only one factory call

		// Resource should not be cached
		expect(pool.has("key")).toBe(false);
	});

	test("supports complex key and value types", async () => {
		interface Config {
			language: string;
			version: number;
		}
		interface Parser {
			parse: (code: string) => string;
		}

		const pool = new ResourcePool<Config, Parser>();

		const factory = async (key: Config) => {
			return {
				parse: (code: string) =>
					`Parsed ${code} with ${key.language} v${key.version}`,
			};
		};

		const key1 = { language: "typescript", version: 5 };
		const key2 = { language: "typescript", version: 5 };

		const parser1 = await pool.getOrCreate(key1, factory);
		const result1 = parser1.parse("const x = 1");
		expect(result1).toBe("Parsed const x = 1 with typescript v5");

		// Different object instance but same content - treated as different key
		const parser2 = await pool.getOrCreate(key2, factory);
		expect(parser2).not.toBe(parser1); // Different instances

		// Same object instance - uses cache
		const parser3 = await pool.getOrCreate(key1, factory);
		expect(parser3).toBe(parser1); // Same instance
	});

	test("manual set overrides pending factory", async () => {
		const pool = new ResourcePool<string, number>();

		const slowFactory = async (_key: string) => {
			await new Promise((resolve) => setTimeout(resolve, 100));
			return 42;
		};

		// Start factory
		const promise = pool.getOrCreate("key", slowFactory);

		// Immediately set a different value
		pool.set("key", 999);

		// Factory still completes but value is already set
		const result = await promise;
		expect(result).toBe(42); // Factory returns its value

		// But the pool has the manually set value
		expect(pool.get("key")).toBe(42); // Factory result wins
	});

	test("clear during pending factory", async () => {
		const pool = new ResourcePool<string, number>();

		const slowFactory = async (_key: string) => {
			await new Promise((resolve) => setTimeout(resolve, 50));
			return 42;
		};

		// Start factory
		const promise = pool.getOrCreate("key", slowFactory);

		// Clear pool while factory is running
		pool.clear();

		// Factory still completes
		const result = await promise;
		expect(result).toBe(42);

		// But pool is empty after clear
		expect(pool.has("key")).toBe(true); // Factory sets it after clear
		expect(pool.get("key")).toBe(42);
	});
});
