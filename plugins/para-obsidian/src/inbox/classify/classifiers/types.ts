/**
 * Classifier Types
 *
 * Core type definitions for the inbox classifier system.
 * These types define the structure of document classifiers.
 *
 * @module classifiers/types
 */

/**
 * Pattern for heuristic matching (filename or content)
 */
export interface HeuristicPattern {
	/** Regex pattern string */
	readonly pattern: string;
	/** Weight for scoring (0.0 to 1.0) */
	readonly weight: number;
}

/**
 * Requirement level for extracted fields.
 * More expressive than boolean for validation logic.
 */
export type RequirementLevel =
	| "required" // Must be present for valid extraction
	| "optional" // Nice to have, extraction succeeds without it
	| "conditional"; // Required only in certain contexts

/**
 * Field definition for LLM extraction
 */
export interface FieldDefinition {
	/** Field name (camelCase, used as LLM extraction key) */
	readonly name: string;
	/** Field type for validation */
	readonly type: "string" | "date" | "currency" | "number";
	/** Human-readable description for LLM prompt */
	readonly description: string;
	/** Requirement level for this field */
	readonly requirement: RequirementLevel;
	/** For conditional fields: what condition must be met */
	readonly conditionalOn?: string;
	/** Human-readable description of the condition */
	readonly conditionalDescription?: string;
	/** Valid values for string fields (enables enum-like validation) */
	readonly allowedValues?: readonly string[];
	/** Validation pattern for additional constraints */
	readonly validationPattern?: string;
}

/**
 * Heuristic configuration for document detection
 */
export interface HeuristicConfig {
	/** Patterns to match against filename */
	readonly filenamePatterns: readonly HeuristicPattern[];
	/** Patterns to match against document content */
	readonly contentMarkers: readonly HeuristicPattern[];
	/** Minimum score to activate this converter (default: 0.3) */
	readonly threshold?: number;
}

/**
 * LLM extraction configuration
 */
export interface ExtractionConfig {
	/** Hint text to include in LLM prompt */
	readonly promptHint: string;
	/** Fields that boost confidence when successfully extracted */
	readonly keyFields: readonly string[];
}

/**
 * Template mapping configuration
 */
export interface TemplateConfig {
	/** Template filename without .md extension */
	readonly name: string;
	/** Maps LLM field names to Templater prompt text */
	readonly fieldMappings: Readonly<Record<string, string>>;
}

/**
 * Confidence scoring configuration
 */
export interface ScoringConfig {
	/** Weight for heuristic score (0.0 to 1.0, default: 0.3) */
	readonly heuristicWeight: number;
	/** Weight for LLM score (0.0 to 1.0, default: 0.7) */
	readonly llmWeight: number;
	/** Threshold for HIGH confidence (default: 0.85) */
	readonly highThreshold: number;
	/** Threshold for MEDIUM confidence (default: 0.6) */
	readonly mediumThreshold: number;
}

/**
 * Source of truth strategy for document processing.
 *
 * - "markdown": Content is extracted and embedded in note body (Type A)
 *   - User edits markdown directly
 *   - Original file is archived/deleted
 *   - Export back to DOCX via pandoc when needed
 *
 * - "binary": Original file remains source of truth (Type B)
 *   - Note contains metadata + attachment reference
 *   - Edit the original file, not the note
 */
export type SourceOfTruth = "markdown" | "binary";

/**
 * Complete inbox converter configuration.
 * Defines how to detect, extract, and create notes for a document type.
 *
 * @remarks Schema versioning enables future migrations when converter structure changes.
 * Increment version when making breaking changes to converter configuration.
 */
export interface InboxConverter {
	/**
	 * Schema version for migration support.
	 * Current version: 1
	 * Increment when making breaking changes to converter structure.
	 */
	readonly schemaVersion: number;
	/** Unique identifier (e.g., 'invoice', 'booking') */
	readonly id: string;
	/** Human-readable name for display */
	readonly displayName: string;
	/** Whether this converter is active */
	readonly enabled: boolean;
	/** Priority for matching (higher = checked first, range: 0-100) */
	readonly priority: number;
	/**
	 * Source of truth strategy for this document type.
	 * - "markdown": Extract content to note body, archive original (Type A)
	 * - "binary": Keep attachment as source, note is metadata (Type B)
	 * @default "binary"
	 */
	readonly sourceOfTruth?: SourceOfTruth;
	/** Heuristic detection configuration */
	readonly heuristics: HeuristicConfig;
	/** Field definitions for LLM extraction */
	readonly fields: readonly FieldDefinition[];
	/** LLM extraction configuration */
	readonly extraction: ExtractionConfig;
	/** Template creation configuration */
	readonly template: TemplateConfig;
	/** Confidence scoring configuration */
	readonly scoring: ScoringConfig;
}

