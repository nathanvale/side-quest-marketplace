/**
 * Inbox Processing Framework - Core Types
 *
 * This module defines all types for the inbox processing system including:
 * - Suggestion formats for processed inbox items
 * - Engine interface for scan/execute/edit operations
 * - Registry types for idempotent processing
 * - Error taxonomy types
 */

// =============================================================================
// Confidence & Action Types
// =============================================================================

/**
 * Confidence level for a suggestion.
 * - HIGH: Heuristics AND AI agree, target location exists, template available
 * - MEDIUM: AI detects type but filename/content ambiguous
 * - LOW: AI uncertain, content unclear, or extraction failed
 */
export type Confidence = "high" | "medium" | "low";

/**
 * Type of processor that generated the suggestion.
 * - attachments: PDF, images, other binary files
 * - notes: Markdown files that need routing
 * - images: Images that may need OCR/vision processing
 */
export type ProcessorType = "attachments" | "notes" | "images";

/**
 * Action to take on an inbox item.
 * - create-note: Create a new note from the item
 * - move: Move file to a different location
 * - rename: Rename the file
 * - link: Link to existing note
 * - skip: Do not process this item
 * - challenge: Re-classify with user hint (triggers Stage 2 re-run)
 */
export type InboxAction =
	| "create-note"
	| "move"
	| "rename"
	| "link"
	| "skip"
	| "challenge";

// =============================================================================
// Branded Types for Type Safety
// =============================================================================

/**
 * Branded type for suggestion IDs to prevent mixing with other string IDs.
 * This ensures compile-time safety when passing IDs between functions.
 */
export type SuggestionId = string & { readonly __brand: "SuggestionId" };

/**
 * Create a branded suggestion ID.
 *
 * When called without arguments, generates a new UUID v4 using crypto.randomUUID().
 * When called with a string, validates it's a proper UUID v4 format.
 *
 * @param uuid - Optional UUID v4 string. If omitted, generates a new UUID.
 * @throws Error if uuid is provided but not a valid UUID v4 format
 *
 * @example
 * ```typescript
 * // Generate new ID
 * const newId = createSuggestionId();
 *
 * // Convert existing UUID
 * const existingId = createSuggestionId("abc12300-0000-4000-8000-000000000001");
 * ```
 */
export function createSuggestionId(uuid?: string): SuggestionId {
	// Generate new UUID if not provided (uses Bun/Node built-in crypto)
	const id = uuid ?? crypto.randomUUID();

	if (!isValidSuggestionId(id)) {
		throw new Error(
			`Invalid suggestion ID format: "${id}". Must be a valid UUID v4.`,
		);
	}
	return id as SuggestionId;
}

/**
 * Validate that a string is a properly formatted suggestion ID (UUID v4).
 */
export function isValidSuggestionId(id: string): id is SuggestionId {
	const uuidPattern =
		/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
	return uuidPattern.test(id);
}

// =============================================================================
// Suggestion Types
// =============================================================================

/**
 * Source of the detection that created this suggestion.
 * Helps users understand if LLM contributed to the classification.
 */
export type DetectionSource =
	| "llm+heuristic" // Both LLM and heuristics detected same type (highest confidence)
	| "llm" // LLM detected (heuristics didn't match or didn't detect)
	| "heuristic" // Only heuristics detected (LLM failed or disagreed)
	| "frontmatter" // Pre-classified from existing frontmatter (skipped LLM)
	| "none"; // Neither detected (skip suggestion)

/**
 * Base fields shared by all suggestion types.
 * Contains common metadata and tracking information.
 */
interface BaseSuggestion {
	/** Branded UUID for approval tracking */
	readonly id: SuggestionId;

	/** Original file path in inbox */
	readonly source: string;

	/** Which processor generated this suggestion */
	readonly processor: ProcessorType;

	/** Confidence level in this suggestion */
	readonly confidence: Confidence;

	/** Source of detection: llm+heuristic, llm, heuristic, frontmatter, or none */
	readonly detectionSource: DetectionSource;

	/** Human-readable explanation of why this suggestion was made */
	readonly reason: string;

	/** Warnings about fields that could not be extracted (requires user attention) */
	readonly extractionWarnings?: readonly string[];

	/** Previous classification that was challenged (for audit trail) */
	readonly previousClassification?: {
		readonly documentType?: string;
		readonly confidence: Confidence;
		readonly reason: string;
	};
}

