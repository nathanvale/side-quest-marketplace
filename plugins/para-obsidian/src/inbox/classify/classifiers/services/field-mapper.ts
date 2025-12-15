/**
 * Field Mapper Service
 *
 * Maps LLM extraction field names to Templater prompt text.
 * Handles field aliasing and generates user-friendly prompt strings.
 *
 * @module classifiers/services/field-mapper
 */

import type { FieldDefinition } from "../types";

/**
 * Generate Templater prompt text for a field.
 *
 * Creates human-readable prompt text based on field definition.
 * Includes type hints and requirement level in the prompt.
 *
 * @param field - Field definition
 * @returns Prompt text for Templater
 *
 * @example
 * ```typescript
 * const field = {
 *   name: 'provider',
 *   type: 'string',
 *   description: 'Medical practice name',
 *   requirement: 'required'
 * };
 * const prompt = generatePromptText(field);
 * // => "Medical practice name"
 * ```
 */
export function generatePromptText(field: FieldDefinition): string {
	// Use description as base prompt text
	let prompt = field.description;

	// Add type hint for dates
	if (field.type === "date") {
		if (!prompt.toLowerCase().includes("yyyy-mm-dd")) {
			prompt += " (YYYY-MM-DD)";
		}
	}

	return prompt;
}

/**
 * Build field mappings from field definitions.
 *
 * Creates a mapping object from LLM field names to Templater prompt text.
 * Automatically adds common aliases (e.g., 'date' → 'statementDate').
 *
 * @param fields - Array of field definitions
 * @returns Field mappings object
 *
 * @example
 * ```typescript
 * const fields = [
 *   { name: 'statementDate', type: 'date', description: 'Statement date', requirement: 'required' },
 *   { name: 'amount', type: 'currency', description: 'Total amount', requirement: 'required' }
 * ];
 * const mappings = buildFieldMappings(fields);
 * // => {
 * //   statementDate: 'Statement date (YYYY-MM-DD)',
 * //   amount: 'Total amount',
 * //   date: 'Statement date (YYYY-MM-DD)',  // Alias
 * //   balance: 'Total amount'               // Alias
 * // }
 * ```
 */
export function buildFieldMappings(
	fields: readonly FieldDefinition[],
): Record<string, string> {
	const mappings: Record<string, string> = {};

	// Primary mappings
	for (const field of fields) {
		mappings[field.name] = generatePromptText(field);
	}

	// Add common aliases
	const statementDate = mappings.statementDate;
	if (statementDate) {
		mappings.date = statementDate;
	}

	const statementBalance = mappings.statementBalance;
	if (statementBalance) {
		mappings.amount = statementBalance;
		mappings.balance = statementBalance;
	}

	const totalAmount = mappings.totalAmount;
	if (totalAmount) {
		mappings.amount = totalAmount;
	}

	return mappings;
}

/**
 * Validate field mappings for completeness.
 *
 * Ensures all required fields have mappings and warns about missing ones.
 *
 * @param fields - Field definitions to validate
 * @param mappings - Field mappings to check
 * @returns Array of validation warnings (empty if valid)
 */
export function validateFieldMappings(
	fields: readonly FieldDefinition[],
	mappings: Readonly<Record<string, string>>,
): string[] {
	const warnings: string[] = [];

	for (const field of fields) {
		if (field.requirement === "required" && !mappings[field.name]) {
			warnings.push(
				`Required field '${field.name}' is missing from field mappings`,
			);
		}
	}

	return warnings;
}
