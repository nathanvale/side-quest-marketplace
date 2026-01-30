/**
 * Frontmatter parsing, validation, and manipulation utilities.
 *
 * This module provides comprehensive tools for working with YAML frontmatter
 * in Markdown notes, including:
 * - Parsing and serializing frontmatter
 * - Validating against type-specific rules
 * - Updating/editing frontmatter fields
 * - Template version migration
 * - Bulk migration operations
 *
 * Frontmatter is the YAML block at the start of Markdown files, delimited
 * by `---` markers. This is standard in Obsidian and many static site generators.
 *
 * @module frontmatter
 */

// =============================================================================
// Types
// =============================================================================

export type {
	ApplyVersionPlanOptions,
	ApplyVersionPlanResult,
	BulkValidationFileResult,
	BulkValidationResult,
	BulkValidationSummary,
	// Parse types
	FrontmatterParseResult,
	ListOptions,
	MigrateAllOptions,
	// Migration types
	MigrateTemplateOptions,
	MigrateTemplateResult,
	MigrationContext,
	MigrationFn,
	MigrationHooks,
	MigrationResult,
	// Pre-write filter types
	PreWriteFilterResult,
	// Update types
	UpdateFrontmatterOptions,
	UpdateFrontmatterResult,
	// Validation types
	ValidationIssue,
	ValidationResult,
	VersionPlan,
	VersionPlanEntry,
	VersionPlanOptions,
	VersionPlanStatus,
} from "./types";

// =============================================================================
// Parse Functions
// =============================================================================

export { parseFrontmatter, serializeFrontmatter } from "./parse";

// =============================================================================
// Validation Functions
// =============================================================================

export {
	filterFieldsForWrite,
	readFrontmatterFile,
	validateFrontmatter,
	validateFrontmatterBulk,
	validateFrontmatterFile,
} from "./validate";

// =============================================================================
// Update Functions
// =============================================================================

export { updateFrontmatterFile } from "./update";

// =============================================================================
// Migration Functions
// =============================================================================

export {
	applyVersionPlan,
	migrateAllTemplateVersions,
	migrateTemplateVersion,
	planTemplateVersionBump,
} from "./migrate";
