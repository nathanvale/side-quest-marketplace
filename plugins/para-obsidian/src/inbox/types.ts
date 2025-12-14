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
 * Create a branded suggestion ID from a UUID string.
 * Use this when generating new IDs or converting from external sources.
 */
export function createSuggestionId(uuid: string): SuggestionId {
	return uuid as SuggestionId;
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
// Execution Types
// =============================================================================

/**
 * Progress update emitted during scanning for user feedback.
 */
export interface ScanProgress {
	/** 1-based index of current file */
	readonly index: number;

	/** Total files being scanned */
	readonly total: number;

	/** Inbox filename (no path) */
	readonly filename: string;

	/** Current stage of processing */
	readonly stage: "hash" | "extract" | "llm" | "skip" | "done" | "error";

	/** Optional error message for failed stage */
	readonly error?: string;
}

/**
 * Options for scanning the inbox.
 */
export interface ScanOptions {
	/**
	 * Optional progress callback invoked per file and stage.
	 * Useful for updating CLI spinners/status lines.
	 */
	readonly onProgress?: (progress: ScanProgress) => void | Promise<void>;
}

/**
 * Result of executing a single suggestion.
 */
export interface ExecutionResult {
	/** ID of the suggestion that was executed */
	readonly suggestionId: SuggestionId;

	/** Whether execution succeeded */
	readonly success: boolean;

	/** Action that was attempted */
	readonly action: InboxAction;

	/** Path to created note (if action was create-note) */
	readonly createdNote?: string;

	/** Path to moved attachment (if applicable) */
	readonly movedAttachment?: string;

	/** Error message if execution failed */
	readonly error?: string;

	/** Warning message if operation partially succeeded */
	readonly warning?: string;
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
	 * @returns Results for each execution
	 */
	execute(
		ids: SuggestionId[],
		options?: ExecuteOptions,
	): Promise<ExecutionResult[]>;

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
 */
export type CLICommand =
	| { type: "approve-all" }
	| { type: "approve"; ids: number[] }
	| { type: "edit"; id: number; prompt: string }
	| { type: "skip"; id: number }
	| { type: "quit" }
	| { type: "help" }
	| { type: "invalid"; input: string };
