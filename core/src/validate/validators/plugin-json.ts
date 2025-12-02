/**
 * Validator for .claude-plugin/plugin.json files
 *
 * Validates the official Claude Code plugin.json schema:
 * - Required fields: name
 * - Recommended fields: version, description, author, homepage, repository, license, keywords
 * - Component path fields: commands, agents, hooks, mcpServers, skills
 *
 * @see https://docs.anthropic.com/claude/docs/claude-code/plugins-reference
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ValidationIssue, ValidatorOptions } from "../types.ts";

/**
 * Regex pattern for kebab-case validation
 * Allows lowercase letters, numbers, and hyphens (no uppercase, no spaces)
 */
const KEBAB_CASE_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Maximum length for plugin name
 */
const MAX_NAME_LENGTH = 64;

/**
 * Maximum length for description
 */
const MAX_DESCRIPTION_LENGTH = 256;

/**
 * Regex pattern for semver validation
 * Matches: 1.0.0, 1.2.3-beta.1, 2.0.0+build.123
 */
const SEMVER_PATTERN =
	/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/**
 * Validates if a string is a valid URL
 */
function isValidUrl(url: string): boolean {
	try {
		new URL(url);
		return true;
	} catch {
		return false;
	}
}

/**
 * Plugin author structure
 */
interface PluginAuthor {
	name: string;
	email?: string;
	url?: string;
}

/**
 * Plugin repository structure (can be URL string or object)
 */
interface PluginRepository {
	type?: string;
	url: string;
}

/**
 * Plugin.json structure (official schema)
 */
interface PluginJson {
	name: string;
	version?: string;
	description?: string;
	author?: PluginAuthor | string;
	homepage?: string;
	repository?: PluginRepository | string;
	license?: string;
	keywords?: string[];
	commands?: string | string[];
	agents?: string | string[];
	hooks?: string | string[];
	mcpServers?: string | string[];
	skills?: string | string[];
}

/**
 * Validates plugin name format (kebab-case)
 */
function validateName(name: string, pluginJsonPath: string): ValidationIssue[] {
	const issues: ValidationIssue[] = [];

	if (name.length > MAX_NAME_LENGTH) {
		issues.push({
			ruleId: "plugin/invalid-name-format",
			severity: "error",
			message: `Plugin name exceeds maximum length of ${MAX_NAME_LENGTH} characters: "${name}"`,
			file: pluginJsonPath,
			suggestion: `Shorten the plugin name to ${MAX_NAME_LENGTH} characters or less`,
		});
	}

	if (!KEBAB_CASE_PATTERN.test(name)) {
		issues.push({
			ruleId: "plugin/invalid-name-format",
			severity: "error",
			message: `Plugin name must be kebab-case (lowercase, hyphens, numbers only): "${name}"`,
			file: pluginJsonPath,
			suggestion:
				'Use kebab-case format (e.g., "my-plugin", "git-tools", "code-review")',
		});
	}

	return issues;
}

/**
 * Validates version format (semver)
 */
function validateVersion(
	version: string,
	pluginJsonPath: string,
): ValidationIssue[] {
	const issues: ValidationIssue[] = [];

	if (!SEMVER_PATTERN.test(version)) {
		issues.push({
			ruleId: "plugin/invalid-version",
			severity: "warning",
			message: `Version should follow semver format: "${version}"`,
			file: pluginJsonPath,
			suggestion: 'Use semver format (e.g., "1.0.0", "2.1.3-beta.1")',
		});
	}

	return issues;
}

/**
 * Validates description length
 */
function validateDescription(
	description: string,
	pluginJsonPath: string,
): ValidationIssue[] {
	const issues: ValidationIssue[] = [];

	if (description.length > MAX_DESCRIPTION_LENGTH) {
		issues.push({
			ruleId: "plugin/invalid-description",
			severity: "warning",
			message: `Description exceeds maximum length of ${MAX_DESCRIPTION_LENGTH} characters`,
			file: pluginJsonPath,
			suggestion: `Shorten the description to ${MAX_DESCRIPTION_LENGTH} characters or less`,
		});
	}

	return issues;
}

