/**
 * Frontmatter migration command handlers
 *
 * @module cli/frontmatter/migrate
 */

import { emphasize } from "@side-quest/core/terminal";
import {
	migrateAllTemplateVersions,
	migrateTemplateVersion,
} from "../../frontmatter/index";
import { autoCommitChanges, ensureGitGuard } from "../../git/index";
import { MIGRATIONS } from "../../templates/migrations";
import type { CommandContext, CommandResult } from "../types";
import {
	normalizeFlags,
	normalizeFlagValue,
	parseAttachments,
	parseDirs,
	withAutoDiscoveredAttachments,
} from "../utils";

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
