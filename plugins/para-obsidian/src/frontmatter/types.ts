/**
 * Type definitions for frontmatter operations.
 *
 * @module frontmatter/types
 */

import type {
	FieldRule,
	FrontmatterRules,
	ParaObsidianConfig,
} from "../config/index";

// =============================================================================
// Parse Types
// =============================================================================

/**
 * Result of parsing frontmatter from Markdown content.
 */
export interface FrontmatterParseResult {
	/** Parsed YAML frontmatter as key-value pairs. Empty object if no frontmatter. */
	readonly attributes: Record<string, unknown>;
	/** Markdown body content (everything after the closing ---). */
	readonly body: string;
}

// =============================================================================
// Validation Types
// =============================================================================

/**
 * Describes a single validation issue found in frontmatter.
 */
export interface ValidationIssue {
	/** The frontmatter field that failed validation. */
	readonly field: string;
	/** Human-readable description of the validation failure. */
	readonly message: string;
}

/**
 * Result of validating frontmatter against rules.
 */
export interface ValidationResult {
	/** True if all validation rules passed. */
	readonly valid: boolean;
	/** List of validation issues found. Empty if valid. */
	readonly issues: ReadonlyArray<ValidationIssue>;
}

/**
 * Issue information for a single file in bulk validation results.
 */
export interface BulkValidationFileResult {
	/** Vault-relative path to the file. */
	readonly file: string;
	/** Note type from frontmatter (if present). */
	readonly type?: string;
	/** Whether the file passed validation. */
	readonly valid: boolean;
	/** List of validation issues found. Empty if valid. */
	readonly errors: ReadonlyArray<ValidationIssue>;
}

/**
 * Summary statistics for bulk validation results.
 */
export interface BulkValidationSummary {
	/** Total files validated. */
	readonly total: number;
	/** Files that passed validation. */
	readonly valid: number;
	/** Files that failed validation. */
	readonly invalid: number;
	/** Files skipped (no type field). */
	readonly skipped: number;
	/** Files that had errors during validation. */
	readonly errors: number;
	/** Stats broken down by note type. */
	readonly byType: Record<
		string,
		{ total: number; valid: number; invalid: number }
	>;
}

/**
 * Complete result of bulk frontmatter validation.
 */
export interface BulkValidationResult {
	/** Summary statistics for the validation run. */
	readonly summary: BulkValidationSummary;
	/** Per-file validation results (legacy alias for files). */
	readonly issues: ReadonlyArray<BulkValidationFileResult>;
	/** Per-file validation results. */
	readonly files: ReadonlyArray<BulkValidationFileResult>;
	/** Error messages for files that failed to process. */
	readonly errors: ReadonlyArray<{ file: string; error: string }>;
}

// =============================================================================
// Pre-Write Filter Types
// =============================================================================

/**
 * Result of filtering frontmatter fields before writing.
 *
 * Categorizes each field as accepted, skipped-unknown, skipped-invalid,
 * or skipped-forbidden based on the note type's schema rules.
 * Enables AI agents to self-correct by reporting exactly why fields were rejected.
 */
export interface PreWriteFilterResult {
	/** Fields that passed validation and will be written. */
	readonly accepted: Record<string, unknown>;
	/** Fields not defined in the schema for this note type. */
	readonly skippedUnknown: ReadonlyArray<{ field: string; reason: string }>;
	/** Fields defined in schema but with invalid values (wrong type/enum). */
	readonly skippedInvalid: ReadonlyArray<{ field: string; reason: string }>;
	/** Fields explicitly forbidden for this note type. */
	readonly skippedForbidden: ReadonlyArray<{ field: string; reason: string }>;
	/** True when all input fields were accepted (no skips). */
	readonly allAccepted: boolean;
	/** The note type used for filtering (undefined if type couldn't be determined). */
	readonly noteType: string | undefined;
}

// =============================================================================
// Update Types
// =============================================================================

/**
 * Options for updating frontmatter fields.
 */