/**
 * Validates that referenced files exist
 * Handles both string and array formats, and normalizes paths
 */
function validateReferencedFiles(
	paths: string | string[] | undefined,
	fieldName: string,
	pluginRoot: string,
	pluginJsonPath: string,
): ValidationIssue[] {
	const issues: ValidationIssue[] = [];

	if (!paths) {
		return issues;
	}

	// Normalize to array
	const pathArray = Array.isArray(paths) ? paths : [paths];

	for (const path of pathArray) {
		if (typeof path !== "string") {
			issues.push({
				ruleId: "plugin/invalid-path-type",
				severity: "error",
				message: `Path in '${fieldName}' must be a string: ${JSON.stringify(path)}`,
				file: pluginJsonPath,
				suggestion: "Ensure all paths are strings",
			});
			continue;
		}

		// Validate path starts with ./
		if (!path.startsWith("./")) {
			issues.push({
				ruleId: "plugin/invalid-path-format",
				severity: "error",
				message: `Path in '${fieldName}' must start with './' (relative to plugin root): "${path}"`,
				file: pluginJsonPath,
				suggestion: `Change "${path}" to "./${path}"`,
			});
			continue;
		}

		// Special validation for hooks field - warn if referencing the standard hooks/hooks.json
		if (fieldName === "hooks" && path === "./hooks/hooks.json") {
			issues.push({
				ruleId: "plugin/duplicate-hooks-file",
				severity: "error",
				message: `Standard hooks file './hooks/hooks.json' is loaded automatically and should not be referenced in the 'hooks' field`,
				file: pluginJsonPath,
				suggestion:
					"Remove './hooks/hooks.json' from the hooks array. The standard hooks/hooks.json is loaded automatically. Only reference additional hook files.",
			});
			continue;
		}

		// Validate file extension based on field type
		if (fieldName === "commands" && !path.endsWith(".md")) {
			issues.push({
				ruleId: "plugin/invalid-command-extension",
				severity: "error",
				message: `Command file must have .md extension: "${path}"`,
				file: pluginJsonPath,
				suggestion: `Rename to "${path.replace(/\.[^.]+$/, "")}.md" or add .md extension`,
			});
		}

		if (fieldName === "mcpServers" && !path.endsWith(".json")) {
			issues.push({
				ruleId: "plugin/invalid-mcp-server-extension",
				severity: "error",
				message: `MCP server configuration must have .json extension: "${path}"`,
				file: pluginJsonPath,
				suggestion: `Use a .json file (typically './.mcp.json')`,
			});
		}

		// Resolve path relative to plugin root
		const resolvedPath = join(pluginRoot, path.slice(2)); // Remove './'

		// Validate file exists
		if (!existsSync(resolvedPath)) {
			issues.push({
				ruleId: "plugin/referenced-file-not-found",
				severity: "error",
				message: `Referenced file not found in '${fieldName}': ${resolvedPath}`,
				file: pluginJsonPath,
				suggestion: `Create the file at ${resolvedPath} or remove the reference from '${fieldName}'`,
			});
		}
	}

	return issues;
}

/**
 * Validates recommended fields and warns if missing
 */
function validateRecommendedFields(
	config: PluginJson,
	pluginJsonPath: string,
): ValidationIssue[] {
	const issues: ValidationIssue[] = [];

	if (!config.version) {
		issues.push({
			ruleId: "plugin/missing-version",
			severity: "warning",
			message: "Plugin is missing recommended field: 'version'",
			file: pluginJsonPath,
			suggestion: 'Add a "version" field with semver format (e.g., "1.0.0")',
		});
	}

	if (!config.description) {
		issues.push({
			ruleId: "plugin/missing-description",
			severity: "warning",
			message: "Plugin is missing recommended field: 'description'",
			file: pluginJsonPath,
			suggestion: 'Add a "description" field explaining what the plugin does',
		});
	}

	if (!config.author) {
		issues.push({
			ruleId: "plugin/missing-author",
			severity: "warning",
			message: "Plugin is missing recommended field: 'author'",
			file: pluginJsonPath,
			suggestion: 'Add an "author" field with your name or organization',
		});
	}

	if (!config.repository) {
		issues.push({
			ruleId: "plugin/missing-repository",
			severity: "warning",
			message: "Plugin is missing recommended field: 'repository'",
			file: pluginJsonPath,
			suggestion: 'Add a "repository" field with the plugin source URL',
		});
	}

	if (!config.license) {
		issues.push({
			ruleId: "plugin/missing-license",
			severity: "warning",
			message: "Plugin is missing recommended field: 'license'",
			file: pluginJsonPath,
			suggestion:
				'Add a "license" field with an SPDX identifier (e.g., "MIT", "Apache-2.0")',
		});
	}

	if (!config.keywords || config.keywords.length === 0) {
		issues.push({
			ruleId: "plugin/missing-keywords",
			severity: "warning",
			message: "Plugin is missing recommended field: 'keywords'",
			file: pluginJsonPath,
			suggestion: 'Add a "keywords" array to help users discover the plugin',
		});
	}

	return issues;
}

