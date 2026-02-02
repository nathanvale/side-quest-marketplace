/**
 * Inbox Processing Framework - Error Types
 *
 * Centralized error creation and typing for the inbox processing pipeline.
 * All inbox operations should use these error types for consistency.
 *
 * @module shared/errors
 */

import {
	type ErrorCategory as CoreErrorCategory,
	StructuredError,
} from "@sidequest/core/errors";
import type { ErrorCategory, ErrorCode, ErrorContext } from "../types";

// =============================================================================
// Error Category Mapping
// =============================================================================

/**
 * Map inbox-specific error categories to core error categories.
 */
const CATEGORY_TO_CORE: Record<ErrorCategory, CoreErrorCategory> = {
	dependency: "CONFIGURATION", // External tool/service configuration
	extraction: "INTERNAL", // Failed to read/parse file
	detection: "INTERNAL", // LLM classification failure
	validation: "VALIDATION", // Data validation
	execution: "INTERNAL", // Failed to execute operation
	registry: "INTERNAL", // Registry I/O failure
	user: "VALIDATION", // Invalid user input
	system: "UNKNOWN", // Unexpected error
};

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
		defaultMessage: "PDF contains no text",
	},
	EXT_PDF_TIMEOUT: {
		category: "extraction",
		recoverable: true,
		defaultMessage: "PDF extraction timed out",
	},
	EXT_PDF_TOO_LARGE: {
		category: "extraction",
		recoverable: false,
		defaultMessage: "PDF file is too large",
	},

	// Detection errors
	DET_TYPE_UNKNOWN: {
		category: "detection",
		recoverable: false,
		defaultMessage: "Document type could not be determined",
	},
	DET_TYPE_AMBIGUOUS: {
		category: "detection",
		recoverable: false,
		defaultMessage: "Multiple document types detected",
	},
	DET_FIELDS_INCOMPLETE: {
		category: "detection",
		recoverable: false,
		defaultMessage: "Required fields could not be extracted",
	},
	DET_LLM_PARSE_FAILED: {
		category: "detection",
		recoverable: true,
		defaultMessage: "LLM response could not be parsed",
	},

	// Validation errors
	VAL_VAULT_NOT_FOUND: {
		category: "validation",
		recoverable: false,
		defaultMessage: "Vault path does not exist",
	},
	VAL_PARA_FOLDER_MISSING: {
		category: "validation",
		recoverable: false,
		defaultMessage: "Required PARA folder missing",
	},
	VAL_AREA_NOT_FOUND: {
		category: "validation",
		recoverable: false,
		defaultMessage: "PARA area not found in vault",
	},
	VAL_PROJECT_NOT_FOUND: {
		category: "validation",
		recoverable: false,
		defaultMessage: "Project not found",
	},
	VAL_TEMPLATE_MISSING: {
		category: "validation",
		recoverable: false,
		defaultMessage: "Note template not found",
	},
	VAL_DUPLICATE_NOTE: {
		category: "validation",
		recoverable: false,
		defaultMessage: "Note with this title already exists",
	},

	// Execution errors
	EXE_NOTE_CREATE_FAILED: {
		category: "execution",
		recoverable: true,
		defaultMessage: "Failed to create note",
	},
	EXE_ATTACHMENT_MOVE_FAILED: {
		category: "execution",
		recoverable: true,
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
		defaultMessage: "Failed to read registry",
	},
	REG_WRITE_FAILED: {
		category: "registry",
		recoverable: true,
		defaultMessage: "Failed to save registry",
	},
	REG_CORRUPT: {
		category: "registry",
		recoverable: false,
		defaultMessage: "Registry file is corrupted",
	},

	// User errors
	USR_INVALID_COMMAND: {
		category: "user",
		recoverable: false,
		defaultMessage: "Invalid command",
	},
	USR_INVALID_ITEM_ID: {
		category: "user",
		recoverable: false,
		defaultMessage: "Invalid item ID",
	},
	USR_EDIT_PROMPT_EMPTY: {
		category: "user",
		recoverable: false,
		defaultMessage: "Edit prompt cannot be empty",
	},

	// System errors
	SYS_UNEXPECTED: {
		category: "system",
		recoverable: false,
		defaultMessage: "Unexpected error occurred",
	},
};

// =============================================================================
// Error Class
// =============================================================================

/**
 * Structured error for inbox processing operations.
 *
 * Extends the core StructuredError with inbox-specific error codes and categories.
 * The inbox category is preserved for backward compatibility, while the core
 * category is used for generic error handling.
 */
export class InboxError extends StructuredError {
	/**
	 * Inbox-specific error code (e.g., "DEP_PDFTOTEXT_MISSING").
	 */
	public override readonly code: ErrorCode;

	/**
	 * Inbox-specific error category for domain-specific handling.
	 */
	public readonly inboxCategory: ErrorCategory;

	/**
	 * Inbox-specific error context with required cid field.
	 */
	public override readonly context: ErrorContext;

	constructor(
		message: string,
		code: ErrorCode,
		category: ErrorCategory,
		recoverable: boolean,
		context: ErrorContext,
	) {
		// Map inbox category to core category
		const coreCategory = CATEGORY_TO_CORE[category];

		super(message, coreCategory, code, recoverable, context);
		this.name = "InboxError";
		this.code = code;
		this.inboxCategory = category;
		this.context = context;

		// Capture stack trace for V8 engines
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, InboxError);
		}
	}

	/**
	 * Convert to plain object for serialization/logging.
	 *
	 * Preserves the inbox-specific category for backward compatibility.
	 */
	override toJSON(): {
		name: string;
		message: string;
		category: import("@sidequest/core/errors").ErrorCategory;
		code: string;
		recoverable: boolean;
		context: Record<string, unknown>;
		stack?: string;
		cause?: {
			name: string;
			message: string;
			stack?: string;
		};
		inboxCategory: ErrorCategory;
	} {
		const base = super.toJSON();
		return {
			...base,
			inboxCategory: this.inboxCategory,
		};
	}
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create an inbox error with proper metadata.
 *
 * @param code - Error code
 * @param context - Error context
 * @param customMessage - Optional custom message (uses default if not provided)
 * @returns InboxError instance
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
 * Check if an error is an InboxError.
 */
export function isInboxError(error: unknown): error is InboxError {
	return error instanceof InboxError;
}

/**
 * Check if an error is recoverable (can be retried).
 */
export function isRecoverableError(error: unknown): boolean {
	return isInboxError(error) && error.recoverable;
}
