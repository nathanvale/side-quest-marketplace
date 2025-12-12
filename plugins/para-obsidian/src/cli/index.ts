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
	handleListTags,
	handleScanTags,
	handleTemplateFields,
	handleTemplates,
} from "./config";
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
} from "./utils";
