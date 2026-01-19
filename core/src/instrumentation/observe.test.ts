import { describe, expect, test } from "bun:test";
import { type ObserveLogger, observe, observeSync } from "./observe.js";

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
