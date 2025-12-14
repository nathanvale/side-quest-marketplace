/**
 * Classifier Loader
 *
 * Functions for matching files to classifiers and mapping fields.
 *
 * @module classifiers/loader
 */

import type { ConverterMatch, HeuristicPattern, InboxConverter } from "./types";

/**
 * Score a filename against heuristic patterns
 * @param filename - The filename to score (basename only)
 * @param patterns - Patterns to match against
 * @returns Score between 0.0 and 1.0
 */
export function scoreFilename(
	filename: string,
	patterns: readonly HeuristicPattern[],
): number {
	const lowerFilename = filename.toLowerCase();
	let maxScore = 0;

	for (const { pattern, weight } of patterns) {
		try {
			const regex = new RegExp(pattern, "i");
			if (regex.test(lowerFilename)) {
				maxScore = Math.max(maxScore, weight);
			}
		} catch {
			// Invalid regex pattern, skip
		}
	}

	return maxScore;
}

/**
 * Score content against heuristic markers
 * @param content - The document content to score
 * @param markers - Markers to match against
 * @returns Score between 0.0 and 1.0
 */
export function scoreContent(
	content: string,
	markers: readonly HeuristicPattern[],
): number {
	const lowerContent = content.toLowerCase();
	let totalScore = 0;
	let matchCount = 0;

	for (const { pattern, weight } of markers) {
		try {
			const regex = new RegExp(pattern, "i");
			if (regex.test(lowerContent)) {
				totalScore += weight;
				matchCount++;
			}
		} catch {
			// Invalid regex pattern, skip
		}
	}

	// Average of matched weights, capped at 1.0
	return matchCount > 0 ? Math.min(totalScore / matchCount, 1.0) : 0;
}

/**
 * Find the best matching converter for a file
 * @param converters - Available converters sorted by priority
 * @param filename - The filename to match
 * @param content - The document content to match
 * @returns Matched converter with score, or null if no match
 */
export function findBestConverter(
	converters: readonly InboxConverter[],
	filename: string,
	content: string,
): ConverterMatch | null {
	// Sort by priority (higher first)
	const sorted = [...converters]
		.filter((c) => c.enabled)
		.sort((a, b) => b.priority - a.priority);

	let bestMatch: ConverterMatch | null = null;

	for (const converter of sorted) {
		const { heuristics } = converter;
		const threshold = heuristics.threshold ?? 0.3;

		const filenameScore = scoreFilename(filename, heuristics.filenamePatterns);
		const contentScore = scoreContent(content, heuristics.contentMarkers);

		// Combine scores (filename weighted slightly higher for initial detection)
		const combinedScore = filenameScore * 0.6 + contentScore * 0.4;

		if (combinedScore >= threshold) {
			if (!bestMatch || combinedScore > bestMatch.score) {
				bestMatch = { converter, score: combinedScore };
			}
		}
	}

	return bestMatch;
}

/**
 * Map extracted LLM fields to Templater prompt format
 * @param extractedFields - Fields extracted by LLM
 * @param converter - The converter with field mappings
 * @returns Record with Templater prompt keys and values
 */
export function mapFieldsToTemplate(
	extractedFields: Record<string, unknown>,
	converter: InboxConverter,
): Record<string, string> {
	const result: Record<string, string> = {};
	const { fieldMappings } = converter.template;

	for (const [llmKey, templaterKey] of Object.entries(fieldMappings)) {
		const value = extractedFields[llmKey];
		if (value !== undefined && value !== null && value !== "") {
			result[templaterKey] = String(value);
		}
	}

	return result;
}

/**
 * Deep merge a partial converter override into a base converter
 */
function mergeConverter(
	base: InboxConverter,
	override: Partial<InboxConverter>,
): InboxConverter {
	return {
		...base,
		...override,
		heuristics: {
			...base.heuristics,
			...(override.heuristics ?? {}),
		},
		extraction: {
			...base.extraction,
			...(override.extraction ?? {}),
		},
		template: {
			...base.template,
			...(override.template ?? {}),
			fieldMappings: {
				...base.template.fieldMappings,
				...(override.template?.fieldMappings ?? {}),
			},
		},
		scoring: {
			...base.scoring,
			...(override.scoring ?? {}),
		},
		fields: override.fields ?? base.fields,
	};
}

/**
 * Merge user converter overrides with defaults
 * @param defaults - Default converters
 * @param overrides - User-provided overrides (must include id)
 * @param disabled - IDs of converters to disable
 * @returns Merged converter list
 */
export function mergeConverters(
	defaults: readonly InboxConverter[],
	overrides: ReadonlyArray<Partial<InboxConverter> & { id: string }>,
	disabled: readonly string[] = [],
): InboxConverter[] {
	const result: InboxConverter[] = [];
	const overrideMap = new Map(overrides.map((o) => [o.id, o]));
	const disabledSet = new Set(disabled);

	// Merge existing defaults with overrides
	for (const base of defaults) {
		if (disabledSet.has(base.id)) {
			continue; // Skip disabled converters
		}

		const override = overrideMap.get(base.id);
		if (override) {
			result.push(mergeConverter(base, override));
			overrideMap.delete(base.id);
		} else {
			result.push(base);
		}
	}

	// Add new converters from overrides (not in defaults)
	for (const override of overrideMap.values()) {
		if (!disabledSet.has(override.id)) {
			// New converter must have all required fields
			const newConverter = override as InboxConverter;
			if (
				newConverter.displayName &&
				newConverter.heuristics &&
				newConverter.template
			) {
				result.push(newConverter);
			}
		}
	}

	return result;
}
