/**
 * Inbox Processing Framework
 *
 * Main entry point for inbox processing functionality.
 * Re-exports all public APIs from submodules.
 *
 * @module inbox
 */

export type { InteractiveOptions } from "./cli-adapter";
// CLI Adapter
export {
	displayResults,
	formatConfidence,
	formatSuggestion,
	formatSuggestionsTable,
	getHelpText,
	parseCommand,
	runInteractiveLoop,
} from "./cli-adapter";
export type {
	ConverterMatch,
	ExtractionConfig,
	FieldDefinition,
	HeuristicConfig,
	HeuristicPattern,
	HeuristicResult,
	InboxConverter,
	ScoringConfig,
	SuggestionInput,
	TemplateConfig,
} from "./converters";
// Converters (re-export from subdomain)
export {
	buildSuggestion,
	DEFAULT_INBOX_CONVERTERS,
	findBestConverter,
	mapFieldsToTemplate,
	mergeConverters,
	scoreContent,
	scoreFilename,
} from "./converters";
// Engine utilities
export {
	capitalizeFirst,
	generateFilename,
	generateTitle,
	generateUniquePath,
} from "./core/engine-utils";
// PDF processor
export {
	checkPdfToText,
	combineHeuristics,
	extractPdfText,
} from "./detection/pdf-processor";
// Engine
export { createInboxEngine } from "./engine";
export type {
	ContentExtractor,
	ExtractedContent,
	ExtractedMetadata,
	ExtractionSource,
	ExtractorMatch,
	ImageExtension,
	ImageExtractionMetadata,
	InboxFile,
	MarkdownExtension,
	MarkdownExtractionMetadata,
} from "./extractors";
// Extractors (re-export from subdomain)
export {
	createDefaultRegistry,
	createImageInboxFile,
	createInboxFile,
	createMarkdownInboxFile,
	ExtractorRegistry,
	extractFrontmatterOnly,
	getDefaultRegistry,
	getMimeType,
	IMAGE_EXTENSIONS,
	imageExtractor,
	isImageExtension,
	isMarkdownExtension,
	MARKDOWN_EXTENSIONS,
	markdownExtractor,
	pdfExtractor,
	readImageAsBase64,
	resetDefaultRegistry,
	VISION_EXTRACTION_PROMPT,
} from "./extractors";
// Errors
export { createInboxError, InboxError } from "./infrastructure/errors";
export type { RegistryManager } from "./infrastructure/processed-registry";
// Processed Registry
export { createRegistry, hashFile } from "./infrastructure/processed-registry";
export type {
	DocumentTypeResult,
	FieldExtractionResult,
	InboxPromptOptions,
	InboxVaultContext,
} from "./llm-detection";
// LLM Detection
export {
	buildInboxPrompt,
	parseDetectionResponse,
} from "./llm-detection";
// Types
export type {
	Confidence,
	ErrorCategory,
	ErrorCode,
	ErrorContext,
	ExecuteOptions,
	ExecutionResult,
	InboxAction,
	InboxEngine,
	InboxEngineConfig,
	InboxSuggestion,
	MigrationRecord,
	OrchestratorResult,
	ProcessedItem,
	ProcessedRegistry,
	ProcessorResult,
	ProcessorType,
	RegistryMetadata,
	ScanOptions,
	ScanProgress,
	SuggestionId,
} from "./types";
// SuggestionId utilities and enum
export {
	createSuggestionId,
	isValidSuggestionId,
	RegistryVersion,
} from "./types";
