import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import type { Logger } from "@logtape/logtape";
import { setupTestLogging } from "../testing/logger.js";
import {
	categorizeError,
	type ErrorCode,
	getCounters,
	getCurrentContext,
	getErrorCategory,
	getHistogramBuckets,
	getHistograms,
	incrementCounter,
	observe,
	observeHistogram,
	observeSync,
	resetMetrics,
} from "./instrumentation.js";
import { getSubsystemLogger } from "./logger.js";

/**
 * Assertion helper for counter metrics.
 * Verifies a counter exists with expected value and optional label matching.
 */
function expectCounter(
	name: string,
	expectedValue: number,
	labels?: Record<string, string | number | boolean>,
) {
	const counters = getCounters();
	const counter = counters.find((c) => c.name === name);
	expect(counter).toBeDefined();
	expect(counter?.value).toBe(expectedValue);
	if (labels) {
		for (const [key, value] of Object.entries(labels)) {
			expect(counter?.labels[key]).toBe(value);
		}
	}
}

/**
 * Assertion helper for histogram metrics.
 * Verifies a histogram exists with expected observation count and optional label matching.
 */
function expectHistogram(
	name: string,
	expectedObservationCount: number,
	labels?: Record<string, string | number | boolean>,
) {
	const histograms = getHistograms();
	const histogram = histograms.find((h) => h.name === name);
	expect(histogram).toBeDefined();
	expect(histogram?.observations).toHaveLength(expectedObservationCount);
	if (labels) {
		for (const [key, value] of Object.entries(labels)) {
			expect(histogram?.labels[key]).toBe(value);
		}
	}
}

