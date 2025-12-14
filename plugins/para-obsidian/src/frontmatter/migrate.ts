/**
 * Frontmatter template version migration utilities.
 *
 * @module frontmatter/migrate
 */

import path from "node:path";
import { readTextFileSync, writeTextFileSync } from "@sidequest/core/fs";
import { globFilesSync } from "@sidequest/core/glob";
import { getErrorMessage } from "@sidequest/core/utils";

import type { ParaObsidianConfig } from "../config/index";
import { resolveVaultPath } from "../shared/fs";
import { parseFrontmatter, serializeFrontmatter } from "./parse";
import type {
	ApplyVersionPlanOptions,
	ApplyVersionPlanResult,
	MigrateAllOptions,
	MigrateTemplateOptions,
	MigrateTemplateResult,
	VersionPlan,
	VersionPlanEntry,
	VersionPlanOptions,
	VersionPlanStatus,
} from "./types";
import { readFrontmatterFile } from "./validate";

// =============================================================================
// Internal Helpers
// =============================================================================

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

// =============================================================================
// Public API
// =============================================================================

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
): MigrateTemplateResult {
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

	// Update template_version and write (as number)
	nextAttributes.template_version = expected;
	const content = serializeFrontmatter(nextAttributes, nextBody);
	if (!dryRun) {
		const { absolute } = resolveVaultPath(config.vault, relative);
		writeTextFileSync(absolute, content);
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
	results: Array<MigrateTemplateResult & { error?: string }>;
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
		globFilesSync("**/*.md", { cwd: dir }),
	);

	const results: Array<MigrateTemplateResult & { error?: string }> = [];
	let updated = 0;
	let wouldUpdate = 0;
	let skipped = 0;
	let errors = 0;
	const changes: Array<{ file: string; changes: ReadonlyArray<string> }> = [];

	for (const file of files) {
		const relative = path.relative(config.vault, file);
		try {
			if (options.type) {
				const content = readTextFileSync(file);
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
				error: getErrorMessage(error),
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
		for (const file of globFilesSync("**/*.md", { cwd: dir })) {
			const relative = path.relative(config.vault, file);
			const content = readTextFileSync(file);
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
				error: getErrorMessage(error),
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
