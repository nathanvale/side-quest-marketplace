/**
 * Classification functionality for determining document types and extracting fields
 *
 * @module classify
 */

// =============================================================================
// Classifier System (new modular architecture)
// =============================================================================

// Registry and migrations
// Suggestion builder
// Types
export type {
	ConverterMatch,
	ExtractionConfig,
	FieldDefinition,
	HeuristicConfig,
	HeuristicPattern,
	HeuristicResult,
	InboxConverter,
	Migration,
	MigrationFn,
	MigrationResult,
	RequirementLevel,
	ScoringConfig,
	SuggestionInput,
	TemplateConfig,
} from "./classifiers";
// Classifier definitions (one file per type)
// Loader utilities
export {
	bookingClassifier,
	buildSuggestion,
	ClassifierRegistry,
	CURRENT_SCHEMA_VERSION,
	DEFAULT_CLASSIFIERS,
	findBestConverter,
	getAvailableMigrations,
	invoiceClassifier,
	mapFieldsToTemplate,
	mergeConverters,
	needsMigration,
	runMigrations,
	scoreContent,
	scoreFilename,
} from "./classifiers";

// =============================================================================
// Legacy exports (deprecated, use classifiers instead)
// =============================================================================

/**
 * @deprecated Use DEFAULT_CLASSIFIERS from ./classifiers instead
 */
export { DEFAULT_INBOX_CONVERTERS } from "./converters/defaults";

// =============================================================================
// Detection (PDF processing, heuristics)
// =============================================================================

export {
	checkPdfToText,
	combineHeuristics,
	extractPdfText,
} from "./detection/pdf-processor";

// =============================================================================
// LLM Classifier
// =============================================================================

export type {
	DocumentTypeResult,
	FieldExtractionResult,
	InboxPromptOptions,
	InboxVaultContext,
} from "./llm-classifier";
export {
	buildEditPrompt,
	buildInboxPrompt,
	parseDetectionResponse,
} from "./llm-classifier";
