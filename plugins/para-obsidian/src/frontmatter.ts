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
import fs from "node:fs";
import path from "node:path";

import { parse, stringify } from "yaml";

import type { FieldRule, FrontmatterRules, ParaObsidianConfig } from "./config";
import { readFile, resolveVaultPath } from "./fs";

/**
 * Result of parsing frontmatter from Markdown content.
 */
export interface FrontmatterParseResult {
	/** Parsed YAML frontmatter as key-value pairs. Empty object if no frontmatter. */
	readonly attributes: Record<string, unknown>;
	/** Markdown body content (everything after the closing ---). */
	readonly body: string;
}

/**
 * Parse YAML frontmatter from Markdown content.
 * Returns empty attributes if no frontmatter is present.
 */
export function parseFrontmatter(content: string): FrontmatterParseResult {
	if (!content.startsWith("---")) {
		return { attributes: {}, body: content };
	}

	const end = content.indexOf("\n---", 3);
	if (end === -1) {
		return { attributes: {}, body: content };
	}

	const raw = content.slice(3, end + 1); // include leading newline
	const body = content.slice(end + 4); // skip closing newline and markers

	try {
		const attributes = parse(raw) as Record<string, unknown>;
		return { attributes, body };
	} catch (error) {
		throw new Error(
			error instanceof Error
				? `Invalid frontmatter: ${error.message}`
				: "Invalid frontmatter",
		);
	}
}

/**
 * Serializes frontmatter attributes and body back to Markdown format.
 *
 * Creates a properly formatted Markdown document with YAML frontmatter
 * delimited by `---` markers.
 *
 * @param attributes - Key-value pairs to serialize as YAML
 * @param body - Markdown body content
 * @returns Complete Markdown document with frontmatter
 *
 * @example
 * ```typescript
 * const md = serializeFrontmatter({ title: 'Note', tags: ['work'] }, '# Content');
 * // '---\ntitle: Note\ntags:\n  - work\n---\n# Content'
 * ```
 */
export function serializeFrontmatter(
	attributes: Record<string, unknown>,
	body: string,
): string {
	const yaml = stringify(attributes).trimEnd();
	return `---\n${yaml}\n---\n${body.replace(/^\n/, "")}`;
}

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
 * Options for updating frontmatter fields.
 */
export interface UpdateFrontmatterOptions {
	/** Fields to set or update. Values will overwrite existing fields. */
	readonly set?: Record<string, unknown>;
	/** Field names to remove from frontmatter. */
	readonly unset?: ReadonlyArray<string>;
	/** If true, report changes without writing to disk. */
	readonly dryRun?: boolean;
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
}

/**
 * Checks if a value looks like an ISO date string.
 * Matches patterns like "2024-01-15" or "2024-01-15T10:30:00".
 */
function isDateLike(value: unknown): boolean {
	if (typeof value !== "string") return false;
	// Simple ISO-ish check: YYYY-MM-DD at minimum
	return /^\d{4}-\d{2}-\d{2}/.test(value);
}

/** Type guard to check if a value is an array. */
function isArray(value: unknown): value is ReadonlyArray<unknown> {
	return Array.isArray(value);
}

