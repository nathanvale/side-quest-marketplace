import { describe, expect, it } from "bun:test";

import {
	bunVersion,
	deepClone,
	deepEquals,
	isBun,
	safeJsonParse,
	sleep,
	uuid,
} from "./index";

describe("utils", () => {
	describe("deepEquals", () => {
		it("returns true for equal primitives", () => {
			expect(deepEquals(1, 1)).toBe(true);
			expect(deepEquals("hello", "hello")).toBe(true);
			expect(deepEquals(true, true)).toBe(true);
			expect(deepEquals(null, null)).toBe(true);
		});

		it("returns false for different primitives", () => {
			expect(deepEquals(1, 2)).toBe(false);
			expect(deepEquals("hello", "world")).toBe(false);
			expect(deepEquals(true, false)).toBe(false);
		});

		it("returns true for equal objects", () => {
			expect(deepEquals({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
			expect(deepEquals({ nested: { x: 1 } }, { nested: { x: 1 } })).toBe(true);
		});

		it("returns false for different objects", () => {
			expect(deepEquals({ a: 1 }, { a: 2 })).toBe(false);
			expect(deepEquals({ a: 1 }, { b: 1 })).toBe(false);
		});

		it("returns true for equal arrays", () => {
			expect(deepEquals([1, 2, 3], [1, 2, 3])).toBe(true);
			expect(deepEquals([{ a: 1 }], [{ a: 1 }])).toBe(true);
		});

		it("returns false for different arrays", () => {
			expect(deepEquals([1, 2], [1, 2, 3])).toBe(false);
			expect(deepEquals([1, 2], [2, 1])).toBe(false);
		});

		it("handles NaN equality", () => {
			// In non-strict mode, NaN === NaN (SameValue semantics)
			expect(deepEquals(Number.NaN, Number.NaN, false)).toBe(true);
		});
	});

	describe("deepClone", () => {
		it("clones simple objects", () => {
			const original = { a: 1, b: "hello" };
			const cloned = deepClone(original);
			expect(cloned).toEqual(original);
			expect(cloned).not.toBe(original);
		});

		it("clones nested objects", () => {
			const original = { outer: { inner: { value: 42 } } };
			const cloned = deepClone(original);
			expect(cloned).toEqual(original);
			expect(cloned.outer).not.toBe(original.outer);
			expect(cloned.outer.inner).not.toBe(original.outer.inner);
		});

		it("clones arrays", () => {
			const original = [1, { a: 2 }, [3, 4]];
			const cloned = deepClone(original);
			expect(cloned).toEqual(original);
			expect(cloned).not.toBe(original);
			expect(cloned[1]).not.toBe(original[1]);
		});

		it("mutations do not affect original", () => {
			const original = { a: 1, nested: { b: 2 } };
			const cloned = deepClone(original);
			cloned.a = 100;
			cloned.nested.b = 200;
			expect(original.a).toBe(1);
			expect(original.nested.b).toBe(2);
		});
	});

	describe("sleep", () => {
		it("returns a promise", () => {
			const result = sleep(1);
			expect(result).toBeInstanceOf(Promise);
		});

		it("resolves after specified time", async () => {
			const start = Date.now();
			await sleep(50);
			const elapsed = Date.now() - start;
			expect(elapsed).toBeGreaterThanOrEqual(45); // Allow small variance
		});
	});

	describe("uuid", () => {
		it("returns a valid UUID v4 format", () => {
			const id = uuid();
			// UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
			expect(id).toMatch(
				/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
			);
		});

		it("generates unique values", () => {
			const ids = new Set<string>();
			for (let i = 0; i < 100; i++) {
				ids.add(uuid());
			}
			expect(ids.size).toBe(100);
		});
	});

	describe("isBun", () => {
		it("returns true when running in Bun", () => {
			// We're running these tests in Bun
			expect(isBun()).toBe(true);
		});
	});

	describe("bunVersion", () => {
		it("returns a version string when running in Bun", () => {
			const version = bunVersion();
			expect(version).not.toBeNull();
			expect(typeof version).toBe("string");
			// Should look like a semver version
			expect(version).toMatch(/^\d+\.\d+\.\d+/);
		});
	});

	describe("safeJsonParse", () => {
		it("parses valid JSON", () => {
			expect(safeJsonParse('{"valid": true}', { valid: false })).toEqual({
				valid: true,
			});
		});

		it("returns fallback for invalid JSON", () => {
			expect(safeJsonParse("invalid json", { fallback: true })).toEqual({
				fallback: true,
			});
		});

		it("returns fallback for empty string", () => {
			expect(safeJsonParse("", { empty: true })).toEqual({ empty: true });
		});
	});
});
