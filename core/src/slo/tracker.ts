/**
 * SLO tracking with burn rate calculation and breach detection.
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { SLOPersistence } from "./persistence.js";
import type {
	SLOBreachResult,
	SLODefinition,
	SLOEvent,
	SLOTrackerConfig,
	SLOWindow,
} from "./types.js";

/**
 * SLO tracker for monitoring service level objectives.
 *
 * Features:
 * - Record SLO events (violations and successes)
 * - Calculate burn rate (error budget consumption)
 * - Check for SLO breaches
 * - Persistent JSONL storage with rotation
 * - Circuit breaker for write failures
 *
 * @example
 * ```typescript
 * const tracker = createSLOTracker({
 *   definitions: {
 *     scan_latency: {
 *       name: "Scan Latency",
 *       target: 0.95,
 *       threshold: 60_000,
 *       unit: "ms",
 *       window: "30d",
 *       errorBudget: 0.05
 *     }
 *   }
 * });
 *
 * // Record event
 * tracker.recordEvent("scan_latency", false, 45_000);
 *
 * // Check breach
 * const result = await tracker.checkBreach("scan_latency", 65_000);
 * if (result.breached) {
 *   console.log(`SLO breached! Burn rate: ${result.burnRate}`);
 * }
 * ```
 */
export class SLOTracker {
	private readonly definitions: Record<string, SLODefinition>;
	private readonly persistence: SLOPersistence;
	private readonly inMemoryEvents = new Map<string, SLOEvent[]>();

	constructor(config: SLOTrackerConfig) {
		this.definitions = config.definitions;

		const persistencePath =
			config.persistencePath ??
			join(homedir(), ".claude", "logs", "slo-events.jsonl");

		this.persistence = new SLOPersistence({
			filePath: persistencePath,
			maxSizeBytes: config.maxFileSizeBytes ?? 10 * 1024 * 1024, // 10MB
			maxAgeDays: config.maxAgeDays ?? 90,
			logger: config.logger,
		});
	}

	/**
	 * Ensure events are loaded from disk.
	 * Useful for testing to ensure async loading completes.
	 */
	async ensureLoaded(): Promise<void> {
		const events = await this.persistence.loadEvents();
		// Merge loaded events into in-memory cache
		for (const [sloName, evts] of events) {
			this.inMemoryEvents.set(sloName, evts);
		}
	}

	/**
	 * Record an SLO event for burn rate calculation.
	 *
	 * @param sloName - Name of the SLO to record event for
	 * @param violated - Whether this event violated the SLO
	 * @param value - Actual value measured (optional, defaults to threshold)
	 *
	 * @example
	 * ```typescript
	 * // Record successful scan within SLO
	 * tracker.recordEvent("scan_latency", false, 45_000);
	 *
	 * // Record failed scan exceeding SLO
	 * tracker.recordEvent("scan_latency", true, 75_000);
	 *
	 * // Backward compatibility (value defaults to threshold)
	 * tracker.recordEvent("scan_latency", false);
	 * ```
	 */
	recordEvent(sloName: string, violated: boolean, value?: number): void {
		const slo = this.definitions[sloName];
		if (!slo) {
			return;
		}

		const event: SLOEvent = {
			timestamp: Date.now(),
			violated,
			sloName,
			value: value ?? slo.threshold,
			threshold: slo.threshold,
		};

		// Store in memory
		const events = this.inMemoryEvents.get(sloName) ?? [];
		events.push(event);
		this.inMemoryEvents.set(sloName, events);

		// Persist to disk (fire-and-forget)
		this.persistence.appendEvent(event).catch(() => {
			// Error already logged by persistence layer
		});
	}

