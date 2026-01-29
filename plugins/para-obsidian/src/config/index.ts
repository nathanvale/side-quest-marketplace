/**
 * Configuration loader for para-obsidian.
 *
 * This module handles loading and merging configuration from multiple sources:
 * - Environment variables (PARA_VAULT, PARA_OBSIDIAN_CONFIG)
 * - User-level config (~/.config/para-obsidian/config.json)
 * - Project-level config (.para-obsidianrc in cwd)
 *
 * Configuration is merged with later sources taking precedence.
 *
 * @module config
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
	ensureParentDir,
	pathExistsSync,
	readTextFileSync,
	validateConfigPath,
} from "@sidequest/core/fs";
import { getErrorMessage } from "@sidequest/core/utils";
import type { InboxConverter } from "../inbox";
import {
	DEFAULT_CONVERTERS as DEFAULT_INBOX_CONVERTERS,
	mergeConverters,
} from "../inbox";
import type { TemplateSection } from "./defaults";
import {
	DEFAULT_AVAILABLE_MODELS,
	DEFAULT_DESTINATIONS,
	DEFAULT_FRONTMATTER_RULES,
	DEFAULT_MODEL,
	DEFAULT_PARA_FOLDERS,
	DEFAULT_PARA_SEARCH_FOLDERS,
	DEFAULT_TEMPLATE_SECTIONS,
	DEFAULT_TEMPLATE_VERSIONS,
	DEFAULT_TITLE_PREFIXES,
} from "./defaults";
import {
	mergeFrontmatterRules,
	mergePerTemplate,
	mergeTemplateSections,
} from "./merge";

/**
 * Defines validation rules for frontmatter fields by note type.
 * Each type (e.g., "project", "area") can specify required fields
 * and their expected types/constraints, as well as forbidden fields
 * that should not appear for this note type.
 */
export interface FrontmatterRules {
	/** Map of field names to their validation rules. */
	readonly required?: Record<string, FieldRule>;
	/** Array of field names that are not allowed for this note type. */
	readonly forbidden?: ReadonlyArray<string>;
	/** Array of field names where at least one must have a value. */
	readonly oneOfRequired?: ReadonlyArray<string>;
}

/**
 * Describes a validation rule for a single frontmatter field.
 *
 * Used to enforce type constraints and value requirements
 * during frontmatter validation.
 */
export interface FieldRule {
	/** The expected data type for this field. */
	readonly type:
		| "string"
		| "date"
		| "number"
		| "array"
		| "wikilink"
		| "enum"
		| "boolean";
	/** For enum types, the allowed values. */
	readonly enum?: ReadonlyArray<string>;
	/** For array types, values that must be present in the array. */
	readonly includes?: ReadonlyArray<string>;
	/** Default value to use if field is missing. */
	readonly defaultValue?: string | ReadonlyArray<string>;
	/** Human-readable description of the field's purpose. */
	readonly description?: string;
	/** If true, the field is not required (validation won't fail if missing). */
	readonly optional?: boolean;
	/** For string types, a regex pattern the value must match. */
	readonly pattern?: string;
}

/**
 * Represents a person/contact for transcription speaker matching.
 * Used to improve transcription accuracy by providing known names and context.
 */
export interface Stakeholder {
	/** Full name as it appears in transcriptions (e.g., "Nathan Vale"). */
	readonly name: string;
	/** Email address (optional, for contact lookup). */
	readonly email?: string;
	/** Role or job title (e.g., "Tech Lead", "Product Owner", "Developer"). */
	readonly role?: string;
	/** Company or organization (e.g., "Bunnings"). */
	readonly company?: string;
	/** Squad or team name (e.g., "GMS", "POS Yellow"). */
	readonly squad?: string;
	/** Related project wikilink (e.g., "[[🎯 GMS - Gift Card Management System]]"). */
	readonly project?: string;
	/** Nickname or alias used in transcriptions (e.g., "MJ" for "Mustafa Jalil"). */
	readonly alias?: string;
}

/**
 * Main configuration object for para-obsidian operations.
 *
 * This configuration controls vault location, template handling,
 * search behavior, git integration, and frontmatter validation.
 */
