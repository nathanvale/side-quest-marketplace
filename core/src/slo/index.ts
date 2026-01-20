/**
 * Service Level Objective (SLO) tracking with error budgets and burn rate analysis.
 *
 * ## Overview
 *
 * This module provides utilities for defining, tracking, and monitoring SLOs
 * with persistent JSONL storage, automatic rotation, and burn rate calculation.
 *
 * ## Features
 *
 * - **Event Recording**: Track SLO violations and successes
 * - **Burn Rate Calculation**: Monitor error budget consumption
 * - **Breach Detection**: Check if metrics violate SLO thresholds
 * - **Persistent Storage**: JSONL-based event log with rotation
 * - **Circuit Breaker**: Automatic write failure protection
 *
 * ## Usage
 *
 * ```typescript
 * import { createSLOTracker } from "@sidequest/core/slo";
 *
 * // Define SLOs
 * const tracker = createSLOTracker({
 *   definitions: {
 *     api_latency: {
 *       name: "API Latency",
 *       target: 0.95,        // 95% of requests
 *       threshold: 1000,     // Under 1s
 *       unit: "ms",
 *       window: "24h",
 *       errorBudget: 0.05    // 5% allowed failures
 *     },
 *     success_rate: {
 *       name: "Success Rate",
 *       target: 0.99,        // 99% success
 *       threshold: 99,
 *       unit: "percent",
 *       window: "7d",
 *       errorBudget: 0.01
 *     }
 *   }
 * });
 *
 * // Record events
 * tracker.recordEvent("api_latency", false, 850);  // Success
 * tracker.recordEvent("api_latency", true, 1200);  // Violation
 *
 * // Check breach
 * const result = await tracker.checkBreach("api_latency", 1100);
 * if (result.breached) {
 *   console.log(`Burn rate: ${result.burnRate.toFixed(2)}x`);
 * }
 *
 * // Get burn rate
 * const burnRate = await tracker.getBurnRate("api_latency");
 * if (burnRate > 1) {
 *   console.warn("Consuming error budget too fast!");
 * }
 * ```
 *
 * ## Burn Rate Explained
 *
 * Burn rate indicates how fast the error budget is being consumed:
 *
 * - **0**: No violations, budget not being consumed
 * - **1**: Consuming budget at exactly the expected rate (target violation rate)
 * - **>1**: Consuming budget faster than sustainable
 *
 * Formula: `burnRate = (violations / totalEvents) / errorBudget`
 *
 * ## Persistence
 *
 * Events are persisted to a JSONL file with:
 * - **Automatic rotation**: When file exceeds size limit (default: 10MB)
 * - **Automatic pruning**: Events older than maxAgeDays (default: 90 days)
 * - **Circuit breaker**: Disables writes after 3 consecutive failures
 *
 * Default path: `~/.claude/logs/slo-events.jsonl`
 *
 * @module core/slo
 */

export { SLOPersistence } from "./persistence.js";
export {
	createSLOTracker,
	SLOTracker,
} from "./tracker.js";

export type {
	SLOBreachResult,
	SLODefinition,
	SLOEvent,
	SLOLogger,
	SLOTrackerConfig,
	SLOUnit,
	SLOWindow,
} from "./types.js";
