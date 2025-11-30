import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { ValidationIssue, ValidatorOptions } from "../types.ts";

/**
 * Parse YAML frontmatter from markdown content
 * Supports basic key-value pairs only (sufficient for command frontmatter)
 */
function parseFrontmatter(content: string): Record<string, unknown> | null {
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (!frontmatterMatch || !frontmatterMatch[1]) {
		return null;
	}

	const frontmatterText = frontmatterMatch[1];
	const result: Record<string, unknown> = {};

	const lines = frontmatterText.split("\n");
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) {
			continue;
		}

		const colonIndex = trimmed.indexOf(":");
		if (colonIndex === -1) {
			continue;
		}

		const key = trimmed.slice(0, colonIndex).trim();
		const value = trimmed.slice(colonIndex + 1).trim();

		// Parse boolean values
		if (value === "true") {
			result[key] = true;
		} else if (value === "false") {
			result[key] = false;
		} else {
			// Store as string (handles allowed-tools, argument-hint, description, model)
			result[key] = value;
		}
	}

	return result;
}

/**
 * Validates the allowed-tools field format
 * Expects: comma-separated tool names with optional (...) suffix
 * Example: "Bash, Read, Write" or "Bash(...), WebFetch(...)"
 */
function validateAllowedTools(
	allowedTools: string,
	filePath: string,
	relativePath: string,
): ValidationIssue[] {
	const issues: ValidationIssue[] = [];

	// Check for empty string
	if (allowedTools.trim() === "") {
		issues.push({
			ruleId: "command/invalid-allowed-tools",
			severity: "error",
			message: `Command ${relativePath} has empty 'allowed-tools' field`,
			file: filePath,
			suggestion:
				"Remove the allowed-tools field or specify at least one tool name",
		});
		return issues;
	}

	// Split by comma and validate each tool name
	const toolNames = allowedTools.split(",").map((t) => t.trim());

	for (const toolName of toolNames) {
		// Check for empty tool name (e.g., "Bash, , Read")
		if (toolName === "") {
			issues.push({
				ruleId: "command/invalid-allowed-tools",
				severity: "error",
				message: `Command ${relativePath} has empty tool name in 'allowed-tools'`,
				file: filePath,
				suggestion: "Remove the extra comma or specify a tool name",
			});
			continue;
		}

		// Valid tool name pattern: identifier with optional (...) suffix
		// Also allow : and - for patterns like "Bash(git add:*)" or "mcp__plugin_name__tool"
		const toolNamePattern = /^[A-Za-z_][A-Za-z0-9_:-]*(\([\s\S]*?\))?$/;

		if (!toolNamePattern.test(toolName)) {
			// Check for specific common mistakes
			if (/^\d/.test(toolName)) {
				issues.push({
					ruleId: "command/invalid-allowed-tools",
					severity: "error",
					message: `Command ${relativePath} has invalid tool name '${toolName}' (starts with number)`,
					file: filePath,
					suggestion: "Tool names must start with a letter or underscore",
				});
			} else if (toolName.includes(" ") && !toolName.includes("(")) {
				issues.push({
					ruleId: "command/invalid-allowed-tools",
					severity: "error",
					message: `Command ${relativePath} has invalid tool name '${toolName}' (contains space)`,
					file: filePath,
					suggestion:
						"Tool names cannot contain spaces. Use comma to separate multiple tools.",
				});
			} else {
				issues.push({
					ruleId: "command/invalid-allowed-tools",
					severity: "error",
					message: `Command ${relativePath} has invalid tool name '${toolName}'`,
					file: filePath,
					suggestion:
						"Tool names must be valid identifiers (letters, numbers, underscores, colons, hyphens) with optional (...) suffix",
				});
			}
		}
	}

	return issues;
}

/**
 * Recursively find all files in a directory (not just markdown)
 */
function findAllFiles(dir: string): string[] {
	const results: string[] = [];

	const entries = readdirSync(dir);
	for (const entry of entries) {
		const fullPath = join(dir, entry);
		const stat = statSync(fullPath);

		if (stat.isDirectory()) {
			results.push(...findAllFiles(fullPath));
		} else if (stat.isFile()) {
			results.push(fullPath);
		}
	}

	return results;
}

/**
 * Validates command markdown files in the commands directory
 *
 * Checks:
 * - All files in commands/ are markdown (.md extension)
 * - Frontmatter is valid YAML if present
 * - Description field is present (required for SlashCommand tool support)
 * - Content is not too short after frontmatter
 */
export async function validateCommandsMd(
	options: ValidatorOptions,
): Promise<ValidationIssue[]> {
	const issues: ValidationIssue[] = [];
	const commandsDir = join(options.pluginRoot, "commands");

	if (!existsSync(commandsDir)) {
		return issues;
	}

	try {
		const allFiles = findAllFiles(commandsDir);

		for (const filePath of allFiles) {
			const relativePath = filePath.replace(`${options.pluginRoot}/`, "");

			// Warn about non-markdown files (should be .md)
			if (!filePath.endsWith(".md")) {
				issues.push({
					ruleId: "command/not-markdown",
					severity: "warning",
					message: `Command file ${relativePath} should have .md extension`,
					file: filePath,
					suggestion: "Rename the file to use .md extension",
				});
				continue;
			}

			// Read and validate content
			const content = await Bun.file(filePath).text();

			// Parse frontmatter if present
			const frontmatter = parseFrontmatter(content);

			if (frontmatter) {
				// Warn if description is missing (needed for SlashCommand tool)
				if (!frontmatter.description) {
					issues.push({
						ruleId: "command/missing-description",
						severity: "warning",
						message: `Command ${relativePath} is missing 'description' in frontmatter`,
						file: filePath,
						suggestion:
							"Add 'description: <text>' to frontmatter for SlashCommand tool support",
					});
				}

				// Validate allowed-tools field if present
				if (
					"allowed-tools" in frontmatter &&
					typeof frontmatter["allowed-tools"] === "string"
				) {
					const allowedToolsIssues = validateAllowedTools(
						frontmatter["allowed-tools"],
						filePath,
						relativePath,
					);
					issues.push(...allowedToolsIssues);
				}

				// Extract content after frontmatter
				const contentAfterFrontmatter = content
					.replace(/^---\n[\s\S]*?\n---\n/, "")
					.trim();

				if (contentAfterFrontmatter.length < 20) {
					issues.push({
						ruleId: "command/too-short",
						severity: "warning",
						message: `Command ${relativePath} has very little content after frontmatter`,
						file: filePath,
						suggestion:
							"Add detailed instructions about what this command does and how to use it",
					});
				}
			} else {
				// No frontmatter - check total content length
				if (content.trim().length < 20) {
					issues.push({
						ruleId: "command/too-short",
						severity: "warning",
						message: `Command ${relativePath} is too short`,
						file: filePath,
						suggestion:
							"Add more detailed documentation about what this command does",
					});
				}
			}
		}
	} catch (error) {
		issues.push({
			ruleId: "command/validation-error",
			severity: "error",
			message: `Failed to validate commands: ${error instanceof Error ? error.message : String(error)}`,
			file: commandsDir,
			suggestion:
				"Check that the commands directory is accessible and readable",
		});
	}

	return issues;
}
