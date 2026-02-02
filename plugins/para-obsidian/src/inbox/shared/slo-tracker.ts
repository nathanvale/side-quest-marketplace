/**
 * Para-obsidian SLO tracker using @sidequest/core/slo.
 *
 * Provides pre-configured SLO definitions for inbox processing operations.
 */

import type { SLODefinition } from "@side-quest/core/slo";
import { createSLOTracker } from "@side-quest/core/slo";

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
 * Singleton SLO tracker instance for para-obsidian
 */
const tracker = createSLOTracker({
	definitions: SLO_DEFINITIONS,
	// Uses default path: ~/.claude/logs/slo-events.jsonl
});

/**
 * Record an SLO event for burn rate calculation.
 *
 * @param sloName - Name of the SLO to record event for
 * @param violated - Whether this event violated the SLO
 * @param value - Actual value measured (optional, defaults to threshold)
 */
export function recordSLOEvent(
	sloName: string,
	violated: boolean,
	value?: number,
): void {
	tracker.recordEvent(sloName, violated, value);
}

/**
 * Calculate the burn rate for an SLO.
 *
 * @param sloName - Name of the SLO to calculate burn rate for
 * @returns Burn rate value (0 = no violations, 1 = consuming at target rate, >1 = over budget)
 */
export async function getBurnRate(sloName: string): Promise<number> {
	return tracker.getBurnRate(sloName);
}

/**
 * Check if a metric value breaches its SLO
 *
 * @param sloName - Name of the SLO to check
 * @param currentValue - Current metric value to check against threshold
 * @returns Breach status with burn rate and SLO details
 */
export async function checkSLOBreach(
	sloName: string,
	currentValue: number,
): Promise<{
	breached: boolean;
	burnRate: number;
	currentValue: number;
	slo: SLODefinition;
}> {
	return tracker.checkBreach(sloName, currentValue);
}

/**
 * Get all SLO names
 */
export function getSLONames(): string[] {
	return tracker.getSLONames();
}

/**
 * Get SLO definition by name
 */
export function getSLODefinition(sloName: string): SLODefinition | undefined {
	return tracker.getSLODefinition(sloName);
}

/**
 * Reset SLO event tracking (useful for testing).
 */
export function resetSLOEvents(): void {
	tracker.reset();
}

/**
 * Ensure events are loaded from disk (useful for testing).
 */
export async function ensureEventsLoaded(): Promise<void> {
	await tracker.ensureLoaded();
}

// Re-export types from core
export type {
	SLOBreachResult,
	SLODefinition,
	SLOUnit,
	SLOWindow,
} from "@side-quest/core/slo";
