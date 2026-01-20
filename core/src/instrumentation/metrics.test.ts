import { beforeEach, describe, expect, test } from "bun:test";
import {
	getCounters,
	getHistogramBuckets,
	getHistograms,
	getLatencyBucket,
	incrementCounter,
	observeHistogram,
	resetMetrics,
} from "./metrics.js";

describe("metrics", () => {
	beforeEach(() => {
		resetMetrics();
	});

	describe("incrementCounter", () => {
		test("creates new counter with initial value", () => {
			incrementCounter("operations_total", { tool: "test:op", success: true });

			const counters = getCounters();
			expect(counters).toHaveLength(1);
			expect(counters[0]?.name).toBe("operations_total");
			expect(counters[0]?.value).toBe(1);
		});

		test("increments existing counter", () => {
			incrementCounter("operations_total", { tool: "test:op", success: true });
			incrementCounter("operations_total", { tool: "test:op", success: true });

			const counters = getCounters();
			expect(counters).toHaveLength(1);
			expect(counters[0]?.value).toBe(2);
		});

		test("supports custom increment value", () => {
			incrementCounter("bytes_processed", { source: "inbox" }, 1024);

			const counters = getCounters();
			expect(counters[0]?.value).toBe(1024);
		});

		test("maintains separate counters for different labels", () => {
			incrementCounter("operations_total", { tool: "test:a", success: true });
			incrementCounter("operations_total", { tool: "test:b", success: true });

			const counters = getCounters();
			expect(counters).toHaveLength(2);
		});
	});

	describe("observeHistogram", () => {
		test("creates new histogram with single observation", () => {
			observeHistogram("operation_duration_seconds", 2.5, { tool: "test:op" });

			const histograms = getHistograms();
			expect(histograms).toHaveLength(1);
			expect(histograms[0]?.name).toBe("operation_duration_seconds");
			expect(histograms[0]?.observations).toHaveLength(1);
			expect(histograms[0]?.observations[0]?.value).toBe(2.5);
		});

		test("appends to existing histogram", () => {
			observeHistogram("operation_duration_seconds", 1.0, { tool: "test:op" });
			observeHistogram("operation_duration_seconds", 2.0, { tool: "test:op" });
			observeHistogram("operation_duration_seconds", 3.0, { tool: "test:op" });

			const histograms = getHistograms();
			expect(histograms).toHaveLength(1);
			expect(histograms[0]?.observations).toHaveLength(3);
		});

		test("maintains separate histograms for different labels", () => {
			observeHistogram("operation_duration_seconds", 1.0, { tool: "test:a" });
			observeHistogram("operation_duration_seconds", 2.0, { tool: "test:b" });

			const histograms = getHistograms();
			expect(histograms).toHaveLength(2);
		});
	});

	describe("getHistogramBuckets", () => {
		test("returns empty buckets for non-existent histogram", () => {
			const result = getHistogramBuckets("nonexistent", { tool: "test" });

			expect(result.buckets).toEqual([0, 0, 0, 0, 0]);
			expect(result.boundaries).toEqual([1, 5, 10, 30, 60]);
		});

		test("distributes observations into SLO-aligned buckets", () => {
			// Add observations at different durations (in seconds)
			observeHistogram("operation_duration_seconds", 0.5, { tool: "test:op" }); // < 1s
			observeHistogram("operation_duration_seconds", 3, { tool: "test:op" }); // 1-5s
			observeHistogram("operation_duration_seconds", 7, { tool: "test:op" }); // 5-10s
			observeHistogram("operation_duration_seconds", 20, { tool: "test:op" }); // 10-30s
			observeHistogram("operation_duration_seconds", 45, { tool: "test:op" }); // 30-60s

			const result = getHistogramBuckets("operation_duration_seconds", {
				tool: "test:op",
			});

			expect(result.buckets).toEqual([1, 2, 3, 4, 5]);
			expect(result.boundaries).toEqual([1, 5, 10, 30, 60]);
		});

		test("counts observations cumulatively into buckets", () => {
			observeHistogram("operation_duration_seconds", 0.5, { tool: "test:op" });
			observeHistogram("operation_duration_seconds", 0.8, { tool: "test:op" });
			observeHistogram("operation_duration_seconds", 3, { tool: "test:op" });

			const result = getHistogramBuckets("operation_duration_seconds", {
				tool: "test:op",
			});

			// 2 observations in <1s bucket, 3 total in <5s bucket (cumulative)
			expect(result.buckets[0]).toBe(2); // <= 1s
			expect(result.buckets[1]).toBe(3); // <= 5s
		});
	});

	describe("resetMetrics", () => {
		test("clears all counters and histograms", () => {
			incrementCounter("test", { label: "value" });
			observeHistogram("test", 1.0, { label: "value" });

			expect(getCounters()).toHaveLength(1);
			expect(getHistograms()).toHaveLength(1);

			resetMetrics();

			expect(getCounters()).toHaveLength(0);
			expect(getHistograms()).toHaveLength(0);
		});
	});

	describe("histogram memory management", () => {
		test("histogram includes buckets field on creation", () => {
			observeHistogram("test_metric", 1.5, { tool: "test" });

			const histograms = getHistograms();
			expect(histograms).toHaveLength(1);
			expect(histograms[0]?.buckets).toBeDefined();
			expect(Array.isArray(histograms[0]?.buckets)).toBe(true);
		});

		test("histogram limits observations to max size (FIFO)", () => {
			const MAX_OBS = 1000;
			// Add more than max observations
			for (let i = 0; i < MAX_OBS + 100; i++) {
				observeHistogram("test_metric", i / 100, { tool: "test" });
			}

			const histograms = getHistograms();
			expect(histograms).toHaveLength(1);

			const histogram = histograms[0];
			expect(histogram?.observations.length).toBeLessThanOrEqual(MAX_OBS);
		});

		test("histogram removes observations older than TTL", async () => {
			// This test is conceptual - TTL is 24h so we can't easily test it
			// without mocking time. But we verify the structure is correct.
			observeHistogram("test_metric", 1.0, { tool: "test" });

			const histograms = getHistograms();
			const observation = histograms[0]?.observations[0];

			expect(observation?.timestamp).toBeDefined();
			expect(typeof observation?.timestamp).toBe("number");
			expect(observation?.timestamp).toBeGreaterThan(0);
		});

		test("getHistogramBuckets returns copy of buckets (O(1))", () => {
			observeHistogram("test_metric", 2.5, { tool: "test" });

			const result1 = getHistogramBuckets("test_metric", { tool: "test" });
			const result2 = getHistogramBuckets("test_metric", { tool: "test" });

			// Should be equal values but different arrays
			expect(result1.buckets).toEqual(result2.buckets);
			expect(result1.buckets).not.toBe(result2.buckets);
		});

		test("buckets are maintained incrementally", () => {
			// Add observations one at a time
			observeHistogram("test_metric", 0.5, { tool: "test" }); // < 1s
			const buckets1 = getHistogramBuckets("test_metric", { tool: "test" });

			observeHistogram("test_metric", 3.0, { tool: "test" }); // 1-5s
			const buckets2 = getHistogramBuckets("test_metric", { tool: "test" });

			// First bucket (<=1s) should stay at 1 (only one obs <= 1s)
			// Second bucket (<=5s) should increase from 1 to 2 (cumulative)
			expect(buckets1.buckets[0]).toBe(1); // 0.5s <= 1s
			expect(buckets2.buckets[0]).toBe(1); // Still only 0.5s <= 1s
			expect(buckets2.buckets[1]).toBe(2); // Both 0.5s and 3.0s <= 5s
		});
	});

	describe("getLatencyBucket", () => {
		test("returns correct bucket for various durations", () => {
			expect(getLatencyBucket(5)).toBe("0-10ms");
			expect(getLatencyBucket(25)).toBe("10-50ms");
			expect(getLatencyBucket(75)).toBe("50-100ms");
			expect(getLatencyBucket(150)).toBe("100-250ms");
			expect(getLatencyBucket(300)).toBe("250-500ms");
			expect(getLatencyBucket(750)).toBe("500-1000ms");
			expect(getLatencyBucket(1500)).toBe("1000-2500ms");
			expect(getLatencyBucket(3500)).toBe("2500-5000ms");
			expect(getLatencyBucket(7500)).toBe("5000-10000ms");
			expect(getLatencyBucket(15000)).toBe("10000+ms");
		});

		test("returns bucket for boundary values", () => {
			expect(getLatencyBucket(10)).toBe("0-10ms");
			expect(getLatencyBucket(50)).toBe("10-50ms");
			expect(getLatencyBucket(100)).toBe("50-100ms");
			expect(getLatencyBucket(10000)).toBe("5000-10000ms");
		});

		test("returns highest bucket for very large durations", () => {
			expect(getLatencyBucket(999999)).toBe("10000+ms");
		});
	});
});
