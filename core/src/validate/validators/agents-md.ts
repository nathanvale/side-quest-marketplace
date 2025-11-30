import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { ValidationIssue, ValidatorOptions } from "../types.ts";

/**
 * Parsed YAML frontmatter from agent .md files
 */
interface AgentFrontmatter {
	name?: string;
	description?: string;
	tools?: string;
	model?: string;
	permissionMode?: string;
	skills?: string;
}

/**
 * Parses YAML frontmatter from agent content
 *
 * @param content - The full agent file content
 * @returns Parsed frontmatter object or null if no frontmatter
 */
function parseFrontmatter(content: string): AgentFrontmatter | null {
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (!frontmatterMatch || !frontmatterMatch[1]) {
		return null;
	}

	const frontmatterText = frontmatterMatch[1];
	const frontmatter: AgentFrontmatter = {};

	// Parse each line as key: value
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
		let value = trimmed.slice(colonIndex + 1).trim();

		// Remove quotes if present
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}

		if (
			key === "name" ||
			key === "description" ||
			key === "tools" ||
			key === "model" ||
			key === "permissionMode" ||
			key === "skills"
		) {
			frontmatter[key as keyof AgentFrontmatter] = value;
		}
	}

	return frontmatter;
}

/**
 * Validates that an agent name follows the required format
 *
 * @param name - The agent name to validate
 * @returns True if valid, false otherwise
 */
function isValidAgentName(name: string): boolean {
	// Must be lowercase letters, numbers, and hyphens only
	// Max 64 characters
	return /^[a-z0-9-]+$/.test(name) && name.length <= 64;
}

/**
 * Validates agent .md files in the agents/ directory per Claude Code spec.
 *
 * Each agent file should have YAML frontmatter with required fields:
 * - name (lowercase letters, numbers, hyphens only, max 64 chars)
 * - description (natural language)
 *
 * Optional fields:
 * - tools (comma-separated list)
 * - model (sonnet, opus, haiku, or 'inherit')
 * - permissionMode (default, acceptEdits, bypassPermissions, plan, ignore)
 * - skills (comma-separated list)
 *
 * @param options - Validation options including plugin root path
 * @returns Array of validation issues found
 */
