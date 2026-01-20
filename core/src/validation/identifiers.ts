/**
 * Identifier validation utilities for kebab-case, camelCase, and template names.
 *
 * Provides path traversal protection and naming convention enforcement
 * for user-provided identifiers used in file generation and code paths.
 *
 * @module validation/identifiers
 */

import { basename, normalize } from "node:path";

/**
 * Validate classifier ID (kebab-case, no path traversal).
 *
 * Ensures IDs are safe for filesystem use and follow kebab-case naming
 * conventions. Prevents path traversal attacks and reserved name collisions.
 *
 * @param id - Classifier ID to validate
 * @returns Sanitized classifier ID
 * @throws Error if ID is invalid
 *
 * @example
 * ```ts
 * const id = validateClassifierId('medical-bill'); // ✅ OK
 * validateClassifierId('medical_bill'); // ❌ Error: must be kebab-case
 * validateClassifierId('../secrets'); // ❌ Error: path traversal
 * validateClassifierId('index'); // ❌ Error: reserved name
 * ```
 */
export function validateClassifierId(id: string): string {
	// Prevent path traversal - check before normalization
	if (id.includes("..") || id.includes("/") || id.includes("\\")) {
		throw new Error(`Path traversal not allowed in classifier ID: ${id}`);
	}

	const clean = basename(normalize(id));

	// Prevent reserved names (check before kebab-case validation)
	const reserved = ["index", "types", "defaults", "_template"];
	if (reserved.includes(clean)) {
		throw new Error(`Reserved classifier ID: ${clean}`);
	}

	// Validate kebab-case
	if (!/^[a-z][a-z0-9-]*$/.test(clean)) {
		throw new Error(`Invalid classifier ID: must be kebab-case (got: ${id})`);
	}

	return clean;
}

/**
 * Validate field name (camelCase, no special chars).
 *
 * Ensures field names follow JavaScript naming conventions and are safe
 * for use in object properties and code generation.
 *
 * @param name - Field name to validate
 * @returns Validated field name
 * @throws Error if name is invalid
 *
 * @example
 * ```ts
 * const name = validateFieldName('dateOfService'); // ✅ OK
 * validateFieldName('totalAmount123'); // ✅ OK
 * validateFieldName('date-of-service'); // ❌ Error: must be camelCase
 * validateFieldName('date of service'); // ❌ Error: no spaces
 * validateFieldName('DateOfService'); // ❌ Error: must start with lowercase
 * ```
 */
export function validateFieldName(name: string): string {
	// Must start with lowercase letter, then letters/numbers only
	if (!/^[a-z][a-zA-Z0-9]*$/.test(name)) {
		throw new Error(`Invalid field name: must be camelCase (got: ${name})`);
	}
	return name;
}

/**
 * Validate template name (kebab-case, no path traversal).
 *
 * Ensures template names are safe for filesystem use and follow kebab-case
 * naming conventions. Similar to validateClassifierId but without reserved
 * name checks.
 *
 * @param name - Template name to validate
 * @returns Sanitized template name
 * @throws Error if name is invalid
 *
 * @example
 * ```ts
 * const name = validateTemplateName('medical-bill'); // ✅ OK
 * validateTemplateName('invoice-v2'); // ✅ OK
 * validateTemplateName('../secrets'); // ❌ Error: path traversal
 * validateTemplateName('Medical-Bill'); // ❌ Error: must be lowercase
 * ```
 */
export function validateTemplateName(name: string): string {
	// Prevent path traversal - check before normalization
	if (name.includes("..") || name.includes("/") || name.includes("\\")) {
		throw new Error(`Path traversal not allowed in template name: ${name}`);
	}

	const clean = basename(normalize(name));

	// Validate kebab-case
	if (!/^[a-z][a-z0-9-]*$/.test(clean)) {
		throw new Error(`Invalid template name: must be kebab-case (got: ${name})`);
	}

	return clean;
}
