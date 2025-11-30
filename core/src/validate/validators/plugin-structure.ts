/**
 * Validator for plugin folder structure
 *
 * Validates that plugins follow the standard folder structure conventions:
 * - .claude-plugin/plugin.json (required)
 * - agents/ for agent markdown files
 * - hooks/ for hook scripts
 * - mcp-servers/ for MCP server implementations
 * - skills/ for agent skills
 * - commands/ for slash commands
 * - src/ for shared source code (if a workspace package)
 *
 * Also validates that plugins don't have non-standard folders that could
 * indicate structural issues.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { ValidationIssue, ValidatorOptions } from "../types.ts";

/**
 * Standard plugin folder names
 */
const STANDARD_FOLDERS = new Set([
	".claude-plugin",
	"agents",
	"commands",
	"hooks",
	"mcp-servers",
	"skills",
	"src",
]);

/**
 * Folders that are always allowed (build artifacts, config, etc.)
 */
const ALLOWED_FOLDERS = new Set([
	".git",
	"node_modules",
	"dist",
	"build",
	".turbo",
	".cache",
]);

/**
 * Files that are always allowed at plugin root
 */
const ALLOWED_ROOT_FILES = new Set([
	"package.json",
	"tsconfig.json",
	"biome.json",
	"README.md",
	"CLAUDE.md",
	"LICENSE",
	".gitignore",
	".mcp.json",
	".vault-id",
	"bun.lock",
	"package-lock.json",
	"pnpm-lock.yaml",
	"yarn.lock",
]);

/**
 * Check if a folder name is a standard plugin folder
 */
function isStandardFolder(name: string): boolean {
	return STANDARD_FOLDERS.has(name) || ALLOWED_FOLDERS.has(name);
}

/**
 * Check if a file name is an allowed root file
 */
function isAllowedRootFile(name: string): boolean {
	// Check exact match or common patterns
	if (ALLOWED_ROOT_FILES.has(name)) return true;
	// Allow dotfiles
	if (name.startsWith(".")) return true;
	// Allow markdown files
	if (name.endsWith(".md")) return true;
	// Allow config files
	if (name.endsWith(".json") || name.endsWith(".yaml") || name.endsWith(".yml"))
		return true;

	return false;
}

/**
 * Validates plugin folder structure
 */