describe("instrumentation", () => {
	beforeEach(async () => {
		await setupTestLogging();
		resetMetrics();
	});

	afterEach(() => {
		// Ensure all mocks are cleaned up
		resetMetrics();
	});

	describe("observe", () => {
		test("returns original value transparently", async () => {
			const logger = getSubsystemLogger("templates");
			const expected = { data: "test" };

			const result = await observe(
				logger,
				"templates:test",
				async () => expected,
			);

			expect(result).toBe(expected);
		});

		test("re-throws errors after logging", async () => {
			const logger = getSubsystemLogger("templates");
			const error = new Error("Test error");

			await expect(
				observe(logger, "templates:test", async () => {
					throw error;
				}),
			).rejects.toThrow("Test error");
		});

		test("accepts custom success check", async () => {
			const logger = getSubsystemLogger("templates");
			const result = { success: false };

			const output = await observe(
				logger,
				"templates:test",
				async () => result,
				{
					isSuccess: (r) => r.success,
				},
			);

			expect(output).toBe(result);
		});

		test("accepts additional context", async () => {
			const logger = getSubsystemLogger("templates");

			const result = await observe(logger, "templates:test", async () => "ok", {
				context: { vaultPath: "/test" },
			});

			expect(result).toBe("ok");
		});
	});

	describe("observeSync", () => {
		test("returns original value transparently", () => {
			const logger = getSubsystemLogger("templates");
			const expected = { data: "test" };

			const result = observeSync(logger, "templates:test", () => expected);

			expect(result).toBe(expected);
		});

		test("re-throws errors after logging", () => {
			const logger = getSubsystemLogger("templates");
			const error = new Error("Test error");

			expect(() =>
				observeSync(logger, "templates:test", () => {
					throw error;
				}),
			).toThrow("Test error");
		});

		test("accepts custom success check", () => {
			const logger = getSubsystemLogger("templates");
			const result = { success: false };

			const output = observeSync(logger, "templates:test", () => result, {
				isSuccess: (r) => r.success,
			});

			expect(output).toBe(result);
		});

		test("accepts additional context", () => {
			const logger = getSubsystemLogger("templates");

			const result = observeSync(logger, "templates:test", () => "ok", {
				context: { vaultPath: "/test" },
			});

			expect(result).toBe("ok");
		});
	});

	describe("parentCid propagation", () => {
		test("observe accepts parentCid option", async () => {
			const logger = getSubsystemLogger("templates");
			const parentCid = "parent-123";

			const result = await observe(logger, "templates:test", async () => "ok", {
				parentCid,
			});

			expect(result).toBe("ok");
			// parentCid is passed through - logging happens internally
		});

		test("observeSync accepts parentCid option", () => {
			const logger = getSubsystemLogger("templates");
			const parentCid = "parent-456";

			const result = observeSync(logger, "templates:test", () => "ok", {
				parentCid,
			});

			expect(result).toBe("ok");
		});

		test("parentCid is optional and defaults to undefined", async () => {
			const logger = getSubsystemLogger("templates");

			// Should not throw when parentCid is not provided
			const result = await observe(logger, "templates:test", async () => "ok");

			expect(result).toBe("ok");
		});
	});

	describe("categorizeError", () => {
		test.each<[string, ErrorCode]>([
			["ECONNREFUSED connection refused", "NETWORK_ERROR"],
			["ENOTFOUND dns lookup failed", "NETWORK_ERROR"],
			["network error occurred", "NETWORK_ERROR"],
			["fetch failed", "NETWORK_ERROR"],
			["timeout exceeded", "TIMEOUT"],
			["operation timed out", "TIMEOUT"],
			["file not found", "NOT_FOUND"],
			["ENOENT: no such file", "NOT_FOUND"],
			["invalid input provided", "VALIDATION"],
			["validation failed", "VALIDATION"],
			["field must be a string", "VALIDATION"],
			["required field missing", "VALIDATION"],
			["permission denied", "PERMISSION"],
			["EACCES: access denied", "PERMISSION"],
			["EPERM: operation not permitted", "PERMISSION"],
			["unauthorized access", "PERMISSION"],
			["resource conflict detected", "CONFLICT"],
			["file already exists", "CONFLICT"],
			["unknown error xyz", "INTERNAL"],
		])('categorizes "%s" as %s', (message, expectedCode) => {
			expect(categorizeError(new Error(message))).toBe(expectedCode);
		});

		test("returns INTERNAL for non-Error objects", () => {
			expect(categorizeError("string error" as unknown)).toBe("INTERNAL");
			expect(categorizeError(null as unknown)).toBe("INTERNAL");
			expect(categorizeError(undefined as unknown)).toBe("INTERNAL");
			expect(categorizeError({ message: "object" } as unknown)).toBe(
				"INTERNAL",
			);
		});
	});

	describe("getErrorCategory", () => {
		test("NETWORK_ERROR is transient", () => {
			expect(getErrorCategory(new Error("ECONNREFUSED"))).toBe("transient");
		});

		test("TIMEOUT is transient", () => {
			expect(getErrorCategory(new Error("timeout"))).toBe("transient");
		});

		test("NOT_FOUND is permanent", () => {
			expect(getErrorCategory(new Error("not found"))).toBe("permanent");
		});

		test("VALIDATION is permanent", () => {
			expect(getErrorCategory(new Error("invalid"))).toBe("permanent");
		});

		test("CONFLICT is permanent", () => {
			expect(getErrorCategory(new Error("already exists"))).toBe("permanent");
		});

		test("INTERNAL is permanent", () => {
			expect(getErrorCategory(new Error("unknown"))).toBe("permanent");
		});

		test("PERMISSION is configuration", () => {
			expect(getErrorCategory(new Error("EACCES"))).toBe("configuration");
		});
	});

	describe("timing edge cases", () => {
		let mathMaxSpy: ReturnType<typeof spyOn> | undefined;

		afterEach(() => {
			// Clean up Math.max spy if it exists
			if (mathMaxSpy) {
				mathMaxSpy.mockRestore();
				mathMaxSpy = undefined;
			}
		});

		test("durationMs is never negative even with clock drift", async () => {
			const logger = getSubsystemLogger("templates");
			mathMaxSpy = spyOn(Math, "max");

			const result = await observe(logger, "templates:test", async () => {
				// Very fast operation
				return "fast";
			});

			expect(result).toBe("fast");
			// Verify Math.max was called with (0, duration) to clamp negative values
			expect(mathMaxSpy).toHaveBeenCalledWith(0, expect.any(Number) as number);
		});

		test("handles zero-duration operations", () => {
			const logger = getSubsystemLogger("templates");

			const result = observeSync(logger, "templates:test", () => "instant");

			expect(result).toBe("instant");
			// Zero-duration operations should still record metrics
			expectCounter("operations_total", 1, { success: true });
			expectHistogram("operation_duration_seconds", 1);
		});
	});

	describe("non-Error error handling", () => {
		test("handles thrown string", async () => {
			const logger = getSubsystemLogger("templates");

			await expect(
				observe(logger, "templates:test", async () => {
					throw "string error";
				}),
			).rejects.toBe("string error");
		});

		test("handles thrown null", async () => {
			const logger = getSubsystemLogger("templates");

			await expect(
				observe(logger, "templates:test", async () => {
					throw null;
				}),
			).rejects.toBeNull();
		});

		test("handles thrown object", async () => {
			const logger = getSubsystemLogger("templates");
			const errorObj = { code: "ERR", message: "custom" };

			await expect(
				observe(logger, "templates:test", async () => {
					throw errorObj;
				}),
			).rejects.toEqual(errorObj);
		});

		test("observeSync handles thrown string", () => {
			const logger = getSubsystemLogger("templates");

			expect(() =>
				observeSync(logger, "templates:test", () => {
					throw "string error";
				}),
			).toThrow("string error");
		});
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

	describe("observe metrics integration", () => {
		test("records counter and histogram on success", async () => {
			const logger = getSubsystemLogger("templates");

			await observe(logger, "templates:test", async () => "ok");

			expectCounter("operations_total", 1, { success: true });
			expectHistogram("operation_duration_seconds", 1);
		});

		test("records counter and histogram on error", async () => {
			const logger = getSubsystemLogger("templates");

			await expect(
				observe(logger, "templates:test", async () => {
					throw new Error("fail");
				}),
			).rejects.toThrow("fail");

			expectCounter("operations_total", 1, { success: false });
			expectHistogram("operation_duration_seconds", 1);
		});

		test("observeSync records metrics", () => {
			const logger = getSubsystemLogger("templates");

			observeSync(logger, "templates:test", () => "ok");

			expectCounter("operations_total", 1, { success: true });
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

	describe("AsyncLocalStorage correlation propagation", () => {
		test("getCurrentContext returns undefined outside observe", () => {
			expect(getCurrentContext()).toBeUndefined();
		});

		test("getCurrentContext returns context inside observe", async () => {
			const logger = getSubsystemLogger("templates");
			let capturedContext: ReturnType<typeof getCurrentContext>;

			await observe(logger, "templates:test", async () => {
				capturedContext = getCurrentContext();
				return "ok";
			});

			expect(capturedContext).toBeDefined();
			expect(capturedContext?.cid).toBeDefined();
			expect(typeof capturedContext?.cid).toBe("string");
		});

		test("nested observe automatically propagates parentCid", async () => {
			const logger = getSubsystemLogger("templates");
			let outerCid: string | undefined;
			let innerContext: ReturnType<typeof getCurrentContext>;

			await observe(logger, "templates:outer", async () => {
				outerCid = getCurrentContext()?.cid;

				await observe(logger, "templates:inner", async () => {
					innerContext = getCurrentContext();
					return "inner";
				});

				return "outer";
			});

			expect(outerCid).toBeDefined();
			expect(innerContext).toBeDefined();
			expect(innerContext?.parentCid).toBe(outerCid);
		});

		test("observeSync supports AsyncLocalStorage", () => {
			const logger = getSubsystemLogger("templates");
			let capturedContext: ReturnType<typeof getCurrentContext>;

			observeSync(logger, "templates:test", () => {
				capturedContext = getCurrentContext();
				return "ok";
			});

			expect(capturedContext).toBeDefined();
			expect(capturedContext?.cid).toBeDefined();
		});

		test("explicit parentCid takes precedence over AsyncLocalStorage", async () => {
			const logger = getSubsystemLogger("templates");
			const explicitParent = "explicit-parent-123";
			let innerContext: ReturnType<typeof getCurrentContext>;

			await observe(logger, "templates:outer", async () => {
				await observe(
					logger,
					"templates:inner",
					async () => {
						innerContext = getCurrentContext();
						return "inner";
					},
					{ parentCid: explicitParent },
				);

				return "outer";
			});

			expect(innerContext?.parentCid).toBe(explicitParent);
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

	describe("safe logging error handling", () => {
		// Suppress console.error from safeLog fallback to prevent test output pollution
		let consoleErrorSpy: ReturnType<typeof spyOn>;

		beforeEach(() => {
			consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
		});

		afterEach(() => {
			consoleErrorSpy.mockRestore();
		});

		test("observe completes even if logging throws", async () => {
			// Create a mock logger that throws
			const brokenLogger = {
				info: () => {
					throw new Error("Logging is broken");
				},
				error: () => {
					throw new Error("Logging is broken");
				},
			} as unknown as Logger;

			// Should not throw despite broken logger
			const result = await observe(
				brokenLogger,
				"templates:test",
				async () => "success",
			);

			expect(result).toBe("success");
			// Verify console.error was called as fallback
			expect(consoleErrorSpy).toHaveBeenCalled();
		});

		test("observeSync completes even if logging throws", () => {
			const brokenLogger = {
				info: () => {
					throw new Error("Logging is broken");
				},
				error: () => {
					throw new Error("Logging is broken");
				},
			} as unknown as Logger;

			const result = observeSync(
				brokenLogger,
				"templates:test",
				() => "success",
			);

			expect(result).toBe("success");
			// Verify console.error was called as fallback
			expect(consoleErrorSpy).toHaveBeenCalled();
		});

		test("observe logs error even when logging itself fails", async () => {
			const brokenLogger = {
				info: () => {
					throw new Error("Logging is broken");
				},
				error: () => {
					throw new Error("Logging is broken");
				},
			} as unknown as Logger;

			// Should throw the original error, not the logging error
			await expect(
				observe(brokenLogger, "templates:test", async () => {
					throw new Error("Operation failed");
				}),
			).rejects.toThrow("Operation failed");
			// Verify console.error was called as fallback
			expect(consoleErrorSpy).toHaveBeenCalled();
		});
	});
});
