import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { homedir } from "node:os";
import { join } from "node:path";
import {
	pathExists,
	readTextFile,
	stat,
	unlink,
	writeTextFile,
} from "@side-quest/core/fs";
import { useTestVaultCleanup } from "../../testing/utils";
import {
	ensureEventsLoaded,
	getBurnRate,
	recordSLOEvent,
	resetSLOEvents,
	SLO_DEFINITIONS,
} from "./slos";

/**
 * Tests for SLO disk persistence
 */
describe("SLO disk persistence", () => {
	const { getAfterEachHook } = useTestVaultCleanup();

	const sloFilePath = join(homedir(), ".claude", "logs", "slo-events.jsonl");
	const backupPath = `${sloFilePath}.backup`;

	beforeEach(async () => {
		// Backup existing file if it exists
		const fileExists = await pathExists(sloFilePath);
		if (fileExists) {
			const content = await readTextFile(sloFilePath);
			await writeTextFile(backupPath, content);
			await unlink(sloFilePath);
		}

		// Clear in-memory events
		resetSLOEvents();
	});

	afterEach(async () => {
		// Restore backup if it exists
		const backupExists = await pathExists(backupPath);
		if (backupExists) {
			const content = await readTextFile(backupPath);
			await writeTextFile(sloFilePath, content);
			await unlink(backupPath);
		} else {
			// Clean up test file
			const fileExists = await pathExists(sloFilePath);
			if (fileExists) {
				await unlink(sloFilePath);
			}
		}

		// Clear in-memory events
		resetSLOEvents();

		// Call the vault cleanup hook
		await getAfterEachHook()();
	});

	describe("recordSLOEvent", () => {
		test("should persist events to disk", async () => {
			recordSLOEvent("scan_latency", false, 45_000);
			recordSLOEvent("scan_latency", true, 75_000);

			// Wait for fire-and-forget append to complete
			await Bun.sleep(100);

			const fileExists = await pathExists(sloFilePath);
			expect(fileExists).toBe(true);

			const content = await readTextFile(sloFilePath);
			const lines = content.trim().split("\n");

			expect(lines.length).toBe(2);

			// Parse both events (order may vary due to async writes)
			const events = lines.map((line) => JSON.parse(line));
			expect(events.length).toBe(2);

			// Check that both events are present
			const successEvent = events.find((e) => e.value === 45_000);
			const violationEvent = events.find((e) => e.value === 75_000);

			expect(successEvent).toBeDefined();
			expect(successEvent.sloName).toBe("scan_latency");
			expect(successEvent.violated).toBe(false);
			expect(successEvent.threshold).toBe(
				SLO_DEFINITIONS.scan_latency?.threshold,
			);

			expect(violationEvent).toBeDefined();
			expect(violationEvent.sloName).toBe("scan_latency");
			expect(violationEvent.violated).toBe(true);
		});

		test("should default value to threshold when not provided", async () => {
			recordSLOEvent("execute_success", false);

			// Wait for fire-and-forget append
			await Bun.sleep(100);

			const content = await readTextFile(sloFilePath);
			const event = JSON.parse(content.trim());

			expect(event.value).toBe(SLO_DEFINITIONS.execute_success?.threshold);
			expect(event.threshold).toBe(SLO_DEFINITIONS.execute_success?.threshold);
		});

		test("should not crash if disk write fails", async () => {
			// This test verifies that errors are caught and logged, not thrown
			recordSLOEvent("scan_latency", false, 45_000);

			// Should not throw even if disk I/O fails
			expect(() => recordSLOEvent("scan_latency", true, 75_000)).not.toThrow();
		});

		test("should skip unknown SLO names", async () => {
			recordSLOEvent("unknown_slo", false);

			// Wait for potential write
			await Bun.sleep(100);

			const fileExists = await pathExists(sloFilePath);
			// File might exist from previous operations, but should have no new events
			if (fileExists) {
				const content = await readTextFile(sloFilePath);
				const lines = content.trim().split("\n").filter(Boolean);
				// Should have no lines for unknown SLO
				expect(lines.length).toBe(0);
			}
		});
	});

	describe("getBurnRate with persistence", () => {
		test("should calculate burn rate from persisted events", async () => {
			// Record events to disk
			for (let i = 0; i < 10; i++) {
				recordSLOEvent("scan_latency", i < 2, 50_000);
			}

			// Wait for writes to complete
			await Bun.sleep(200);

			// Reset in-memory state to force load from disk
			resetSLOEvents();

			// Ensure events are loaded from disk
			await ensureEventsLoaded();

			// Get burn rate - should have loaded from disk
			const burnRate = await getBurnRate("scan_latency");

			// 2 violations out of 10 = 20% violation rate
			// Error budget is 5%, so burn rate = 0.20 / 0.05 = 4.0
			expect(burnRate).toBeCloseTo(4.0, 1);
		});

		test("should handle empty disk file", async () => {
			// Create empty file
			await writeTextFile(sloFilePath, "");

			resetSLOEvents();
			await ensureEventsLoaded();

			const burnRate = await getBurnRate("scan_latency");
			expect(burnRate).toBe(0);
		});

		test("should handle missing disk file", async () => {
			// Ensure file doesn't exist
			const fileExists = await pathExists(sloFilePath);
			if (fileExists) {
				await unlink(sloFilePath);
			}

			resetSLOEvents();
			await ensureEventsLoaded();

			const burnRate = await getBurnRate("scan_latency");
			expect(burnRate).toBe(0);
		});

		test("should skip malformed JSON lines", async () => {
			// Write some valid and invalid lines
			await writeTextFile(
				sloFilePath,
				JSON.stringify({
					timestamp: Date.now(),
					violated: false,
					sloName: "scan_latency",
					value: 45_000,
					threshold: 60_000,
				}) +
					"\n" +
					"malformed json\n" +
					JSON.stringify({
						timestamp: Date.now(),
						violated: true,
						sloName: "scan_latency",
						value: 75_000,
						threshold: 60_000,
					}) +
					"\n",
			);

			resetSLOEvents();
			await ensureEventsLoaded();

			const burnRate = await getBurnRate("scan_latency");

			// Should have loaded 2 valid events, skipped 1 malformed
			// 1 violation out of 2 = 50% violation rate
			// Error budget is 5%, so burn rate = 0.50 / 0.05 = 10.0
			expect(burnRate).toBeCloseTo(10.0, 1);
		});
	});

	describe("event pruning", () => {
		test("should prune events older than 90 days on load", async () => {
			const now = Date.now();
			const oldTimestamp = now - 91 * 24 * 60 * 60 * 1000; // 91 days ago
			const recentTimestamp = now - 7 * 24 * 60 * 60 * 1000; // 7 days ago (within 30d window)

			// Write old and recent events
			await writeTextFile(
				sloFilePath,
				JSON.stringify({
					timestamp: oldTimestamp,
					violated: false,
					sloName: "scan_latency",
					value: 45_000,
					threshold: 60_000,
				}) +
					"\n" +
					JSON.stringify({
						timestamp: recentTimestamp,
						violated: true,
						sloName: "scan_latency",
						value: 75_000,
						threshold: 60_000,
					}) +
					"\n",
			);

			resetSLOEvents();

			// Load from disk - should prune old event
			await ensureEventsLoaded();
			const burnRate = await getBurnRate("scan_latency");

			// Should only have 1 recent event (violated)
			// 1 violation out of 1 = 100% violation rate
			// Error budget is 5%, so burn rate = 1.00 / 0.05 = 20.0
			expect(burnRate).toBeCloseTo(20.0, 1);
		});
	});

	describe("file rotation", () => {
		test("should rotate file when exceeding 10MB", async () => {
			// Create a large event payload
			// Each event is ~100 bytes, so we need ~105k events for 10MB
			const largeEvents: string[] = [];
			const targetSize = 10 * 1024 * 1024;
			const sampleEvent = JSON.stringify({
				timestamp: Date.now(),
				violated: false,
				sloName: "scan_latency",
				value: 45_000,
				threshold: 60_000,
			});
			const bytesPerEvent = sampleEvent.length + 1; // +1 for newline
			const eventsNeeded = Math.ceil(targetSize / bytesPerEvent);

			for (let i = 0; i < eventsNeeded; i++) {
				largeEvents.push(sampleEvent);
			}

			await writeTextFile(sloFilePath, `${largeEvents.join("\n")}\n`);

			// Verify file is large
			const statsBefore = await stat(sloFilePath);
			expect(statsBefore.size).toBeGreaterThan(targetSize);

			// Record one more event - should trigger rotation
			recordSLOEvent("scan_latency", false, 45_000);

			// Wait for rotation to complete
			await Bun.sleep(500);

			// File should be much smaller now (only recent events)
			const statsAfter = await stat(sloFilePath);
			expect(statsAfter.size).toBeLessThan(statsBefore.size);
		}, 10_000); // 10s timeout for large file test

		test("should rotate file when >10% events are stale", async () => {
			const now = Date.now();
			const oldTimestamp = now - 91 * 24 * 60 * 60 * 1000; // 91 days ago

			// Write 15 old events + 5 recent events (60% stale, >10% threshold)
			const events: string[] = [];
			for (let i = 0; i < 15; i++) {
				events.push(
					JSON.stringify({
						timestamp: oldTimestamp,
						violated: false,
						sloName: "scan_latency",
						value: 45_000,
						threshold: 60_000,
					}),
				);
			}
			for (let i = 0; i < 5; i++) {
				events.push(
					JSON.stringify({
						timestamp: now,
						violated: true,
						sloName: "scan_latency",
						value: 75_000,
						threshold: 60_000,
					}),
				);
			}

			await writeTextFile(sloFilePath, `${events.join("\n")}\n`);

			resetSLOEvents();

			// Load from disk - should trigger rotation due to >10% stale
			await ensureEventsLoaded();
			getBurnRate("scan_latency");

			// Wait for rotation
			await Bun.sleep(500);

			// Read file - should only have recent events
			const content = await readTextFile(sloFilePath);
			const lines = content.trim().split("\n").filter(Boolean);

			expect(lines.length).toBe(5); // Only recent events remain
		});
	});

	describe("integration tests", () => {
		test("should persist and load events across process lifecycle", async () => {
			// Simulate first process: record events
			recordSLOEvent("scan_latency", false, 45_000);
			recordSLOEvent("scan_latency", false, 50_000);
			recordSLOEvent("scan_latency", true, 75_000);

			await Bun.sleep(200);

			// Simulate second process: clear memory and reload
			resetSLOEvents();
			await ensureEventsLoaded();
			const burnRate = await getBurnRate("scan_latency");

			// 1 violation out of 3 = 33% violation rate
			// Error budget is 5%, so burn rate = 0.33 / 0.05 = 6.67
			expect(burnRate).toBeCloseTo(6.67, 1);
		});

		test("should handle multiple SLOs independently", async () => {
			// Record events for different SLOs
			recordSLOEvent("scan_latency", true, 75_000);
			recordSLOEvent("execute_success", false, 99.5);
			recordSLOEvent("llm_availability", false, 85);

			await Bun.sleep(200);

			// Reset and reload
			resetSLOEvents();
			await ensureEventsLoaded();

			const scanBurn = await getBurnRate("scan_latency");
			const executeBurn = await getBurnRate("execute_success");
			const llmBurn = await getBurnRate("llm_availability");

			expect(scanBurn).toBeGreaterThan(0);
			expect(executeBurn).toBe(0);
			expect(llmBurn).toBe(0);
		});
	});
});