export interface UpdateFrontmatterOptions {
	/** Fields to set or update. Values will overwrite existing fields. */
	readonly set?: Record<string, unknown>;
	/** Field names to remove from frontmatter. */
	readonly unset?: ReadonlyArray<string>;
	/** If true, report changes without writing to disk. */
	readonly dryRun?: boolean;
	/** When provided, filters set fields against the note type's schema before writing. */
	readonly preWriteFilter?: {
		readonly config: ParaObsidianConfig;
		readonly noteType: string | undefined;
	};
}

/**
 * Result of a frontmatter update operation.
 */
export interface UpdateFrontmatterResult {
	/** Vault-relative path to the updated file. */
	readonly relative: string;
	/** Whether this was a dry-run (no actual changes made). */
	readonly dryRun: boolean;
	/** Whether changes would be made (true even in dry-run mode). */
	readonly wouldChange: boolean;
	/** Whether changes were actually written to disk. */
	readonly updated: boolean;
	/** Human-readable descriptions of changes made. */
	readonly changes: ReadonlyArray<string>;
	/** Before/after snapshots of the frontmatter attributes. */
	readonly attributes: {
		readonly before: Record<string, unknown>;
		readonly after: Record<string, unknown>;
	};
	/** Pre-write filter result when filtering was applied. */
	readonly filtered?: PreWriteFilterResult;
}

// =============================================================================
// Migration Types
// =============================================================================

/**
 * Options for template version migration.
 */
export interface MigrateTemplateOptions {
	/** Force migration to a specific version (overrides config). */
	readonly forceVersion?: number;
	/** If true, report changes without writing to disk. */
	readonly dryRun?: boolean;
	/** Custom migration hooks to transform content during version bump. */
	readonly migrate?: MigrationHooks;
}

/**
 * Options for listing files recursively.
 */
export interface ListOptions {
	/** Directory or directories to scan. */
	readonly dir?: string | ReadonlyArray<string>;
}

/**
 * Options for bulk template version migration.
 */
export interface MigrateAllOptions {
	/** Directory or directories to scan. Defaults to vault root. */
	readonly dir?: string | ReadonlyArray<string>;
	/** If true, report changes without writing to disk. */
	readonly dryRun?: boolean;
	/** Custom migration hooks to apply during version bumps. */
	readonly migrate?: MigrationHooks;
	/** Force all notes to a specific version (overrides config). */
	readonly forceVersion?: number;
	/** Only migrate notes of this type (e.g., "project"). */
	readonly type?: string;
}

/**
 * Options for planning a template version bump.
 */
export interface VersionPlanOptions {
	/** Note type to plan migration for (e.g., "project"). */
	readonly type: string;
	/** Target version to migrate notes to. */
	readonly toVersion: number;
	/** Directory or directories to scan. Defaults to vault root. */
	readonly dir?: string | ReadonlyArray<string>;
}

/**
 * Status categories for notes in a migration plan.
 *
 * - "missing-type": Note has no type field in frontmatter
 * - "missing-version": Note has type but no template_version
 * - "outdated": Note version is below target (needs migration)
 * - "current": Note is already at target version
 * - "ahead": Note version is above target (newer than expected)
 * - "type-mismatch": Note is a different type than requested
 */
export type VersionPlanStatus =
	| "missing-type"
	| "missing-version"
	| "outdated"
	| "current"
	| "ahead"
	| "type-mismatch";

/**
 * Entry for a single file in a version migration plan.
 */
export interface VersionPlanEntry {
	/** Vault-relative path to the file. */
	readonly file: string;
	/** Actual note type from frontmatter (if present). */
	readonly type?: string;
	/** Current template version (if present). */
	readonly current?: number;
	/** Target version for migration. */
	readonly target: number;
	/** Status category for this entry. */
	readonly status: VersionPlanStatus;
}

/**
 * Summary of a template version migration plan.
 *
 * Provides counts and details for planning bulk migrations,
 * allowing users to preview what would be affected.
 */
