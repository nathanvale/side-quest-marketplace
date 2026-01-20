import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { pathExists, readTextFile } from "../fs/index.js";
import { createTempDir } from "../testing/index.js";
import { SLOPersistence } from "./persistence.js";
import type { SLOEvent } from "./types.js";

describe("SLOPersistence", () => {
	let tempDir: string;
	let persistencePath: string;

	beforeEach(() => {
		tempDir = createTempDir("slo-persist-test-");
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

	const createTestEvent = (
		sloName: string,
		violated: boolean,
		timestamp = Date.now(),
	): SLOEvent => ({
		timestamp,
		violated,
		sloName,
		value: violated ? 1500 : 800,
		threshold: 1000,
	});

	test("creates persistence instance", () => {
		const persistence = new SLOPersistence({
			filePath: persistencePath,
			maxSizeBytes: 1024 * 1024,
			maxAgeDays: 30,
		});

		expect(persistence).toBeDefined();
	});

	test("loads empty events when file does not exist", async () => {
		const persistence = new SLOPersistence({
			filePath: persistencePath,
			maxSizeBytes: 1024 * 1024,
			maxAgeDays: 30,
		});

		const events = await persistence.loadEvents();
		expect(events.size).toBe(0);
	});

	test("appends event to disk", async () => {
		const persistence = new SLOPersistence({
			filePath: persistencePath,
			maxSizeBytes: 1024 * 1024,
			maxAgeDays: 30,
		});

		const event = createTestEvent("test_slo", false);
		await persistence.appendEvent(event);

		// Wait for async write
		await new Promise((resolve) => setTimeout(resolve, 10));

		// Verify file exists
		const exists = await pathExists(persistencePath);
		expect(exists).toBe(true);

		// Verify content
		const content = await readTextFile(persistencePath);
		expect(content).toContain('"test_slo"');
		expect(content).toContain('"violated":false');
	});

	test("loads events from disk", async () => {
		const persistence = new SLOPersistence({
			filePath: persistencePath,
			maxSizeBytes: 1024 * 1024,
			maxAgeDays: 30,
		});

		// Write events
		const event1 = createTestEvent("slo_a", false);
		const event2 = createTestEvent("slo_b", true);
		await persistence.appendEvent(event1);
		await persistence.appendEvent(event2);

		// Wait for writes
		await new Promise((resolve) => setTimeout(resolve, 10));

		// Load events
		const events = await persistence.loadEvents();
		expect(events.size).toBe(2);
		expect(events.get("slo_a")).toHaveLength(1);
		expect(events.get("slo_b")).toHaveLength(1);
		expect(events.get("slo_a")?.[0]?.violated).toBe(false);
		expect(events.get("slo_b")?.[0]?.violated).toBe(true);
	});

	test("filters stale events during load", async () => {
		const persistence = new SLOPersistence({
			filePath: persistencePath,
			maxSizeBytes: 1024 * 1024,
			maxAgeDays: 30,
		});

		// Write recent and stale events
		const recentEvent = createTestEvent("recent_slo", false, Date.now());
		const staleEvent = createTestEvent(
			"stale_slo",
			false,
			Date.now() - 40 * 24 * 60 * 60 * 1000, // 40 days old
		);

		await persistence.appendEvent(recentEvent);
		await persistence.appendEvent(staleEvent);
		await new Promise((resolve) => setTimeout(resolve, 10));

		// Load events
		const events = await persistence.loadEvents();

		// Should only have recent event
		expect(events.size).toBe(1);
		expect(events.get("recent_slo")).toHaveLength(1);
		expect(events.get("stale_slo")).toBeUndefined();
	});

	test("handles rotation when file size exceeds limit", async () => {
		const smallSize = 500; // Small limit to trigger rotation
		const persistence = new SLOPersistence({
			filePath: persistencePath,
			maxSizeBytes: smallSize,
			maxAgeDays: 30,
		});

		// Write many events to exceed size
		for (let i = 0; i < 20; i++) {
			await persistence.appendEvent(createTestEvent(`slo_${i}`, false));
		}

		// Wait for writes
		await new Promise((resolve) => setTimeout(resolve, 50));

		// File should exist and be within size limit after rotation
		const exists = await pathExists(persistencePath);
		expect(exists).toBe(true);

		// Load events - should still have events after rotation
		const events = await persistence.loadEvents();
		expect(events.size).toBeGreaterThan(0);
	});

	test("handles circuit breaker after write failures", async () => {
		// Use a valid parent dir but non-writable filename
		const invalidPath = join(tempDir, "\0invalid-filename.jsonl");

		const logs: Array<{ level: string; message: string }> = [];
		const logger = {
			info: (message: string) => logs.push({ level: "info", message }),
			error: (message: string) => logs.push({ level: "error", message }),
		};

		const persistence = new SLOPersistence({
			filePath: invalidPath,
			maxSizeBytes: 1024 * 1024,
			maxAgeDays: 30,
			logger,
		});

		// Try to write events (should fail due to invalid filename)
		for (let i = 0; i < 5; i++) {
			await persistence.appendEvent(createTestEvent("test_slo", false));
		}

		// Wait for async writes to fail
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Should have logged errors
		const errorLogs = logs.filter((log) => log.level === "error");
		expect(errorLogs.length).toBeGreaterThan(0);
		expect(
			errorLogs.some((log) =>
				log.message.includes("Failed to persist SLO event"),
			),
		).toBe(true);
	});

	test("resets persistence state", async () => {
		const persistence = new SLOPersistence({
			filePath: persistencePath,
			maxSizeBytes: 1024 * 1024,
			maxAgeDays: 30,
		});

		// Write event
		await persistence.appendEvent(createTestEvent("test_slo", false));
		await new Promise((resolve) => setTimeout(resolve, 10));

		// Load events
		const eventsBefore = await persistence.loadEvents();
		expect(eventsBefore.size).toBe(1);

		// Reset
		persistence.reset();

		// After reset, should reload from disk
		const eventsAfter = await persistence.loadEvents();
		expect(eventsAfter.size).toBe(1);
	});

	test("handles multiple loads without duplicate loading", async () => {
		const persistence = new SLOPersistence({
			filePath: persistencePath,
			maxSizeBytes: 1024 * 1024,
			maxAgeDays: 30,
		});

		// Write events
		await persistence.appendEvent(createTestEvent("test_slo", false));
		await new Promise((resolve) => setTimeout(resolve, 10));

		// Load multiple times concurrently
		const [events1, events2, events3] = await Promise.all([
			persistence.loadEvents(),
			persistence.loadEvents(),
			persistence.loadEvents(),
		]);

		// All should return same data
		expect(events1.size).toBe(1);
		expect(events2.size).toBe(1);
		expect(events3.size).toBe(1);
	});

	test("handles malformed JSON lines gracefully", async () => {
		const persistence = new SLOPersistence({
			filePath: persistencePath,
			maxSizeBytes: 1024 * 1024,
			maxAgeDays: 30,
		});

		// Write valid event
		await persistence.appendEvent(createTestEvent("test_slo", false));
		await new Promise((resolve) => setTimeout(resolve, 10));

		// Manually append malformed line
		const content = await readTextFile(persistencePath);
		const malformedContent = `${content}{invalid json\n`;
		await Bun.write(persistencePath, malformedContent);

		// Should load valid events, skip malformed
		const events = await persistence.loadEvents();
		expect(events.size).toBe(1);
	});

	test("uses logger when provided", async () => {
		const logs: Array<{ level: string; message: string }> = [];
		const logger = {
			info: (message: string) => logs.push({ level: "info", message }),
			error: (message: string) => logs.push({ level: "error", message }),
		};

		const persistence = new SLOPersistence({
			filePath: persistencePath,
			maxSizeBytes: 1024 * 1024,
			maxAgeDays: 30,
			logger,
		});

		// Load from non-existent file
		await persistence.loadEvents();

		// Should log
		expect(logs.length).toBeGreaterThan(0);
		expect(logs.some((log) => log.level === "info")).toBe(true);
	});

	test("handles rotation with stale events trigger", async () => {
		const persistence = new SLOPersistence({
			filePath: persistencePath,
			maxSizeBytes: 1024 * 1024,
			maxAgeDays: 30,
		});

		// Write mix of recent and stale events
		for (let i = 0; i < 5; i++) {
			await persistence.appendEvent(createTestEvent("recent_slo", false));
		}
		for (let i = 0; i < 10; i++) {
			await persistence.appendEvent(
				createTestEvent(
					"stale_slo",
					false,
					Date.now() - 40 * 24 * 60 * 60 * 1000,
				),
			);
		}

		await new Promise((resolve) => setTimeout(resolve, 50));

		// Load should trigger rotation (>10% stale)
		const events = await persistence.loadEvents();

		// Should only have recent events after rotation
		expect(events.get("recent_slo")).toHaveLength(5);
		expect(events.get("stale_slo")).toBeUndefined();
	});
});