export async function validatePluginStructure(
	options: ValidatorOptions,
): Promise<ValidationIssue[]> {
	const issues: ValidationIssue[] = [];
	const pluginRoot = options.pluginRoot;
	const pluginJsonPath = join(pluginRoot, ".claude-plugin", "plugin.json");

	// Skip if this is not a plugin (no .claude-plugin/plugin.json)
	if (!existsSync(pluginJsonPath)) {
		return issues;
	}

	try {
		// Get all entries in the plugin root
		const entries = readdirSync(pluginRoot, { withFileTypes: true });

		// Check for non-standard folders
		for (const entry of entries) {
			if (!entry.isDirectory()) {
				// Check files
				if (!isAllowedRootFile(entry.name)) {
					issues.push({
						ruleId: "structure/unexpected-root-file",
						severity: "info",
						message: `Unexpected file at plugin root: ${entry.name}`,
						file: join(pluginRoot, entry.name),
						suggestion:
							"Consider moving this file to an appropriate subfolder or adding it to .gitignore",
					});
				}
				continue;
			}

			// Check folders
			if (!isStandardFolder(entry.name)) {
				// Special case: 'core' folder is deprecated, should be 'src'
				if (entry.name === "core") {
					issues.push({
						ruleId: "structure/deprecated-core-folder",
						severity: "warning",
						message:
							'Folder "core" should be renamed to "src" for consistency with other plugins',
						file: join(pluginRoot, entry.name),
						suggestion:
							'Rename "core" to "src" and update workspace configuration',
					});
				} else {
					issues.push({
						ruleId: "structure/non-standard-folder",
						severity: "info",
						message: `Non-standard folder at plugin root: ${entry.name}`,
						file: join(pluginRoot, entry.name),
						suggestion: `Standard folders are: ${Array.from(STANDARD_FOLDERS).join(", ")}`,
					});
				}
			}
		}

		// Validate hooks folder structure if it exists
		const hooksPath = join(pluginRoot, "hooks");
		if (existsSync(hooksPath) && statSync(hooksPath).isDirectory()) {
			const hooksJsonPath = join(hooksPath, "hooks.json");
			if (!existsSync(hooksJsonPath)) {
				issues.push({
					ruleId: "structure/missing-hooks-json",
					severity: "warning",
					message: "hooks/ folder exists but hooks.json is missing",
					file: hooksPath,
					suggestion: "Add hooks.json to define hook configurations",
				});
			}
		}

		// Validate mcp-servers folder structure if it exists
		const mcpServersPath = join(pluginRoot, "mcp-servers");
		if (existsSync(mcpServersPath) && statSync(mcpServersPath).isDirectory()) {
			const serverDirs = readdirSync(mcpServersPath, { withFileTypes: true })
				.filter((d) => d.isDirectory())
				.map((d) => d.name);

			for (const serverName of serverDirs) {
				const serverPath = join(mcpServersPath, serverName);
				const indexPath = join(serverPath, "index.ts");
				const packagePath = join(serverPath, "package.json");

				if (!existsSync(indexPath)) {
					issues.push({
						ruleId: "structure/mcp-server-missing-index",
						severity: "error",
						message: `MCP server "${serverName}" is missing index.ts`,
						file: serverPath,
						suggestion: "Create index.ts as the server entry point",
					});
				}

				if (!existsSync(packagePath)) {
					issues.push({
						ruleId: "structure/mcp-server-missing-package",
						severity: "warning",
						message: `MCP server "${serverName}" is missing package.json`,
						file: serverPath,
						suggestion:
							"Add package.json with server dependencies and metadata",
					});
				}
			}
		}

		// Validate skills folder structure if it exists
		const skillsPath = join(pluginRoot, "skills");
		if (existsSync(skillsPath) && statSync(skillsPath).isDirectory()) {
			const skillDirs = readdirSync(skillsPath, { withFileTypes: true })
				.filter((d) => d.isDirectory())
				.map((d) => d.name);

			for (const skillName of skillDirs) {
				const skillPath = join(skillsPath, skillName);
				const skillMdPath = join(skillPath, "SKILL.md");

				if (!existsSync(skillMdPath)) {
					issues.push({
						ruleId: "structure/skill-missing-md",
						severity: "error",
						message: `Skill "${skillName}" is missing SKILL.md`,
						file: skillPath,
						suggestion:
							"Create SKILL.md with skill description and instructions",
					});
				}
			}
		}

		// Validate commands folder structure if it exists
		const commandsPath = join(pluginRoot, "commands");
		if (existsSync(commandsPath) && statSync(commandsPath).isDirectory()) {
			const commandFiles = readdirSync(commandsPath, { withFileTypes: true })
				.filter((f) => f.isFile())
				.map((f) => f.name);

			for (const commandFile of commandFiles) {
				if (!commandFile.endsWith(".md")) {
					issues.push({
						ruleId: "structure/command-not-markdown",
						severity: "warning",
						message: `Command file "${commandFile}" should be a markdown file (.md)`,
						file: join(commandsPath, commandFile),
						suggestion: "Rename to use .md extension",
					});
				}
			}
		}

		// Check for src/ folder with package.json (workspace package)
		const srcPath = join(pluginRoot, "src");
		if (existsSync(srcPath) && statSync(srcPath).isDirectory()) {
			const srcPackagePath = join(srcPath, "package.json");
			if (existsSync(srcPackagePath)) {
				// This is a workspace package - validate it has required fields
				try {
					const packageJson = JSON.parse(await Bun.file(srcPackagePath).text());
					if (!packageJson.name) {
						issues.push({
							ruleId: "structure/src-package-missing-name",
							severity: "error",
							message: "src/package.json is missing 'name' field",
							file: srcPackagePath,
							suggestion: "Add a name field like '@sidequest/plugin-name-core'",
						});
					}
				} catch (_error) {
					issues.push({
						ruleId: "structure/src-package-invalid",
						severity: "error",
						message: "src/package.json contains invalid JSON",
						file: srcPackagePath,
						suggestion: "Fix JSON syntax errors in package.json",
					});
				}
			}
		}
	} catch (error) {
		issues.push({
			ruleId: "structure/validation-error",
			severity: "error",
			message: `Failed to validate plugin structure: ${error instanceof Error ? error.message : String(error)}`,
			file: pluginRoot,
			suggestion: "Check that the plugin directory is accessible",
		});
	}

	return issues;
}