/**
 * Suggestion to create a new note from the inbox item.
 * Requires note type and title, plus optional PARA metadata.
 */
export interface CreateNoteSuggestion extends BaseSuggestion {
	readonly action: "create-note";

	/** Template/note type: invoice, booking, session, etc. (REQUIRED) */
	readonly suggestedNoteType: string;

	/** Suggested title for the note (REQUIRED) */
	readonly suggestedTitle: string;

	/** Target PARA folder for the note */
	readonly suggestedDestination?: string;

	/** [[Area]] wikilink */
	readonly suggestedArea?: string;

	/** [[Project]] wikilink */
	readonly suggestedProject?: string;

	/** Fields extracted from content (amount, provider, date, etc.) */
	readonly extractedFields?: Record<string, unknown>;

	/** Date-prefixed filename for attachment */
	readonly suggestedAttachmentName?: string;

	/** [[Attachments/...]] wikilink */
	readonly attachmentLink?: string;

	/** If true, auto-route without user review (for high-confidence suggestions) */
	readonly autoRoute?: boolean;

	/** LLM's suggested area (display only - shows what LLM detected before user override) */
	readonly llmSuggestedArea?: string;

	/** LLM's suggested project (display only - shows what LLM detected before user override) */
	readonly llmSuggestedProject?: string;
}

/**
 * Suggestion to move the inbox item to a new location.
 * Requires destination path, may include attachment naming.
 */
export interface MoveSuggestion extends BaseSuggestion {
	readonly action: "move";

	/** Target PARA folder for the file (REQUIRED) */
	readonly suggestedDestination: string;

	/** Date-prefixed filename for attachment */
	readonly suggestedAttachmentName?: string;

	/** [[Attachments/...]] wikilink */
	readonly attachmentLink?: string;
}

/**
 * Suggestion to rename the inbox item.
 * Requires new attachment name.
 */
export interface RenameSuggestion extends BaseSuggestion {
	readonly action: "rename";

	/** Date-prefixed filename for attachment (REQUIRED) */
	readonly suggestedAttachmentName: string;
}

/**
 * Suggestion to link the inbox item to an existing note.
 * Requires attachment link, may include naming.
 */
export interface LinkSuggestion extends BaseSuggestion {
	readonly action: "link";

	/** [[Attachments/...]] wikilink (REQUIRED) */
	readonly attachmentLink: string;

	/** Date-prefixed filename for attachment */
	readonly suggestedAttachmentName?: string;
}

/**
 * Suggestion to skip/ignore the inbox item.
 * No additional fields required beyond base suggestion.
 */
export interface SkipSuggestion extends BaseSuggestion {
	readonly action: "skip";
}

/**
 * Suggestion to challenge and re-classify the inbox item with a user hint.
 * Triggers Stage 2 re-run with additional context.
 */
export interface ChallengeSuggestion extends BaseSuggestion {
	readonly action: "challenge";

	/** User hint for re-classification (REQUIRED) */
	readonly hint: string;
}

/**
 * Union type for all suggestion types.
 * Discriminated by the `action` field for type-safe pattern matching.
 *
 * Use type guards to narrow to specific suggestion types:
 * - isCreateNoteSuggestion(s)
 * - isMoveSuggestion(s)
 * - isRenameSuggestion(s)
 * - isLinkSuggestion(s)
 * - isSkipSuggestion(s)
 * - isChallengeSuggestion(s)
 */
export type InboxSuggestion =
	| CreateNoteSuggestion
	| MoveSuggestion
	| RenameSuggestion
	| LinkSuggestion
	| SkipSuggestion
	| ChallengeSuggestion;

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if a suggestion is a create-note suggestion.
 */
export function isCreateNoteSuggestion(
	s: InboxSuggestion,
): s is CreateNoteSuggestion {
	return s.action === "create-note";
}

/**
 * Type guard to check if a suggestion is a move suggestion.
 */
export function isMoveSuggestion(s: InboxSuggestion): s is MoveSuggestion {
	return s.action === "move";
}

/**
 * Type guard to check if a suggestion is a rename suggestion.
 */
export function isRenameSuggestion(s: InboxSuggestion): s is RenameSuggestion {
	return s.action === "rename";
}

