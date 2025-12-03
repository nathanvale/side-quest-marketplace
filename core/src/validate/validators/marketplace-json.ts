/**
 * Validator for .claude-plugin/marketplace.json files
 *
 * Validates the official Claude Code marketplace.json schema:
 * - Required fields: name, owner, plugins
 * - Owner must have name and email
 * - Each plugin must have name and source
 * - Source can be relative path, GitHub object, or Git URL object
 * - Optional metadata: description, version, pluginRoot
 * - All local plugin directories must be registered in marketplace.json
 *
 * @see https://docs.anthropic.com/claude/docs/claude-code/plugins-reference
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { ValidationIssue, ValidatorOptions } from "../types.ts";

/**
 * Regex pattern for kebab-case validation
 * Allows lowercase letters, numbers, and hyphens (no uppercase, no spaces)
 */
const KEBAB_CASE_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Maximum length for marketplace name
 */
const MAX_NAME_LENGTH = 64;

/**
 * Regex pattern for email validation (basic)
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Marketplace owner structure
 */
interface MarketplaceOwner {
	name: string;
	email: string;
}

/**
 * Plugin source object (GitHub)
 */
interface PluginSourceGitHub {
	source: "github";
	repo: string;
}

/**
 * Plugin source object (Git URL)
 */
interface PluginSourceGit {
	source: "url";
	url: string;
}

/**
 * Plugin source type (can be string path or object)
 */
type PluginSource = string | PluginSourceGitHub | PluginSourceGit;

/**
 * Plugin entry structure
 */
interface PluginEntry {
	name: string;
	source: PluginSource;
	description?: string;
	version?: string;
	author?: { name: string; email?: string } | string;
	category?: string;
	keywords?: string[];
	pluginRoot?: string;
}

/**
 * Marketplace metadata structure (optional)
 */
interface MarketplaceMetadata {
	description?: string;
	version?: string;
}

/**
 * Marketplace.json structure
 */
interface MarketplaceJson {
	name: string;
	owner: MarketplaceOwner;
	metadata?: MarketplaceMetadata;
	plugins: PluginEntry[];
}

/**
 * Validates marketplace name format (kebab-case)
 */
function validateName(
	name: string,
	marketplaceJsonPath: string,
): ValidationIssue[] {
	const issues: ValidationIssue[] = [];

	if (name.length > MAX_NAME_LENGTH) {
		issues.push({
			ruleId: "marketplace/invalid-name-format",
			severity: "error",
			message: `Marketplace name exceeds maximum length of ${MAX_NAME_LENGTH} characters: "${name}"`,
			file: marketplaceJsonPath,
			suggestion: `Shorten the marketplace name to ${MAX_NAME_LENGTH} characters or less`,
		});
	}

	if (!KEBAB_CASE_PATTERN.test(name)) {
		issues.push({
			ruleId: "marketplace/invalid-name-format",
			severity: "error",
			message: `Marketplace name must be kebab-case (lowercase, hyphens, numbers only): "${name}"`,
			file: marketplaceJsonPath,
			suggestion:
				'Use kebab-case format (e.g., "my-marketplace", "side-quest-marketplace")',
		});
	}

	return issues;
}

/**
 * Validates owner structure
 */
function validateOwner(
	owner: MarketplaceOwner,
	marketplaceJsonPath: string,
): ValidationIssue[] {
	const issues: ValidationIssue[] = [];

	if (!owner.name) {
		issues.push({
			ruleId: "marketplace/missing-owner-name",
			severity: "error",
			message: "Owner object is missing required field: 'name'",
			file: marketplaceJsonPath,
			suggestion: 'Add a "name" field to the owner object',
		});
	}

	if (!owner.email) {
		issues.push({
			ruleId: "marketplace/missing-owner-email",
			severity: "error",
			message: "Owner object is missing required field: 'email'",
			file: marketplaceJsonPath,
			suggestion: 'Add an "email" field to the owner object',
		});
	} else if (!EMAIL_PATTERN.test(owner.email)) {
		issues.push({
			ruleId: "marketplace/invalid-owner-email",
			severity: "warning",
			message: `Owner email does not appear to be valid: "${owner.email}"`,
			file: marketplaceJsonPath,
			suggestion:
				"Ensure the email address is in valid format (user@domain.com)",
		});
	}

	return issues;
}

/**
 * Validates plugin source format and existence (for relative paths)
 */
