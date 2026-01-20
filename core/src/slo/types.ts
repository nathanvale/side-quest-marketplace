/**
 * Service Level Objective (SLO) type definitions.
 *
 * Provides types for defining, tracking, and analyzing SLOs with error budgets.
 */

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
 * SLO event with all fields for persistence
 */
export interface SLOEvent {
	/** Unix timestamp in milliseconds */
	timestamp: number;
	/** Whether the SLO was violated */
	violated: boolean;
	/** Name of the SLO */
	sloName: string;
	/** Actual value measured */
	value: number;
	/** SLO threshold */
	threshold: number;
}

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
 * SLO tracker configuration
 */
export interface SLOTrackerConfig {
	/** SLO definitions to track */
	definitions: Record<string, SLODefinition>;
	/** Path to persistence file (JSONL format) */
	persistencePath?: string;
	/** Max file size before rotation (default: 10MB) */
	maxFileSizeBytes?: number;
	/** Max age in days for events (default: 90) */
	maxAgeDays?: number;
	/** Optional logger for debugging */
	logger?: SLOLogger;
}

/**
 * Optional logger interface for SLO operations
 */
export interface SLOLogger {
	info(message: string, context?: Record<string, unknown>): void;
	error(message: string, context?: Record<string, unknown>): void;
}
