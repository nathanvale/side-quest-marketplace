/**
 * Inbox Processing Framework - Error Taxonomy
 *
 * Provides structured error handling with:
 * - Error codes for specific conditions
 * - Categories for handling strategies
 * - Recoverable flag for retry logic
 * - User-friendly messages for terminal display
 */

import type { ErrorCategory, ErrorCode, ErrorContext } from "./types";

// =============================================================================
// Error Metadata Mapping
// =============================================================================

interface ErrorMetadata {
	readonly category: ErrorCategory;
	readonly recoverable: boolean;
	readonly defaultMessage: string;
}

/**
 * Mapping of error codes to their metadata.
 * This is the source of truth for error classification.
 */
const ERROR_METADATA: Record<ErrorCode, ErrorMetadata> = {
	// Dependency errors
	DEP_PDFTOTEXT_MISSING: {
		category: "dependency",
		recoverable: false,
		defaultMessage: "pdftotext CLI not found",
	},
	DEP_LLM_UNAVAILABLE: {
		category: "dependency",
		recoverable: false,
		defaultMessage: "LLM provider not available",
	},
	DEP_LLM_RATE_LIMITED: {
		category: "dependency",
		recoverable: true,
		defaultMessage: "LLM API rate limit exceeded",
	},

	// Extraction errors
	EXT_PDF_CORRUPT: {
		category: "extraction",
		recoverable: false,
		defaultMessage: "PDF file is corrupted",
	},
	EXT_PDF_EMPTY: {
		category: "extraction",
		recoverable: false,
		defaultMessage: "PDF has no extractable text",
	},
	EXT_PDF_TIMEOUT: {
		category: "extraction",
		recoverable: true,
		defaultMessage: "PDF extraction timed out",
	},
	EXT_PDF_TOO_LARGE: {
		category: "extraction",
		recoverable: false,
		defaultMessage: "PDF exceeds size limit",
	},

	// Detection errors
	DET_TYPE_UNKNOWN: {
		category: "detection",
		recoverable: false,
		defaultMessage: "Could not determine document type",
	},
	DET_TYPE_AMBIGUOUS: {
		category: "detection",
		recoverable: false,
		defaultMessage: "Multiple document types equally likely",
	},
	DET_FIELDS_INCOMPLETE: {
		category: "detection",
		recoverable: false,
		defaultMessage: "Required fields could not be extracted",
	},
	DET_LLM_PARSE_FAILED: {
		category: "detection",
		recoverable: true,
		defaultMessage: "LLM response was not valid JSON",
	},

	// Validation errors
	VAL_AREA_NOT_FOUND: {
		category: "validation",
		recoverable: false,
		defaultMessage: "Suggested area not found in vault",
	},
	VAL_PROJECT_NOT_FOUND: {
		category: "validation",
		recoverable: false,
		defaultMessage: "Suggested project not found in vault",
	},
	VAL_TEMPLATE_MISSING: {
		category: "validation",
		recoverable: false,
		defaultMessage: "Template for note type not found",
	},
	VAL_DUPLICATE_NOTE: {
		category: "validation",
		recoverable: false,
		defaultMessage: "Note with same title already exists",
	},

	// Execution errors
	EXE_NOTE_CREATE_FAILED: {
		category: "execution",
		recoverable: false,
		defaultMessage: "Failed to create note",
	},
	EXE_ATTACHMENT_MOVE_FAILED: {
		category: "execution",
		recoverable: false,
		defaultMessage: "Failed to move attachment",
	},
	EXE_PERMISSION_DENIED: {
		category: "execution",
		recoverable: false,
		defaultMessage: "Permission denied",
	},

	// Registry errors
	REG_READ_FAILED: {
		category: "registry",
		recoverable: true,
		defaultMessage: "Could not read processed registry",
	},
	REG_WRITE_FAILED: {
		category: "registry",
		recoverable: true,
		defaultMessage: "Could not update processed registry",
	},
	REG_CORRUPT: {
		category: "registry",
		recoverable: true,
		defaultMessage: "Processed registry is malformed",
	},

	// User errors
	USR_INVALID_COMMAND: {
		category: "user",
		recoverable: true,
		defaultMessage: "Unrecognized command",
	},
	USR_INVALID_ITEM_ID: {
		category: "user",
		recoverable: true,
		defaultMessage: "Item ID not found",
	},
	USR_EDIT_PROMPT_EMPTY: {
		category: "user",
		recoverable: true,
		defaultMessage: "Edit command requires a prompt",
	},

	// System errors
	SYS_UNEXPECTED: {
		category: "system",
		recoverable: false,
		defaultMessage: "An unexpected error occurred",
	},
};

// =============================================================================
// User-Friendly Messages
// =============================================================================

/**
 * User-friendly messages for terminal display.
 * These provide actionable guidance for each error condition.
 */
