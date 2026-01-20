import { describe, expect, test } from "bun:test";
import { createTraceContext, runWithContext } from "./context.js";
import {
	type ContextAwareLogger,
	getCurrentContext,
	type ObserveLogger,
	observe,
	observeSync,
	observeSyncWithContext,
	observeWithContext,
} from "./observe.js";

// Test logger that captures calls
class TestLogger implements ObserveLogger {
	infoCalls: Array<{ message: string; props?: Record<string, unknown> }> = [];
	errorCalls: Array<{ message: string; props?: Record<string, unknown> }> = [];

	info(message: string, properties?: Record<string, unknown>): void {
		this.infoCalls.push({ message, props: properties });
	}

	error(message: string, properties?: Record<string, unknown>): void {
		this.errorCalls.push({ message, props: properties });
	}

	reset(): void {
		this.infoCalls = [];
		this.errorCalls = [];
	}
}

describe("observe", () => {
	test("logs success and returns result", async () => {
		const logger = new TestLogger();
		const result = await observe(logger, "testOp", async () => "success");

		expect(result).toBe("success");
		expect(logger.infoCalls).toHaveLength(1);
		expect(logger.infoCalls[0]?.message).toBe("testOp succeeded");
		expect(logger.infoCalls[0]?.props).toMatchObject({
			durationMs: expect.any(Number),
		});
		expect(logger.errorCalls).toHaveLength(0);
	});

	test("calls onSuccess callback with result and duration", async () => {
		const logger = new TestLogger();
		let callbackResult: string | undefined;
		let callbackDuration: number | undefined;

		await observe(logger, "testOp", async () => "success", {
			onSuccess: (result, durationMs) => {
				callbackResult = result;
				callbackDuration = durationMs;
			},
		});

		expect(callbackResult).toBe("success");
		expect(callbackDuration).toBeGreaterThanOrEqual(0);
	});

	test("logs error and re-throws", async () => {
		const logger = new TestLogger();
		const error = new Error("Test error");

		await expect(
			observe(logger, "testOp", async () => {
				throw error;
			}),
		).rejects.toThrow("Test error");

		expect(logger.errorCalls).toHaveLength(1);
		expect(logger.errorCalls[0]?.message).toBe("testOp failed");
		expect(logger.errorCalls[0]?.props).toMatchObject({
			error: "Test error",
			errorCode: expect.any(String),
			errorCategory: expect.any(String),
			durationMs: expect.any(Number),
		});
		expect(logger.infoCalls).toHaveLength(0);
	});

	test("categorizes errors correctly", async () => {
		const logger = new TestLogger();

		// Network error (transient)
		await expect(
			observe(logger, "networkOp", async () => {
				throw new Error("ECONNREFUSED");
			}),
		).rejects.toThrow();

		expect(logger.errorCalls[0]?.props).toMatchObject({
			errorCode: "NETWORK_ERROR",
			errorCategory: "transient",
		});

		logger.reset();

		// Validation error (permanent)
		await expect(
			observe(logger, "validateOp", async () => {
				throw new Error("Validation failed");
			}),
		).rejects.toThrow();

		expect(logger.errorCalls[0]?.props).toMatchObject({
			errorCode: "VALIDATION",
			errorCategory: "permanent",
		});
	});

	test("calls onError callback with error and duration", async () => {
		const logger = new TestLogger();
		let callbackError: unknown;
		let callbackDuration: number | undefined;

		await expect(
			observe(
				logger,
				"testOp",
				async () => {
					throw new Error("Test error");
				},
				{
					onError: (error, durationMs) => {
						callbackError = error;
						callbackDuration = durationMs;
					},
				},
			),
		).rejects.toThrow();

		expect(callbackError).toBeInstanceOf(Error);
		expect((callbackError as Error).message).toBe("Test error");
		expect(callbackDuration).toBeGreaterThanOrEqual(0);
	});

	test("handles non-Error objects", async () => {
		const logger = new TestLogger();

		await expect(
			observe(logger, "testOp", async () => {
				throw "string error";
			}),
		).rejects.toBe("string error");

		expect(logger.errorCalls[0]?.props?.error).toBe("string error");
	});

	test("measures duration correctly", async () => {
		const logger = new TestLogger();

		await observe(logger, "testOp", async () => {
			await new Promise((resolve) => setTimeout(resolve, 10));
			return "done";
		});

		const duration = logger.infoCalls[0]?.props?.durationMs as number;
		expect(duration).toBeGreaterThanOrEqual(10);
		expect(duration).toBeLessThan(100); // Should not be wildly off
	});
});

