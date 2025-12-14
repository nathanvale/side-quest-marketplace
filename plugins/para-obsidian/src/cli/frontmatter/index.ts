/**
 * Frontmatter command handlers - Main entry point
 *
 * This module provides the main dispatcher and re-exports all frontmatter handlers.
 *
 * @module cli/frontmatter
 */

import type { CommandContext, CommandResult } from "../types";

// Re-export handlers from submodules
export { handleFrontmatterGet } from "./get";
export { computeFrontmatterHints, suggestFieldsForType } from "./hints";
export {
	handleFrontmatterMigrate,
	handleFrontmatterMigrateAll,
} from "./migrate";
export { handleFrontmatterApplyPlan, handleFrontmatterPlan } from "./plan";
export { handleFrontmatterSet } from "./set";
export {
	handleFrontmatterValidate,
	handleFrontmatterValidateAll,
} from "./validate";

// Import handlers for dispatcher
import { handleFrontmatterGet } from "./get";
import {
	handleFrontmatterMigrate,
	handleFrontmatterMigrateAll,
} from "./migrate";
import { handleFrontmatterApplyPlan, handleFrontmatterPlan } from "./plan";
import { handleFrontmatterSet } from "./set";
import {
	handleFrontmatterValidate,
	handleFrontmatterValidateAll,
} from "./validate";

/**
 * Main frontmatter command dispatcher
 *
 * Routes to the appropriate handler based on subcommand.
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
