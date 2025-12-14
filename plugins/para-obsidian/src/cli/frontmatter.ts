/**
 * Frontmatter command handlers for PARA Obsidian CLI
 *
 * Re-exports all frontmatter handlers from submodules.
 * This file is kept for backward compatibility but delegates to the
 * organized submodules in ./frontmatter/
 *
 * @module cli/frontmatter
 */

// Re-export everything from the frontmatter submodule
export {
	computeFrontmatterHints,
	handleFrontmatter,
	handleFrontmatterApplyPlan,
	handleFrontmatterGet,
	handleFrontmatterMigrate,
	handleFrontmatterMigrateAll,
	handleFrontmatterPlan,
	handleFrontmatterSet,
	handleFrontmatterValidate,
	handleFrontmatterValidateAll,
	suggestFieldsForType,
} from "./frontmatter/index";