describe("observeSync", () => {
	test("logs success and returns result", () => {
		const logger = new TestLogger();
		const result = observeSync(logger, "testOp", () => "success");

		expect(result).toBe("success");
		expect(logger.infoCalls).toHaveLength(1);
		expect(logger.infoCalls[0]?.message).toBe("testOp succeeded");
		expect(logger.infoCalls[0]?.props).toMatchObject({
			durationMs: expect.any(Number),
		});
		expect(logger.errorCalls).toHaveLength(0);
	});

	test("calls onSuccess callback with result and duration", () => {
		const logger = new TestLogger();
		let callbackResult: string | undefined;
		let callbackDuration: number | undefined;

		observeSync(logger, "testOp", () => "success", {
			onSuccess: (result, durationMs) => {
				callbackResult = result;
				callbackDuration = durationMs;
			},
		});

		expect(callbackResult).toBe("success");
		expect(callbackDuration).toBeGreaterThanOrEqual(0);
	});

	test("logs error and re-throws", () => {
		const logger = new TestLogger();
		const error = new Error("Test error");

		expect(() =>
			observeSync(logger, "testOp", () => {
				throw error;
			}),
		).toThrow("Test error");

		expect(logger.errorCalls).toHaveLength(1);
		expect(logger.errorCalls[0]?.message).toBe("testOp failed");
		expect(logger.errorCalls[0]?.props).toMatchObject({
			error: "Test error",
			errorCode: expect.any(String),
			errorCategory: expect.any(String),
			durationMs: expect.any(Number),
		});
		expect(logger.infoCalls).toHaveLength(0);
	});

	test("categorizes errors correctly", () => {
		const logger = new TestLogger();

		// Permission error (configuration)
		expect(() =>
			observeSync(logger, "permOp", () => {
				throw new Error("Permission denied");
			}),
		).toThrow();

		expect(logger.errorCalls[0]?.props).toMatchObject({
			errorCode: "PERMISSION",
			errorCategory: "configuration",
		});

		logger.reset();

		// Not found error (permanent)
		expect(() =>
			observeSync(logger, "findOp", () => {
				throw new Error("File not found");
			}),
		).toThrow();

		expect(logger.errorCalls[0]?.props).toMatchObject({
			errorCode: "NOT_FOUND",
			errorCategory: "permanent",
		});
	});

	test("calls onError callback with error and duration", () => {
		const logger = new TestLogger();
		let callbackError: unknown;
		let callbackDuration: number | undefined;

		expect(() =>
			observeSync(
				logger,
				"testOp",
				() => {
					throw new Error("Test error");
				},
				{
					onError: (error, durationMs) => {
						callbackError = error;
						callbackDuration = durationMs;
					},
				},
			),
		).toThrow();

		expect(callbackError).toBeInstanceOf(Error);
		expect((callbackError as Error).message).toBe("Test error");
		expect(callbackDuration).toBeGreaterThanOrEqual(0);
	});

	test("handles non-Error objects", () => {
		const logger = new TestLogger();

		expect(() =>
			observeSync(logger, "testOp", () => {
				throw "string error";
			}),
		).toThrow("string error");

		expect(logger.errorCalls[0]?.props?.error).toBe("string error");
	});

	test("measures duration correctly", () => {
		const logger = new TestLogger();

		observeSync(logger, "testOp", () => {
			// Simulate some work
			let sum = 0;
			for (let i = 0; i < 1000000; i++) {
				sum += i;
			}
			return sum;
		});

		const duration = logger.infoCalls[0]?.props?.durationMs as number;
		expect(duration).toBeGreaterThanOrEqual(0);
	});
});