export interface ParaObsidianConfig {
	/** Absolute path to the Obsidian vault root directory. */
	readonly vault: string;
	/** Directory containing note templates. Defaults to vault/Templates. */
	readonly templatesDir?: string;
	/** Path to the cached vault index file. Defaults to vault/.para-obsidian-index.json. */
	readonly indexPath?: string;
	/** Default directories to scope search and index operations. */
	readonly defaultSearchDirs?: ReadonlyArray<string>;
	/** If true, automatically commit changes after write operations. */
	readonly autoCommit?: boolean;
	/** Template for git commit messages. Supports {summary} and {files} placeholders. */
	readonly gitCommitMessageTemplate?: string;
	/** List of suggested tags for LLM prompts (no longer used for validation). */
	readonly suggestedTags?: ReadonlyArray<string>;
	/** Validation rules keyed by note type (e.g., "project", "area"). */
	readonly frontmatterRules?: Record<string, FrontmatterRules>;
	/** Expected template_version for each note type. Used for migration tracking. */
	readonly templateVersions?: Record<string, number>;
	/** Default destination directories for each template type (e.g., project → 01 Projects). */
	readonly defaultDestinations?: Record<string, string>;
	/** Available LLM models for AI-powered features. */
	readonly availableModels?: ReadonlyArray<string>;
	/** Default LLM model to use. */
	readonly defaultModel?: string;
	/** PARA folder mappings (e.g., "projects" → "01 Projects"). */
	readonly paraFolders?: Record<string, string>;
	/** Default PARA folders to search when --para flag omitted. */
	readonly defaultParaSearchFolders?: ReadonlyArray<string>;
	/** Title prefixes for specific template types (e.g., "research" → "Research -"). */
	readonly titlePrefixes?: Partial<Record<string, string>>;
	/** Template body section overrides. Replaces default sections for specified templates. */
	readonly templateSections?: Partial<
		Record<string, ReadonlyArray<TemplateSection>>
	>;
	/** Inbox converter overrides (merged with defaults). */
	readonly inboxConverters?: ReadonlyArray<
		Partial<InboxConverter> & { id: string }
	>;
	/** IDs of converters to disable. */
	readonly disabledConverters?: ReadonlyArray<string>;
	/**
	 * LLM timeout in milliseconds.
	 * Overrides model-aware defaults (60s Claude, 10min Ollama).
	 * Can also be set via PARA_LLM_TIMEOUT_MS env var (takes precedence).
	 */
	readonly llmTimeoutMs?: number;
	/**
	 * Known people for transcription speaker matching.
	 * Helps improve transcription accuracy by providing names, roles, and context.
	 * Used by voice memo processing and meeting note creation.
	 */
	readonly stakeholders?: ReadonlyArray<Stakeholder>;
}

/**
 * Describes a configured template with its version.
 * Used when listing available templates and their current versions.
 */
export interface TemplateInfo {
	/** Template name (matches filename without .md extension). */
	readonly name: string;
	/** Current template version number. */
	readonly version: number;
}

/**
 * Attempts to load and parse a JSON config file.
 *
 * @param filePath - Absolute path to the JSON file
 * @returns Parsed config object, or undefined if file doesn't exist or fails to parse
 */
function loadJsonIfExists<T>(filePath: string): Partial<T> | undefined {
	if (!pathExistsSync(filePath)) return undefined;
	try {
		const raw = readTextFileSync(filePath);
		return JSON.parse(raw) as Partial<T>;
	} catch (error) {
		console.warn(
			`Warning: Failed to parse config at ${filePath}: ${getErrorMessage(error)}. Using defaults.`,
		);
		return undefined;
	}
}

function resolveRcFromEnv(): string | undefined {
	const explicit = process.env.PARA_OBSIDIAN_CONFIG;
	if (!explicit || explicit.trim().length === 0) {
		return undefined;
	}

	// Validate path is safe before returning
	// Allow vault path if PARA_VAULT is set
	const vault = process.env.PARA_VAULT;
	const allowedRoots = vault ? [vault] : [];

	if (!validateConfigPath(explicit, allowedRoots)) {
		throw new Error(
			`PARA_OBSIDIAN_CONFIG path is not allowed: ${explicit}. ` +
				"Config files must be within home/.config/, the current directory, or the vault.",
		);
	}

	return explicit;
}