export async function validateAgentsMd(
	options: ValidatorOptions,
): Promise<ValidationIssue[]> {
	const issues: ValidationIssue[] = [];
	const agentsDir = join(options.pluginRoot, "agents");

	// Skip if agents directory doesn't exist
	if (!existsSync(agentsDir)) {
		return issues;
	}

	try {
		const entries = readdirSync(agentsDir);
		const agentFiles = entries.filter((entry) => entry.endsWith(".md"));

		if (agentFiles.length === 0) {
			issues.push({
				ruleId: "agents/missing-file",
				severity: "warning",
				message: "No agent .md files found in agents/ directory",
				file: agentsDir,
				suggestion:
					"Add at least one agent markdown file (e.g., security-reviewer.md)",
			});
			return issues;
		}

		for (const agentFile of agentFiles) {
			const agentPath = join(agentsDir, agentFile);
			const content = await Bun.file(agentPath).text();

			// Parse frontmatter
			const frontmatter = parseFrontmatter(content);

			if (!frontmatter) {
				issues.push({
					ruleId: "agents/missing-frontmatter",
					severity: "error",
					message: `Agent file ${agentFile} is missing YAML frontmatter`,
					file: agentPath,
					suggestion:
						"Add YAML frontmatter with required fields:\n---\nname: agent-name\ndescription: What this agent does\n---",
				});
				continue;
			}

			// Validate required 'name' field
			if (!frontmatter.name) {
				issues.push({
					ruleId: "agents/missing-name",
					severity: "error",
					message: `Agent file ${agentFile} is missing required 'name' field in frontmatter`,
					file: agentPath,
					suggestion: "Add 'name: agent-name' to the frontmatter",
				});
			} else if (!isValidAgentName(frontmatter.name)) {
				if (frontmatter.name.length > 64) {
					issues.push({
						ruleId: "agents/invalid-name-format",
						severity: "error",
						message: `Agent file ${agentFile} has name exceeding 64 characters (${frontmatter.name.length} chars)`,
						file: agentPath,
						suggestion: "Shorten the agent name to 64 characters or less",
					});
				} else {
					issues.push({
						ruleId: "agents/invalid-name-format",
						severity: "error",
						message: `Agent file ${agentFile} has invalid name format: "${frontmatter.name}"`,
						file: agentPath,
						suggestion:
							"Name must contain only lowercase letters, numbers, and hyphens (a-z, 0-9, -)",
					});
				}
			}

			// Validate required 'description' field
			if (!frontmatter.description || !frontmatter.description.trim()) {
				issues.push({
					ruleId: "agents/missing-description",
					severity: "error",
					message: `Agent file ${agentFile} is missing required 'description' field in frontmatter`,
					file: agentPath,
					suggestion:
						"Add 'description: What this agent specializes in' to the frontmatter",
				});
			}

			// Validate optional 'tools' field
			if (frontmatter.tools) {
				const tools = frontmatter.tools.split(",").map((t) => t.trim());
				if (tools.length === 0 || tools.some((t) => t.length === 0)) {
					issues.push({
						ruleId: "agents/invalid-tools-format",
						severity: "warning",
						message: `Agent file ${agentFile} has invalid 'tools' format`,
						file: agentPath,
						suggestion:
							"Ensure tools is a comma-separated list (e.g., 'Read, Grep, Write')",
					});
				}
			}

			// Validate optional 'model' field
			if (frontmatter.model) {
				const validModels = ["sonnet", "opus", "haiku", "inherit"];
				if (!validModels.includes(frontmatter.model)) {
					issues.push({
						ruleId: "agents/invalid-model",
						severity: "error",
						message: `Agent file ${agentFile} has invalid 'model' value: "${frontmatter.model}"`,
						file: agentPath,
						suggestion: `Model must be one of: ${validModels.join(", ")}`,
					});
				}
			}

			// Validate optional 'permissionMode' field
			if (frontmatter.permissionMode) {
				const validModes = [
					"default",
					"acceptEdits",
					"bypassPermissions",
					"plan",
					"ignore",
				];
				if (!validModes.includes(frontmatter.permissionMode)) {
					issues.push({
						ruleId: "agents/invalid-permission-mode",
						severity: "error",
						message: `Agent file ${agentFile} has invalid 'permissionMode' value: "${frontmatter.permissionMode}"`,
						file: agentPath,
						suggestion: `permissionMode must be one of: ${validModes.join(", ")}`,
					});
				}
			}

			// Validate optional 'skills' field
			if (frontmatter.skills) {
				const skills = frontmatter.skills.split(",").map((s) => s.trim());
				if (skills.length === 0 || skills.some((s) => s.length === 0)) {
					issues.push({
						ruleId: "agents/invalid-skills-format",
						severity: "warning",
						message: `Agent file ${agentFile} has invalid 'skills' format`,
						file: agentPath,
						suggestion:
							"Ensure skills is a comma-separated list (e.g., 'skill-one, skill-two')",
					});
				}
			}

			// Get content after frontmatter
			const frontmatterMatch = content.match(/^---\n[\s\S]*?\n---/);
			const contentAfterFrontmatter = frontmatterMatch
				? content.substring(frontmatterMatch[0].length).trim()
				: content.trim();

			// Warn if content is too short
			if (contentAfterFrontmatter.length < 50) {
				issues.push({
					ruleId: "agents/too-short",
					severity: "warning",
					message: `Agent file ${agentFile} has very little content after frontmatter`,
					file: agentPath,
					suggestion:
						"Add more detailed documentation about what this agent does and when to use it",
				});
			}

			// Warn if missing heading
			if (!contentAfterFrontmatter.includes("#")) {
				issues.push({
					ruleId: "agents/missing-heading",
					severity: "warning",
					message: `Agent file ${agentFile} should have a markdown heading`,
					file: agentPath,
					suggestion: "Add a markdown heading (e.g., # Agent Name)",
				});
			}
		}
	} catch (error) {
		issues.push({
			ruleId: "agents/validation-error",
			severity: "error",
			message: `Failed to validate agents: ${error instanceof Error ? error.message : String(error)}`,
			file: agentsDir,
			suggestion: "Check that the agents directory is accessible and readable",
		});
	}

	return issues;
}
