/**
 * Frontmatter validation command handlers
 *
 * @module cli/frontmatter/validate
 */

import { emphasize } from "@side-quest/core/terminal";
import {
	validateFrontmatterBulk,
	validateFrontmatterFile,
} from "../../frontmatter/index";
import type { CommandContext, CommandResult } from "../types";
import { normalizeFlagValue, parseDirs } from "../utils";

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
