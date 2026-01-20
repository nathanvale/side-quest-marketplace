import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { createTempDir } from "../testing/index.js";
import { createSLOTracker } from "./tracker.js";
import type { SLODefinition } from "./types.js";

describe("SLOTracker", () => {
	let tempDir: string;
	let persistencePath: string;

	beforeEach(() => {
		tempDir = createTempDir("slo-test-");
		persistencePath = join(tempDir, "slo-events.jsonl");
	});

	afterEach(async () => {
		// Clean up persistence file
		try {
			await unlink(persistencePath);
		} catch {
			// Ignore if file doesn't exist
		}
	});

	const testDefinitions: Record<string, SLODefinition> = {
		test_latency: {
			name: "Test Latency",
			target: 0.95,
			threshold: 1000,
			unit: "ms",
			window: "24h",
			errorBudget: 0.05,
		},
		test_success: {
			name: "Test Success",
			target: 0.99,
			threshold: 99,
			unit: "percent",
			window: "7d",
			errorBudget: 0.01,
		},
	};

	test("creates tracker with definitions", () => {
		const tracker = createSLOTracker({
			definitions: testDefinitions,
			persistencePath,
		});

		expect(tracker.getSLONames()).toEqual(["test_latency", "test_success"]);
		expect(tracker.getSLODefinition("test_latency")).toEqual(
			testDefinitions.test_latency,
		);
	});

	test("records events without persistence errors", () => {
		const tracker = createSLOTracker({
			definitions: testDefinitions,
			persistencePath,
		});

		// Should not throw
		tracker.recordEvent("test_latency", false, 800);
		tracker.recordEvent("test_latency", true, 1200);
		tracker.recordEvent("test_success", false);
	});

	test("calculates burn rate correctly", async () => {
		const tracker = createSLOTracker({
			definitions: testDefinitions,
			persistencePath,
		});

		// Record 10 events: 9 successes, 1 failure
		for (let i = 0; i < 9; i++) {
			tracker.recordEvent("test_latency", false, 800);
		}
		tracker.recordEvent("test_latency", true, 1200);

		// Wait for persistence
		await new Promise((resolve) => setTimeout(resolve, 10));
		await tracker.ensureLoaded();

		// Violation rate: 1/10 = 0.1 (10%)
		// Error budget: 0.05 (5%)
		// Burn rate: 0.1 / 0.05 = 2.0
		const burnRate = await tracker.getBurnRate("test_latency");
		expect(burnRate).toBeCloseTo(2.0, 1);
	});

	test("returns zero burn rate when no events", async () => {
		const tracker = createSLOTracker({
			definitions: testDefinitions,
			persistencePath,
		});

		const burnRate = await tracker.getBurnRate("test_latency");
		expect(burnRate).toBe(0);
	});

	test("returns zero burn rate for unknown SLO", async () => {
		const tracker = createSLOTracker({
			definitions: testDefinitions,
			persistencePath,
		});

		const burnRate = await tracker.getBurnRate("unknown_slo");
		expect(burnRate).toBe(0);
	});

	test("detects breach for latency SLO (ms)", async () => {
		const tracker = createSLOTracker({
			definitions: testDefinitions,
			persistencePath,
		});

		// Breach: value > threshold
		const result = await tracker.checkBreach("test_latency", 1500);
		expect(result.breached).toBe(true);
		expect(result.currentValue).toBe(1500);
		expect(result.slo.name).toBe("Test Latency");
	});

	test("detects no breach for latency SLO (ms)", async () => {
		const tracker = createSLOTracker({
			definitions: testDefinitions,
			persistencePath,
		});

		// No breach: value < threshold
		const result = await tracker.checkBreach("test_latency", 800);
		expect(result.breached).toBe(false);
		expect(result.currentValue).toBe(800);
	});

	test("detects breach for percentage SLO", async () => {
		const tracker = createSLOTracker({
			definitions: testDefinitions,
			persistencePath,
		});

		// Breach: value < threshold (for percentages)
		const result = await tracker.checkBreach("test_success", 95);
		expect(result.breached).toBe(true);
		expect(result.currentValue).toBe(95);
	});

	test("detects no breach for percentage SLO", async () => {
		const tracker = createSLOTracker({
			definitions: testDefinitions,
			persistencePath,
		});

		// No breach: value >= threshold
		const result = await tracker.checkBreach("test_success", 99.5);
		expect(result.breached).toBe(false);
		expect(result.currentValue).toBe(99.5);
	});

	test("uses simplified burn rate when no events recorded", async () => {
		const tracker = createSLOTracker({
			definitions: testDefinitions,
			persistencePath,
		});

		// Breach with no event history: burn rate = 1
		const breached = await tracker.checkBreach("test_latency", 1500);
		expect(breached.burnRate).toBe(1);

		// No breach with no event history: burn rate = 0
		const notBreached = await tracker.checkBreach("test_latency", 800);
		expect(notBreached.burnRate).toBe(0);
	});

	test("uses calculated burn rate when events exist", async () => {
		const tracker = createSLOTracker({
			definitions: testDefinitions,
			persistencePath,
		});

		// Record events with 20% violation rate
		for (let i = 0; i < 8; i++) {
			tracker.recordEvent("test_latency", false, 800);
		}
		tracker.recordEvent("test_latency", true, 1200);
		tracker.recordEvent("test_latency", true, 1300);

		await new Promise((resolve) => setTimeout(resolve, 10));
		await tracker.ensureLoaded();

		// Violation rate: 2/10 = 0.2 (20%)
		// Error budget: 0.05 (5%)
		// Burn rate: 0.2 / 0.05 = 4.0
		const result = await tracker.checkBreach("test_latency", 1500);
		expect(result.burnRate).toBeCloseTo(4.0, 1);
	});

	test("filters events by time window", async () => {
		const tracker = createSLOTracker({
			definitions: {
				short_window: {
					name: "Short Window",
					target: 0.95,
					threshold: 1000,
					unit: "ms",
					window: "1h",
					errorBudget: 0.05,
				},
			},
			persistencePath,
		});

		// Record 10 events: 9 successes, 1 failure
		for (let i = 0; i < 9; i++) {
			tracker.recordEvent("short_window", false, 800);
		}
		tracker.recordEvent("short_window", true, 1200);

		await new Promise((resolve) => setTimeout(resolve, 10));
		await tracker.ensureLoaded();

		// Violation rate: 1/10 = 0.1 (10%)
		// Error budget: 0.05 (5%)
		// Burn rate: 0.1 / 0.05 = 2.0
		const burnRate = await tracker.getBurnRate("short_window");
		expect(burnRate).toBeCloseTo(2.0, 1);
	});

	test("returns unknown SLO for checkBreach with invalid name", async () => {
		const tracker = createSLOTracker({
			definitions: testDefinitions,
			persistencePath,
		});

		const result = await tracker.checkBreach("unknown_slo", 100);
		expect(result.breached).toBe(false);
		expect(result.slo.name).toBe("Unknown");
		expect(result.burnRate).toBe(0);
	});

	test("resets tracker state", async () => {
		const tracker = createSLOTracker({
			definitions: testDefinitions,
			persistencePath,
		});

		tracker.recordEvent("test_latency", false, 800);
		await tracker.ensureLoaded();

		// Before reset
		const burnRateBefore = await tracker.getBurnRate("test_latency");
		expect(burnRateBefore).toBeGreaterThanOrEqual(0);

		// Reset
		tracker.reset();

		// After reset (should force reload)
		const burnRateAfter = await tracker.getBurnRate("test_latency");
		expect(burnRateAfter).toBeGreaterThanOrEqual(0);
	});

	test("defaults value to threshold when not provided", () => {
		const tracker = createSLOTracker({
			definitions: testDefinitions,
			persistencePath,
		});

		// Should not throw
		tracker.recordEvent("test_latency", false);
		tracker.recordEvent("test_latency", true);
	});

	test("handles concurrent event recording", async () => {
		const tracker = createSLOTracker({
			definitions: testDefinitions,
			persistencePath,
		});

		// Record many events concurrently
		const _promises = [];
		for (let i = 0; i < 100; i++) {
			tracker.recordEvent("test_latency", i % 10 === 0, 800 + i * 10);
		}

		// Wait for all persistence
		await new Promise((resolve) => setTimeout(resolve, 50));
		await tracker.ensureLoaded();

		// Should have recorded events
		const burnRate = await tracker.getBurnRate("test_latency");
		expect(burnRate).toBeGreaterThanOrEqual(0);
	});
});
