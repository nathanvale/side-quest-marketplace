/**
 * Frontmatter command handlers for PARA Obsidian CLI
 */

import path from "node:path";

import { coerceValue, parseKeyValuePairs } from "@sidequest/core/cli";
import {
	pathExistsSync,
	readTextFileSync,
	writeTextFileSync,
} from "@sidequest/core/fs";
import { emphasize } from "@sidequest/core/terminal";
import type { ParaObsidianConfig } from "../config/index";
import {
	applyVersionPlan,
	migrateAllTemplateVersions,
	migrateTemplateVersion,
	planTemplateVersionBump,
	readFrontmatterFile,
	updateFrontmatterFile,
	type VersionPlanStatus,
	validateFrontmatter,
	validateFrontmatterBulk,
	validateFrontmatterFile,
} from "../frontmatter/index";
import { autoCommitChanges, ensureGitGuard } from "../git/index";
import { MIGRATIONS } from "../templates/migrations";
import type { CommandContext, CommandResult } from "./types";
import {
	normalizeFlags,
	normalizeFlagValue,
	parseAttachments,
	parseDirs,
	parseFrontmatterFilters,
	parseStatuses,
	parseUnset,
	withAutoDiscoveredAttachments,
} from "./utils";

/**
 * Get allowed fields and enum values for a note type
 */
export function suggestFieldsForType(
	config: ParaObsidianConfig,
	type?: string,
): { allowed: string[]; enums: Record<string, ReadonlyArray<string>> } {
	const rules = type ? config.frontmatterRules?.[type] : undefined;
	const allowed = rules?.required ? Object.keys(rules.required).sort() : [];
	const enums: Record<string, ReadonlyArray<string>> = {};
	if (rules?.required) {
		for (const [field, rule] of Object.entries(rules.required)) {
			if (rule.type === "enum" && rule.enum) {
				enums[field] = rule.enum;
			}
		}
	}
	return { allowed, enums };
}

/**
 * Compute warnings and hints for frontmatter edits
 */
export function computeFrontmatterHints(
	config: ParaObsidianConfig,
	noteType: string | undefined,
	setPairs: Record<string, string>,
	attributes: Record<string, unknown>,
) {
	const suggestions = suggestFieldsForType(config, noteType);
	const warnings: string[] = [];
	const fixHints: string[] = [];

	// Unknown fields
	if (suggestions.allowed.length > 0) {
		for (const key of Object.keys(setPairs)) {
			if (!suggestions.allowed.includes(key)) {
				warnings.push(`Unknown field for type ${noteType}: ${key}`);
				fixHints.push(
					`Remove or rename "${key}" to a known field for type ${noteType}`,
				);
			}
		}
		if (warnings.length > 0) {
			fixHints.push(
				`Allowed fields for type ${noteType}: ${suggestions.allowed.join(", ")}`,
			);
		}
	}

	// Enum mismatches
	if (noteType) {
		const rules = config.frontmatterRules?.[noteType]?.required ?? {};
		for (const [field, rule] of Object.entries(rules)) {
			if (rule.type === "enum" && rule.enum && field in attributes) {
				const val = attributes[field];
				if (typeof val === "string" && !rule.enum.includes(val)) {
					warnings.push(
						`Invalid value for ${field}: ${val} (allowed: ${rule.enum.join(", ")})`,
					);
					fixHints.push(
						`Field "${field}" allowed values: ${rule.enum.join(", ")}`,
					);
				}
			}
		}
	}

	return { warnings, fixHints, suggestions };
}

/**
 * Handle frontmatter get command
 */
export async function handleFrontmatterGet(
	ctx: CommandContext,
): Promise<CommandResult> {
	const { config, positional, isJson } = ctx;
	const target = positional[0];

	if (!target) {
		console.error("frontmatter get requires <file>");
		return { success: false, exitCode: 1 };
	}

	const { attributes } = readFrontmatterFile(config, target);
	if (isJson) {
		console.log(
			JSON.stringify({ file: target, frontmatter: attributes }, null, 2),
		);
	} else {
		console.log(JSON.stringify(attributes, null, 2));
	}

	return { success: true };
}

/**
 * Handle frontmatter validate command
 */
