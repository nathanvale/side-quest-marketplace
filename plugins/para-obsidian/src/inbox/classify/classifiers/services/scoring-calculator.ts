/**
 * Scoring Configuration Calculator
 *
 * Calculates confidence scoring thresholds for classifier configuration.
 * Provides sensible defaults and validation for heuristic/LLM weight balance.
 *
 * @module classifiers/services/scoring-calculator
 */

import type { ScoringConfig } from "../types";

/**
 * Default scoring configuration for most classifiers.
 * - Heuristics: 30% weight (fast, deterministic)
 * - LLM: 70% weight (accurate, context-aware)
 * - High confidence: ≥85% (both heuristics + LLM agree)
 * - Medium confidence: ≥60% (LLM alone sufficient)
 */
export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
	heuristicWeight: 0.3,
	llmWeight: 0.7,
	highThreshold: 0.85,
	mediumThreshold: 0.6,
} as const;

/**
 * Options for calculating custom scoring configuration
 */
export interface ScoringOptions {
	/** Weight for heuristic score (0.0 to 1.0, default: 0.3) */
	readonly heuristicWeight?: number;
	/** Weight for LLM score (0.0 to 1.0, default: 0.7) */
	readonly llmWeight?: number;
	/** Threshold for HIGH confidence (0.0 to 1.0, default: 0.85) */
	readonly highThreshold?: number;
	/** Threshold for MEDIUM confidence (0.0 to 1.0, default: 0.6) */
	readonly mediumThreshold?: number;
}

/**
 * Calculate scoring configuration with validation.
 *
 * Validates that:
 * - Weights sum to 1.0 (±0.01 tolerance for floating point)
 * - All values are in valid ranges (0.0 to 1.0)
 * - High threshold > medium threshold
 *
 * @param options - Optional scoring parameters (uses defaults if omitted)
 * @returns Validated scoring configuration
 * @throws Error if validation fails
 *
 * @example
 * ```typescript
 * // Use defaults
 * const scoring = calculateScoringConfig();
 *
 * // Custom weights (e.g., heuristic-heavy for well-structured documents)
 * const scoring = calculateScoringConfig({
 *   heuristicWeight: 0.6,
 *   llmWeight: 0.4
 * });
 * ```
 */
export function calculateScoringConfig(
	options?: ScoringOptions,
): ScoringConfig {
	const heuristicWeight =
		options?.heuristicWeight ?? DEFAULT_SCORING_CONFIG.heuristicWeight;
	const llmWeight = options?.llmWeight ?? DEFAULT_SCORING_CONFIG.llmWeight;
	const highThreshold =
		options?.highThreshold ?? DEFAULT_SCORING_CONFIG.highThreshold;
	const mediumThreshold =
		options?.mediumThreshold ?? DEFAULT_SCORING_CONFIG.mediumThreshold;

	// Validate ranges
	if (heuristicWeight < 0 || heuristicWeight > 1) {
		throw new Error(
			`heuristicWeight must be between 0.0 and 1.0 (got: ${heuristicWeight})`,
		);
	}
	if (llmWeight < 0 || llmWeight > 1) {
		throw new Error(
			`llmWeight must be between 0.0 and 1.0 (got: ${llmWeight})`,
		);
	}
	if (highThreshold < 0 || highThreshold > 1) {
		throw new Error(
			`highThreshold must be between 0.0 and 1.0 (got: ${highThreshold})`,
		);
	}
	if (mediumThreshold < 0 || mediumThreshold > 1) {
		throw new Error(
			`mediumThreshold must be between 0.0 and 1.0 (got: ${mediumThreshold})`,
		);
	}

	// Validate weight sum (with floating point tolerance)
	const weightSum = heuristicWeight + llmWeight;
	if (Math.abs(weightSum - 1.0) > 0.01) {
		throw new Error(
			`heuristicWeight + llmWeight must sum to 1.0 (got: ${weightSum.toFixed(2)})`,
		);
	}

	// Validate threshold ordering
	if (highThreshold <= mediumThreshold) {
		throw new Error(
			`highThreshold (${highThreshold}) must be greater than mediumThreshold (${mediumThreshold})`,
		);
	}

	return {
		heuristicWeight,
		llmWeight,
		highThreshold,
		mediumThreshold,
	};
}
