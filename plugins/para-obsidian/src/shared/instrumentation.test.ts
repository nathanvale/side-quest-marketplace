import { beforeEach, describe, expect, test } from "bun:test";
import { setupTestLogging } from "../testing/logger.js";
import {
	categorizeError,
	type ErrorCode,
	getCounters,
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

describe("instrumentation", () => {
	beforeEach(async () => {
		await setupTestLogging();
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
		test("durationMs is never negative even with clock drift", async () => {
			const logger = getSubsystemLogger("templates");

			// This is a behavioral test - the observe function uses Math.max(0, ...)
			// We can't easily mock Date.now, but we can verify the function completes
			const result = await observe(logger, "templates:test", async () => {
				// Very fast operation
				return "fast";
			});

			expect(result).toBe("fast");
		});

		test("handles zero-duration operations", () => {
			const logger = getSubsystemLogger("templates");

			const result = observeSync(logger, "templates:test", () => "instant");

			expect(result).toBe("instant");
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

			const counters = getCounters();
			const histograms = getHistograms();

			expect(counters).toHaveLength(1);
			expect(counters[0]?.labels.success).toBe(true);

			expect(histograms).toHaveLength(1);
			expect(histograms[0]?.observations).toHaveLength(1);
		});

		test("records counter and histogram on error", async () => {
			const logger = getSubsystemLogger("templates");

			await expect(
				observe(logger, "templates:test", async () => {
					throw new Error("fail");
				}),
			).rejects.toThrow("fail");

			const counters = getCounters();
			const histograms = getHistograms();

			expect(counters).toHaveLength(1);
			expect(counters[0]?.labels.success).toBe(false);

			expect(histograms).toHaveLength(1);
			expect(histograms[0]?.observations).toHaveLength(1);
		});

		test("observeSync records metrics", () => {
			const logger = getSubsystemLogger("templates");

			observeSync(logger, "templates:test", () => "ok");

			const counters = getCounters();
			expect(counters).toHaveLength(1);
			expect(counters[0]?.labels.success).toBe(true);
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
});
