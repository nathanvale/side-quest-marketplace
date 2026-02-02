/**
 * Frontmatter validation utilities.
 *
 * @module frontmatter/validate
 */

import path from "node:path";
import { globFilesSync } from "@side-quest/core/glob";
import { getErrorMessage } from "@side-quest/core/utils";

import type {
	FieldRule,
	FrontmatterRules,
	ParaObsidianConfig,
} from "../config/index";
import { getManagedFolders } from "../git/index";
import { readFile, resolveVaultPath } from "../shared/fs";
import { parseFrontmatter } from "./parse";
import type {
	BulkValidationFileResult,
	BulkValidationResult,
	PreWriteFilterResult,
	ValidationIssue,
	ValidationResult,
} from "./types";

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Checks if a value looks like an ISO date string.
 * Matches patterns like "2024-01-15" or "2024-01-15T10:30:00".
 */
function isDateLike(value: unknown): boolean {
	if (typeof value !== "string") return false;
	return /^\d{4}-\d{2}-\d{2}/.test(value);
}

/** Type guard to check if a value is an array. */
function isArray(value: unknown): value is ReadonlyArray<unknown> {
	return Array.isArray(value);
}

/**
 * Format a value for display in error messages.
 * Truncates long values and shows type information.
 */
function formatValueForError(value: unknown): string {
	if (value === null) return "null";
	if (value === undefined) return "undefined";
	const type = typeof value;
	if (type === "string") {
		const str = value as string;
		return str.length > 50 ? `"${str.slice(0, 47)}..."` : `"${str}"`;
	}
	if (type === "number" || type === "boolean") return String(value);
	if (Array.isArray(value)) return `array[${value.length}]`;
	return type;
}

/**
 * Validates a single field value against its rule.
 *
 * @param field - Field name (for error messages)
 * @param value - The value to validate
 * @param rule - Validation rule defining expected type/constraints
 * @returns ValidationIssue if invalid, undefined if valid
 */
function validateField(
	field: string,
	value: unknown,
	rule: FieldRule,
): ValidationIssue | undefined {
	const optionalHint = rule.optional ? " (or omit if not applicable)" : "";

	switch (rule.type) {
		case "string": {
			if (typeof value !== "string") {
				return {
					field,
					message: `expected string, got ${formatValueForError(value)}${optionalHint}`,
				};
			}
			// Check pattern if provided
			if (rule.pattern) {
				try {
					const regex = new RegExp(rule.pattern);
					if (!regex.test(value)) {
						return {
							field,
							message: `must match pattern ${rule.pattern}, got ${formatValueForError(value)}${optionalHint}`,
						};
					}
				} catch (_error) {
					// Invalid regex pattern - this is a configuration error
					return {
						field,
						message: `invalid pattern in validation rule: ${rule.pattern}`,
					};
				}
			}
			return undefined;
		}
		case "number": {
			if (typeof value !== "number") {
				return {
					field,
					message: `expected number, got ${formatValueForError(value)}${optionalHint}`,
				};
			}
			return undefined;
		}
		case "date": {
			if (typeof value !== "string" || !isDateLike(value)) {
				return {
					field,
					message: `expected date (YYYY-MM-DD), got ${formatValueForError(value)}${optionalHint}`,
				};
			}
			return undefined;
		}
		case "array": {
			if (!isArray(value)) {
				return {
					field,
					message: `expected array, got ${formatValueForError(value)}${optionalHint}`,
				};
			}
			return undefined;
		}
		case "wikilink": {
			if (
				typeof value !== "string" ||
				!value.startsWith("[[") ||
				!value.endsWith("]]")
			) {
				return {
					field,
					message: `expected wikilink [[...]], got ${formatValueForError(value)}${optionalHint}`,
				};
			}
			return undefined;
		}
		case "enum": {
			if (typeof value !== "string" || !rule.enum?.includes(value)) {
				return {
					field,
					message: `expected one of [${rule.enum?.join(", ") ?? ""}], got ${formatValueForError(value)}${optionalHint}`,
				};
			}
			return undefined;
		}
		case "boolean": {
			if (typeof value !== "boolean") {
				return {
					field,
					message: `expected boolean, got ${formatValueForError(value)}${optionalHint}`,
				};
			}
			return undefined;
		}
		default:
			return { field, message: "unknown rule" };
	}
}

// =============================================================================
// Pre-Write Field Filtering
// =============================================================================

/**
 * Fields managed by the template/system layer that bypass schema filtering.
 * These are always accepted regardless of note type rules.
 */