	/**
	 * Calculate the burn rate for an SLO.
	 * Burn rate indicates how fast the error budget is being consumed:
	 * - 0 = No errors, budget not being consumed
	 * - 1 = Consuming budget at exactly the expected rate (target violation rate)
	 * - >1 = Consuming budget faster than sustainable
	 *
	 * Formula: burnRate = (violations / totalEvents) / errorBudget
	 *
	 * Note: First call will load events from disk if not already loaded.
	 * Subsequent calls use in-memory cache.
	 *
	 * @param sloName - Name of the SLO to calculate burn rate for
	 * @returns Burn rate value (0 = no violations, 1 = consuming at target rate, >1 = over budget)
	 *
	 * @example
	 * ```typescript
	 * // Get burn rate for scan_latency SLO
	 * const burnRate = await tracker.getBurnRate("scan_latency");
	 * if (burnRate > 1) {
	 *   console.warn("Consuming error budget faster than sustainable!");
	 * }
	 * ```
	 */
	async getBurnRate(sloName: string): Promise<number> {
		// Ensure events are loaded from disk before calculating
		await this.ensureLoaded();

		const slo = this.definitions[sloName];
		if (!slo) {
			return 0;
		}

		const allEvents = this.inMemoryEvents.get(sloName) ?? [];
		if (allEvents.length === 0) {
			return 0;
		}

		// Filter events to only those within the SLO window
		const windowMs = getWindowMs(slo.window);
		const cutoffTime = Date.now() - windowMs;
		const recentEvents = allEvents.filter((e) => e.timestamp >= cutoffTime);

		if (recentEvents.length === 0) {
			return 0;
		}

		// Calculate violation rate
		const violations = recentEvents.filter((e) => e.violated).length;
		const violationRate = violations / recentEvents.length;

		// Burn rate = actual violation rate / allowed violation rate (error budget)
		// If errorBudget is 0.05 (5%), and we're violating at 0.05 rate, burnRate = 1
		// If we're violating at 0.10 rate, burnRate = 2 (consuming twice as fast)
		const burnRate = violationRate / slo.errorBudget;

		return burnRate;
	}

	/**
	 * Check if a metric value breaches its SLO
	 *
	 * @param sloName - Name of the SLO to check (must exist in definitions)
	 * @param currentValue - Current metric value to check against threshold
	 * @returns Breach status with burn rate and SLO details
	 *
	 * @example
	 * ```typescript
	 * const result = await tracker.checkBreach("scan_latency", 65_000);
	 * if (result.breached) {
	 *   console.log(`SLO breached: ${result.slo.name} (burn rate: ${result.burnRate})`);
	 * }
	 * ```
	 */
	async checkBreach(
		sloName: string,
		currentValue: number,
	): Promise<SLOBreachResult> {
		const slo = this.definitions[sloName];
		if (!slo) {
			return {
				breached: false,
				burnRate: 0,
				currentValue,
				slo: {
					name: "Unknown",
					target: 0,
					threshold: 0,
					unit: "count",
					window: "24h",
					errorBudget: 0,
				},
			};
		}

		// For latency (ms), breach if current > threshold
		// For percentages, breach if current < threshold
		const breached =
			slo.unit === "ms"
				? currentValue > slo.threshold
				: currentValue < slo.threshold;

		// Get actual burn rate from recorded events
		const calculatedBurnRate = await this.getBurnRate(sloName);

		// Use simplified burn rate if no events have been recorded yet:
		// - 1 = fully consuming error budget (when breached)
		// - 0 = not consuming budget (when within SLO)
		// Once events are recorded, use the calculated burn rate from event history.
		const burnRate =
			calculatedBurnRate > 0 ? calculatedBurnRate : breached ? 1 : 0;

		return { breached, burnRate, currentValue, slo };
	}

	/**
	 * Get all SLO names
	 *
	 * @returns Array of SLO names
	 */
	getSLONames(): string[] {
		return Object.keys(this.definitions);
	}

	/**
	 * Get SLO definition by name
	 *
	 * @param sloName - Name of the SLO
	 * @returns SLO definition or undefined if not found
	 */
	getSLODefinition(sloName: string): SLODefinition | undefined {
		return this.definitions[sloName];
	}

	/**
	 * Reset SLO event tracking (useful for testing).
	 * Also resets the disk load flag to force reload on next access.
	 */
	reset(): void {
		this.inMemoryEvents.clear();
		this.persistence.reset();
	}
}

/**
 * Create an SLO tracker instance
 *
 * @param config - Tracker configuration
 * @returns SLO tracker instance
 */
export function createSLOTracker(config: SLOTrackerConfig): SLOTracker {
	return new SLOTracker(config);
}

/**
 * Convert SLO window to milliseconds for time-based filtering.
 *
 * @param window - SLO window string
 * @returns Window duration in milliseconds
 */
function getWindowMs(window: SLOWindow): number {
	switch (window) {
		case "1h":
			return 60 * 60 * 1000;
		case "24h":
			return 24 * 60 * 60 * 1000;
		case "7d":
			return 7 * 24 * 60 * 60 * 1000;
		case "30d":
			return 30 * 24 * 60 * 60 * 1000;
	}
}