export interface VersionPlan {
	/** Note type being planned for (e.g., "project"). */
	readonly type: string;
	/** Target version for migration. */
	readonly targetVersion: number;
	/** Total files scanned. */
	readonly total: number;
	/** Files matching the target type. */
	readonly matches: number;
	/** Files without a type field. */
	readonly missingType: number;
	/** Files with type but missing template_version. */
	readonly missingVersion: number;
	/** Files below target version (need migration). */
	readonly outdated: number;
	/** Files above target version (newer than expected). */
	readonly ahead: number;
	/** Files already at target version. */
	readonly current: number;
	/** Files with different type than requested. */
	readonly typeMismatch: number;
	/** Directories that were scanned. */
	readonly dirs: ReadonlyArray<string>;
	/** Detailed entries for each file scanned. */
	readonly entries: ReadonlyArray<VersionPlanEntry>;
	/** Aggregated stats keyed by actual note type encountered. */
	readonly perType: Record<
		string,
		{
			readonly total: number;
			readonly missingVersion: number;
			readonly outdated: number;
			readonly ahead: number;
			readonly current: number;
		}
	>;
}

/**
 * Options for applying a version migration plan.
 */
export interface ApplyVersionPlanOptions {
	readonly plan:
		| VersionPlan
		| {
				readonly entries: ReadonlyArray<VersionPlanEntry>;
				readonly type: string;
				readonly targetVersion: number;
				readonly dirs?: ReadonlyArray<string>;
		  };
	readonly dryRun?: boolean;
	readonly migrate?: MigrationHooks;
	readonly statuses?: ReadonlyArray<VersionPlanStatus>;
	readonly dirs?: ReadonlyArray<string>;
}

/**
 * Result of applying a version migration plan.
 */
export interface ApplyVersionPlanResult {
	readonly dryRun: boolean;
	readonly updated: number;
	readonly wouldUpdate: number;
	readonly skipped: number;
	readonly errors: number;
	readonly changes: Array<{ file: string; changes: ReadonlyArray<string> }>;
	readonly selected: ReadonlyArray<VersionPlanEntry>;
	readonly results: Array<MigrateTemplateResult & { error?: string }>;
}

/**
 * Result of a single template migration.
 */
export interface MigrateTemplateResult {
	relative: string;
	fromVersion?: number;
	toVersion: number;
	updated: boolean;
	wouldChange: boolean;
	dryRun: boolean;
	changes?: ReadonlyArray<string>;
}

/**
 * Context provided to migration hook functions.
 */
export interface MigrationContext {
	/** Current frontmatter attributes. */
	readonly attributes: Record<string, unknown>;
	/** Current Markdown body. */
	readonly body: string;
	/** Source version being migrated from. */
	readonly from?: number;
	/** Target version being migrated to. */
	readonly to: number;
}

/**
 * Result returned by a migration hook function.
 * Contains the transformed note content.
 */
export interface MigrationResult {
	/** Transformed frontmatter attributes. */
	readonly attributes: Record<string, unknown>;
	/** Transformed Markdown body. */
	readonly body: string;
	/** Human-readable descriptions of changes made. */
	readonly changes?: ReadonlyArray<string>;
}

/**
 * A migration function that transforms a note from one version to another.
 *
 * @param ctx - Migration context with current note state
 * @returns Transformed note content and change descriptions
 */
export type MigrationFn = (ctx: MigrationContext) => MigrationResult;

/**
 * Registry of migration hooks organized by type and version transitions.
 *
 * Structure: `{ [type]: { [fromVersion]: { [toVersion]: MigrationFn } } }`
 *
 * @example
 * ```typescript
 * const MIGRATIONS: MigrationHooks = {
 *   project: {
 *     1: { 2: projectV1ToV2 },  // Migrate project from v1 to v2
 *     2: { 3: projectV2ToV3 }   // Migrate project from v2 to v3
 *   }
 * };
 * ```
 */
export type MigrationHooks = Record<
	string,
	Partial<Record<number, Partial<Record<number, MigrationFn>>>>
>;

// Re-export config types for convenience
export type { FieldRule, FrontmatterRules, ParaObsidianConfig };