/**
 * Type guard to check if a suggestion is a link suggestion.
 */
export function isLinkSuggestion(s: InboxSuggestion): s is LinkSuggestion {
	return s.action === "link";
}

/**
 * Type guard to check if a suggestion is a skip suggestion.
 */
export function isSkipSuggestion(s: InboxSuggestion): s is SkipSuggestion {
	return s.action === "skip";
}

/**
 * Type guard to check if a suggestion is a challenge suggestion.
 */
export function isChallengeSuggestion(
	s: InboxSuggestion,
): s is ChallengeSuggestion {
	return s.action === "challenge";
}

/**
 * Result from a single processor (PDF, markdown, image).
 */
export interface ProcessorResult {
	/** Which processor ran */
	readonly processor: string;

	/** Number of items found and scanned */
	readonly itemsScanned: number;

	/** Suggestions generated */
	readonly suggestions: InboxSuggestion[];

	/** Errors encountered during processing */
	readonly errors: ReadonlyArray<{ file: string; error: string }>;
}

/**
 * Aggregated result from the orchestrator (all processors).
 */
export interface OrchestratorResult {
	readonly summary: {
		readonly totalItems: number;
		readonly suggestions: number;
		readonly byProcessor: Record<string, number>;
		readonly byConfidence: { high: number; medium: number; low: number };
	};
	readonly suggestions: InboxSuggestion[];
}

// =============================================================================
// Confidence Thresholds (Constants)
// =============================================================================

/**
 * Confidence threshold constants for classification decisions.
 * These define the boundaries between confidence levels.
 */
export const CONFIDENCE_THRESHOLDS = {
	/** Minimum confidence for HIGH classification (LLM ≥90% or LLM+heuristic agreement) */
	HIGH: 0.9,
	/** Minimum confidence for MEDIUM classification (LLM ≥70%) */
	MEDIUM: 0.7,
	/** Minimum confidence for heuristic-only classification */
	HEURISTIC_MIN: 0.5,
	/** Minimum confidence for heuristic MEDIUM classification */
	HEURISTIC_MEDIUM: 0.8,
} as const;

// =============================================================================
// Execution Types
// =============================================================================

/**
 * Base fields for all scan progress updates.
 */
interface ScanProgressBase {
	/** 1-based index of current file */
	readonly index: number;

	/** Total files being scanned */
	readonly total: number;

	/** Inbox filename (no path) */
	readonly filename: string;
}

/**
 * Progress update when file processing starts.
 * Emitted before any work begins on a file.
 */
export interface StartProgress extends ScanProgressBase {
	readonly stage: "start";
}

/**
 * Progress update during hash calculation stage.
 */
export interface HashingProgress extends ScanProgressBase {
	readonly stage: "hash";
}

/**
 * Progress update during content extraction stage.
 */
export interface ExtractingProgress extends ScanProgressBase {
	readonly stage: "extract";
}

/**
 * Progress update during LLM classification stage.
 */
export interface LLMProgress extends ScanProgressBase {
	readonly stage: "llm";
	/** LLM model being used (required during llm stage) */
	readonly model: string;
	/** True if this is a fallback model (Claude failed, using Ollama) */
	readonly isFallback?: boolean;
	/** Reason for fallback (e.g., "Limit reached", "Timeout") */
	readonly fallbackReason?: string;
}

/**
 * Progress update during bookmark enrichment stage.
 */
export interface EnrichProgress extends ScanProgressBase {
	readonly stage: "enrich";
}

/**
 * Progress update when file is skipped (already processed).
 */
export interface SkippedProgress extends ScanProgressBase {
	readonly stage: "skip";
}

/**
 * Progress update when file processing completes successfully.
 */
export interface DoneProgress extends ScanProgressBase {
	readonly stage: "done";
	/** Running count of LLM failures (for detecting service unavailability) */
	readonly llmFailures?: number;
	/** LLM error message if classification failed */
	readonly llmError?: string;
	/** Actual LLM model used (may differ from requested if fallback) */
	readonly llmModelUsed?: string;
	/** True if fallback model was used instead of primary */
	readonly llmFallbackUsed?: boolean;
}

/**
 * Progress update when file processing fails.
 */
export interface ErrorProgress extends ScanProgressBase {
	readonly stage: "error";
	/** Error message describing the failure (required for error stage) */
	readonly error: string;
}

