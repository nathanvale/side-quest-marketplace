/**
 * Inbox Processing Framework
 *
 * Main entry point for inbox processing functionality.
 * Re-exports all public APIs from domain-organized submodules.
 *
 * @module inbox
 */

// =============================================================================
// Classify - Document classification and field extraction
// =============================================================================
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
} from "./classify";
export {
	buildEditPrompt,
	buildInboxPrompt,
	buildSuggestion,
	checkPdfToText,
	combineHeuristics,
	DEFAULT_INBOX_CONVERTERS as DEFAULT_CONVERTERS,
	extractPdfText as extractPdfContent,
	extractPdfText,
	findBestConverter as findConverterMatch,
	mapFieldsToTemplate,
	mergeConverters,
	parseDetectionResponse,
	scoreContent,
	scoreFilename,
} from "./classify";
// LLM Detection types
export type {
	DocumentTypeResult,
	FieldExtractionResult,
	InboxPromptOptions,
	InboxVaultContext,
} from "./classify/llm-classifier";
// =============================================================================
// Engine - Main processing pipeline
// =============================================================================
export { createInboxEngine } from "./core/engine";
export {
	capitalizeFirst,
	generateFilename,
	generateTitle,
	generateUniqueNotePath,
	generateUniquePath,
} from "./core/engine-utils";
// =============================================================================
// Execute - Applying approved suggestions
// =============================================================================
// ExecutionResult now exported from ./types (discriminated union)
// Legacy exports removed - now exported from ./classify above
// =============================================================================
// Registry - Tracking processed items
// =============================================================================
export type { RegistryManager } from "./registry";
export { createRegistry, hashFile } from "./registry";
// =============================================================================
// Scan - Content extraction from files
// =============================================================================
export type {
	ContentExtractor,
	ExtractedContent,
	ExtractedMetadata,
	ExtractionSource,
	ExtractorMatch,
	InboxFile,
} from "./scan";
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
} from "./scan";
// Extractor types from their specific modules
export type {
	ImageExtension,
	ImageExtractionMetadata,
	MarkdownExtension,
	MarkdownExtractionMetadata,
} from "./scan/extractors";
export type { ErrorCategory, ErrorCode, ErrorContext } from "./shared";
// =============================================================================
// Shared - Errors and utilities
// =============================================================================
export {
	createInboxError,
	InboxError,
	isInboxError,
	isRecoverableError,
} from "./shared";
// =============================================================================
// Types - All type definitions
// =============================================================================
export type {
	BatchResult,
	Confidence,
	DetectionSource,
	DoneProgress,
	ErrorProgress,
	ExecuteOptions,
	ExecutionResult,
	ExtractingProgress,
	FailedExecutionResult,
	HashingProgress,
	InboxAction,
	InboxEngine,
	InboxEngineConfig,
	InboxSuggestion,
	LLMProgress,
	MigrationRecord,
	OrchestratorResult,
	ProcessedItem,
	ProcessedRegistry,
	ProcessInboxOptions,
	ProcessorResult,
	ProcessorType,
	RegistryMetadata,
	ScanOptions,
	ScanProgress,
	SkippedProgress,
	SuccessfulExecutionResult,
	SuggestionId,
} from "./types";
// SuggestionId utilities, enum, and constants
// Type guards for suggestion types
export {
	CONFIDENCE_THRESHOLDS,
	createSuggestionId,
	isChallengeSuggestion,
	isCreateNoteSuggestion,
	isLinkSuggestion,
	isMoveSuggestion,
	isRenameSuggestion,
	isRoutableSuggestion,
	isSkipSuggestion,
	isValidSuggestionId,
	RegistryVersion,
	validateInboxEngineConfig,
} from "./types";
// =============================================================================
// UI - Terminal interaction
// =============================================================================
export type { InteractiveOptions } from "./ui";
export {
	displayResults,
	formatConfidence,
	formatDetectionSource,
	formatSuggestion,
	formatSuggestionsTable,
	getHelpText,
	parseCommand,
	runInteractiveLoop,
} from "./ui";