export async function handleFrontmatterValidate(
	ctx: CommandContext,
): Promise<CommandResult> {
	const { config, positional, isJson } = ctx;
	const target = positional[0];

	if (!target) {
		console.error("frontmatter validate requires <file>");
		return { success: false, exitCode: 1 };
	}

	const result = validateFrontmatterFile(config, target);
	if (isJson) {
		console.log(
			JSON.stringify(
				{
					file: result.relative,
					valid: result.valid,
					issues: result.issues,
				},
				null,
				2,
			),
		);
	} else {
		if (result.valid) {
			console.log(emphasize.success(`${result.relative} frontmatter ok`));
		} else {
			console.log(emphasize.warn(`${result.relative} has issues:`));
			for (const issue of result.issues) {
				console.log(`- ${issue.field}: ${issue.message}`);
			}
		}
	}

	return { success: true };
}

/**
 * Handle frontmatter validate-all command
 */
export async function handleFrontmatterValidateAll(
	ctx: CommandContext,
): Promise<CommandResult> {
	const { config, flags, isJson } = ctx;
	const dirs = parseDirs(
		normalizeFlagValue(flags.dir),
		config.defaultSearchDirs,
	);
	const type =
		typeof flags.type === "string" && flags.type.trim().length > 0
			? flags.type.trim()
			: undefined;

	const result = validateFrontmatterBulk(config, { dirs, type });

	if (isJson) {
		console.log(JSON.stringify(result, null, 2));
	} else {
		const { summary, issues } = result;
		const totalFiles = summary.total;
		const validFiles = summary.valid;
		const invalidFiles = summary.invalid;

		// Overall summary
		if (invalidFiles === 0) {
			console.log(
				emphasize.success(`✓ All ${totalFiles} file(s) passed validation`),
			);
		} else {
			console.log(
				emphasize.warn(
					`${invalidFiles} of ${totalFiles} file(s) have issues (${validFiles} valid)`,
				),
			);
		}

		// Per-type breakdown
		if (Object.keys(summary.byType).length > 0) {
			console.log("\nBy type:");
			for (const [noteType, stats] of Object.entries(summary.byType)) {
				const status =
					stats.invalid === 0 ? emphasize.success("✓") : emphasize.warn("✗");
				console.log(
					`  ${status} ${noteType}: ${stats.valid}/${stats.total} valid`,
				);
			}
		}

		// Show detailed issues for files that failed
		const filesWithIssues = issues.filter((f) => !f.valid);
		if (filesWithIssues.length > 0) {
			console.log("\nFiles with issues:");
			for (const file of filesWithIssues) {
				console.log(emphasize.warn(`\n${file.file}:`));
				for (const error of file.errors) {
					console.log(`  - ${error.field}: ${error.message}`);
				}
			}
		}
	}

	return { success: true };
}

/**
 * Handle frontmatter set/edit command
 */