/**
 * Progress update emitted during scanning for user feedback.
 * Discriminated union based on `stage` field for type-safe handling.
 *
 * Each stage has its specific required fields:
 * - start: Just base fields (emitted when file processing begins)
 * - hash: Just base fields
 * - extract: Just base fields
 * - llm: Requires `model` field
 * - skip: Just base fields
 * - done: Optional `llmFailures` count
 * - error: Requires `error` message
 */
export type ScanProgress =
	| StartProgress
	| HashingProgress
	| ExtractingProgress
	| EnrichProgress
	| LLMProgress
	| SkippedProgress
	| DoneProgress
	| ErrorProgress;

/**
 * Options for scanning the inbox.
 */
export interface ScanOptions {
	/**
	 * Optional progress callback invoked per file and stage.
	 * Useful for updating CLI spinners/status lines.
	 */
	readonly onProgress?: (progress: ScanProgress) => void | Promise<void>;

	/**
	 * Optional session-level correlation ID to link scan → execute operations.
	 * If provided, will be logged alongside the operation-level CID.
	 * If omitted, a new session CID will be generated.
	 */
	readonly sessionCid?: string;
}

/**
 * Base fields for all execution results.
 */
interface ExecutionResultBase {
	/** ID of the suggestion that was executed */
	readonly suggestionId: SuggestionId;

	/** Action that was attempted */
	readonly action: InboxAction;
}

/**
 * Successful execution result.
 * Contains paths to created/moved files.
 */
export interface SuccessfulExecutionResult extends ExecutionResultBase {
	readonly success: true;

	/** Path to created note (if action was create-note) */
	readonly createdNote?: string;

	/** Path to moved attachment (if applicable) */
	readonly movedAttachment?: string;

	/** Source path for git staging when files are moved */
	readonly movedFrom?: string;

	/** Warning message if operation partially succeeded */
	readonly warning?: string;
}

/**
 * Failed execution result.
 * Contains error message describing the failure.
 */
export interface FailedExecutionResult extends ExecutionResultBase {
	readonly success: false;

	/** Error message describing why execution failed (required for failures) */
	readonly error: string;
}

/**
 * Result of executing a single suggestion.
 * Discriminated union based on `success` field for type-safe error handling.
 *
 * Use pattern matching to handle success/failure:
 * ```typescript
 * if (result.success) {
 *   // TypeScript knows createdNote exists here
 *   console.log(result.createdNote);
 * } else {
 *   // TypeScript knows error is defined here
 *   console.error(result.error);
 * }
 * ```
 */
export type ExecutionResult = SuccessfulExecutionResult | FailedExecutionResult;

/**
 * Result of batch execution with fault isolation.
 * Allows partial success - some suggestions can fail while others succeed.
 */
export interface BatchResult {
	/** Successfully executed suggestions */
	readonly successful: ExecutionResult[];
	/** Failed suggestions with their errors */
	readonly failed: ReadonlyMap<SuggestionId, Error>;
	/** Summary counts */
	readonly summary: {
		readonly total: number;
		readonly succeeded: number;
		readonly failed: number;
	};
}

/**
 * Progress update emitted during execution for user feedback.
 */
export interface ExecuteProgress {
	/** Number of items processed so far (1-based) */
	readonly processed: number;

	/** Total items requested */
	readonly total: number;

	/** Suggestion ID being processed */
	readonly suggestionId: SuggestionId;

	/** Action being executed */
	readonly action: InboxAction;

	/** Whether the individual execution succeeded */
	readonly success: boolean;

	/** Error message when execution failed */
	readonly error?: string;

	/** Progress percentage (0-100) */
	readonly percentComplete: number;

	/** Running success rate (0-1) calculated from successful executions so far */
	readonly runningSuccessRate?: number;

	/** Estimated time remaining in milliseconds */
	readonly etaMs?: number;
}

/**
 * Options for executing suggestions.
 */
export interface ExecuteOptions {
	/**
	 * Optional progress callback invoked after each item.
	 * Useful for updating CLI spinners/status lines.
	 */
	readonly onProgress?: (progress: ExecuteProgress) => void | Promise<void>;

	/**
	 * Map of area names (lowercase) to their full vault paths.
	 * Used to resolve area names from LLM suggestions to actual paths.
	 */
	readonly areaPathMap?: Map<string, string>;

