/**
 * Frontmatter plan command handlers
 *
 * @module cli/frontmatter/plan
 */

import path from "node:path";
import {
	pathExistsSync,
	readTextFileSync,
	writeTextFileSync,
} from "@sidequest/core/fs";
import { emphasize } from "@sidequest/core/terminal";
import {
	applyVersionPlan,
	planTemplateVersionBump,
	type VersionPlanStatus,
} from "../../frontmatter/index";
import { autoCommitChanges, ensureGitGuard } from "../../git/index";
import { MIGRATIONS } from "../../templates/migrations";
import type { CommandContext, CommandResult } from "../types";
import {
	normalizeFlags,
	normalizeFlagValue,
	parseAttachments,
	parseDirs,
	parseStatuses,
	withAutoDiscoveredAttachments,
} from "../utils";

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