export async function handleFrontmatterSet(
	ctx: CommandContext,
): Promise<CommandResult> {
	const { config, positional, flags, isJson } = ctx;
	const target = positional[0];

	if (!target) {
		console.error("frontmatter set|edit requires <file>");
		return { success: false, exitCode: 1 };
	}

	const dryRun = flags["dry-run"] === true || flags["dry-run"] === "true";
	const strict = flags.strict === true || flags.strict === "true";
	const suggestOnly = flags.suggest === true || flags.suggest === "true";
	const attachments = parseAttachments(normalizeFlags(flags));
	const unset = parseUnset(normalizeFlagValue(flags.unset));
	const additionalPairs = positional.slice(1);
	const setPairs = {
		...parseFrontmatterFilters(normalizeFlags(flags), []),
		...parseKeyValuePairs(additionalPairs),
		...(typeof flags.set === "string" ? parseKeyValuePairs([flags.set]) : {}),
	};

	if (Object.keys(setPairs).length === 0 && unset.length === 0) {
		console.error(
			"frontmatter set|edit requires key=value pairs or --unset keys",
		);
		return { success: false, exitCode: 1 };
	}

	const typed: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(setPairs)) {
		typed[k] = coerceValue(v);
	}

	const preview = updateFrontmatterFile(config, target, {
		set: typed,
		unset,
		dryRun: true,
	});

	const after = preview.attributes.after;
	const noteType =
		typeof after.type === "string" ? (after.type as string) : undefined;
	const rules = noteType ? config.frontmatterRules?.[noteType] : undefined;
	const validation = validateFrontmatter(after, rules);
	const { warnings, fixHints, suggestions } = computeFrontmatterHints(
		config,
		noteType,
		setPairs,
		after,
	);

	if (!validation.valid) {
		for (const issue of validation.issues) {
			warnings.push(`${issue.field}: ${issue.message}`);
			if (
				issue.message.includes("one of") &&
				noteType &&
				suggestions.enums[issue.field]
			) {
				const enumValues = suggestions.enums[issue.field];
				if (enumValues) {
					fixHints.push(
						`Field "${issue.field}" allowed values: ${enumValues.join(", ")}`,
					);
				}
			}
			fixHints.push(`Fix ${issue.field}: ${issue.message}`);
		}
	}

	if (suggestOnly) {
		if (isJson) {
			console.log(
				JSON.stringify(
					{ suggest: suggestions, file: target, type: noteType },
					null,
					2,
				),
			);
		} else {
			console.log(
				emphasize.info(
					`Fields for type ${noteType ?? "unknown"}${suggestions.allowed.length === 0 ? "" : ":"}`,
				),
			);
			if (suggestions.allowed.length > 0) {
				console.log(`Allowed: ${suggestions.allowed.join(", ")}`);
			}
			if (Object.keys(suggestions.enums).length > 0) {
				console.log("Enums:");
				for (const [field, vals] of Object.entries(suggestions.enums)) {
					console.log(`- ${field}: ${vals.join(", ")}`);
				}
			}
		}
		return { success: true };
	}

	const strictFailed = strict && warnings.length > 0;
	const invalid = !validation.valid;

	if (!dryRun && !invalid) {
		await ensureGitGuard(config);
	}

	const result =
		dryRun || strictFailed || invalid
			? preview
			: updateFrontmatterFile(config, target, {
					set: typed,
					unset,
					dryRun,
				});

	const attachmentsUsed = withAutoDiscoveredAttachments(
		config,
		target,
		attachments,
	);

	if (
		config.autoCommit &&
		!dryRun &&
		result.updated &&
		!strictFailed &&
		!invalid
	) {
		await autoCommitChanges(
			config,
			[result.relative, ...attachmentsUsed],
			`frontmatter set ${target}`,
		);
	}

	if (isJson) {
		console.log(
			JSON.stringify(
				{
					...result,
					attachmentsUsed,
					action: "set",
					warnings,
					fixHints,
					strictFailed,
					suggest: suggestions,
				},
				null,
				2,
			),
		);
		if (strictFailed || invalid) return { success: false, exitCode: 1 };
	} else {
		if (!result.wouldChange) {
			console.log(emphasize.info(`${result.relative} unchanged`));
		} else {
			const verb = result.updated ? "Updated" : "Would update";
			console.log(
				emphasize.success(
					`${verb} ${result.relative} (${result.changes.length} change(s))`,
				),
			);
			for (const change of result.changes) {
				console.log(`- ${change}`);
			}
		}
		if (warnings.length > 0) {
			console.log(emphasize.warn("Warnings:"));
			for (const w of warnings) console.log(`- ${w}`);
		}
		if (strictFailed || invalid) {
			return { success: false, exitCode: 1 };
		}
	}

	return { success: true };
}

/**
 * Handle frontmatter migrate command
 */
export async function handleFrontmatterMigrate(
	ctx: CommandContext,
): Promise<CommandResult> {
	const { config, positional, flags, isJson } = ctx;
	const target = positional[0];

	if (!target) {
		console.error("frontmatter migrate requires <file>");
		return { success: false, exitCode: 1 };
	}

	const dryRun = flags["dry-run"] === true || flags["dry-run"] === "true";
	const forceVersionRaw =
		typeof flags.force === "string"
			? Number.parseInt(flags.force, 10)
			: undefined;

	if (forceVersionRaw !== undefined && !Number.isFinite(forceVersionRaw)) {
		console.error(
			`Invalid --force value: "${flags.force}" (must be a valid integer)`,
		);
		return { success: false, exitCode: 1 };
	}

	const forceVersion = forceVersionRaw;
	const attachments = parseAttachments(normalizeFlags(flags));

	if (!dryRun) {
		await ensureGitGuard(config);
	}

	const result = migrateTemplateVersion(config, target, {
		forceVersion,
		dryRun,
		migrate: MIGRATIONS,
	});

	const attachmentsUsed = withAutoDiscoveredAttachments(
		config,
		target,
		attachments,
	);

	if (config.autoCommit && !dryRun) {
		await autoCommitChanges(
			config,
			[target, ...attachmentsUsed],
			`migrate ${target} to v${result.toVersion}`,
		);
	}

	if (isJson) {
		console.log(JSON.stringify({ ...result, attachmentsUsed }));
	} else {
		const changeNote =
			result.changes && result.changes.length > 0
				? `\nChanges:\n- ${result.changes.join("\n- ")}`
				: "";
		const status = result.wouldChange
			? `${dryRun ? "Would migrate" : "Migrated"} ${result.relative} to template_version ${result.toVersion}`
			: `${result.relative} already at template_version ${result.toVersion}`;
		console.log(status + changeNote);
	}

	return { success: true };
}