	/**
	 * Map of project names (lowercase) to their full vault paths.
	 * Used to resolve project names from LLM suggestions to actual paths.
	 */
	readonly projectPathMap?: Map<string, string>;

	/**
	 * Map of suggestion IDs to CLI-modified suggestions.
	 * When present, these take precedence over the engine's internal cache.
	 * This allows the CLI to modify suggestions (e.g., accept LLM destination)
	 * and have those modifications respected during execution.
	 */
	readonly updatedSuggestions?: Map<string, InboxSuggestion>;

	/**
	 * Optional session-level correlation ID to link scan → execute operations.
	 * If provided, will be logged alongside the operation-level CID.
	 * If omitted, a new session CID will be generated.
	 */
	readonly sessionCid?: string;
}

// =============================================================================
// Registry Types (Idempotency)
// =============================================================================

/**
 * Registry schema version for migration support.
 * Increment when making breaking changes to ProcessedRegistry structure.
 */
export enum RegistryVersion {
	/** Initial version with basic item tracking */
	V1 = 1,
	// V2 = 2, // Future: Add migration metadata
}

/** Migration record for tracking schema updates */
export interface MigrationRecord {
	readonly fromVersion: RegistryVersion;
	readonly toVersion: RegistryVersion;
	readonly migratedAt: string; // ISO 8601 timestamp
	readonly itemsAffected: number;
}

/** Optional metadata for registry migrations */
export interface RegistryMetadata {
	readonly lastMigration?: string; // ISO 8601 timestamp
	readonly migrationHistory?: readonly MigrationRecord[];
}

/**
 * Record of a processed item for idempotency tracking.
 */
export interface ProcessedItem {
	/** SHA256 hash of original file content */
	readonly sourceHash: string;

	/** Original path (for reference) */
	readonly sourcePath: string;

	/** ISO timestamp of when it was processed */
	readonly processedAt: string;

	/** Path to created note (if any) */
	readonly createdNote?: string;

	/** Path to moved attachment (if any) */
	readonly movedAttachment?: string;

	/** Flag indicating note is orphaned in staging (Layer 4 cleanup marker) */
	readonly orphanedInStaging?: boolean;

	/** Flag indicating operation is still in progress (Layer 2 tracking) */
	readonly inProgress?: boolean;
}

/**
 * Registry file format for tracking processed items.
 * Stored at .inbox-processed.json in vault root.
 */
export interface ProcessedRegistry {
	/** Schema version for migrations */
	readonly version: RegistryVersion;

	/** All processed items */
	readonly items: readonly ProcessedItem[];

	/** Optional metadata for registry migrations */
	readonly metadata?: RegistryMetadata;
}

// =============================================================================
// Engine Types
// =============================================================================

/**
 * Result metadata from an LLM call with fallback information.
 */
export interface LLMCallResultMetadata {
	/** The LLM response text */
	readonly response: string;
	/** The actual model that was used */
	readonly modelUsed: string;
	/** True if a fallback model was used instead of the primary */
	readonly isFallback: boolean;
	/** Reason for fallback (only set if isFallback is true) */
	readonly fallbackReason?: string;
}

/**
 * LLM client function signature for classification.
 * Takes a prompt, provider, and optional model override.
 * Returns the LLM response as a string.
 */
export type LLMClientFunction = (
	prompt: string,
	provider: string,
	model?: string,
) => Promise<string>;

/**
 * LLM client function signature with metadata about fallback.
 * Takes a prompt, provider, and optional model override.
 * Returns the LLM response with metadata about which model was used.
 */
export type LLMClientWithMetadataFunction = (
	prompt: string,
	provider: string,
	model?: string,
) => Promise<LLMCallResultMetadata>;

/**
 * Configuration for the inbox engine.
 */
export interface InboxEngineConfig {
	/** Path to the Obsidian vault */
	readonly vaultPath: string;

	/** Inbox folder name (default: "00 Inbox") */
	readonly inboxFolder?: string;

	/** Attachments folder name (default: "Attachments") */
	readonly attachmentsFolder?: string;

	/** Templates folder name (default: "Templates") */
	readonly templatesFolder?: string;

	/** LLM provider to use (default: "haiku") */
	readonly llmProvider?: string;

	/** LLM model override */
	readonly llmModel?: string;

