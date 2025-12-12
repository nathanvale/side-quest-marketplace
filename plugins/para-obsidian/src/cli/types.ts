/**
 * CLI command handler types.
 *
 * Provides the interface for modular CLI commands. Each command domain
 * exports a handler function that implements this interface.
 *
 * @module cli/types
 */

import type { OutputFormat } from "@sidequest/core/terminal";
import type { ParaObsidianConfig } from "../config";

/**
 * Parsed CLI flags with normalized values.
 */
export type NormalizedFlags = Record<string, string | boolean>;

/**
 * Context passed to all command handlers.
 */
export interface CommandContext {
	/** Loaded vault configuration */
	readonly config: ParaObsidianConfig;
	/** Positional arguments after command/subcommand */
	readonly positional: ReadonlyArray<string>;
	/** Normalized flag values */
	readonly flags: NormalizedFlags;
	/** Output format (json or markdown) */
	readonly format: OutputFormat;
	/** Whether output is JSON format */
	readonly isJson: boolean;
	/** Optional subcommand (e.g., "get" in "frontmatter get") */
	readonly subcommand?: string;
}

/**
 * Result of a command execution.
 */
export interface CommandResult {
	/** Whether the command succeeded */
	readonly success: boolean;
	/** Optional error message on failure */
	readonly error?: string;
	/** Exit code (0 for success, non-zero for failure) */
	readonly exitCode?: number;
}

/**
 * Command handler function signature.
 *
 * All command handlers receive a context and return a result.
 * Handlers are responsible for their own output (console.log, JSON, etc.).
 */
export type CommandHandler = (ctx: CommandContext) => Promise<CommandResult>;

/**
 * Command definition with metadata.
 */
export interface CommandDefinition {
	/** Command name (e.g., "frontmatter", "search") */
	readonly name: string;
	/** Brief description for help text */
	readonly description: string;
	/** The handler function */
	readonly handler: CommandHandler;
	/** Optional subcommands (e.g., frontmatter get/set/validate) */
	readonly subcommands?: ReadonlyArray<string>;
}
