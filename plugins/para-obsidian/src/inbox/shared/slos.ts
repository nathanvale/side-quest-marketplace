/**
 * Service Level Objectives (SLOs) for inbox processing with error budgets.
 * Defines reliability targets for scan latency, execution success, and LLM availability.
 */

import { homedir } from "node:os";
import { join } from "node:path";
import {
	appendToFile,
	ensureDir,
	pathExists,
	readTextFile,
	stat,
	writeTextFileAtomic,
} from "@sidequest/core/fs";

/** SLO event with all fields for persistence */
interface SLOEvent {
	timestamp: number;
	violated: boolean;
	sloName: string;
	value: number;
	threshold: number;
}

/** In-memory storage for SLO events */
const sloEvents = new Map<string, SLOEvent[]>();

/** Disk persistence configuration */
const SLO_STORAGE_CONFIG = {
	/** Storage location: ~/.claude/logs/slo-events.jsonl */
	path: join(homedir(), ".claude", "logs", "slo-events.jsonl"),
	/** Max file size before rotation (10MB) */
	maxSizeBytes: 10 * 1024 * 1024,
	/** Max age in days (90 days) */
	maxAgeDays: 90,
} as const;

/** Flag to track if events have been loaded from disk */
let eventsLoaded = false;

/** Promise for ongoing load operation (for deduplication) */
let loadPromise: Promise<void> | null = null;

/** Promise chain for serializing disk writes */
let writeChain: Promise<void> = Promise.resolve();

/** Circuit breaker for write failures */
let writeFailures = 0;
const MAX_WRITE_FAILURES = 3;

/**
 * SLO metric unit type
 */
export type SLOUnit = "ms" | "percent" | "count";

/**
 * SLO time window for evaluation
 */
export type SLOWindow = "1h" | "24h" | "7d" | "30d";

/**
 * Service Level Objective definition with error budget
 */
export interface SLODefinition {
	/** Name of the SLO */
	name: string;
	/** Target percentage (0-1), e.g., 0.95 for 95% */
	target: number;
	/** Threshold value for the metric */
	threshold: number;
	/** Unit of the threshold (ms, percent, count) */
	unit: SLOUnit;
	/** Window for evaluation */
	window: SLOWindow;
	/** Error budget (1 - target) */
	errorBudget: number;
}

/**
 * Predefined SLO definitions for inbox processing.
 * Covers end-to-end operations from scan to execution.
 */
export const SLO_DEFINITIONS: Record<string, SLODefinition> = {
	scan_latency: {
		name: "Scan Latency",
		target: 0.95, // 95% under 60s
		threshold: 60_000,
		unit: "ms",
		window: "30d",
		errorBudget: 0.05,
	},
	execute_success: {
		name: "Execute Success Rate",
		target: 0.99, // 99% success
		threshold: 99,
		unit: "percent",
		window: "7d",
		errorBudget: 0.01,
	},
	llm_availability: {
		name: "LLM Availability",
		target: 0.8, // 80% available
		threshold: 80,
		unit: "percent",
		window: "24h",
		errorBudget: 0.2,
	},
	execute_latency: {
		name: "Execute Latency",
		target: 0.95, // 95% under 30s
		threshold: 30_000,
		unit: "ms",
		window: "30d",
		errorBudget: 0.05,
	},
	extraction_latency: {
		name: "Extraction Latency",
		target: 0.95, // 95% under 5s
		threshold: 5_000,
		unit: "ms",
		window: "7d",
		errorBudget: 0.05,
	},
	enrichment_latency: {
		name: "Enrichment Latency",
		target: 0.95, // 95% under 5s
		threshold: 5_000,
		unit: "ms",
		window: "7d",
		errorBudget: 0.05,
	},
	llm_latency: {
		name: "LLM Latency",
		target: 0.9, // 90% under 10s
		threshold: 10_000,
		unit: "ms",
		window: "24h",
		errorBudget: 0.1,
	},
};

/**
 * Result of SLO breach check
 */
