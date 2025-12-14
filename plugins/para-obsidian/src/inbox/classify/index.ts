/**
 * Classification functionality for determining document types and extracting fields
 */

export {
	findBestConverter,
	mapFieldsToTemplate,
	mergeConverters,
	scoreContent,
	scoreFilename,
} from "./converters";
export { DEFAULT_INBOX_CONVERTERS } from "./converters/defaults";
export type {
	HeuristicResult,
	SuggestionInput,
} from "./converters/suggestion-builder";
export { buildSuggestion } from "./converters/suggestion-builder";
// Re-export converters functionality
export type {
	ConverterMatch,
	ExtractionConfig,
	FieldDefinition,
	HeuristicConfig,
	HeuristicPattern,
	InboxConverter,
	ScoringConfig,
	TemplateConfig,
} from "./converters/types";
// Re-export PDF processing from detection folder
export {
	checkPdfToText,
	combineHeuristics,
	extractPdfText,
} from "./detection/pdf-processor";
export type {
	DocumentTypeResult,
	FieldExtractionResult,
	InboxPromptOptions,
	InboxVaultContext,
} from "./llm-classifier";
// Re-export LLM detection functionality
export {
	buildEditPrompt,
	buildInboxPrompt,
	parseDetectionResponse,
} from "./llm-classifier";