/**
 * Validates .claude-plugin/plugin.json structure and references
 */
export async function validatePluginJson(
	options: ValidatorOptions,
): Promise<ValidationIssue[]> {
	const issues: ValidationIssue[] = [];
	const pluginJsonPath = join(
		options.pluginRoot,
		".claude-plugin",
		"plugin.json",
	);

	// If plugin.json doesn't exist, skip validation (not required by this validator)
	// Note: plugin-structure validator will check if the file exists
	if (!existsSync(pluginJsonPath)) {
		return issues;
	}

	try {
		// Read and parse plugin.json
		const content = await Bun.file(pluginJsonPath).text();
		const config: PluginJson = JSON.parse(content);

		// Validate required field: name
		if (!config.name) {
			issues.push({
				ruleId: "plugin/missing-name",
				severity: "error",
				message: "plugin.json is missing required field: 'name'",
				file: pluginJsonPath,
				suggestion: 'Add a "name" field with kebab-case format',
			});
		} else if (typeof config.name !== "string") {
			issues.push({
				ruleId: "plugin/invalid-name-type",
				severity: "error",
				message: "'name' field must be a string",
				file: pluginJsonPath,
				suggestion: "Change 'name' to a string value",
			});
		} else {
			// Validate name format
			issues.push(...validateName(config.name, pluginJsonPath));
		}

		// Validate version format if present
		if (config.version) {
			if (typeof config.version !== "string") {
				issues.push({
					ruleId: "plugin/invalid-version-type",
					severity: "error",
					message: "'version' field must be a string",
					file: pluginJsonPath,
					suggestion: 'Use semver string format (e.g., "1.0.0")',
				});
			} else {
				issues.push(...validateVersion(config.version, pluginJsonPath));
			}
		}

		// Validate description length if present
		if (config.description) {
			if (typeof config.description !== "string") {
				issues.push({
					ruleId: "plugin/invalid-description-type",
					severity: "error",
					message: "'description' field must be a string",
					file: pluginJsonPath,
					suggestion: "Change 'description' to a string value",
				});
			} else {
				issues.push(...validateDescription(config.description, pluginJsonPath));
			}
		}

		// Validate author format if present
		if (config.author) {
			if (
				typeof config.author !== "string" &&
				typeof config.author !== "object"
			) {
				issues.push({
					ruleId: "plugin/invalid-author-type",
					severity: "error",
					message: "'author' field must be a string or object",
					file: pluginJsonPath,
					suggestion:
						'Use either a string ("John Doe") or object ({ "name": "John Doe", "email": "..." })',
				});
			} else if (typeof config.author === "object" && !config.author.name) {
				issues.push({
					ruleId: "plugin/missing-author-name",
					severity: "error",
					message: "Author object is missing required field: 'name'",
					file: pluginJsonPath,
					suggestion: 'Add a "name" field to the author object',
				});
			}
		}

		// Validate homepage URL format if present
		if (config.homepage) {
			if (typeof config.homepage !== "string") {
				issues.push({
					ruleId: "plugin/invalid-homepage-type",
					severity: "error",
					message: "'homepage' field must be a string",
					file: pluginJsonPath,
					suggestion: "Change 'homepage' to a valid URL string",
				});
			} else if (!isValidUrl(config.homepage)) {
				issues.push({
					ruleId: "plugin/invalid-homepage-url",
					severity: "error",
					message: `'homepage' must be a valid URL: "${config.homepage}"`,
					file: pluginJsonPath,
					suggestion: "Provide a valid URL starting with https://",
				});
			}
		}

		// Validate repository URL format if present
		if (config.repository) {
			if (typeof config.repository === "string") {
				if (!isValidUrl(config.repository)) {
					issues.push({
						ruleId: "plugin/invalid-repository-url",
						severity: "error",
						message: `'repository' must be a valid URL: "${config.repository}"`,
						file: pluginJsonPath,
						suggestion: "Provide a valid URL starting with https://",
					});
				}
			} else if (typeof config.repository === "object") {
				if (!config.repository.url) {
					issues.push({
						ruleId: "plugin/missing-repository-url",
						severity: "error",
						message: "Repository object is missing required field: 'url'",
						file: pluginJsonPath,
						suggestion: 'Add a "url" field to the repository object',
					});
				} else if (typeof config.repository.url !== "string") {
					issues.push({
						ruleId: "plugin/invalid-repository-url-type",
						severity: "error",
						message: "'repository.url' field must be a string",
						file: pluginJsonPath,
						suggestion: "Change 'repository.url' to a valid URL string",
					});
				} else if (!isValidUrl(config.repository.url)) {
					issues.push({
						ruleId: "plugin/invalid-repository-url",
						severity: "error",
						message: `'repository.url' must be a valid URL: "${config.repository.url}"`,
						file: pluginJsonPath,
						suggestion: "Provide a valid URL starting with https://",
					});
				}
			} else {
				issues.push({
					ruleId: "plugin/invalid-repository-type",
					severity: "error",
					message: "'repository' field must be a string or object",
					file: pluginJsonPath,
					suggestion:
						'Use either a URL string or object ({ "type": "git", "url": "..." })',
				});
			}
		}

		// Validate keywords is an array if present
		if (config.keywords) {
			if (!Array.isArray(config.keywords)) {
				issues.push({
					ruleId: "plugin/invalid-keywords-type",
					severity: "error",
					message: "'keywords' field must be an array",
					file: pluginJsonPath,
					suggestion:
						'Change keywords to an array of strings (e.g., ["git", "mcp"])',
				});
			} else {
				// Validate each keyword is a string
				for (const keyword of config.keywords) {
					if (typeof keyword !== "string") {
						issues.push({
							ruleId: "plugin/invalid-keyword-type",
							severity: "error",
							message: `Keyword must be a string: ${JSON.stringify(keyword)}`,
							file: pluginJsonPath,
							suggestion: "Ensure all keywords are strings",
						});
					}
				}
			}
		}

		// Validate recommended fields (warnings only)
		issues.push(...validateRecommendedFields(config, pluginJsonPath));

		// Validate component path references
		issues.push(
			...validateReferencedFiles(
				config.commands,
				"commands",
				options.pluginRoot,
				pluginJsonPath,
			),
		);
		issues.push(
			...validateReferencedFiles(
				config.agents,
				"agents",
				options.pluginRoot,
				pluginJsonPath,
			),
		);
		issues.push(
			...validateReferencedFiles(
				config.hooks,
				"hooks",
				options.pluginRoot,
				pluginJsonPath,
			),
		);
		issues.push(
			...validateReferencedFiles(
				config.mcpServers,
				"mcpServers",
				options.pluginRoot,
				pluginJsonPath,
			),
		);
		issues.push(
			...validateReferencedFiles(
				config.skills,
				"skills",
				options.pluginRoot,
				pluginJsonPath,
			),
		);
	} catch (error) {
		issues.push({
			ruleId: "plugin/parse-error",
			severity: "error",
			message: `Failed to parse plugin.json: ${error instanceof Error ? error.message : String(error)}`,
			file: pluginJsonPath,
			suggestion: "Ensure plugin.json is valid JSON with proper syntax",
		});
	}

	return issues;
}