/**
 * Handle frontmatter migrate-all command
 */
export async function handleFrontmatterMigrateAll(
	ctx: CommandContext,
): Promise<CommandResult> {
	const { config, flags, isJson } = ctx;
	const dryRun = flags["dry-run"] === true || flags["dry-run"] === "true";
	const dir = parseDirs(
		normalizeFlagValue(flags.dir),
		config.defaultSearchDirs,
	);
	const forceVersionRaw =
		typeof flags.force === "string"
			? Number.parseInt(flags.force, 10)
			: undefined;

	if (forceVersionRaw !== undefined && !Number.isFinite(forceVersionRaw)) {
		console.error(
			`Invalid --force value: "${flags.force}" (must be a valid integer)`,
		);
		return { success: false, exitCode: 1 };
	}

	const forceVersion = forceVersionRaw;
	const type =
		typeof flags.type === "string" && flags.type.trim().length > 0
			? flags.type.trim()
			: undefined;
	const attachments = parseAttachments(normalizeFlags(flags));

	if (!dryRun) {
		await ensureGitGuard(config);
	}

	const result = migrateAllTemplateVersions(config, {
		dir,
		dryRun,
		forceVersion,
		type,
		migrate: MIGRATIONS,
	});

	// Get changed notes for attachment discovery and commit
	const changed = result.results
		.filter((r): r is (typeof result.results)[number] => r.updated === true)
		.map((r) => r.relative);

	// Only auto-discover attachments for changed notes
	const autoAttachments =
		attachments.length > 0
			? attachments
			: changed.flatMap((r) => withAutoDiscoveredAttachments(config, r, []));

	if (config.autoCommit && !dryRun && changed.length > 0) {
		await autoCommitChanges(
			config,
			[...changed, ...autoAttachments],
			`migrate ${changed.length} note(s)`,
		);
	}

	if (isJson) {
		console.log(
			JSON.stringify({
				...result,
				attachmentsUsed: autoAttachments,
				changes: result.changes,
				errors: result.results
					.filter((r) => r.error)
					.map((r) => ({ file: r.relative, error: r.error })),
			}),
		);
	} else {
		const changeCount = result.changes.length;
		const summary = `${dryRun ? "Would migrate" : "Migrated"}: updated ${result.updated} (${result.wouldUpdate} would update), skipped ${result.skipped}, errors ${result.errors}, changes ${changeCount}`;
		console.log(emphasize.info(summary));
		if (changeCount > 0) {
			console.log("Changes:");
			for (const change of result.changes) {
				console.log(`- ${change.file}: ${change.changes.join("; ")}`);
			}
		}
		if (result.errors > 0) {
			for (const err of result.results.filter((r) => r.error)) {
				console.log(
					emphasize.warn(`- ${err.relative}: ${err.error ?? "unknown error"}`),
				);
			}
		}
	}

	return { success: true };
}

/**
 * Handle frontmatter plan command
 */
