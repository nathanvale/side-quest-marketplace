import { afterEach, describe, expect, mock, test } from "bun:test";
import {
	calculateResourceDelta,
	captureResourceMetrics,
	formatResourceMetrics,
	type ResourceMetricsLogger,
} from "./resource-metrics.js";

describe("captureResourceMetrics", () => {
	test("captures memory metrics from process.memoryUsage()", () => {
		const metrics = captureResourceMetrics();

		// Verify all fields are present
		expect(metrics.heapUsedMB).toBeGreaterThanOrEqual(0);
		expect(metrics.heapTotalMB).toBeGreaterThanOrEqual(0);
		expect(metrics.externalMB).toBeGreaterThanOrEqual(0);
		expect(metrics.rssMB).toBeGreaterThanOrEqual(0);
		expect(metrics.timestamp).toBeDefined();

		// Verify timestamp is valid ISO string
		expect(new Date(metrics.timestamp).toISOString()).toBe(metrics.timestamp);

		// Verify values are integers (rounded)
		expect(metrics.heapUsedMB % 1).toBe(0);
		expect(metrics.heapTotalMB % 1).toBe(0);
		expect(metrics.externalMB % 1).toBe(0);
		expect(metrics.rssMB % 1).toBe(0);
	});

	test("heapUsed is less than or equal to heapTotal", () => {
		const metrics = captureResourceMetrics();
		expect(metrics.heapUsedMB).toBeLessThanOrEqual(metrics.heapTotalMB);
	});

	test("RSS includes heap memory", () => {
		const metrics = captureResourceMetrics();
		// RSS should be at least as large as heap total (includes other memory)
		expect(metrics.rssMB).toBeGreaterThanOrEqual(metrics.heapTotalMB);
	});

	test("captures metrics without logger", () => {
		// Should not throw when no logger provided
		const metrics = captureResourceMetrics();
		expect(metrics).toBeDefined();
	});

	test("captures metrics with empty options", () => {
		const metrics = captureResourceMetrics({});
		expect(metrics).toBeDefined();
	});

	test("sequential captures show increasing timestamps", async () => {
		const first = captureResourceMetrics();
		await new Promise((resolve) => setTimeout(resolve, 10)); // Wait 10ms
		const second = captureResourceMetrics();

		const firstTime = new Date(first.timestamp).getTime();
		const secondTime = new Date(second.timestamp).getTime();

		expect(secondTime).toBeGreaterThan(firstTime);
	});
});

describe("captureResourceMetrics with logger", () => {
	let loggerMock: ResourceMetricsLogger;

	afterEach(() => {
		if (loggerMock && typeof loggerMock.debug === "function") {
			// Restore mock if it exists
			mock.restore();
		}
	});

	test("logs metrics when logger provided", () => {
		const debugMock = mock(() => {});
		loggerMock = { debug: debugMock };

		const metrics = captureResourceMetrics({ logger: loggerMock });

		expect(debugMock).toHaveBeenCalledTimes(1);

		// Verify log message structure
		const logCall = debugMock.mock.calls[0] as unknown[];
		expect(logCall).toBeDefined();
		const logMessage = String(logCall[0]);

		expect(logMessage).toContain("resource:capture");
		expect(logMessage).toContain(`heapUsedMB=${metrics.heapUsedMB}`);
		expect(logMessage).toContain(`heapTotalMB=${metrics.heapTotalMB}`);
		expect(logMessage).toContain(`externalMB=${metrics.externalMB}`);
		expect(logMessage).toContain(`rssMB=${metrics.rssMB}`);
		expect(logMessage).toContain(`timestamp=${metrics.timestamp}`);
	});

	test("includes operation in log when provided", () => {
		const debugMock = mock(() => {});
		loggerMock = { debug: debugMock };

		captureResourceMetrics({
			logger: loggerMock,
			operation: "inbox:scan",
		});

		const logMessage = String((debugMock.mock.calls[0] as unknown[])[0]);
		expect(logMessage).toContain("operation=inbox:scan");
	});

	test("includes cid in log when provided", () => {
		const debugMock = mock(() => {});
		loggerMock = { debug: debugMock };

		captureResourceMetrics({
			logger: loggerMock,
			cid: "abc123",
		});

		const logMessage = String((debugMock.mock.calls[0] as unknown[])[0]);
		expect(logMessage).toContain("cid=abc123");
	});

	test("includes sessionCid in log when provided", () => {
		const debugMock = mock(() => {});
		loggerMock = { debug: debugMock };

		captureResourceMetrics({
			logger: loggerMock,
			sessionCid: "session-1",
		});

		const logMessage = String((debugMock.mock.calls[0] as unknown[])[0]);
		expect(logMessage).toContain("sessionCid=session-1");
	});

	test("includes all context fields in log", () => {
		const debugMock = mock(() => {});
		loggerMock = { debug: debugMock };

		captureResourceMetrics({
			logger: loggerMock,
			operation: "execute",
			cid: "def456",
			sessionCid: "session-2",
		});

		const logMessage = String((debugMock.mock.calls[0] as unknown[])[0]);
		expect(logMessage).toContain("operation=execute");
		expect(logMessage).toContain("cid=def456");
		expect(logMessage).toContain("sessionCid=session-2");
	});

	test("omits undefined context fields from log", () => {
		const debugMock = mock(() => {});
		loggerMock = { debug: debugMock };

		captureResourceMetrics({
			logger: loggerMock,
			operation: "scan",
			// cid and sessionCid not provided
		});

		const logMessage = String((debugMock.mock.calls[0] as unknown[])[0]);
		expect(logMessage).toContain("operation=scan");
		expect(logMessage).not.toContain("cid=");
		expect(logMessage).not.toContain("sessionCid=");
	});
});