function validatePluginSource(
	source: PluginSource,
	pluginName: string,
	pluginRoot: string,
	marketplaceJsonPath: string,
): ValidationIssue[] {
	const issues: ValidationIssue[] = [];

	// If source is a string, it should be a relative path
	if (typeof source === "string") {
		// Validate path starts with ./
		if (!source.startsWith("./")) {
			issues.push({
				ruleId: "marketplace/invalid-source-path",
				severity: "error",
				message: `Plugin '${pluginName}' source path must start with './' (relative to marketplace root): "${source}"`,
				file: marketplaceJsonPath,
				suggestion: `Change "${source}" to "./${source}"`,
			});
		} else {
			// Resolve path relative to plugin root
			const resolvedPath = join(pluginRoot, source.slice(2)); // Remove './'

			// Validate directory exists
			if (!existsSync(resolvedPath)) {
				issues.push({
					ruleId: "marketplace/source-not-found",
					severity: "error",
					message: `Plugin '${pluginName}' source directory not found: ${resolvedPath}`,
					file: marketplaceJsonPath,
					suggestion: `Create the plugin directory at ${resolvedPath} or update the source path`,
				});
			}
		}
	} else if (typeof source === "object") {
		// Validate source object format
		if (!source.source) {
			issues.push({
				ruleId: "marketplace/invalid-source-object",
				severity: "error",
				message: `Plugin '${pluginName}' source object is missing 'source' field`,
				file: marketplaceJsonPath,
				suggestion:
					'Add a "source" field with value "github" or "url" to the source object',
			});
		} else if (source.source === "github") {
			const githubSource = source as PluginSourceGitHub;
			if (!githubSource.repo) {
				issues.push({
					ruleId: "marketplace/missing-github-repo",
					severity: "error",
					message: `Plugin '${pluginName}' GitHub source is missing 'repo' field`,
					file: marketplaceJsonPath,
					suggestion:
						'Add a "repo" field with format "owner/repository" (e.g., "anthropic/claude-code")',
				});
			} else if (!githubSource.repo.includes("/")) {
				issues.push({
					ruleId: "marketplace/invalid-github-repo",
					severity: "error",
					message: `Plugin '${pluginName}' GitHub repo must be in 'owner/repository' format: "${githubSource.repo}"`,
					file: marketplaceJsonPath,
					suggestion:
						'Use format "owner/repository" (e.g., "anthropic/claude-code")',
				});
			}
		} else if (source.source === "url") {
			const gitSource = source as PluginSourceGit;
			if (!gitSource.url) {
				issues.push({
					ruleId: "marketplace/missing-git-url",
					severity: "error",
					message: `Plugin '${pluginName}' Git URL source is missing 'url' field`,
					file: marketplaceJsonPath,
					suggestion: 'Add a "url" field with a Git repository URL',
				});
			} else if (
				!gitSource.url.endsWith(".git") &&
				!gitSource.url.includes("github.com")
			) {
				issues.push({
					ruleId: "marketplace/invalid-git-url",
					severity: "warning",
					message: `Plugin '${pluginName}' Git URL may not be valid: "${gitSource.url}"`,
					file: marketplaceJsonPath,
					suggestion:
						"Ensure the URL is a valid Git repository URL (usually ends with .git)",
				});
			}
		} else {
			issues.push({
				ruleId: "marketplace/invalid-source-type",
				severity: "error",
				message: `Plugin '${pluginName}' has invalid source type: "${(source as { source: string }).source}"`,
				file: marketplaceJsonPath,
				suggestion: 'Use "github" or "url" for the source type',
			});
		}
	} else {
		issues.push({
			ruleId: "marketplace/invalid-source-format",
			severity: "error",
			message: `Plugin '${pluginName}' source must be a string or object`,
			file: marketplaceJsonPath,
			suggestion:
				'Use a relative path string (e.g., "./plugins/my-plugin") or source object',
		});
	}

	return issues;
}

/**
 * Validates a single plugin entry
 */
