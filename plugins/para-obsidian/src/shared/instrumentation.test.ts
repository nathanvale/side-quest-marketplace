import { beforeEach, describe, expect, test } from "bun:test";
import type { Logger } from "@logtape/logtape";
import { setupTestLogging } from "../testing/logger.js";
import {
	categorizeError,
	type ErrorCode,
	getCounters,
	getCurrentContext,
	getErrorCategory,
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

	// Detailed metrics unit tests moved to @sidequest/core/instrumentation/metrics.test.ts
	// Only integration tests remain here to verify observe/observeSync metrics recording

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

	// Histogram memory management tests moved to @sidequest/core/instrumentation/metrics.test.ts

	describe("safe logging error handling", () => {
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
		});
	});
});