/** Checks if an array contains all required values. */
function includesRequired(
	array: ReadonlyArray<unknown>,
	required: ReadonlyArray<string>,
) {
	return required.every((r) => array.includes(r));
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
	switch (rule.type) {
		case "string": {
			if (typeof value !== "string") {
				return { field, message: "must be a string" };
			}
			return undefined;
		}
		case "date": {
			if (typeof value !== "string" || !isDateLike(value)) {
				return { field, message: "must be a date string (YYYY-MM-DD)" };
			}
			return undefined;
		}
		case "array": {
			if (!isArray(value)) {
				return { field, message: "must be an array" };
			}
			if (rule.includes && !includesRequired(value, rule.includes)) {
				return { field, message: `must include: ${rule.includes.join(", ")}` };
			}
			return undefined;
		}
		case "wikilink": {
			if (typeof value !== "string" || !value.startsWith("[[")) {
				return { field, message: "must be a wikilink [[...]]" };
			}
			return undefined;
		}
		case "enum": {
			if (typeof value !== "string" || !rule.enum?.includes(value)) {
				return {
					field,
					message: `must be one of: ${rule.enum?.join(", ") ?? ""}`,
				};
			}
			return undefined;
		}
		default:
			return { field, message: "unknown rule" };
	}
}

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
	if (!rules?.required) {
		return { valid: true, issues: [] };
	}

	const issues: ValidationIssue[] = [];
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
 * Validates a file's frontmatter against type-specific rules.
 *
 * Reads the file, determines its type from frontmatter, and validates
 * against the appropriate rules. Also checks template_version for
 * migration needs.
 *
 * @param config - Para-obsidian configuration with rules
 * @param filePath - Path to file (relative to vault or absolute)
 * @returns Validation result plus file metadata and parsed attributes
 * @throws Error if file doesn't exist or path escapes vault
 *
 * @example
 * ```typescript
 * const result = validateFrontmatterFile(config, 'Projects/Note.md');
 * if (!result.valid) {
 *   console.log('Issues:', result.issues);
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
		} else if (
			typeof templateVersion === "number" &&
			templateVersion < expectedVersion
		) {
			versionIssues.push({
				field: "template_version",
				message: `outdated (found ${templateVersion}, expected ${expectedVersion})`,
			});
		}
	}

	const issues = [...result.issues, ...versionIssues];
	return { valid: issues.length === 0, issues, relative, attributes };
}

/**
 * Updates frontmatter fields in a file.
 *
 * Supports setting new values, updating existing values, and removing fields.
 * Provides before/after comparison and dry-run capability.
 *
 * @param config - Para-obsidian configuration with vault path
 * @param filePath - Path to file (relative to vault or absolute)
 * @param options - Update options (set, unset, dryRun)
 * @returns Update result with change details and before/after snapshots
 * @throws Error if file doesn't exist or path escapes vault
 *
 * @example
 * ```typescript
 * // Set and unset fields
 * const result = updateFrontmatterFile(config, 'Note.md', {
 *   set: { status: 'completed', reviewed: '2024-01-15' },
 *   unset: ['draft'],
 *   dryRun: true
 * });
 * console.log(result.changes); // ['set status ("active" → "completed")', 'unset draft ("true")']
 * ```
 */
export function updateFrontmatterFile(
	config: ParaObsidianConfig,
	filePath: string,
	options: UpdateFrontmatterOptions,
): UpdateFrontmatterResult {
	const { attributes, body, relative } = readFrontmatterFile(config, filePath);
	const before = { ...attributes };
	const changes: string[] = [];
	const next = { ...before };

	// Apply set operations
	for (const [key, value] of Object.entries(options.set ?? {})) {
		const previous = next[key];
		const same =
			typeof previous === "object" && typeof value === "object"
				? JSON.stringify(previous) === JSON.stringify(value)
				: previous === value;
		if (same) continue;
		next[key] = value;
		changes.push(
			previous === undefined
				? `set ${key}`
				: `set ${key} (${JSON.stringify(previous)} → ${JSON.stringify(value)})`,
		);
	}

	// Apply unset operations
	for (const key of options.unset ?? []) {
		if (!(key in next)) continue;
		const previous = next[key];
		delete next[key];
		changes.push(`unset ${key} (${JSON.stringify(previous)})`);
	}

	const dryRun = options.dryRun ?? false;
	const wouldChange = changes.length > 0;
	const updated = wouldChange && !dryRun;

	// Write changes to disk if not dry-run
	if (updated) {
		const content = serializeFrontmatter(next, body);
		const { absolute } = resolveVaultPath(config.vault, relative);
		fs.writeFileSync(absolute, content, "utf8");
	}

	return {
		relative,
		dryRun,
		wouldChange,
		updated,
		changes,
		attributes: {
			before,
			after: next,
		},
	};
}

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
 * Migrates a single file's template_version to the expected version.
 *
 * Applies any registered migration hooks to transform the frontmatter
 * and body content during the version bump. Hooks allow for automated
 * field renames, default value additions, and content transformations.
 *
 * @param config - Para-obsidian configuration with template versions
 * @param filePath - Path to file (relative to vault or absolute)
 * @param options - Migration options (forceVersion, dryRun, migrate hooks)
 * @returns Migration result with version change details
 * @throws Error if note type has no configured version or file doesn't exist
 *
 * @example
 * ```typescript
 * const result = migrateTemplateVersion(config, 'Projects/Note.md', {
 *   migrate: MIGRATIONS,
 *   dryRun: true
 * });
 * console.log(`Would update from v${result.fromVersion} to v${result.toVersion}`);
 * console.log('Changes:', result.changes);
 * ```
 */
export function migrateTemplateVersion(
	config: ParaObsidianConfig,
	filePath: string,
	options: MigrateTemplateOptions = {},
): {
	relative: string;
	fromVersion?: number;
	toVersion: number;
	updated: boolean;
	wouldChange: boolean;
	dryRun: boolean;
	changes?: ReadonlyArray<string>;
} {
	const { attributes, body, relative } = readFrontmatterFile(config, filePath);
	const type = attributes.type as string | undefined;
	const expected =
		options.forceVersion ??
		(type ? config.templateVersions?.[type] : undefined);
	if (expected === undefined) {
		throw new Error(
			`No template version configured for ${type ?? "unknown type"}`,
		);
	}

	const current =
		typeof attributes.template_version === "number"
			? attributes.template_version
			: undefined;

	const dryRun = options.dryRun ?? false;
	const wouldChange = current !== expected;
	const changes: string[] = [];

	// No migration needed if already at expected version
	if (!wouldChange) {
		return {
			relative,
			fromVersion: current,
			toVersion: expected,
			updated: false,
			wouldChange: false,
			dryRun,
		};
	}

	// Apply migration hooks if available
	const migrateHooks = options.migrate ?? {};
	const hook = type
		? migrateHooks[type]?.[current ?? 0]?.[expected]
		: undefined;
	let nextAttributes = attributes;
	let nextBody = body;
	if (hook) {
		const transformed = hook({ attributes, body, from: current, to: expected });
		nextAttributes = transformed.attributes;
		nextBody = transformed.body;
		if (transformed.changes?.length) changes.push(...transformed.changes);
	}

	// Update template_version and write
	nextAttributes.template_version = expected;
	const content = serializeFrontmatter(nextAttributes, nextBody);
	if (!dryRun) {
		const { absolute } = resolveVaultPath(config.vault, relative);
		fs.writeFileSync(absolute, content, "utf8");
	}

	return {
		relative,
		fromVersion: current,
		toVersion: expected,
		updated: !dryRun,
		wouldChange: true,
		dryRun,
		changes,
	};
}

/** Options for recursive file listing. */
interface ListOptions {
	/** File extensions to include (e.g., [".md"]). Empty means all files. */
	readonly extensions?: ReadonlyArray<string>;
}

/**
 * Recursively lists all files in a directory matching extension filters.
 * Used internally for bulk operations like migrate-all.
 */
function listFilesRecursive(root: string, options: ListOptions = {}): string[] {
	const exts = options.extensions ?? [];
	const entries = fs.readdirSync(root, { withFileTypes: true });
	const files: string[] = [];
	for (const entry of entries) {
		const full = path.join(root, entry.name);
		if (entry.isDirectory()) {
			files.push(...listFilesRecursive(full, options));
		} else if (
			entry.isFile() &&
			(exts.length === 0 || exts.some((ext) => entry.name.endsWith(ext)))
		) {
			files.push(full);
		}
	}
	return files;
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
 * Details about a single file in a migration plan.
 */
export interface VersionPlanEntry {
	/** Vault-relative path to the file. */
	readonly file: string;
	/** Note type from frontmatter (if present). */
	readonly type?: string;
	/** Current template_version (if present). */
	readonly current?: number;
	/** Target version for migration. */
	readonly target: number;
	/** Migration status category. */
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
 * Normalizes directory input to an array, using defaults if empty.
 * Ensures we always have at least one directory to scan.
 */
function normalizeDirs(
	dir?: string | ReadonlyArray<string>,
	defaults?: ReadonlyArray<string>,
): ReadonlyArray<string> {
	const list = dir ?? defaults ?? [];
	const dirs = Array.isArray(list) ? list : [list];
	return dirs.length > 0 ? dirs : ["."];
}

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

export interface ApplyVersionPlanResult {
	readonly dryRun: boolean;
	readonly updated: number;
	readonly wouldUpdate: number;
	readonly skipped: number;
	readonly errors: number;
	readonly changes: Array<{ file: string; changes: ReadonlyArray<string> }>;
	readonly selected: ReadonlyArray<VersionPlanEntry>;
	readonly results: Array<
		ReturnType<typeof migrateTemplateVersion> & { error?: string }
	>;
}

/**
 * Migrate template_version across all markdown files (optionally scoped to dirs/type).
 *
 * - Respects `forceVersion` to override config versions.
 * - Supports dry-run with change previews.
 * - Returns aggregated stats plus per-file results.
 */
export function migrateAllTemplateVersions(
	config: ParaObsidianConfig,
	options: MigrateAllOptions = {},
): {
	results: Array<
		ReturnType<typeof migrateTemplateVersion> & { error?: string }
	>;
	updated: number;
	wouldUpdate: number;
	skipped: number;
	errors: number;
	dir: string;
	dirs: ReadonlyArray<string>;
	dryRun: boolean;
	changes: Array<{ file: string; changes: ReadonlyArray<string> }>;
} {
	const dirInputs = normalizeDirs(options.dir, config.defaultSearchDirs);
	const resolvedDirs = dirInputs.map(
		(entry) => resolveVaultPath(config.vault, entry).absolute,
	);
	const dryRun = options.dryRun ?? false;
	const files = resolvedDirs.flatMap((dir) =>
		listFilesRecursive(dir, { extensions: [".md"] }),
	);

	const results: Array<
		ReturnType<typeof migrateTemplateVersion> & { error?: string }
	> = [];
	let updated = 0;
	let wouldUpdate = 0;
	let skipped = 0;
	let errors = 0;
	const changes: Array<{ file: string; changes: ReadonlyArray<string> }> = [];

	for (const file of files) {
		const relative = path.relative(config.vault, file);
		try {
			if (options.type) {
				const content = fs.readFileSync(file, "utf8");
				const { attributes } = parseFrontmatter(content);
				if (attributes.type !== options.type) {
					results.push({
						relative,
						fromVersion: undefined,
						toVersion: options.forceVersion ?? 0,
						updated: false,
						wouldChange: false,
						dryRun,
					});
					skipped++;
					continue;
				}
			}
			const result = migrateTemplateVersion(config, relative, {
				forceVersion: options.forceVersion,
				dryRun,
				migrate: options.migrate,
			});
			results.push(result);
			if (result.wouldChange) {
				wouldUpdate++;
				if (result.updated) {
					updated++;
					if (result.changes && result.changes.length > 0) {
						changes.push({ file: relative, changes: result.changes });
					}
				}
			} else {
				skipped++;
			}
		} catch (error) {
			errors++;
			results.push({
				relative,
				fromVersion: undefined,
				toVersion: 0,
				updated: false,
				wouldChange: false,
				dryRun,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return {
		results,
		updated,
		wouldUpdate,
		skipped,
		errors,
		dir: dirInputs.join(","),
		dirs: dirInputs,
		dryRun,
		changes,
	};
}

/**
 * Create a migration plan showing template_version state for a given type.
 *
 * Scans markdown files (with optional dir scoping) and reports whether each
 * note is missing type/version, outdated, current, ahead, or mismatched.
 */
/**
 * Creates a migration plan for bumping template versions.
 *
 * Scans directories and categorizes each file by its migration status
 * without making any changes. Useful for previewing what a migration
 * would affect before running it.
 *
 * @param config - Para-obsidian configuration
 * @param options - Plan options (type, toVersion, dir)
 * @returns Migration plan with counts and per-file status
 *
 * @example
 * ```typescript
 * const plan = planTemplateVersionBump(config, {
 *   type: 'project',
 *   toVersion: 2,
 *   dir: 'Projects'
 * });
 * console.log(`${plan.outdated} files need migration`);
 * console.log(`${plan.current} files already up to date`);
 * ```
 */
export function planTemplateVersionBump(
	config: ParaObsidianConfig,
	options: VersionPlanOptions,
): VersionPlan {
	const dirs = normalizeDirs(options.dir, config.defaultSearchDirs);
	const resolvedDirs = dirs.map(
		(entry) => resolveVaultPath(config.vault, entry).absolute,
	);

	const entries: VersionPlanEntry[] = [];
	let matches = 0;
	let missingType = 0;
	let missingVersion = 0;
	let outdated = 0;
	let ahead = 0;
	let current = 0;
	let typeMismatch = 0;
	const perType: Record<
		string,
		{
			total: number;
			missingVersion: number;
			outdated: number;
			ahead: number;
			current: number;
		}
	> = {};

	for (const dir of resolvedDirs) {
		for (const file of listFilesRecursive(dir, { extensions: [".md"] })) {
			const relative = path.relative(config.vault, file);
			const content = fs.readFileSync(file, "utf8");
			const { attributes } = parseFrontmatter(content);
			const noteType = attributes.type as string | undefined;

			// Categorize by type presence
			if (!noteType) {
				entries.push({
					file: relative,
					target: options.toVersion,
					status: "missing-type",
				});
				missingType++;
				continue;
			}

			// Categorize by type match
			if (noteType !== options.type) {
				entries.push({
					file: relative,
					type: noteType,
					target: options.toVersion,
					status: "type-mismatch",
				});
				typeMismatch++;
				continue;
			}

			const currentVersion =
				typeof attributes.template_version === "number"
					? attributes.template_version
					: undefined;

			// Categorize by version presence and value
			if (currentVersion === undefined) {
				entries.push({
					file: relative,
					type: noteType,
					target: options.toVersion,
					status: "missing-version",
				});
				missingVersion++;
				perType[noteType] ??= {
					total: 0,
					missingVersion: 0,
					outdated: 0,
					ahead: 0,
					current: 0,
				};
				perType[noteType].total++;
				perType[noteType].missingVersion++;
				continue;
			}

			if (currentVersion < options.toVersion) {
				entries.push({
					file: relative,
					type: noteType,
					current: currentVersion,
					target: options.toVersion,
					status: "outdated",
				});
				outdated++;
				perType[noteType] ??= {
					total: 0,
					missingVersion: 0,
					outdated: 0,
					ahead: 0,
					current: 0,
				};
				perType[noteType].total++;
				perType[noteType].outdated++;
			} else if (currentVersion > options.toVersion) {
				entries.push({
					file: relative,
					type: noteType,
					current: currentVersion,
					target: options.toVersion,
					status: "ahead",
				});
				ahead++;
				perType[noteType] ??= {
					total: 0,
					missingVersion: 0,
					outdated: 0,
					ahead: 0,
					current: 0,
				};
				perType[noteType].total++;
				perType[noteType].ahead++;
			} else {
				entries.push({
					file: relative,
					type: noteType,
					current: currentVersion,
					target: options.toVersion,
					status: "current",
				});
				current++;
				perType[noteType] ??= {
					total: 0,
					missingVersion: 0,
					outdated: 0,
					ahead: 0,
					current: 0,
				};
				perType[noteType].total++;
				perType[noteType].current++;
			}
			matches++;
		}
	}

	return {
		type: options.type,
		targetVersion: options.toVersion,
		total: entries.length,
		matches,
		missingType,
		missingVersion,
		outdated,
		ahead,
		current,
		typeMismatch,
		dirs,
		entries,
		perType,
	};
}

/**
 * Apply a previously generated version plan to migrate only the selected files.
 *
 * Filters entries by status (default: outdated + missing-version + current) and
 * runs `migrateTemplateVersion` for each matching file. Optional dir filters
 * restrict which plan entries are applied.
 *
 * @param config - Loaded para-obsidian configuration
 * @param options.plan - Plan object to apply
 * @param options.statuses - Statuses to include (defaults to common migration cases)
 * @param options.dirs - Optional dir prefixes to scope the plan
 * @param options.dryRun - If true, skip writing changes
 * @param options.migrate - Migration hooks map
 */
export function applyVersionPlan(
	config: ParaObsidianConfig,
	options: ApplyVersionPlanOptions,
): ApplyVersionPlanResult {
	const plan = options.plan;
	const targetVersion = plan.targetVersion;
	const entries = plan.entries;
	const statuses = new Set<VersionPlanStatus>(
		options.statuses ?? ["outdated", "missing-version", "current"],
	);
	const dirFilter = options.dirs ?? plan.dirs;
	const dryRun = options.dryRun ?? false;

	const selected = entries.filter((entry) => {
		if (!statuses.has(entry.status)) return false;
		if (!dirFilter || dirFilter.length === 0) return true;
		return dirFilter.some((dir) => {
			if (dir === ".") return true;
			return entry.file === dir || entry.file.startsWith(`${dir}/`);
		});
	});

	const results: ApplyVersionPlanResult["results"] = [];
	let updated = 0;
	let wouldUpdate = 0;
	let skipped = entries.length - selected.length;
	let errors = 0;
	const changes: Array<{ file: string; changes: ReadonlyArray<string> }> = [];

	for (const entry of selected) {
		try {
			const result = migrateTemplateVersion(config, entry.file, {
				forceVersion: targetVersion,
				dryRun,
				migrate: options.migrate,
			});
			results.push(result);
			if (result.wouldChange) {
				wouldUpdate++;
				if (result.updated) {
					updated++;
					if (result.changes && result.changes.length > 0) {
						changes.push({ file: entry.file, changes: result.changes });
					}
				}
			} else {
				skipped++;
			}
		} catch (error) {
			errors++;
			results.push({
				relative: entry.file,
				fromVersion: entry.current,
				toVersion: targetVersion,
				updated: false,
				wouldChange: false,
				dryRun,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return {
		dryRun,
		updated,
		wouldUpdate,
		skipped,
		errors,
		changes,
		results,
		selected,
	};
}

/**
 * Context passed to migration hook functions.
 * Contains the current state of the note being migrated.
 */
export interface MigrationContext {
	/** Current frontmatter attributes. */
	readonly attributes: Record<string, unknown>;
	/** Current Markdown body content. */
	readonly body: string;
	/** Source version (undefined if missing template_version). */
	readonly from?: number;
	/** Target version for migration. */
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