export async function handleFrontmatterPlan(
	ctx: CommandContext,
): Promise<CommandResult> {
	const { config, positional, flags, isJson } = ctx;
	const type =
		typeof positional[0] === "string" && positional[0].trim().length > 0
			? positional[0].trim()
			: undefined;
	const to =
		typeof flags.to === "string" ? Number.parseInt(flags.to, 10) : undefined;

	if (!type || !to) {
		console.error("frontmatter plan requires <type> and --to <version>");
		return { success: false, exitCode: 1 };
	}

	const dir = parseDirs(
		normalizeFlagValue(flags.dir),
		config.defaultSearchDirs,
	);

	if (flags.interactive === true || flags.interactive === "true") {
		const plan = planTemplateVersionBump(config, {
			type,
			toVersion: to,
			dir,
		});
		console.log(
			emphasize.info(
				`Plan summary (interactive stub): type=${type}, target=${to}, dirs=${plan.dirs.join(", ")}`,
			),
		);
		console.log(
			emphasize.info(
				`Outdated ${plan.outdated}, missing ${plan.missingVersion}, current ${plan.current}, ahead ${plan.ahead}`,
			),
		);
		console.log(
			emphasize.info(
				`Per-type: ${Object.entries(plan.perType)
					.map(
						([t, s]) =>
							`${t}: total ${s.total}, outdated ${s.outdated}, missing ${s.missingVersion}, current ${s.current}, ahead ${s.ahead}`,
					)
					.join(" | ")}`,
			),
		);
		console.log(
			"To proceed, rerun without --interactive and use --save/--dir as needed.",
		);
		return { success: true };
	}

	const plan = planTemplateVersionBump(config, {
		type,
		toVersion: to,
		dir,
	});

	const savePath =
		typeof flags.save === "string" && flags.save.trim().length > 0
			? path.resolve(flags.save)
			: undefined;

	if (savePath) {
		writeTextFileSync(savePath, JSON.stringify(plan, null, 2));
	}

	if (isJson) {
		console.log(JSON.stringify({ ...plan, savedPath: savePath }, null, 2));
	} else {
		console.log(
			emphasize.info(
				`Plan for type=${type} → v${to} (dirs: ${plan.dirs.join(", ")}): ${plan.outdated} outdated, ${plan.missingVersion} missing, ${plan.current} current, ${plan.ahead} ahead, ${plan.typeMismatch} mismatched`,
			),
		);
		console.log(
			emphasize.info(
				`Per-type summary: ${Object.entries(plan.perType)
					.map(
						([t, s]) =>
							`${t}: total ${s.total}, outdated ${s.outdated}, missing ${s.missingVersion}, current ${s.current}, ahead ${s.ahead}`,
					)
					.join(" | ")}`,
			),
		);
		if (savePath) {
			console.log(emphasize.success(`Saved plan to ${savePath}`));
		}
	}

	return { success: true };
}

/**
 * Handle frontmatter apply-plan command
 */