function validatePluginEntry(
	plugin: PluginEntry,
	pluginRoot: string,
	marketplaceJsonPath: string,
	index: number,
): ValidationIssue[] {
	const issues: ValidationIssue[] = [];

	// Validate required field: name
	if (!plugin.name) {
		issues.push({
			ruleId: "marketplace/missing-plugin-name",
			severity: "error",
			message: `Plugin at index ${index} is missing required field: 'name'`,
			file: marketplaceJsonPath,
			suggestion: 'Add a "name" field to the plugin entry',
		});
	} else if (typeof plugin.name !== "string") {
		issues.push({
			ruleId: "marketplace/invalid-plugin-name-type",
			severity: "error",
			message: `Plugin at index ${index} 'name' field must be a string`,
			file: marketplaceJsonPath,
			suggestion: "Change 'name' to a string value",
		});
	} else if (!KEBAB_CASE_PATTERN.test(plugin.name)) {
		issues.push({
			ruleId: "marketplace/invalid-plugin-name-format",
			severity: "error",
			message: `Plugin '${plugin.name}' name must be kebab-case (lowercase, hyphens, numbers only)`,
			file: marketplaceJsonPath,
			suggestion:
				'Use kebab-case format (e.g., "my-plugin", "git-tools", "code-review")',
		});
	}

	// Validate required field: source
	if (!plugin.source) {
		issues.push({
			ruleId: "marketplace/missing-plugin-source",
			severity: "error",
			message: `Plugin '${plugin.name || `at index ${index}`}' is missing required field: 'source'`,
			file: marketplaceJsonPath,
			suggestion: 'Add a "source" field with a relative path or source object',
		});
	} else {
		issues.push(
			...validatePluginSource(
				plugin.source,
				plugin.name || `at index ${index}`,
				pluginRoot,
				marketplaceJsonPath,
			),
		);
	}

	// Validate optional keywords array
	if (plugin.keywords) {
		if (!Array.isArray(plugin.keywords)) {
			issues.push({
				ruleId: "marketplace/invalid-keywords-type",
				severity: "error",
				message: `Plugin '${plugin.name}' keywords field must be an array`,
				file: marketplaceJsonPath,
				suggestion:
					'Change keywords to an array of strings (e.g., ["git", "mcp"])',
			});
		} else {
			for (const keyword of plugin.keywords) {
				if (typeof keyword !== "string") {
					issues.push({
						ruleId: "marketplace/invalid-keyword-type",
						severity: "error",
						message: `Plugin '${plugin.name}' keyword must be a string: ${JSON.stringify(keyword)}`,
						file: marketplaceJsonPath,
						suggestion: "Ensure all keywords are strings",
					});
				}
			}
		}
	}

	return issues;
}

/**
 * Validates that all local plugin directories are registered in marketplace.json
 */
function validateAllPluginsRegistered(
	plugins: PluginEntry[],
	pluginRoot: string,
	marketplaceJsonPath: string,
): ValidationIssue[] {
	const issues: ValidationIssue[] = [];

	// Get the plugins directory path (should be sibling to .claude-plugin)
	const pluginsDir = join(pluginRoot, "plugins");

	// If plugins directory doesn't exist, skip validation
	if (!existsSync(pluginsDir)) {
		return issues;
	}

	// Get all directories in the plugins folder
	const pluginDirs = readdirSync(pluginsDir).filter((item) => {
		const fullPath = join(pluginsDir, item);
		return statSync(fullPath).isDirectory();
	});

	// Get list of registered plugin names from relative path sources
	const registeredPlugins = new Set<string>();
	for (const plugin of plugins) {
		if (
			typeof plugin.source === "string" &&
			plugin.source.startsWith("./plugins/")
		) {
			const pluginName = plugin.source.replace("./plugins/", "");
			registeredPlugins.add(pluginName);
		}
	}

	// Check if any directories are not registered
	for (const dir of pluginDirs) {
		if (!registeredPlugins.has(dir)) {
			issues.push({
				ruleId: "marketplace/unregistered-plugin",
				severity: "error",
				message: `Plugin directory 'plugins/${dir}' exists but is not registered in marketplace.json`,
				file: marketplaceJsonPath,
				suggestion: `Add an entry for '${dir}' to the plugins array with source: "./plugins/${dir}"`,
			});
		}
	}

	return issues;
}

/**
 * Validates .claude-plugin/marketplace.json structure and references
 */