	/**
	 * Optional LLM client function for dependency injection.
	 * If provided, this will be used instead of the default callLLM.
	 * Useful for testing with fast mock responses.
	 */
	readonly llmClient?: LLMClientFunction;

	/** Concurrency limits */
	readonly concurrency?: {
		/** Max concurrent PDF extractions (default: 5) */
		readonly pdfExtraction?: number;
		/** Max concurrent LLM calls (default: 3) */
		readonly llmCalls?: number;
		/** Max concurrent file I/O operations (default: 10) */
		readonly fileIO?: number;
	};
}

/**
 * The main engine interface for inbox processing.
 * Implementations should be stateless - all state passed via config.
 */
export interface InboxEngine {
	/**
	 * Scan the inbox and generate suggestions for all items.
	 * Does NOT execute anything - just returns suggestions.
	 */
	scan(options?: ScanOptions): Promise<InboxSuggestion[]>;

	/**
	 * Re-process a suggestion with additional user instructions.
	 * Used for the interactive "e3 'put in Health area'" command.
	 *
	 * @param id - Suggestion ID to edit
	 * @param prompt - User's additional instructions
	 * @returns Updated suggestion
	 */
	editWithPrompt(id: SuggestionId, prompt: string): Promise<InboxSuggestion>;

	/**
	 * Challenge a suggestion and re-classify with a user hint.
	 * Preserves the previous classification for audit trail.
	 *
	 * This is the formal way to dispute an LLM classification.
	 * The hint should explain why the current classification is wrong
	 * (e.g., "This is actually a Medicare invoice, not a generic medical bill").
	 *
	 * @param id - Suggestion ID to challenge
	 * @param hint - User's hint for re-classification
	 * @returns Updated suggestion with previousClassification populated
	 */
	challenge(id: SuggestionId, hint: string): Promise<InboxSuggestion>;

	/**
	 * Execute approved suggestions (create notes, move attachments).
	 *
	 * @param ids - IDs of suggestions to execute
	 * @param options - Optional execution options (progress callbacks)
	 * @returns Batch result with successful executions and failures
	 */
	execute(ids: SuggestionId[], options?: ExecuteOptions): Promise<BatchResult>;

	/**
	 * Generate a markdown report of suggestions.
	 * Used for CI/nightly mode reporting.
	 *
	 * @param suggestions - Suggestions to include in report
	 * @returns Markdown formatted report
	 */
	generateReport(suggestions: InboxSuggestion[]): string;
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error category for classification and handling.
 */
export type ErrorCategory =
	| "dependency" // External tool/service unavailable
	| "extraction" // Failed to read/parse file content
	| "detection" // LLM failed to classify or extract
	| "validation" // Data doesn't meet requirements
	| "execution" // Failed to create note/move file
	| "registry" // Failed to read/write tracking registry
	| "user" // Invalid user input/command
	| "system"; // Unexpected internal error

/**
 * Error codes for specific error conditions.
 */
export type ErrorCode =
	// Dependency errors
	| "DEP_PDFTOTEXT_MISSING"
	| "DEP_LLM_UNAVAILABLE"
	| "DEP_LLM_RATE_LIMITED"
	// Extraction errors
	| "EXT_PDF_CORRUPT"
	| "EXT_PDF_EMPTY"
	| "EXT_PDF_TIMEOUT"
	| "EXT_PDF_TOO_LARGE"
	// Detection errors
	| "DET_TYPE_UNKNOWN"
	| "DET_TYPE_AMBIGUOUS"
	| "DET_FIELDS_INCOMPLETE"
	| "DET_LLM_PARSE_FAILED"
	// Validation errors
	| "VAL_VAULT_NOT_FOUND"
	| "VAL_PARA_FOLDER_MISSING"
	| "VAL_AREA_NOT_FOUND"
	| "VAL_PROJECT_NOT_FOUND"
	| "VAL_TEMPLATE_MISSING"
	| "VAL_DUPLICATE_NOTE"
	// Execution errors
	| "EXE_NOTE_CREATE_FAILED"
	| "EXE_ATTACHMENT_MOVE_FAILED"
	| "EXE_PERMISSION_DENIED"
	// Registry errors
	| "REG_READ_FAILED"
	| "REG_WRITE_FAILED"
	| "REG_CORRUPT"
	// User errors
	| "USR_INVALID_COMMAND"
	| "USR_INVALID_ITEM_ID"
	| "USR_EDIT_PROMPT_EMPTY"
	// System errors
	| "SYS_UNEXPECTED";

/**
 * Context information for error debugging and logging.
 */
export interface ErrorContext {
	/** File being processed when error occurred */
	readonly source?: string;