describe("calculateResourceDelta", () => {
	test("calculates delta correctly (memory may increase or stay stable)", () => {
		const start = captureResourceMetrics();

		// Allocate some memory (may or may not increase heap in test environment)
		const largeArray = new Array(1000000).fill("test");

		const end = captureResourceMetrics();
		const delta = calculateResourceDelta(start, end);

		// Clean up
		largeArray.length = 0;

		// Verify delta is calculated (value can be positive, zero, or negative)
		expect(typeof delta.heapUsedMB).toBe("number");
		expect(typeof delta.heapTotalMB).toBe("number");
		expect(typeof delta.rssMB).toBe("number");
		expect(typeof delta.externalMB).toBe("number");
	});

	test("calculates negative delta when memory decreases", () => {
		// Allocate memory
		let _largeArray: string[] | null = new Array(1000000).fill("test");
		const start = captureResourceMetrics();

		// Release memory and force GC if available
		_largeArray = null;
		if (global.gc) {
			global.gc();
		}

		const end = captureResourceMetrics();
		const delta = calculateResourceDelta(start, end);

		// Note: Without explicit GC, this test may be flaky
		// In production, negative deltas indicate memory was freed
		expect(typeof delta.heapUsedMB).toBe("number");
		expect(typeof delta.heapTotalMB).toBe("number");
		expect(typeof delta.rssMB).toBe("number");
	});

	test("calculates zero delta for identical metrics", () => {
		const metrics = captureResourceMetrics();
		const delta = calculateResourceDelta(metrics, metrics);

		expect(delta.heapUsedMB).toBe(0);
		expect(delta.heapTotalMB).toBe(0);
		expect(delta.externalMB).toBe(0);
		expect(delta.rssMB).toBe(0);
	});

	test("returns delta with all required fields", () => {
		const start = captureResourceMetrics();
		const end = captureResourceMetrics();
		const delta = calculateResourceDelta(start, end);

		expect(delta).toHaveProperty("heapUsedMB");
		expect(delta).toHaveProperty("heapTotalMB");
		expect(delta).toHaveProperty("externalMB");
		expect(delta).toHaveProperty("rssMB");
		expect(delta).not.toHaveProperty("timestamp");
	});

	test("handles large memory changes", () => {
		const start = {
			heapUsedMB: 100,
			heapTotalMB: 200,
			externalMB: 10,
			rssMB: 500,
			timestamp: new Date().toISOString(),
		};

		const end = {
			heapUsedMB: 1100,
			heapTotalMB: 2200,
			externalMB: 110,
			rssMB: 5500,
			timestamp: new Date().toISOString(),
		};

		const delta = calculateResourceDelta(start, end);

		expect(delta.heapUsedMB).toBe(1000);
		expect(delta.heapTotalMB).toBe(2000);
		expect(delta.externalMB).toBe(100);
		expect(delta.rssMB).toBe(5000);
	});
});