export async function validateMarketplaceJson(
	options: ValidatorOptions,
): Promise<ValidationIssue[]> {
	const issues: ValidationIssue[] = [];
	const marketplaceJsonPath = join(
		options.pluginRoot,
		".claude-plugin",
		"marketplace.json",
	);

	// If marketplace.json doesn't exist, skip validation (not required)
	if (!existsSync(marketplaceJsonPath)) {
		return issues;
	}

	try {
		// Read and parse marketplace.json
		const content = await Bun.file(marketplaceJsonPath).text();
		const config: MarketplaceJson = JSON.parse(content);

		// Validate required field: name
		if (!config.name) {
			issues.push({
				ruleId: "marketplace/missing-name",
				severity: "error",
				message: "marketplace.json is missing required field: 'name'",
				file: marketplaceJsonPath,
				suggestion: 'Add a "name" field with kebab-case format',
			});
		} else if (typeof config.name !== "string") {
			issues.push({
				ruleId: "marketplace/invalid-name-type",
				severity: "error",
				message: "'name' field must be a string",
				file: marketplaceJsonPath,
				suggestion: "Change 'name' to a string value",
			});
		} else {
			// Validate name format
			issues.push(...validateName(config.name, marketplaceJsonPath));
		}

		// Validate required field: owner
		if (!config.owner) {
			issues.push({
				ruleId: "marketplace/missing-owner",
				severity: "error",
				message: "marketplace.json is missing required field: 'owner'",
				file: marketplaceJsonPath,
				suggestion: 'Add an "owner" object with name and email fields',
			});
		} else if (typeof config.owner !== "object") {
			issues.push({
				ruleId: "marketplace/invalid-owner-type",
				severity: "error",
				message: "'owner' field must be an object",
				file: marketplaceJsonPath,
				suggestion: 'Change owner to an object with "name" and "email" fields',
			});
		} else {
			// Validate owner structure
			issues.push(...validateOwner(config.owner, marketplaceJsonPath));
		}

		// Validate required field: plugins
		if (!config.plugins) {
			issues.push({
				ruleId: "marketplace/missing-plugins",
				severity: "error",
				message: "marketplace.json is missing required field: 'plugins'",
				file: marketplaceJsonPath,
				suggestion: 'Add a "plugins" array with plugin entries',
			});
		} else if (!Array.isArray(config.plugins)) {
			issues.push({
				ruleId: "marketplace/invalid-plugins-type",
				severity: "error",
				message: "'plugins' field must be an array",
				file: marketplaceJsonPath,
				suggestion: "Change plugins to an array of plugin objects",
			});
		} else if (config.plugins.length === 0) {
			issues.push({
				ruleId: "marketplace/empty-plugins",
				severity: "warning",
				message: "Marketplace has no plugins defined",
				file: marketplaceJsonPath,
				suggestion: "Add at least one plugin entry to the plugins array",
			});
		} else {
			// Validate each plugin entry
			for (let i = 0; i < config.plugins.length; i++) {
				const plugin = config.plugins[i];
				if (!plugin || typeof plugin !== "object") {
					issues.push({
						ruleId: "marketplace/invalid-plugin-entry",
						severity: "error",
						message: `Plugin at index ${i} must be an object`,
						file: marketplaceJsonPath,
						suggestion:
							"Ensure all plugin entries are objects with name and source fields",
					});
				} else {
					issues.push(
						...validatePluginEntry(
							plugin as PluginEntry,
							options.pluginRoot,
							marketplaceJsonPath,
							i,
						),
					);
				}
			}

			// Check for duplicate plugin names
			const pluginNames = config.plugins
				.map((p) => p?.name)
				.filter((name): name is string => typeof name === "string");
			const duplicates = pluginNames.filter(
				(name, index) => pluginNames.indexOf(name) !== index,
			);

			for (const duplicate of new Set(duplicates)) {
				issues.push({
					ruleId: "marketplace/duplicate-plugin-name",
					severity: "error",
					message: `Duplicate plugin name found: "${duplicate}"`,
					file: marketplaceJsonPath,
					suggestion: "Ensure all plugin names are unique in the marketplace",
				});
			}

			// Check that all local plugin directories are registered
			issues.push(
				...validateAllPluginsRegistered(
					config.plugins,
					options.pluginRoot,
					marketplaceJsonPath,
				),
			);
		}
	} catch (error) {
		issues.push({
			ruleId: "marketplace/parse-error",
			severity: "error",
			message: `Failed to parse marketplace.json: ${error instanceof Error ? error.message : String(error)}`,
			file: marketplaceJsonPath,
			suggestion: "Ensure marketplace.json is valid JSON with proper syntax",
		});
	}

	return issues;
}
