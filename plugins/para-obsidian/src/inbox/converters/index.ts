/**
 * Pluggable inbox converter system
 *
 * Provides config-driven document type detection, LLM extraction,
 * and template field mapping for inbox processing.
 *
 * @module converters
 */

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
