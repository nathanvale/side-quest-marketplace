/**
 * Frontmatter set command handler
 *
 * @module cli/frontmatter/set
 */

import { coerceValue, parseKeyValuePairs } from "@side-quest/core/cli";
import { emphasize } from "@side-quest/core/terminal";
import {
	updateFrontmatterFile,
	validateFrontmatter,
} from "../../frontmatter/index";
import { autoCommitChanges, ensureGitGuard } from "../../git/index";
import type { CommandContext, CommandResult } from "../types";
import {
	normalizeFlags,
	normalizeFlagValue,
	parseAttachments,
	parseFrontmatterFilters,
	parseUnset,
	withAutoDiscoveredAttachments,
} from "../utils";
import { computeFrontmatterHints } from "./hints";

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
