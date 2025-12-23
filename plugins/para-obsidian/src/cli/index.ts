/**
 * CLI command handlers.
 *
 * This module re-exports all command handlers for the PARA Obsidian CLI.
 * Commands are organized by domain into separate modules for maintainability.
 *
 * Domain modules:
 * - config.ts: Configuration and info commands
 * - notes.ts: CRUD operations on notes
 * - frontmatter.ts: Frontmatter manipulation commands
 * - search.ts: Search and index commands
 * - links.ts: Link management commands
 * - git.ts: Git integration commands
 * - inbox.ts: Inbox processing commands
 *
 * @module cli
 */

// Config/Info commands
export {
	handleConfig,
	handleListAreas,
	handleTemplateFields,
	handleTemplates,
} from "./config";
// Create commands
export { handleCreate } from "./create";
export { handleCreateClassifier } from "./create-classifier";
export { handleCreateNoteTemplate } from "./create-note-template";
// Enrich commands
export { handleEnrich } from "./enrich";
export { handleEnrichBookmark } from "./enrich-bookmark";
// Export commands
export { handleExportBookmarks } from "./export-bookmarks";
export { handleExportWebClipperTemplate } from "./export-webclipper-template";
// Frontmatter commands
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
} from "./frontmatter";
// Git commands
export { handleGit, handleInsert } from "./git";
// Inbox commands
export { handleInboxMove } from "./inbox-move";
// Links commands
export {
	handleCleanBrokenLinks,
	handleFindOrphans,
	handleLinkAttachments,
	handleRename,
	handleRewriteLinks,
} from "./links";
// Migration commands
export { handleMigrateRemoveTags } from "./migrate-remove-tags";
// Notes commands
export { handleDelete, handleList, handleRead } from "./notes";
// Process inbox commands
export { handleProcessInbox } from "./process-inbox";
// Registry commands
export { handleRegistry } from "./registry";
// Search commands
export { handleIndex, handleSearch, handleSemantic } from "./search";
// Types
export type {
	CommandContext,
	CommandDefinition,
	CommandHandler,
	CommandResult,
	NormalizedFlags,
} from "./types";
// Utilities
export {
	matchesDir,
	normalizeFlags,
	normalizeFlagValue,
	normalizePathFragment,
	parseArgOverrides,
	parseAttachments,
	parseDirs,
	parseFrontmatterFilters,
	parseStatuses,
	parseUnset,
	withAutoDiscoveredAttachments,
} from "./utils";