function resolveUserRc(): string {
	const home = process.env.HOME ?? process.env.USERPROFILE ?? "~";
	return path.join(home, ".config", "para-obsidian", "config.json");
}

const PROJECT_RC = ".paraobsidianrc";

function resolveProjectRc(cwd: string): string | undefined {
	const candidate = path.join(cwd, PROJECT_RC);
	return pathExistsSync(candidate) ? candidate : undefined;
}

/**
 * Options for the loadConfig function.
 */
export interface LoadConfigOptions {
	/** Working directory for resolving project-level .para-obsidianrc. Defaults to process.cwd(). */
	readonly cwd?: string;
}

/**
 * Loads and merges configuration from all sources.
 *
 * Configuration sources (in order of precedence, later wins):
 * 1. Built-in defaults (lowest priority)
 * 2. Project-level: .para-obsidianrc in vault
 * 3. User-level: ~/.config/para-obsidian/config.json
 * 4. Explicit: path from PARA_OBSIDIAN_CONFIG env var (highest priority)
 * 5. Required: PARA_VAULT env var (always required)
 *
 * Environment variables:
 * - PARA_VAULT (required): Path to Obsidian vault
 * - PARA_TEMPLATES_DIR (optional): Override templates directory
 * - PARA_OBSIDIAN_CONFIG (optional): Path to JSON config file
 *
 * Default templates directory: vault/Templates (was vault/06_Metadata/Templates)
 *
 * @param options - Configuration loading options
 * @returns Fully resolved configuration object
 * @throws Error if PARA_VAULT is not set or doesn't point to a valid directory
 *
 * @example
 * ```typescript
 * const config = loadConfig({ cwd: '/my/project' });
 * console.log(config.vault); // Absolute path to vault
 * ```
 */
export function loadConfig(
	_options: LoadConfigOptions = {},
): ParaObsidianConfig {
	const envVault = process.env.PARA_VAULT;
	if (!envVault || envVault.trim().length === 0) {
		throw new Error("PARA_VAULT env is required to use para-obsidian.");
	}

	const envConfigPath = resolveRcFromEnv();

	// Resolve vault path first so we can look for .paraobsidianrc in the vault
	const vault = path.resolve(envVault);
	if (!fs.existsSync(vault) || !fs.statSync(vault).isDirectory()) {
		throw new Error(`PARA_VAULT does not point to a directory: ${vault}`);
	}

	// Load config files individually - errors are logged but don't throw
	const projectRcPath = resolveProjectRc(vault);
	const projectRc = projectRcPath
		? (loadJsonIfExists<ParaObsidianConfig>(projectRcPath) ?? {})
		: {};

	const userRc = loadJsonIfExists<ParaObsidianConfig>(resolveUserRc()) ?? {};

	const explicitRc = envConfigPath
		? (loadJsonIfExists<ParaObsidianConfig>(envConfigPath) ?? {})
		: {};

	// Merge in correct priority order: project < user < explicit
	// This ensures user config overrides project config as expected
	const merged: ParaObsidianConfig = {
		...projectRc,
		...userRc,
		...explicitRc,
		vault: envVault,
	};

	// Templates dir priority: PARA_TEMPLATES_DIR env > config files > default (vault/Templates)
	const envTemplatesDir = process.env.PARA_TEMPLATES_DIR;
	const templatesDir =
		(envTemplatesDir && envTemplatesDir.trim().length > 0
			? envTemplatesDir
			: merged.templatesDir) ?? path.join(vault, "Templates");

	// Resolve PARA folders for defaults
	const paraFolders = merged.paraFolders ?? DEFAULT_PARA_FOLDERS;
	const defaultParaSearchFolders = merged.defaultParaSearchFolders ?? [
		...DEFAULT_PARA_SEARCH_FOLDERS,
	];

	// Derive defaultSearchDirs from PARA folders if not explicitly set
	// This ensures find-orphans, validate-all, etc. only search managed folders
	const defaultSearchDirs =
		merged.defaultSearchDirs ??
		defaultParaSearchFolders
			.map((shortName) => paraFolders[shortName])
			.filter((dir): dir is string => dir !== undefined);

	return {
		...merged,
		vault,
		templatesDir,
		autoCommit: merged.autoCommit ?? true,
		suggestedTags: merged.suggestedTags ?? [],
		frontmatterRules: mergeFrontmatterRules(
			DEFAULT_FRONTMATTER_RULES,
			merged.frontmatterRules ?? {},
		),
		templateVersions: mergePerTemplate(
			DEFAULT_TEMPLATE_VERSIONS,
			merged.templateVersions ?? {},
		),
		defaultDestinations: mergePerTemplate(
			DEFAULT_DESTINATIONS,
			merged.defaultDestinations ?? {},
		),
		availableModels: merged.availableModels ?? [...DEFAULT_AVAILABLE_MODELS],
		defaultModel: merged.defaultModel ?? DEFAULT_MODEL,
		paraFolders,
		defaultParaSearchFolders,
		defaultSearchDirs,
		titlePrefixes: mergePerTemplate(
			DEFAULT_TITLE_PREFIXES as Record<string, string>,
			(merged.titlePrefixes ?? {}) as Record<string, string>,
		),
		templateSections: mergeTemplateSections(
			DEFAULT_TEMPLATE_SECTIONS,
			merged.templateSections ?? {},
		),
		inboxConverters: mergeConverters(
			DEFAULT_INBOX_CONVERTERS,
			merged.inboxConverters ?? [],
			merged.disabledConverters ?? [],
		),
	};
}

