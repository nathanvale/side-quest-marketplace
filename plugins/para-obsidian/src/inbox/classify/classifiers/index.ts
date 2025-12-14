/**
 * Classifier System
 *
 * Provides registry, types, loader, and migration support for inbox document classifiers.
 * Each classifier is defined in its own file under definitions/.
 *
 * @module classify/classifiers
 */

// Classifier definitions (one file per classifier type)
export {
	bookingClassifier,
	DEFAULT_CLASSIFIERS,
	invoiceClassifier,
} from "./definitions";

// Loader utilities
export {
	findBestConverter,
	mapFieldsToTemplate,
	mergeConverters,
	scoreContent,
	scoreFilename,
} from "./loader";

// Migrations
export type { Migration, MigrationFn, MigrationResult } from "./migrations";
export {
	getAvailableMigrations,
	needsMigration,
	runMigrations,
} from "./migrations";

// Registry
export { ClassifierRegistry, CURRENT_SCHEMA_VERSION } from "./registry";

// Suggestion builder
export type { HeuristicResult, SuggestionInput } from "./suggestion-builder";
export { buildSuggestion } from "./suggestion-builder";

// Types
export type {
	ConverterMatch,
	ExtractionConfig,
	FieldDefinition,
	HeuristicConfig,
	HeuristicPattern,
	InboxConverter,
	RequirementLevel,
	ScoringConfig,
	TemplateConfig,
} from "./types";