export async function handleFrontmatterApplyPlan(
	ctx: CommandContext,
): Promise<CommandResult> {
	const { config, positional, flags, isJson } = ctx;
	const target = positional[0];

	const planPath =
		typeof target === "string" && target.trim().length > 0
			? target
			: typeof flags.plan === "string"
				? flags.plan
				: undefined;

	if (!planPath) {
		console.error(
			"frontmatter apply-plan requires <plan file> or --plan <file>",
		);
		return { success: false, exitCode: 1 };
	}

	const dryRun = flags["dry-run"] === true || flags["dry-run"] === "true";
	const statuses = parseStatuses(normalizeFlagValue(flags.statuses), [
		"outdated",
		"missing-version",
		"current",
	]) as VersionPlanStatus[];
	const emitPlan =
		typeof flags["emit-plan"] === "string"
			? path.resolve(flags["emit-plan"])
			: undefined;
	const planAbs = path.resolve(planPath);

	if (!pathExistsSync(planAbs)) {
		console.error(`Plan file not found: ${planAbs}`);
		return { success: false, exitCode: 1 };
	}

	const plan = JSON.parse(readTextFileSync(planAbs));

	if (!plan?.entries || !Array.isArray(plan.entries)) {
		console.error("Plan file must contain entries[]");
		return { success: false, exitCode: 1 };
	}

	if (typeof plan.targetVersion !== "number" || !plan.type) {
		console.error("Plan file must include targetVersion and type");
		return { success: false, exitCode: 1 };
	}

	// Use plan.dirs unless user explicitly specified --dir
	const userSpecifiedDir = normalizeFlagValue(flags.dir);
	const dirs =
		userSpecifiedDir !== undefined
			? parseDirs(userSpecifiedDir, config.defaultSearchDirs)
			: (plan.dirs ?? config.defaultSearchDirs ?? []);

	const attachments = parseAttachments(normalizeFlags(flags));

	if (!dryRun) {
		await ensureGitGuard(config);
	}

	const result = applyVersionPlan(config, {
		plan,
		dryRun,
		statuses,
		dirs,
		migrate: MIGRATIONS,
	});

	const filteredPlan =
		emitPlan || isJson
			? {
					type: plan.type,
					targetVersion: plan.targetVersion,
					dirs,
					entries: result.selected,
					stats: {
						total: result.selected.length,
						outdated: result.selected.filter((e) => e.status === "outdated")
							.length,
						missingVersion: result.selected.filter(
							(e) => e.status === "missing-version",
						).length,
						current: result.selected.filter((e) => e.status === "current")
							.length,
						ahead: result.selected.filter((e) => e.status === "ahead").length,
						typeMismatch: result.selected.filter(
							(e) => e.status === "type-mismatch",
						).length,
						missingType: result.selected.filter(
							(e) => e.status === "missing-type",
						).length,
					},
				}
			: undefined;

	if (emitPlan && filteredPlan) {
		writeTextFileSync(emitPlan, JSON.stringify(filteredPlan, null, 2));
	}

	const updatedFiles = result.results
		.filter((r) => r.updated)
		.map((r) => r.relative);
	const autoAttachments =
		attachments.length > 0
			? attachments
			: updatedFiles.flatMap((file) =>
					withAutoDiscoveredAttachments(config, file, []),
				);

	if (config.autoCommit && !dryRun && updatedFiles.length > 0) {
		await autoCommitChanges(
			config,
			[...new Set([...updatedFiles, ...autoAttachments])],
			`apply plan (${updatedFiles.length} file(s))`,
		);
	}

	if (isJson) {
		console.log(
			JSON.stringify(
				{
					...result,
					attachmentsUsed: autoAttachments,
					statuses,
					dirs,
					planFile: planAbs,
					filteredPlan,
					savedPlan: emitPlan,
				},
				null,
				2,
			),
		);
	} else {
		console.log(
			emphasize.info(
				`${dryRun ? "Would apply" : "Applied"} plan from ${planAbs}: updated ${result.updated}, would update ${result.wouldUpdate}, skipped ${result.skipped}, errors ${result.errors}`,
			),
		);
		if (filteredPlan) {
			console.log(
				emphasize.info(
					`Selected entries: ${filteredPlan.entries.length} (outdated ${filteredPlan.stats.outdated}, missing-version ${filteredPlan.stats.missingVersion}, current ${filteredPlan.stats.current})`,
				),
			);
		}
		if (emitPlan && filteredPlan) {
			console.log(emphasize.success(`Saved filtered plan to ${emitPlan}`));
		}
		if (result.selected.length > 0) {
			console.log("Selected:");
			for (const entry of result.selected) {
				const cur = entry.current ?? "none";
				console.log(
					`- ${entry.file} (${entry.status}) ${cur} -> ${entry.target}`,
				);
			}
		}
		if (result.changes.length > 0) {
			console.log("Changes:");
			for (const change of result.changes) {
				console.log(`- ${change.file}: ${change.changes.join("; ")}`);
			}
		}
		if (result.errors > 0) {
			for (const err of result.results.filter((r) => r.error)) {
				console.log(
					emphasize.warn(`- ${err.relative}: ${err.error ?? "unknown error"}`),
				);
			}
		}
	}

	return { success: true };
}

/**
 * Main frontmatter command dispatcher
 */
export async function handleFrontmatter(
	ctx: CommandContext,
): Promise<CommandResult> {
	const { subcommand, positional } = ctx;
	const action = subcommand;

	// Actions that don't require a target file
	const noTargetActions = ["validate-all", "migrate-all", "plan", "apply-plan"];
	const requiresTarget = !noTargetActions.includes(action ?? "");

	if (!action || (requiresTarget && !positional[0])) {
		console.error(
			requiresTarget
				? "frontmatter requires action and <file>"
				: "frontmatter requires action",
		);
		return { success: false, exitCode: 1 };
	}

	switch (action) {
		case "get":
			return handleFrontmatterGet(ctx);
		case "validate":
			return handleFrontmatterValidate(ctx);
		case "validate-all":
			return handleFrontmatterValidateAll(ctx);
		case "set":
		case "edit":
			return handleFrontmatterSet(ctx);
		case "migrate":
			return handleFrontmatterMigrate(ctx);
		case "migrate-all":
			return handleFrontmatterMigrateAll(ctx);
		case "plan":
			return handleFrontmatterPlan(ctx);
		case "apply-plan":
			return handleFrontmatterApplyPlan(ctx);
		default:
			console.error(`Unknown frontmatter action: ${action}`);
			return { success: false, exitCode: 1 };
	}
}