	/** Suggestion ID if applicable */
	readonly itemId?: SuggestionId;

	/** Operation being attempted */
	readonly operation?: string;

	/** Correlation ID for log tracing */
	readonly cid: string;

	/** Additional context data */
	readonly [key: string]: unknown;
}

// =============================================================================
// Timing Metrics
// =============================================================================

/**
 * Per-file timing breakdown for performance analysis.
 * Tracks duration of each processing stage to identify bottlenecks.
 */
export interface FileTimingMetrics {
	/** Filename without path */
	readonly filename: string;

	/** Per-stage timings in milliseconds */
	readonly stages: {
		/** Content hash calculation */
		readonly hash?: { readonly durationMs: number };
		/** Content extraction (PDF, markdown, image) */
		readonly extract?: { readonly durationMs: number };
		/** Bookmark enrichment (Firecrawl API) */
		readonly enrich?: { readonly durationMs: number };
		/** LLM classification call */
		readonly llm?: { readonly durationMs: number };
	};

	/** Total processing time for this file (sum of all stages) */
	readonly totalMs: number;
}

// =============================================================================
// CLI Types
// =============================================================================

/**
 * Options for the process-inbox CLI command.
 */
export interface ProcessInboxOptions {
	/** Auto-execute HIGH confidence items without prompting */
	readonly auto?: boolean;

	/** Show suggestions only, no interactive loop */
	readonly preview?: boolean;

	/** Show what would be executed without actually doing it */
	readonly dryRun?: boolean;

	/** Enable debug logging */
	readonly verbose?: boolean;

	/** Output format: "json" or "markdown" */
	readonly format?: "json" | "markdown";

	/** File pattern filter (e.g., "*.pdf") */
	readonly filter?: string;

	/** Force re-process items in registry */
	readonly force?: boolean;
}

/**
 * Parsed command from interactive CLI.
 *
 * All user interactions are represented as typed commands.
 * This ensures consistent validation and handling across the CLI.
 */
export type CLICommand =
	| { type: "execute" } // Execute approved items (Enter key when items approved)
	| { type: "approve-all" } // Approve all visible items (lowercase 'a')
	| { type: "approve-remaining" } // Approve all non-skipped items across all pages (uppercase 'A')
	| { type: "approve"; ids: number[] }
	| { type: "accept-suggestion"; id: number } // Accept LLM suggestion for item (y<n>)
	| { type: "set-destination"; id: number; path: string } // Set custom destination (d<n> <path>)
	| { type: "edit"; id: number; prompt: string }
	| { type: "skip"; id: number }
	| { type: "view"; id: number }
	| { type: "undo" }
	| { type: "next-page" }
	| { type: "prev-page" }
	| { type: "list-all" } // Show all items with status (approved/skipped/pending)
	| { type: "quit" }
	| { type: "help" }
	| { type: "invalid"; input: string };

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validates InboxEngineConfig for runtime safety.
 * Ensures required directories exist and concurrency limits are valid.
 */
export function validateInboxEngineConfig(
	config: InboxEngineConfig,
): InboxEngineConfig {
	// Validate that required directories exist
	if (!config.vaultPath || typeof config.vaultPath !== "string") {
		throw new Error(
			"InboxEngineConfig: vaultPath is required and must be a string",
		);
	}

	// Validate concurrency limits
	if (config.concurrency) {
		const { concurrency } = config;
		if (
			concurrency.pdfExtraction !== undefined &&
			concurrency.pdfExtraction <= 0
		) {
			throw new Error(
				"InboxEngineConfig: concurrency.pdfExtraction must be positive",
			);
		}
		if (concurrency.llmCalls !== undefined && concurrency.llmCalls <= 0) {
			throw new Error(
				"InboxEngineConfig: concurrency.llmCalls must be positive",
			);
		}
		if (concurrency.fileIO !== undefined && concurrency.fileIO <= 0) {
			throw new Error("InboxEngineConfig: concurrency.fileIO must be positive");
		}
	}

	return config;
}