// =============================================================================
// Context-aware API tests
// =============================================================================

// Test logger for context-aware functions
class ContextTestLogger implements ContextAwareLogger {
	infoCalls: Array<{ message: string; props: Record<string, unknown> }> = [];
	errorCalls: Array<{ message: string; props: Record<string, unknown> }> = [];

	info(message: string, properties: Record<string, unknown>): void {
		this.infoCalls.push({ message, props: properties });
	}

	error(message: string, properties: Record<string, unknown>): void {
		this.errorCalls.push({ message, props: properties });
	}

	reset(): void {
		this.infoCalls = [];
		this.errorCalls = [];
	}
}

describe("observeWithContext", () => {
	test("logs success with correlation IDs", async () => {
		const logger = new ContextTestLogger();
		const result = await observeWithContext(
			logger,
			"test:operation",
			async () => "success",
		);

		expect(result).toBe("success");
		expect(logger.infoCalls).toHaveLength(1);
		expect(logger.infoCalls[0]?.message).toBe("test:operation succeeded");

		const props = logger.infoCalls[0]?.props;
		expect(props?.cid).toMatch(/^[a-f0-9]{8}$/);
		expect(props?.sessionCid).toBeDefined();
		expect(props?.operation).toBe("test:operation");
		expect(props?.durationMs).toBeGreaterThanOrEqual(0);
		expect(props?.latencyBucket).toBeDefined();
		expect(props?.success).toBe(true);
		expect(props?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	});

	test("includes custom context", async () => {
		const logger = new ContextTestLogger();
		await observeWithContext(logger, "test:op", async () => "result", {
			context: { filePath: "/test/file.md", customField: "custom" },
		});

		const props = logger.infoCalls[0]?.props;
		expect(props?.filePath).toBe("/test/file.md");
		expect(props?.customField).toBe("custom");
		expect(props?.operation).toBe("test:op");
	});

	test("inherits parent context", async () => {
		const logger = new ContextTestLogger();
		const parentCtx = createTraceContext({ cid: "parent01" });

		await runWithContext(parentCtx, async () => {
			await observeWithContext(logger, "child:op", async () => "result");
		});

		const props = logger.infoCalls[0]?.props;
		expect(props?.parentCid).toBe("parent01");
	});

	test("explicit parentCid overrides inherited", async () => {
		const logger = new ContextTestLogger();
		const parentCtx = createTraceContext({ cid: "parent01" });

		await runWithContext(parentCtx, async () => {
			await observeWithContext(logger, "child:op", async () => "result", {
				parentCid: "explicit1",
			});
		});

		const props = logger.infoCalls[0]?.props;
		expect(props?.parentCid).toBe("explicit1");
	});

	test("propagates context to nested operations", async () => {
		const logger = new ContextTestLogger();

		await observeWithContext(logger, "outer:op", async () => {
			const outerCid = getCurrentContext()?.cid;

			await observeWithContext(logger, "inner:op", async () => {
				const innerCtx = getCurrentContext();
				expect(innerCtx?.parentCid).toBe(outerCid);
				return "inner";
			});

			return "outer";
		});

		expect(logger.infoCalls).toHaveLength(2);
		// Inner completes first
		expect(logger.infoCalls[0]?.message).toBe("inner:op succeeded");
		expect(logger.infoCalls[1]?.message).toBe("outer:op succeeded");

		// Verify parent-child relationship
		const innerProps = logger.infoCalls[0]?.props;
		const outerProps = logger.infoCalls[1]?.props;
		expect(innerProps?.parentCid).toBe(outerProps?.cid);
	});

	test("logs error with correlation IDs", async () => {
		const logger = new ContextTestLogger();

		await expect(
			observeWithContext(logger, "test:fail", async () => {
				throw new Error("Test error");
			}),
		).rejects.toThrow("Test error");

		expect(logger.errorCalls).toHaveLength(1);
		expect(logger.errorCalls[0]?.message).toBe("test:fail failed");

		const props = logger.errorCalls[0]?.props;
		expect(props?.cid).toMatch(/^[a-f0-9]{8}$/);
		expect(props?.success).toBe(false);
		expect(props?.error).toBe("Test error");
		expect(props?.errorCode).toBeDefined();
		expect(props?.errorCategory).toBeDefined();
		expect(props?.stack).toBeDefined();
	});

	test("supports isSuccess for non-throwing failures", async () => {
		const logger = new ContextTestLogger();

		type Result = { ok: boolean; data?: string };
		const result = await observeWithContext<Result>(
			logger,
			"test:maybe",
			async () => ({ ok: false }),
			{ isSuccess: (r) => r.ok },
		);

		expect(result).toEqual({ ok: false });
		expect(logger.infoCalls[0]?.message).toBe("test:maybe failed");
		expect(logger.infoCalls[0]?.props?.success).toBe(false);
	});

	test("measures duration correctly", async () => {
		const logger = new ContextTestLogger();

		await observeWithContext(logger, "test:slow", async () => {
			await new Promise((resolve) => setTimeout(resolve, 10));
			return "done";
		});

		const duration = logger.infoCalls[0]?.props?.durationMs as number;
		expect(duration).toBeGreaterThanOrEqual(10);
		expect(duration).toBeLessThan(100);
	});
});

describe("observeSyncWithContext", () => {
	test("logs success with correlation IDs", () => {
		const logger = new ContextTestLogger();
		const result = observeSyncWithContext(
			logger,
			"sync:operation",
			() => "success",
		);

		expect(result).toBe("success");
		expect(logger.infoCalls).toHaveLength(1);
		expect(logger.infoCalls[0]?.message).toBe("sync:operation succeeded");

		const props = logger.infoCalls[0]?.props;
		expect(props?.cid).toMatch(/^[a-f0-9]{8}$/);
		expect(props?.success).toBe(true);
	});

	test("inherits parent context", () => {
		const logger = new ContextTestLogger();
		const parentCtx = createTraceContext({ cid: "syncpar1" });

		runWithContext(parentCtx, () => {
			observeSyncWithContext(logger, "sync:child", () => "result");
		});

		const props = logger.infoCalls[0]?.props;
		expect(props?.parentCid).toBe("syncpar1");
	});

	test("logs error with correlation IDs", () => {
		const logger = new ContextTestLogger();

		expect(() =>
			observeSyncWithContext(logger, "sync:fail", () => {
				throw new Error("Sync error");
			}),
		).toThrow("Sync error");

		expect(logger.errorCalls).toHaveLength(1);
		const props = logger.errorCalls[0]?.props;
		expect(props?.cid).toMatch(/^[a-f0-9]{8}$/);
		expect(props?.success).toBe(false);
		expect(props?.error).toBe("Sync error");
	});

	test("includes custom context", () => {
		const logger = new ContextTestLogger();
		observeSyncWithContext(logger, "sync:ctx", () => "result", {
			context: { customField: "value" },
		});

		expect(logger.infoCalls[0]?.props?.customField).toBe("value");
	});
});

describe("getCurrentContext from observe", () => {
	test("returns undefined outside observe context", () => {
		expect(getCurrentContext()).toBeUndefined();
	});

	test("returns context inside observeWithContext", async () => {
		let capturedCtx: ReturnType<typeof getCurrentContext>;

		await observeWithContext(
			new ContextTestLogger(),
			"test:capture",
			async () => {
				capturedCtx = getCurrentContext();
				return "done";
			},
		);

		expect(capturedCtx).toBeDefined();
		expect(capturedCtx?.cid).toMatch(/^[a-f0-9]{8}$/);
	});

	test("returns context inside observeSyncWithContext", () => {
		let capturedCtx: ReturnType<typeof getCurrentContext>;

		observeSyncWithContext(new ContextTestLogger(), "sync:capture", () => {
			capturedCtx = getCurrentContext();
			return "done";
		});

		expect(capturedCtx).toBeDefined();
		expect(capturedCtx?.cid).toMatch(/^[a-f0-9]{8}$/);
	});
});
