/**
 * Classifier Validator
 *
 * Validates classifier configurations for correctness and completeness.
 * Ensures all required fields are present and valid before code generation.
 *
 * @module classifiers/validator
 */

import type { InboxConverter } from "./types";

/**
 * Validation result for a classifier configuration
 */
export interface ClassifierValidationResult {
	/** Whether the classifier is valid */
	readonly isValid: boolean;
	/** Error messages for critical issues (prevent code generation) */
	readonly errors: readonly string[];
	/** Warning messages for potential issues (allow code generation) */
	readonly warnings: readonly string[];
}

/**
 * Validate classifier configuration.
 *
 * Checks for:
 * - Valid ID format (kebab-case)
 * - Priority in valid range (0-100)
 * - At least one heuristic pattern
 * - At least one field definition
 * - Valid schema version
 * - Complete field definitions
 * - Valid scoring configuration
 *
 * @param classifier - Classifier configuration to validate
 * @returns Validation result with errors and warnings
 *
 * @example
 * ```typescript
 * const result = validateClassifier(myClassifier);
 * if (!result.isValid) {
 *   console.error('Validation errors:', result.errors);
 * }
 * ```
 */
export function validateClassifier(
	classifier: InboxConverter,
): ClassifierValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Validate ID format (kebab-case)
	if (!/^[a-z][a-z0-9-]*$/.test(classifier.id)) {
		errors.push(
			`Classifier ID '${classifier.id}' must be kebab-case (lowercase, hyphens only)`,
		);
	}

	// Validate priority range
	if (classifier.priority < 0 || classifier.priority > 100) {
		errors.push(`Priority must be between 0-100 (got: ${classifier.priority})`);
	}

	// Validate schema version
	if (classifier.schemaVersion < 1) {
		errors.push(
			`Schema version must be >= 1 (got: ${classifier.schemaVersion})`,
		);
	}

	// Validate heuristics
	const filenameCount = classifier.heuristics.filenamePatterns.length;
	const contentCount = classifier.heuristics.contentMarkers.length;

	if (filenameCount === 0 && contentCount === 0) {
		errors.push("Classifier must have at least one heuristic pattern");
	}

	if (filenameCount === 0) {
		warnings.push(
			"No filename patterns defined - classifier will only match via content",
		);
	}

	if (contentCount === 0) {
		warnings.push(
			"No content markers defined - classifier will only match via filename",
		);
	}

	// Validate pattern weights
	for (const pattern of classifier.heuristics.filenamePatterns) {
		if (pattern.weight < 0 || pattern.weight > 1) {
			errors.push(
				`Filename pattern '${pattern.pattern}' has invalid weight: ${pattern.weight} (must be 0.0-1.0)`,
			);
		}
	}

	for (const pattern of classifier.heuristics.contentMarkers) {
		if (pattern.weight < 0 || pattern.weight > 1) {
			errors.push(
				`Content marker '${pattern.pattern}' has invalid weight: ${pattern.weight} (must be 0.0-1.0)`,
			);
		}
	}

	// Validate fields
	if (classifier.fields.length === 0) {
		errors.push("Classifier must define at least one field");
	}

	for (const field of classifier.fields) {
		// Validate field name (camelCase)
		if (!/^[a-z][a-zA-Z0-9]*$/.test(field.name)) {
			errors.push(
				`Field name '${field.name}' must be camelCase (start with lowercase)`,
			);
		}

		// Validate conditional fields
		if (field.requirement === "conditional") {
			if (!field.conditionalOn) {
				errors.push(
					`Conditional field '${field.name}' must specify 'conditionalOn'`,
				);
			}
			if (!field.conditionalDescription) {
				warnings.push(
					`Conditional field '${field.name}' should have 'conditionalDescription'`,
				);
			}
		}

		// Validate enum fields
		if (field.allowedValues && field.allowedValues.length === 0) {
			warnings.push(
				`Field '${field.name}' has empty allowedValues array (will accept any value)`,
			);
		}
	}

	// Validate extraction config
	if (!classifier.extraction.promptHint) {
		warnings.push(
			"No promptHint defined - LLM may need more context for extraction",
		);
	}

	if (classifier.extraction.keyFields.length === 0) {
		warnings.push(
			"No keyFields defined - confidence scoring may be less accurate",
		);
	}

	// Validate that keyFields reference real fields
	const fieldNames = new Set(classifier.fields.map((f) => f.name));
	for (const keyField of classifier.extraction.keyFields) {
		if (!fieldNames.has(keyField)) {
			errors.push(
				`keyField '${keyField}' references undefined field (available: ${[...fieldNames].join(", ")})`,
			);
		}
	}

	// Validate template config
	if (!classifier.template.name) {
		errors.push("Template name is required");
	}

	// Warn if no field mappings
	const mappingCount = Object.keys(classifier.template.fieldMappings).length;
	if (mappingCount === 0) {
		warnings.push("No field mappings defined - template will have no prompts");
	}

	// Validate scoring config
	const { scoring } = classifier;

	if (scoring.heuristicWeight < 0 || scoring.heuristicWeight > 1) {
		errors.push(
			`heuristicWeight must be 0.0-1.0 (got: ${scoring.heuristicWeight})`,
		);
	}

	if (scoring.llmWeight < 0 || scoring.llmWeight > 1) {
		errors.push(`llmWeight must be 0.0-1.0 (got: ${scoring.llmWeight})`);
	}

	const weightSum = scoring.heuristicWeight + scoring.llmWeight;
	if (Math.abs(weightSum - 1.0) > 0.01) {
		errors.push(
			`heuristicWeight + llmWeight must sum to 1.0 (got: ${weightSum.toFixed(2)})`,
		);
	}

	if (scoring.highThreshold <= scoring.mediumThreshold) {
		errors.push(
			`highThreshold (${scoring.highThreshold}) must be > mediumThreshold (${scoring.mediumThreshold})`,
		);
	}

	return {
		isValid: errors.length === 0,
		errors,
		warnings,
	};
}

/**
 * Validate that a classifier ID is unique in the registry.
 *
 * @param id - Classifier ID to check
 * @param existingIds - Set of existing classifier IDs
 * @returns Error message if ID exists, undefined if unique
 */
export function validateUniqueId(
	id: string,
	existingIds: readonly string[],
): string | undefined {
	if (existingIds.includes(id)) {
		return `Classifier ID '${id}' already exists. Choose a different ID.`;
	}
	return undefined;
}