/**
 * Result of finding a matching converter
 */
export interface ConverterMatch {
	/** The matched converter */
	readonly converter: InboxConverter;
	/** Combined heuristic score (0.0 to 1.0) */
	readonly score: number;
}

/**
 * Field validation result
 */
export interface FieldValidationResult {
	/** Whether the field value is valid */
	readonly isValid: boolean;
	/** Error message if validation failed */
	readonly error?: string;
	/** Normalized value after validation */
	readonly normalizedValue?: string;
}

/**
 * Validates a field value against its definition constraints
 *
 * @param value - The value to validate
 * @param field - The field definition with constraints
 * @returns Validation result with error details if invalid
 */
export function validateFieldValue(
	value: string | undefined,
	field: FieldDefinition,
): FieldValidationResult {
	// Handle undefined/empty values
	if (!value || value.trim() === "") {
		if (field.requirement === "required") {
			return {
				isValid: false,
				error: `Field '${field.name}' is required but was empty`,
			};
		}
		return { isValid: true };
	}

	const trimmedValue = value.trim();

	// Validate against allowed values
	if (field.allowedValues && field.allowedValues.length > 0) {
		if (!field.allowedValues.includes(trimmedValue)) {
			return {
				isValid: false,
				error: `Field '${field.name}' must be one of: ${field.allowedValues.join(", ")}. Got: '${trimmedValue}'`,
			};
		}
	}

	// Validate against pattern
	if (field.validationPattern) {
		const pattern = new RegExp(field.validationPattern);
		if (!pattern.test(trimmedValue)) {
			return {
				isValid: false,
				error: `Field '${field.name}' does not match required pattern: ${field.validationPattern}`,
			};
		}
	}

	// Type-specific validation
	switch (field.type) {
		case "date":
			if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
				return {
					isValid: false,
					error: `Field '${field.name}' must be a valid date in YYYY-MM-DD format. Got: '${trimmedValue}'`,
				};
			}
			break;
		case "currency":
		case "number": {
			const numValue = Number(trimmedValue);
			if (Number.isNaN(numValue)) {
				return {
					isValid: false,
					error: `Field '${field.name}' must be a valid number. Got: '${trimmedValue}'`,
				};
			}
			break;
		}
	}

	return {
		isValid: true,
		normalizedValue: trimmedValue,
	};
}

/**
 * Configuration for generating a new classifier
 */
export interface ClassifierConfig {
	readonly id: string;
	readonly displayName: string;
	readonly description: string;
	readonly priority: number;
	readonly defaultArea?: string;
	readonly filenamePatterns: readonly string[];
	readonly contentMarkers: readonly string[];
	readonly fields: readonly FieldDefinition[];
	readonly promptHint: string;
	readonly keyFields: readonly string[];
	readonly templateName: string;
	readonly fieldMappings: Readonly<Record<string, string>>;
	readonly scoring: ScoringConfig;
}

/**
 * Result of detecting existing template (discriminated union)
 */
export type TemplateDetectionResult =
	| {
			readonly exists: true;
			readonly path: string;
			readonly content: string;
	  }
	| { readonly exists: false; readonly suggestedPath: string };

/**
 * User choice for template handling (discriminated union)
 */
export type TemplateChoice =
	| { readonly action: "use-existing" }
	| {
			readonly action: "create-new";
			readonly suffix?: string;
			readonly mode: "basic" | "rich";
	  }
	| { readonly action: "skip" };

/**
 * Registry modification patch
 */
export interface RegistryPatch {
	readonly importStatement: string;
	readonly exportStatement: string;
	readonly insertionIndex: number;
	readonly camelCaseName: string;
}

/**
 * Atomic rollback operation
 */
export interface RollbackOperation {
	readonly name: string;
	readonly execute: () => Promise<unknown>;
	readonly rollback: (result?: unknown) => Promise<void>;
}