export const USER_MESSAGES: Record<ErrorCode, string> = {
	// Dependency errors
	DEP_PDFTOTEXT_MISSING:
		"pdftotext not found. Install with: brew install poppler",
	DEP_LLM_UNAVAILABLE:
		"LLM provider not configured. Check your API key and settings.",
	DEP_LLM_RATE_LIMITED: "Rate limited by LLM API. Waiting before retry...",

	// Extraction errors
	EXT_PDF_CORRUPT: "PDF file is corrupted and cannot be read.",
	EXT_PDF_EMPTY: "PDF has no text content to extract.",
	EXT_PDF_TIMEOUT: "PDF extraction timed out. Try again or check file size.",
	EXT_PDF_TOO_LARGE: "PDF exceeds maximum size limit.",

	// Detection errors
	DET_TYPE_UNKNOWN:
		"Could not determine document type. Try 'e{n} \"hint\"' to provide context.",
	DET_TYPE_AMBIGUOUS:
		"Multiple document types possible. Use 'e{n} \"hint\"' to clarify.",
	DET_FIELDS_INCOMPLETE:
		"Some required fields could not be extracted from the document.",
	DET_LLM_PARSE_FAILED: "LLM returned invalid response. Retrying...",

	// Validation errors
	VAL_AREA_NOT_FOUND:
		"Suggested area not found in vault. Check spelling or create it first.",
	VAL_PROJECT_NOT_FOUND:
		"Suggested project not found in vault. Check spelling or create it first.",
	VAL_TEMPLATE_MISSING:
		"No template found for this note type. Create the template first.",
	VAL_DUPLICATE_NOTE:
		"A note with this title already exists. Choose a different title.",

	// Execution errors
	EXE_NOTE_CREATE_FAILED: "Failed to create note. Check file permissions.",
	EXE_ATTACHMENT_MOVE_FAILED:
		"Failed to move attachment. Check if source file exists.",
	EXE_PERMISSION_DENIED:
		"Permission denied. Check file and folder permissions.",

	// Registry errors
	REG_READ_FAILED:
		"Could not read tracking registry. Processing will continue without idempotency protection.",
	REG_WRITE_FAILED:
		"Could not save to tracking registry. Re-running may process duplicates.",
	REG_CORRUPT:
		"Tracking registry is corrupted. Delete .inbox-processed.json to reset.",

	// User errors
	USR_INVALID_COMMAND: "Unknown command. Type 'h' for help or 'q' to quit.",
	USR_INVALID_ITEM_ID: "Item number not found. Check the list above.",
	USR_EDIT_PROMPT_EMPTY:
		'Edit command requires instructions. Example: e3 "put in Health area"',

	// System errors
	SYS_UNEXPECTED:
		"An unexpected error occurred. Please report this issue with the log output.",
};

// =============================================================================
// InboxError Class
// =============================================================================

/**
 * Custom error class for inbox processing errors.
 * Includes structured metadata for handling and logging.
 */
export class InboxError extends Error {
	public readonly code: ErrorCode;
	public readonly category: ErrorCategory;
	public readonly recoverable: boolean;
	public readonly context: ErrorContext;

	constructor(
		message: string,
		code: ErrorCode,
		category: ErrorCategory,
		recoverable: boolean,
		context: ErrorContext,
	) {
		super(message);
		this.name = "InboxError";
		this.code = code;
		this.category = category;
		this.recoverable = recoverable;
		this.context = context;

		// Maintains proper stack trace for where error was thrown
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, InboxError);
		}
	}

	/**
	 * Get the user-friendly message for this error.
	 */
	getUserMessage(): string {
		return USER_MESSAGES[this.code];
	}
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create an InboxError with automatic metadata lookup.
 *
 * @param code - Error code
 * @param context - Error context (must include cid)
 * @param customMessage - Optional custom message (defaults to code's default)
 */
export function createInboxError(
	code: ErrorCode,
	context: ErrorContext,
	customMessage?: string,
): InboxError {
	const metadata = ERROR_METADATA[code];
	const message = customMessage ?? metadata.defaultMessage;

	return new InboxError(
		message,
		code,
		metadata.category,
		metadata.recoverable,
		context,
	);
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if an error is a dependency error (external tool/service unavailable).
 */
export function isDependencyError(error: InboxError): boolean {
	return error.category === "dependency";
}

/**
 * Check if an error is recoverable (can be retried).
 */
export function isRecoverableError(error: InboxError): boolean {
	return error.recoverable;
}

/**
 * Check if an error is a user input error.
 */
export function isUserError(error: InboxError): boolean {
	return error.category === "user";
}

/**
 * Check if an error is a system/unexpected error.
 */
export function isSystemError(error: InboxError): boolean {
	return error.category === "system";
}

/**
 * Check if any error is an InboxError.
 */
export function isInboxError(error: unknown): error is InboxError {
	return error instanceof InboxError;
}