export interface SLOBreachResult {
	/** Whether the SLO is breached */
	breached: boolean;
	/** Burn rate (1 = fully consuming error budget) */
	burnRate: number;
	/** Current value of the metric */
	currentValue: number;
	/** SLO definition that was checked */
	slo: SLODefinition;
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

/**
 * Load SLO events from disk on first use.
 * Prunes events older than maxAgeDays automatically.
 *
 * @internal
 */
async function loadEventsFromDisk(): Promise<void> {
	// If already loaded or currently loading, return existing promise
	if (eventsLoaded) {
		return;
	}
	if (loadPromise) {
		return loadPromise;
	}

	// Create load promise to prevent duplicate loads
	loadPromise = (async () => {
		try {
			const filePath = SLO_STORAGE_CONFIG.path;
			const fileExists = await pathExists(filePath);

			if (!fileExists) {
				return;
			}

			const content = await readTextFile(filePath);
			const lines = content.trim().split("\n").filter(Boolean);

			const cutoffTime =
				Date.now() - SLO_STORAGE_CONFIG.maxAgeDays * 24 * 60 * 60 * 1000;
			let prunedCount = 0;

			for (const line of lines) {
				try {
					const event = JSON.parse(line) as SLOEvent;

					// Skip events older than maxAgeDays
					if (event.timestamp < cutoffTime) {
						prunedCount++;
						continue;
					}

					const events = sloEvents.get(event.sloName) ?? [];
					events.push(event);
					sloEvents.set(event.sloName, events);
				} catch (error) {
					console.error(
						`Failed to parse SLO event line: ${line.substring(0, 100)}...`,
						error,
					);
				}
			}

			// If we pruned >10% of events, trigger rotation to clean up disk
			if (lines.length > 0 && prunedCount / lines.length > 0.1) {
				rotateEventsFile().catch((error: unknown) => {
					console.error("Failed to rotate SLO events file:", error);
				});
			}
		} catch (error: unknown) {
			// If loading fails, just start fresh (don't block execution)
			console.error("Failed to load SLO events from disk:", error);
		} finally {
			// CRITICAL: Set eventsLoaded BEFORE clearing loadPromise to prevent race condition
			// Race window: Thread A clears promise, Thread B sees !eventsLoaded && !loadPromise, Thread A sets flag
			eventsLoaded = true;
			loadPromise = null;
		}
	})();

	return loadPromise;
}

/**
 * Ensure SLO events are loaded from disk.
 * Useful for testing to ensure async loading completes.
 *
 * @internal For testing only
 */
export async function ensureEventsLoaded(): Promise<void> {
	await loadEventsFromDisk();
}

/**
 * Append a single SLO event to disk (fire-and-forget, non-blocking).
 *
 * @param event - SLO event to persist
 * @internal
 */
async function appendEventToDisk(event: SLOEvent): Promise<void> {
	const filePath = SLO_STORAGE_CONFIG.path;

	// Ensure directory exists
	await ensureDir(join(homedir(), ".claude", "logs"));

	// Check if file exists and size
	const fileExists = await pathExists(filePath);
	if (fileExists) {
		const stats = await stat(filePath);
		const currentSize = stats.size;

		// If file exceeds max size, rotate it first
		if (currentSize >= SLO_STORAGE_CONFIG.maxSizeBytes) {
			await rotateEventsFile();
		}
	}

	// Append event as JSON line
	const line = `${JSON.stringify(event)}\n`;
	await appendToFile(filePath, line);
}

/**
 * Rotate the events file when it exceeds size limit or has too many stale events.
 * Rewrites the file with only recent events (atomic operation).
 *
 * @internal
 */
async function rotateEventsFile(): Promise<void> {
	const filePath = SLO_STORAGE_CONFIG.path;
	const cutoffTime =
		Date.now() - SLO_STORAGE_CONFIG.maxAgeDays * 24 * 60 * 60 * 1000;

	// Collect all in-memory events (already pruned during load)
	const allEvents: SLOEvent[] = [];
	for (const events of sloEvents.values()) {
		for (const event of events) {
			if (event.timestamp >= cutoffTime) {
				allEvents.push(event);
			}
		}
	}

	// Write atomically (temp file + rename)
	const lines = allEvents.map((e) => JSON.stringify(e)).join("\n");
	const content = lines ? `${lines}\n` : "";
	await writeTextFileAtomic(filePath, content);
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
 * recordSLOEvent("scan_latency", false, 45_000);
 *
 * // Record failed scan exceeding SLO
 * recordSLOEvent("scan_latency", true, 75_000);
 *
 * // Backward compatibility (value defaults to threshold)
 * recordSLOEvent("scan_latency", false);
 * ```
 */
export function recordSLOEvent(
	sloName: string,
	violated: boolean,
	value?: number,
): void {
	const slo = SLO_DEFINITIONS[sloName];
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

	const events = sloEvents.get(sloName) ?? [];
	events.push(event);
	sloEvents.set(sloName, events);

	// Serialize disk writes to prevent interleaving
	writeChain = writeChain
		.then(() => {
			// Circuit breaker: Skip writes if too many failures
			if (writeFailures >= MAX_WRITE_FAILURES) {
				console.error(
					"SLO persistence disabled - too many consecutive failures",
				);
				return;
			}
			return appendEventToDisk(event);
		})
		.then(() => {
			// Reset failure count on success
			writeFailures = 0;
		})
		.catch((error: unknown) => {
			// Increment failure count and log
			writeFailures++;
			console.error(
				`Failed to persist SLO event (failure ${writeFailures}/${MAX_WRITE_FAILURES}):`,
				error,
			);
			if (writeFailures >= MAX_WRITE_FAILURES) {
				console.error("SLO persistence disabled - too many failures");
			}
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
 * const burnRate = await getBurnRate("scan_latency");
 * if (burnRate > 1) {
 *   console.warn("Consuming error budget faster than sustainable!");
 * }
 * ```
 */
export async function getBurnRate(sloName: string): Promise<number> {
	// Ensure events are loaded from disk before calculating
	await ensureEventsLoaded();

	const slo = SLO_DEFINITIONS[sloName];
	if (!slo) {
		return 0;
	}

	const allEvents = sloEvents.get(sloName) ?? [];
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
 * Reset SLO event tracking (useful for testing).
 * Also resets the disk load flag to force reload on next access.
 */
export function resetSLOEvents(): void {
	sloEvents.clear();
	eventsLoaded = false; // Allow reload from disk
	loadPromise = null;
	writeChain = Promise.resolve();
	writeFailures = 0; // Reset circuit breaker
}

/**
 * Reset SLO events for unit tests (prevents disk loading)
 * @internal
 */
export function resetSLOEventsForTests(): void {
	sloEvents.clear();
	eventsLoaded = true; // Mark as loaded to prevent disk reload
	loadPromise = null;
	writeChain = Promise.resolve();
	writeFailures = 0; // Reset circuit breaker
}

/**
 * Check if a metric value breaches its SLO
 *
 * @param sloName - Name of the SLO to check (must exist in SLO_DEFINITIONS)
 * @param currentValue - Current metric value to check against threshold
 * @returns Breach status with burn rate and SLO details
 *
 * @example
 * ```typescript
 * const result = await checkSLOBreach("scan_latency", 65_000);
 * if (result.breached) {
 *   console.log(`SLO breached: ${result.slo.name} (burn rate: ${result.burnRate})`);
 * }
 * ```
 */
export async function checkSLOBreach(
	sloName: string,
	currentValue: number,
): Promise<SLOBreachResult> {
	const slo = SLO_DEFINITIONS[sloName];
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
	const calculatedBurnRate = await getBurnRate(sloName);

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
export function getSLONames(): string[] {
	return Object.keys(SLO_DEFINITIONS);
}

/**
 * Get SLO definition by name
 *
 * @param sloName - Name of the SLO
 * @returns SLO definition or undefined if not found
 */
export function getSLODefinition(sloName: string): SLODefinition | undefined {
	return SLO_DEFINITIONS[sloName];
}
