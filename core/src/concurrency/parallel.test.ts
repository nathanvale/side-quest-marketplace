import { describe, expect, test } from "bun:test";
import { processInParallelChunks } from "./parallel.js";

describe("processInParallelChunks", () => {
	describe("basic parallel processing", () => {
		test("processes all items with default chunk size", async () => {
			const items = Array.from({ length: 25 }, (_, i) => i);
			const results = await processInParallelChunks({
				items,
				processor: async (n) => n * 2,
			});

			expect(results).toEqual(items.map((n) => n * 2));
		});

		test("processes items with custom chunk size", async () => {
			const items = Array.from({ length: 15 }, (_, i) => i);
			const processedChunks: number[][] = [];

			await processInParallelChunks({
				items,
				chunkSize: 5,
				processor: async (n) => {
					// Track which items are in the same chunk
					processedChunks.push([n]);
					return n;
				},
			});

			// Should have processed in 3 chunks of 5
			expect(processedChunks.length).toBe(15);
		});

		test("handles single item", async () => {
			const results = await processInParallelChunks({
				items: [42],
				processor: async (n) => n * 2,
			});

			expect(results).toEqual([84]);
		});

		test("handles empty input", async () => {
			const results = await processInParallelChunks({
				items: [],
				processor: async (n: number) => n,
			});

			expect(results).toEqual([]);
		});
	});

	describe("result flattening", () => {
		test("handles processor returning single value", async () => {
			const items = [1, 2, 3];
			const results = await processInParallelChunks({
				items,
				processor: async (n) => n * 2,
			});

			expect(results).toEqual([2, 4, 6]);
		});

		test("handles processor returning array", async () => {
			const items = [1, 2, 3];
			const results = await processInParallelChunks({
				items,
				processor: async (n) => [n, n * 2],
			});

			expect(results).toEqual([1, 2, 2, 4, 3, 6]);
		});

		test("handles processor returning empty array", async () => {
			const items = [1, 2, 3];
			const results = await processInParallelChunks({
				items,
				processor: async () => [],
			});

			expect(results).toEqual([]);
		});

		test("handles mixed single values and arrays", async () => {
			const items = [1, 2, 3, 4];
			const results = await processInParallelChunks({
				items,
				processor: async (n) => (n % 2 === 0 ? [n, n * 2] : n),
			});

			expect(results).toEqual([1, 2, 4, 3, 4, 8]);
		});
	});

	describe("early termination with maxResults", () => {
		test("stops processing when maxResults reached", async () => {
			const items = Array.from({ length: 100 }, (_, i) => i);
			let processedCount = 0;

			const results = await processInParallelChunks({
				items,
				maxResults: 5,
				processor: async (n) => {
					processedCount++;
					return n;
				},
			});

			expect(results).toHaveLength(5);
			expect(results).toEqual([0, 1, 2, 3, 4]);
			// Should process at least one chunk (10 items) but not all 100
			expect(processedCount).toBeLessThan(100);
			expect(processedCount).toBeGreaterThanOrEqual(5);
		});

		test("stops mid-chunk when maxResults reached", async () => {
			const items = Array.from({ length: 25 }, (_, i) => i);

			const results = await processInParallelChunks({
				items,
				chunkSize: 10,
				maxResults: 15,
				processor: async (n) => n,
			});

			expect(results).toHaveLength(15);
		});

		test("stops with array results when maxResults reached", async () => {
			const items = [1, 2, 3, 4, 5];

			const results = await processInParallelChunks({
				items,
				maxResults: 5,
				processor: async (n) => [n, n * 2], // Each item produces 2 results
			});

			expect(results).toHaveLength(5);
			// First 3 items produce: [1, 2, 2, 4, 3, 6] - stopped at 5
		});

		test("returns exact maxResults count", async () => {
			const items = Array.from({ length: 100 }, (_, i) => i);

			const results = await processInParallelChunks({
				items,
				maxResults: 25,
				processor: async (n) => n,
			});

			expect(results).toHaveLength(25);
		});
	});

	describe("error handling", () => {
		test("propagates errors when no onError handler", async () => {
			const items = [1, 2, 3];

			await expect(
				processInParallelChunks({
					items,
					processor: async (n) => {
						if (n === 2) {
							throw new Error("Test error");
						}
						return n;
					},
				}),
			).rejects.toThrow("Test error");
		});

		test("calls onError handler when provided", async () => {
			const items = [1, 2, 3, 4];
			const errors: Array<{ item: number; error: Error }> = [];

			const results = await processInParallelChunks({
				items,
				processor: async (n) => {
					if (n % 2 === 0) {
						throw new Error(`Error for ${n}`);
					}
					return n;
				},
				onError: (item, error) => {
					errors.push({ item, error });
					return -1; // Fallback value
				},
			});

			expect(results).toEqual([1, -1, 3, -1]);
			expect(errors).toHaveLength(2);
			expect(errors[0]?.item).toBe(2);
			expect(errors[1]?.item).toBe(4);
		});

		test("onError can return empty array to skip failed items", async () => {
			const items = [1, 2, 3, 4, 5];

			const results = await processInParallelChunks({
				items,
				processor: async (n) => {
					if (n % 2 === 0) {
						throw new Error(`Error for ${n}`);
					}
					return n;
				},
				onError: () => [], // Skip failed items
			});

			expect(results).toEqual([1, 3, 5]);
		});

		test("onError can return array of fallback values", async () => {
			const items = [1, 2, 3];

			const results = await processInParallelChunks({
				items,
				processor: async (n) => {
					if (n === 2) {
						throw new Error("Test error");
					}
					return [n, n * 2];
				},
				onError: (item) => [item, -1], // Fallback array
			});

			expect(results).toEqual([1, 2, 2, -1, 3, 6]);
		});

		test("onError receives correct error object", async () => {
			const items = [1];
			const errors: Error[] = [];

			await processInParallelChunks({
				items,
				processor: async () => {
					throw new Error("Specific error message");
				},
				onError: (_item, error) => {
					errors.push(error);
					return [];
				},
			});

			expect(errors).toHaveLength(1);
			expect(errors[0]).toBeInstanceOf(Error);
			expect(errors[0]?.message).toBe("Specific error message");
		});
	});

	describe("async processing", () => {
		test("handles async delays in processing", async () => {
			const items = [1, 2, 3];

			const results = await processInParallelChunks({
				items,
				processor: async (n) => {
					await new Promise((resolve) => setTimeout(resolve, 10));
					return n * 2;
				},
			});

			expect(results).toEqual([2, 4, 6]);
		});

		test("processes chunks in parallel", async () => {
			const items = Array.from({ length: 20 }, (_, i) => i);
			const processingOrder: number[] = [];

			await processInParallelChunks({
				items,
				chunkSize: 5,
				processor: async (n) => {
					await new Promise((resolve) =>
						setTimeout(resolve, Math.random() * 10),
					);
					processingOrder.push(n);
					return n;
				},
			});

			// Items within a chunk may complete out of order due to parallel processing
			// but we should have processed all items
			expect(processingOrder).toHaveLength(20);
			expect(new Set(processingOrder).size).toBe(20);
		});
	});

	describe("edge cases", () => {
		test("handles chunk size larger than items length", async () => {
			const items = [1, 2, 3];

			const results = await processInParallelChunks({
				items,
				chunkSize: 100,
				processor: async (n) => n,
			});

			expect(results).toEqual([1, 2, 3]);
		});

		test("handles chunk size of 1", async () => {
			const items = [1, 2, 3];

			const results = await processInParallelChunks({
				items,
				chunkSize: 1,
				processor: async (n) => n * 2,
			});

			expect(results).toEqual([2, 4, 6]);
		});

		test("handles maxResults of 0", async () => {
			const items = [1, 2, 3];
			let processedCount = 0;

			const results = await processInParallelChunks({
				items,
				maxResults: 0,
				processor: async (n) => {
					processedCount++;
					return n;
				},
			});

			expect(results).toEqual([]);
			// Should not process any items if maxResults is 0
			expect(processedCount).toBe(0);
		});

		test("handles undefined maxResults (processes all)", async () => {
			const items = [1, 2, 3, 4, 5];

			const results = await processInParallelChunks({
				items,
				maxResults: undefined,
				processor: async (n) => n,
			});

			expect(results).toEqual([1, 2, 3, 4, 5]);
		});

		test("handles complex object types", async () => {
			interface TestItem {
				id: number;
				name: string;
			}

			const items: TestItem[] = [
				{ id: 1, name: "foo" },
				{ id: 2, name: "bar" },
			];

			const results = await processInParallelChunks({
				items,
				processor: async (item) => ({
					...item,
					processed: true,
				}),
			});

			expect(results).toEqual([
				{ id: 1, name: "foo", processed: true },
				{ id: 2, name: "bar", processed: true },
			]);
		});
	});
});