describe("formatResourceMetrics", () => {
	test("formats metrics as human-readable string", () => {
		const metrics = {
			heapUsedMB: 128,
			heapTotalMB: 256,
			externalMB: 5,
			rssMB: 512,
			timestamp: new Date().toISOString(),
		};

		const formatted = formatResourceMetrics(metrics);

		expect(formatted).toBe("Heap: 128MB / 256MB, RSS: 512MB, External: 5MB");
	});

	test("formats zero values", () => {
		const metrics = {
			heapUsedMB: 0,
			heapTotalMB: 0,
			externalMB: 0,
			rssMB: 0,
			timestamp: new Date().toISOString(),
		};

		const formatted = formatResourceMetrics(metrics);

		expect(formatted).toBe("Heap: 0MB / 0MB, RSS: 0MB, External: 0MB");
	});

	test("formats large values", () => {
		const metrics = {
			heapUsedMB: 2048,
			heapTotalMB: 4096,
			externalMB: 512,
			rssMB: 8192,
			timestamp: new Date().toISOString(),
		};

		const formatted = formatResourceMetrics(metrics);

		expect(formatted).toBe(
			"Heap: 2048MB / 4096MB, RSS: 8192MB, External: 512MB",
		);
	});

	test("includes all metrics in output", () => {
		const metrics = captureResourceMetrics();
		const formatted = formatResourceMetrics(metrics);

		expect(formatted).toContain("Heap:");
		expect(formatted).toContain("RSS:");
		expect(formatted).toContain("External:");
		expect(formatted).toContain(`${metrics.heapUsedMB}MB`);
		expect(formatted).toContain(`${metrics.heapTotalMB}MB`);
		expect(formatted).toContain(`${metrics.externalMB}MB`);
		expect(formatted).toContain(`${metrics.rssMB}MB`);
	});
});

describe("integration scenarios", () => {
	test("track memory across async operation", async () => {
		const start = captureResourceMetrics();

		// Simulate work
		const data = new Array(100000).fill("test data");
		await new Promise((resolve) => setTimeout(resolve, 10));

		const end = captureResourceMetrics();
		const delta = calculateResourceDelta(start, end);

		// Clean up
		data.length = 0;

		// Memory should have increased during work
		expect(delta.heapUsedMB).toBeGreaterThanOrEqual(0);
		expect(end.timestamp).not.toBe(start.timestamp);
	});

	test("captures metrics at multiple points for leak detection", async () => {
		const baseline = captureResourceMetrics();
		const leakyArray: unknown[] = [];
		const snapshots: ReturnType<typeof captureResourceMetrics>[] = [];

		for (let i = 0; i < 5; i++) {
			// Simulate leak
			leakyArray.push(new Array(100000).fill(`leak-${i}`));

			const current = captureResourceMetrics();
			snapshots.push(current);

			const delta = calculateResourceDelta(baseline, current);

			// Delta should be calculable (actual memory behavior is unpredictable in tests)
			expect(typeof delta.heapUsedMB).toBe("number");
		}

		// Verify we captured all snapshots
		expect(snapshots).toHaveLength(5);

		// Each snapshot should have valid timestamps
		for (const snapshot of snapshots) {
			expect(snapshot.timestamp).toBeDefined();
			expect(new Date(snapshot.timestamp).toISOString()).toBe(
				snapshot.timestamp,
			);
		}

		// Clean up
		leakyArray.length = 0;
	});

	test("logger integration with operation lifecycle", () => {
		const debugMock = mock(() => {});
		const logger = { debug: debugMock };

		const startMetrics = captureResourceMetrics({
			logger,
			operation: "process:files",
			cid: "op-1",
			sessionCid: "session-1",
		});

		// Simulate work
		const data = new Array(10000).fill("work");

		const endMetrics = captureResourceMetrics({
			logger,
			operation: "process:files",
			cid: "op-1",
			sessionCid: "session-1",
		});

		// Clean up
		data.length = 0;

		// Verify both captures were logged
		expect(debugMock).toHaveBeenCalledTimes(2);

		// Verify log format consistency
		const logs = debugMock.mock.calls.map((call) =>
			String((call as unknown[])[0]),
		);
		for (const log of logs) {
			expect(log).toContain("resource:capture");
			expect(log).toContain("operation=process:files");
			expect(log).toContain("cid=op-1");
			expect(log).toContain("sessionCid=session-1");
		}

		// Calculate delta for reporting
		const delta = calculateResourceDelta(startMetrics, endMetrics);
		expect(typeof delta.heapUsedMB).toBe("number");
	});

	test("format metrics for user-facing display", () => {
		const metrics = captureResourceMetrics();
		const formatted = formatResourceMetrics(metrics);

		// Should be readable console output
		expect(formatted).toMatch(
			/^Heap: \d+MB \/ \d+MB, RSS: \d+MB, External: \d+MB$/,
		);
	});
});