const SYSTEM_MANAGED_FIELDS = new Set([
	"title",
	"type",
	"created",
	"template_version",
]);

/**
 * Filters fields against a note type's schema before writing.
 *
 * Categorizes each field as accepted, unknown, invalid, or forbidden.
 * When no rules exist for the note type (or noteType is undefined),
 * all fields are accepted for backward compatibility.
 *
 * @param fields - Key-value pairs to filter
 * @param noteType - The note's type (from frontmatter `type` field)
 * @param config - Para-obsidian config containing frontmatterRules
 * @returns Categorized result with accepted fields and skip reasons
 *
 * @example
 * ```typescript
 * const result = filterFieldsForWrite(
 *   { status: 'completed', foobar: 'oops' },
 *   'project',
 *   config,
 * );
 * // result.accepted: { status: 'completed' }
 * // result.skippedUnknown: [{ field: 'foobar', reason: '...' }]
 * ```
 */
export function filterFieldsForWrite(
	fields: Record<string, unknown>,
	noteType: string | undefined,
	config: ParaObsidianConfig,
): PreWriteFilterResult {
	const rules = noteType ? config.frontmatterRules?.[noteType] : undefined;

	// No rules for this note type → accept everything (backward compat)
	if (!rules) {
		return {
			accepted: { ...fields },
			skippedUnknown: [],
			skippedInvalid: [],
			skippedForbidden: [],
			allAccepted: true,
			noteType,
		};
	}

	// Build known fields from rules.required keys
	const knownFields = new Set(
		rules.required ? Object.keys(rules.required) : [],
	);
	const forbiddenFields = new Set(rules.forbidden ?? []);

	const accepted: Record<string, unknown> = {};
	const skippedUnknown: Array<{ field: string; reason: string }> = [];
	const skippedInvalid: Array<{ field: string; reason: string }> = [];
	const skippedForbidden: Array<{ field: string; reason: string }> = [];

	for (const [field, value] of Object.entries(fields)) {
		// System-managed fields always pass through
		if (SYSTEM_MANAGED_FIELDS.has(field)) {
			accepted[field] = value;
			continue;
		}

		// Forbidden fields are rejected
		if (forbiddenFields.has(field)) {
			skippedForbidden.push({
				field,
				reason: `field not allowed for type '${noteType}'`,
			});
			continue;
		}

		// Unknown fields (not in schema) are rejected
		if (!knownFields.has(field)) {
			skippedUnknown.push({
				field,
				reason: `not a valid field for type '${noteType}'`,
			});
			continue;
		}

		// Known field: null/undefined means "clear this field" → accept
		if (value === null || value === undefined) {
			accepted[field] = value;
			continue;
		}

		// Validate value against the field rule
		const rule = rules.required?.[field];
		if (!rule) {
			// Should not happen since field is in knownFields, but be safe
			accepted[field] = value;
			continue;
		}

		const issue = validateField(field, value, rule);
		if (issue) {
			skippedInvalid.push({
				field,
				reason: issue.message,
			});
		} else {
			accepted[field] = value;
		}
	}

	const allAccepted =
		skippedUnknown.length === 0 &&
		skippedInvalid.length === 0 &&
		skippedForbidden.length === 0;

	return {
		accepted,
		skippedUnknown,
		skippedInvalid,
		skippedForbidden,
		allAccepted,
		noteType,
	};
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Validates frontmatter attributes against a set of rules.
 *
 * Checks each required field for presence and type conformance.
 * Optional fields are only validated if present.
 *
 * @param attributes - Parsed frontmatter key-value pairs
 * @param rules - Validation rules defining required fields and types
 * @returns Validation result with pass/fail status and any issues
 *
 * @example
 * ```typescript
 * const result = validateFrontmatter(
 *   { title: 'Note', status: 'active' },
 *   { required: { title: { type: 'string' }, status: { type: 'enum', enum: ['active', 'done'] } } }
 * );
 * // { valid: true, issues: [] }
 * ```
 */
export function validateFrontmatter(
	attributes: Record<string, unknown>,
	rules?: FrontmatterRules,
): ValidationResult {
	if (!rules?.required && !rules?.forbidden) {
		return { valid: true, issues: [] };
	}

	const issues: ValidationIssue[] = [];

	// Check required fields
	if (rules?.required) {
		for (const [field, rule] of Object.entries(rules.required)) {
			const value = attributes[field];
			// Check for missing required fields
			if (value === undefined || value === null || value === "") {
				if (!rule.optional) {
					issues.push({ field, message: "is required" });
				}
				continue;
			}

			// Validate field type and constraints
			const issue = validateField(field, value, rule);
			if (issue) issues.push(issue);
		}
	}

	// Check forbidden fields (ignore null or empty string values)
	if (rules?.forbidden) {
		for (const forbiddenField of rules.forbidden) {
			const value = attributes[forbiddenField];
			// Only flag as invalid if field exists AND has a non-null, non-empty value
			if (
				forbiddenField in attributes &&
				value !== null &&
				value !== undefined &&
				value !== ""
			) {
				issues.push({
					field: forbiddenField,
					message: "field not allowed for this note type",
				});
			}
		}
	}

	// Check oneOfRequired constraint (at least one field must have a value)
	if (rules?.oneOfRequired && rules.oneOfRequired.length > 0) {
		const hasAtLeastOne = rules.oneOfRequired.some((fieldName) => {
			const value = attributes[fieldName];
			if (value === undefined || value === null) return false;
			if (typeof value === "string" && value.trim() === "") return false;
			return true;
		});
		if (!hasAtLeastOne) {
			const fieldList = rules.oneOfRequired.join(", ");
			issues.push({
				field: rules.oneOfRequired.join("|"),
				message: `at least one of [${fieldList}] is required`,
			});
		}
	}

	return { valid: issues.length === 0, issues };
}

/**
 * Reads and parses frontmatter from a file in the vault.
 *
 * Combines path resolution, file reading, and frontmatter parsing
 * into a single operation.
 *
 * @param config - Para-obsidian configuration with vault path
 * @param filePath - Path to file (relative to vault or absolute)
 * @returns Parsed frontmatter, body content, and resolved relative path
 * @throws Error if file doesn't exist or path escapes vault
 *
 * @example
 * ```typescript
 * const { attributes, body, relative } = readFrontmatterFile(config, 'Projects/Note.md');
 * console.log(attributes.title); // 'My Note'
 * ```
 */
export function readFrontmatterFile(
	config: ParaObsidianConfig,
	filePath: string,
): { attributes: Record<string, unknown>; body: string; relative: string } {
	const { relative } = resolveVaultPath(config.vault, filePath);
	const content = readFile(config.vault, relative);
	const { attributes, body } = parseFrontmatter(content);
	return { attributes, body, relative };
}

/**
 * Validates frontmatter in a single file.
 *
 * Combines file reading, frontmatter parsing, and validation against
 * type-specific rules. Also validates template_version and filename format.
 *
 * @param config - Para-obsidian configuration with rules and vault path
 * @param filePath - Path to file (relative to vault or absolute)
 * @returns Validation result with issues, relative path, and parsed attributes
 * @throws Error if file doesn't exist or path escapes vault
 *
 * @example
 * ```typescript
 * const result = validateFrontmatterFile(config, 'Projects/Note.md');
 * if (!result.valid) {
 *   for (const issue of result.issues) {
 *     console.log(`${issue.field}: ${issue.message}`);
 *   }
 * }
 * ```
 */
export function validateFrontmatterFile(
	config: ParaObsidianConfig,
	filePath: string,
): ValidationResult & {
	relative: string;
	attributes: Record<string, unknown>;
} {
	const { attributes, relative } = readFrontmatterFile(config, filePath);
	const type = attributes.type as string | undefined;
	const rules = type ? config.frontmatterRules?.[type] : undefined;
	const result = validateFrontmatter(attributes, rules);

	// Check template version for migration needs
	const versionIssues: ValidationIssue[] = [];
	const expectedVersion =
		typeof type === "string" ? config.templateVersions?.[type] : undefined;
	const templateVersion = attributes.template_version;
	if (expectedVersion !== undefined) {
		if (templateVersion === undefined) {
			versionIssues.push({
				field: "template_version",
				message: `missing (expected ${expectedVersion})`,
			});
		} else if (typeof templateVersion === "number") {
			if (templateVersion < expectedVersion) {
				versionIssues.push({
					field: "template_version",
					message: `outdated (found ${templateVersion}, expected ${expectedVersion})`,
				});
			}
		} else {
			// Invalid type (string, NaN, etc.)
			versionIssues.push({
				field: "template_version",
				message: `invalid type (found ${typeof templateVersion}: ${JSON.stringify(templateVersion)}, expected number)`,
			});
		}
	}

	// Validate filename format
	const filenameIssues: ValidationIssue[] = [];
	const filename = path.basename(relative, ".md");

	// Check for Title Case (each word should start with uppercase)
	const words = filename.split(" ");
	const hasCorrectCase = words.every((word) => {
		if (word.length === 0) return true;
		// Allow emoji prefixes and special chars
		const firstLetter = word.match(/[a-zA-Z]/)?.[0];
		if (!firstLetter) return true; // No letters (e.g., emoji-only)
		return firstLetter === firstLetter.toUpperCase();
	});

	if (!hasCorrectCase) {
		filenameIssues.push({
			field: "filename",
			message: `should use Title Case (found "${filename}")`,
		});
	}

	// Check for invalid filename characters
	const invalidChars = /[/\\:*?"<>|]/;
	if (invalidChars.test(filename)) {
		filenameIssues.push({
			field: "filename",
			message: `contains invalid characters: /\\:*?"<>|`,
		});
	}

	// Check for expected prefix based on note type
	if (type && config.titlePrefixes?.[type]) {
		const expectedPrefix = config.titlePrefixes[type];
		if (!filename.startsWith(expectedPrefix)) {
			filenameIssues.push({
				field: "filename",
				message: `should start with "${expectedPrefix}" for type "${type}"`,
			});
		}
	}

	const issues = [...result.issues, ...versionIssues, ...filenameIssues];
	return { valid: issues.length === 0, issues, relative, attributes };
}

/**
 * Validates frontmatter across multiple files in the vault.
 *
 * Scans directories for Markdown files, validates each file's frontmatter
 * against type-specific rules, and returns structured error data with
 * aggregate statistics.
 *
 * @param config - Para-obsidian configuration with rules and vault path
 * @param options - Validation options
 * @param options.dirs - Directories to scan (defaults to config.defaultSearchDirs)
 * @param options.type - Optional filter to validate only notes of this type
 * @returns Bulk validation result with summary stats and per-file issues
 *
 * @example
 * ```typescript
 * // Validate all files in default search dirs
 * const result = validateFrontmatterBulk(config, {});
 * console.log(`${result.summary.invalid} of ${result.summary.total} files have issues`);
 * ```
 */
export function validateFrontmatterBulk(
	config: ParaObsidianConfig,
	options: {
		readonly dirs?: readonly string[];
		readonly type?: string;
	} = {},
): BulkValidationResult {
	// Determine which directories to scan - use managed folders if not specified
	const dirs =
		options.dirs ??
		config.defaultSearchDirs ??
		Array.from(getManagedFolders(config));
	const resolvedDirs = dirs.map(
		(entry) => resolveVaultPath(config.vault, entry).absolute,
	);

	// Collect all Markdown files from specified directories
	const files = resolvedDirs.flatMap((dir) =>
		globFilesSync("**/*.md", { cwd: dir }),
	);

	// Initialize statistics tracking
	const byType: Record<
		string,
		{ total: number; valid: number; invalid: number }
	> = {};
	const issues: BulkValidationFileResult[] = [];
	let validCount = 0;
	let invalidCount = 0;

	// Validate each file
	for (const file of files) {
		const relative = path.relative(config.vault, file);

		try {
			// Validate the file using existing single-file validation
			const result = validateFrontmatterFile(config, relative);
			const noteType = result.attributes.type as string | undefined;

			// Apply optional type filter
			if (options.type && noteType !== options.type) {
				continue;
			}

			// Update statistics
			if (result.valid) {
				validCount++;
			} else {
				invalidCount++;
			}

			// Track per-type statistics
			const typeKey = noteType ?? "unknown";
			if (!byType[typeKey]) {
				byType[typeKey] = { total: 0, valid: 0, invalid: 0 };
			}
			byType[typeKey].total++;
			if (result.valid) {
				byType[typeKey].valid++;
			} else {
				byType[typeKey].invalid++;
			}

			// Record file result
			issues.push({
				file: relative,
				type: noteType,
				valid: result.valid,
				errors: result.issues,
			});
		} catch (error) {
			// Handle validation errors gracefully
			invalidCount++;
			const typeKey = "error";
			if (!byType[typeKey]) {
				byType[typeKey] = { total: 0, valid: 0, invalid: 0 };
			}
			byType[typeKey].total++;
			byType[typeKey].invalid++;

			issues.push({
				file: relative,
				valid: false,
				errors: [
					{
						field: "_validation",
						message: getErrorMessage(error),
					},
				],
			});
		}
	}

	return {
		summary: {
			total: validCount + invalidCount,
			valid: validCount,
			invalid: invalidCount,
			skipped: 0,
			errors: 0,
			byType,
		},
		issues,
		files: issues,
		errors: [],
	};
}
