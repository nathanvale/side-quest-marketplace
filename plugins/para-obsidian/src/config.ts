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
import fs from "node:fs";
import path from "node:path";

import {
	DEFAULT_AVAILABLE_MODELS,
	DEFAULT_DESTINATIONS,
	DEFAULT_FRONTMATTER_RULES,
	DEFAULT_MODEL,
	DEFAULT_PARA_FOLDERS,
	DEFAULT_PARA_SEARCH_FOLDERS,
	DEFAULT_SUGGESTED_TAGS,
	DEFAULT_TEMPLATE_VERSIONS,
	DEFAULT_TITLE_PREFIXES,
} from "./defaults";

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
}

/**
 * Describes a validation rule for a single frontmatter field.
 *
 * Used to enforce type constraints and value requirements
 * during frontmatter validation.
 */
export interface FieldRule {
	/** The expected data type for this field. */
	readonly type: "string" | "date" | "number" | "array" | "wikilink" | "enum";
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
	/** List of suggested tags for autocompletion and validation. */
	readonly suggestedTags?: ReadonlyArray<string>;
	/** Validation rules keyed by note type (e.g., "project", "area"). */
	readonly frontmatterRules?: Record<string, FrontmatterRules>;
	/** Expected template_version for each note type. Used for migration tracking. */
	readonly templateVersions?: Record<string, number>;
	/** Default destination directories for each template type (e.g., project → 01_Projects). */
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
 * @returns Parsed config object, or undefined if file doesn't exist
 * @throws Error if file exists but cannot be parsed as JSON
 */
function loadJsonIfExists<T>(filePath: string): Partial<T> | undefined {
	if (!fs.existsSync(filePath)) return undefined;
	try {
		const raw = fs.readFileSync(filePath, "utf8");
		return JSON.parse(raw) as Partial<T>;
	} catch (error) {
		throw new Error(
			`Failed to parse config at ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

function resolveRcFromEnv(): string | undefined {
	const explicit = process.env.PARA_OBSIDIAN_CONFIG;
	return explicit && explicit.trim().length > 0 ? explicit : undefined;
}

function resolveUserRc(): string {
	const home = process.env.HOME ?? process.env.USERPROFILE ?? "~";
	return path.join(home, ".config", "para-obsidian", "config.json");
}

const PROJECT_RC = ".paraobsidianrc";

function resolveProjectRc(cwd: string): string | undefined {
	const candidate = path.join(cwd, PROJECT_RC);
	return fs.existsSync(candidate) ? candidate : undefined;
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
 * 1. Project-level: .para-obsidianrc in cwd
 * 2. User-level: ~/.config/para-obsidian/config.json
 * 3. Explicit: path from PARA_OBSIDIAN_CONFIG env var
 * 4. Required: PARA_VAULT env var (always required)
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
	const userRc = loadJsonIfExists<ParaObsidianConfig>(resolveUserRc()) ?? {};

	// Resolve vault path first so we can look for .paraobsidianrc in the vault
	const vault = path.resolve(envVault);
	if (!fs.existsSync(vault) || !fs.statSync(vault).isDirectory()) {
		throw new Error(`PARA_VAULT does not point to a directory: ${vault}`);
	}

	const projectRcPath = resolveProjectRc(vault);
	const projectRc = projectRcPath
		? (loadJsonIfExists<ParaObsidianConfig>(projectRcPath) ?? {})
		: {};
	const explicitRc = envConfigPath
		? (loadJsonIfExists<ParaObsidianConfig>(envConfigPath) ?? {})
		: {};

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

	return {
		...merged,
		vault,
		templatesDir,
		suggestedTags: merged.suggestedTags ?? [...DEFAULT_SUGGESTED_TAGS],
		frontmatterRules: merged.frontmatterRules ?? DEFAULT_FRONTMATTER_RULES,
		templateVersions: merged.templateVersions ?? DEFAULT_TEMPLATE_VERSIONS,
		defaultDestinations: merged.defaultDestinations ?? DEFAULT_DESTINATIONS,
		availableModels: merged.availableModels ?? [...DEFAULT_AVAILABLE_MODELS],
		defaultModel: merged.defaultModel ?? DEFAULT_MODEL,
		paraFolders: merged.paraFolders ?? DEFAULT_PARA_FOLDERS,
		defaultParaSearchFolders: merged.defaultParaSearchFolders ?? [
			...DEFAULT_PARA_SEARCH_FOLDERS,
		],
		titlePrefixes: merged.titlePrefixes ?? DEFAULT_TITLE_PREFIXES,
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
