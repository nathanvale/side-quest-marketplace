/**
 * Pluggable inbox converter system
 *
 * Provides config-driven document type detection, LLM extraction,
 * and template field mapping for inbox processing.
 *
 * @module converters
 */

// Clipping converter
export {
	type ClippingConversionResult,
	convertClippingToBookmark,
} from "./clipping-converter";
// Default converters
export { DEFAULT_INBOX_CONVERTERS } from "./defaults";
// Loader utilities
export {
	findBestConverter,
	mapFieldsToTemplate,
	mergeConverters,
	scoreContent,
	scoreFilename,
} from "./loader";
export type { HeuristicResult, SuggestionInput } from "./suggestion-builder";
// Suggestion builder
export { buildSuggestion } from "./suggestion-builder";
// Types
export type {
	ConverterMatch,
	ExtractionConfig,
	FieldDefinition,
	HeuristicConfig,
	HeuristicPattern,
	InboxConverter,
	ScoringConfig,
	TemplateConfig,
} from "./types";