/**
 * Returns all configured template types with their expected versions.
 *
 * Useful for displaying a catalog of available templates and
 * their current version numbers for migration planning.
 *
 * @param config - The loaded para-obsidian configuration
 * @returns Array of template info objects with name and version
 *
 * @example
 * ```typescript
 * const templates = listTemplateVersions(config);
 * // [{ name: 'project', version: 2 }, { name: 'area', version: 2 }, ...]
 * ```
 */
export function listTemplateVersions(
	config: ParaObsidianConfig,
): ReadonlyArray<TemplateInfo> {
	const versions = config.templateVersions ?? DEFAULT_TEMPLATE_VERSIONS;
	return Object.entries(versions).map(([name, version]) => ({
		name,
		version,
	}));
}

/**
 * Save stakeholders to user config file.
 *
 * Reads existing config from ~/.config/para-obsidian/config.json,
 * updates only the `stakeholders` key (preserving all other config),
 * and writes atomically using temp file + rename pattern.
 *
 * @param stakeholders - Array of stakeholder objects to save
 * @throws Error if write fails
 *
 * @example
 * ```typescript
 * await saveStakeholders([
 *   { name: "June Xu", role: "Developer", email: "JXu3@bunnings.com.au" },
 *   { name: "Mustafa Jalil", alias: "MJ", role: "Backend Dev" },
 * ]);
 * ```
 */
export async function saveStakeholders(
	stakeholders: readonly Stakeholder[],
): Promise<void> {
	const configPath = resolveUserRc();

	// Read existing config or start fresh
	let existing: Record<string, unknown> = {};
	if (pathExistsSync(configPath)) {
		try {
			const raw = readTextFileSync(configPath);
			existing = JSON.parse(raw) as Record<string, unknown>;
		} catch {
			// If corrupt, start fresh but preserve nothing
			existing = {};
		}
	}

	// Update only the stakeholders key
	const updated = { ...existing, stakeholders };
	const content = JSON.stringify(updated, null, "\t");

	// Atomic write: temp + rename
	const tempPath = `${configPath}.tmp.${randomUUID()}`;
	try {
		await ensureParentDir(configPath);
		await writeFile(tempPath, content, "utf-8");
		await rename(tempPath, configPath);
	} catch (error) {
		await unlink(tempPath).catch(() => {});
		throw error;
	}
}
