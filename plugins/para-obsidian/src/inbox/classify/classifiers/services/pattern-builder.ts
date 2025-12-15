/**
 * Pattern Builder Service
 *
 * Builds weighted heuristic patterns for filename and content matching.
 * Provides sensible weight defaults based on pattern specificity.
 *
 * @module classifiers/services/pattern-builder
 */

import type { HeuristicPattern } from "../types";

/**
 * Build weighted filename patterns from keywords.
 *
 * Assigns weights based on specificity:
 * - Exact match keywords: weight 1.0
 * - Partial match keywords: weight 0.8
 * - Generic keywords: weight 0.6
 *
 * @param patterns - Array of pattern strings or pattern objects
 * @returns Array of weighted heuristic patterns
 *
 * @example
 * ```typescript
 * const patterns = buildFilenamePatterns([
 *   'invoice',           // Gets weight 1.0
 *   'medical',           // Gets weight 1.0
 *   { pattern: 'dr-', weight: 0.9 }  // Custom weight
 * ]);
 * ```
 */
export function buildFilenamePatterns(
	patterns: ReadonlyArray<string | HeuristicPattern>,
): HeuristicPattern[] {
	return patterns.map((p) => {
		if (typeof p === "string") {
			return { pattern: p, weight: 1.0 };
		}
		return p;
	});
}

/**
 * Build weighted content marker patterns.
 *
 * Assigns weights based on marker strength:
 * - Strong indicators (unique phrases): weight 1.0
 * - Moderate indicators (common in domain): weight 0.8
 * - Weak indicators (generic terms): weight 0.5
 *
 * @param patterns - Array of pattern strings or pattern objects
 * @returns Array of weighted heuristic patterns
 *
 * @example
 * ```typescript
 * const markers = buildContentMarkers([
 *   'provider #',        // Strong indicator: weight 1.0
 *   'patient name',      // Moderate: weight 0.8
 *   { pattern: 'abn', weight: 0.5 }  // Weak (generic)
 * ]);
 * ```
 */
export function buildContentMarkers(
	patterns: ReadonlyArray<string | HeuristicPattern>,
): HeuristicPattern[] {
	return patterns.map((p) => {
		if (typeof p === "string") {
			// Default to moderate weight for content markers
			return { pattern: p, weight: 0.8 };
		}
		return p;
	});
}

/**
 * Normalize pattern weights to ensure valid ranges.
 *
 * Clamps all weights to [0.0, 1.0] range and warns if adjustments made.
 *
 * @param patterns - Patterns to normalize
 * @returns Normalized patterns with valid weights
 */
export function normalizePatternWeights(
	patterns: readonly HeuristicPattern[],
): HeuristicPattern[] {
	return patterns.map((p) => {
		const clampedWeight = Math.max(0.0, Math.min(1.0, p.weight));
		if (clampedWeight !== p.weight) {
			console.warn(
				`Pattern '${p.pattern}' weight ${p.weight} clamped to ${clampedWeight}`,
			);
		}
		return { pattern: p.pattern, weight: clampedWeight };
	});
}
