import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { ValidationIssue, ValidatorOptions } from "../types.ts";

/**
 * Parsed YAML frontmatter from SKILL.md
 */
interface SkillFrontmatter {
	name?: string;
	description?: string;
	"allowed-tools"?: string;
}

/**
 * Parses YAML frontmatter from SKILL.md content
 *
 * @param content - The full SKILL.md content
 * @returns Parsed frontmatter object or null if no frontmatter
 */
function parseFrontmatter(content: string): SkillFrontmatter | null {
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (!frontmatterMatch || !frontmatterMatch[1]) {
		return null;
	}

	const frontmatterText = frontmatterMatch[1];
	const frontmatter: SkillFrontmatter = {};

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
		const value = trimmed.slice(colonIndex + 1).trim();

		if (key === "name" || key === "description" || key === "allowed-tools") {
			frontmatter[key] = value;
		}
	}

	return frontmatter;
}

/**
 * Validates that a skill name follows the required format
 *
 * @param name - The skill name to validate
 * @returns True if valid, false otherwise
 */
function isValidSkillName(name: string): boolean {
	// Must be lowercase letters, numbers, and hyphens only
	// Max 64 characters
	return /^[a-z0-9-]+$/.test(name) && name.length <= 64;
}

/**
 * Content quality heuristics for description field
 */

/**
 * Checks if description meets minimum length threshold
 *
 * @param description - The description text to check
 * @returns True if description is at least 50 characters
 */
function hasMinimumLength(description: string): boolean {
	return description.length >= 50;
}

/**
 * Checks if description contains trigger words indicating when to use the skill
 *
 * @param description - The description text to check
 * @returns True if description contains trigger words
 */
function hasTriggerWords(description: string): boolean {
	const triggerWords = ["when", "use when", "use this", "helps", "for", "with"];
	const lowerDescription = description.toLowerCase();
	return triggerWords.some((word) => lowerDescription.includes(word));
}

/**
 * Checks if description contains action verbs indicating what the skill does
 *
 * @param description - The description text to check
 * @returns True if description contains action verbs
 */
function hasActionVerbs(description: string): boolean {
	const actionVerbs = [
		"analyze",
		"create",
		"generate",
		"manage",
		"build",
		"search",
		"find",
		"process",
		"validate",
		"check",
		"run",
		"execute",
		"perform",
		"handle",
		"convert",
		"transform",
		"extract",
		"parse",
		"format",
		"organize",
	];
	const lowerDescription = description.toLowerCase();
	return actionVerbs.some((verb) => lowerDescription.includes(verb));
}

/**
 * Validates SKILL.md files in skills directories
 *
 * Checks both legacy content requirements and new YAML frontmatter format:
 * - Frontmatter with name, description, and optional allowed-tools
 * - Name format: lowercase, hyphens, numbers (max 64 chars)
 * - Description max length: 1024 chars
 */
export async function validateSkillMd(
	options: ValidatorOptions,
): Promise<ValidationIssue[]> {
	const issues: ValidationIssue[] = [];
	const skillsDir = join(options.pluginRoot, "skills");

	if (!existsSync(skillsDir)) {
		return issues;
	}

	try {
		const entries = readdirSync(skillsDir);

		for (const entry of entries) {
			const entryPath = join(skillsDir, entry);

			if (!statSync(entryPath).isDirectory()) {
				continue;
			}

			const skillMdPath = join(entryPath, "SKILL.md");

			if (!existsSync(skillMdPath)) {
				issues.push({
					ruleId: "skill/missing-file",
					severity: "error",
					message: `SKILL.md not found in skills/${entry}/`,
					file: entryPath,
					suggestion: `Create a SKILL.md file in skills/${entry}/ directory`,
				});
				continue;
			}

			const content = await Bun.file(skillMdPath).text();

			// Legacy validations (backward compatibility)
			if (content.trim().length < 50) {
				issues.push({
					ruleId: "skill/too-short",
					severity: "warning",
					message: `SKILL.md in skills/${entry}/ is too short`,
					file: skillMdPath,
					suggestion:
						"Add more detailed documentation about what this skill does and when to use it",
				});
			}

			if (!content.includes("#")) {
				issues.push({
					ruleId: "skill/missing-heading",
					severity: "warning",
					message: `SKILL.md in skills/${entry}/ should have a heading`,
					file: skillMdPath,
					suggestion: "Add a markdown heading (e.g., # Skill Name)",
				});
			}

			// Frontmatter validation
			const frontmatter = parseFrontmatter(content);

			if (!frontmatter) {
				issues.push({
					ruleId: "skill/missing-frontmatter",
					severity: "warning",
					message: `SKILL.md in skills/${entry}/ is missing YAML frontmatter`,
					file: skillMdPath,
					suggestion:
						"Add frontmatter with required fields:\n---\nname: your-skill-name\ndescription: Brief description\n---",
				});
				continue; // Skip further frontmatter validation
			}

			// Validate name field
			if (!frontmatter.name) {
				issues.push({
					ruleId: "skill/missing-name",
					severity: "error",
					message: `SKILL.md in skills/${entry}/ is missing 'name' field in frontmatter`,
					file: skillMdPath,
					suggestion: "Add 'name: your-skill-name' to the frontmatter",
				});
			} else if (!isValidSkillName(frontmatter.name)) {
				if (frontmatter.name.length > 64) {
					issues.push({
						ruleId: "skill/invalid-name-format",
						severity: "error",
						message: `SKILL.md in skills/${entry}/ has name exceeding 64 characters (${frontmatter.name.length} chars)`,
						file: skillMdPath,
						suggestion: "Shorten the skill name to 64 characters or less",
					});
				} else {
					issues.push({
						ruleId: "skill/invalid-name-format",
						severity: "error",
						message: `SKILL.md in skills/${entry}/ has invalid name format: "${frontmatter.name}"`,
						file: skillMdPath,
						suggestion:
							"Name must contain only lowercase letters, numbers, and hyphens (a-z, 0-9, -)",
					});
				}
			}

			// Validate description field
			if (!frontmatter.description) {
				issues.push({
					ruleId: "skill/missing-description",
					severity: "error",
					message: `SKILL.md in skills/${entry}/ is missing 'description' field in frontmatter`,
					file: skillMdPath,
					suggestion: "Add 'description: Brief description' to the frontmatter",
				});
			} else if (frontmatter.description.length > 1024) {
				issues.push({
					ruleId: "skill/description-too-long",
					severity: "error",
					message: `SKILL.md in skills/${entry}/ has description exceeding 1024 characters (${frontmatter.description.length} chars)`,
					file: skillMdPath,
					suggestion: "Shorten the description to 1024 characters or less",
				});
			} else {
				// Content quality heuristics (warnings only)
				if (!hasMinimumLength(frontmatter.description)) {
					issues.push({
						ruleId: "skill/description-too-short",
						severity: "warning",
						message: `SKILL.md in skills/${entry}/ has a short description (${frontmatter.description.length} chars)`,
						file: skillMdPath,
						suggestion:
							'Description should be at least 50 characters and explain WHAT the skill does and WHEN to use it. Example: "Analyze Excel spreadsheets, create pivot tables, and generate charts. Use when working with Excel files or tabular data."',
					});
				}

				if (!hasTriggerWords(frontmatter.description)) {
					issues.push({
						ruleId: "skill/description-missing-trigger-words",
						severity: "warning",
						message: `SKILL.md in skills/${entry}/ description may not explain WHEN to use the skill`,
						file: skillMdPath,
						suggestion:
							'Include trigger words that indicate when to use the skill (e.g., "when", "use when", "for", "with"). Example: "Use when working with Excel files" or "Helps with data analysis tasks"',
					});
				}

				if (!hasActionVerbs(frontmatter.description)) {
					issues.push({
						ruleId: "skill/description-missing-action-verbs",
						severity: "warning",
						message: `SKILL.md in skills/${entry}/ description may not explain WHAT the skill does`,
						file: skillMdPath,
						suggestion:
							'Include action verbs that describe what the skill does (e.g., "analyze", "create", "generate", "manage", "search"). Example: "Analyze spreadsheets and generate reports" or "Search code repositories and find patterns"',
					});
				}
			}

			// Validate allowed-tools field (optional)
			if (frontmatter["allowed-tools"]) {
				const tools = frontmatter["allowed-tools"]
					.split(",")
					.map((t) => t.trim());
				// Just validate it's a reasonable format - actual tool names will be validated at runtime
				if (tools.length === 0 || tools.some((t) => t.length === 0)) {
					issues.push({
						ruleId: "skill/invalid-allowed-tools",
						severity: "warning",
						message: `SKILL.md in skills/${entry}/ has invalid 'allowed-tools' format`,
						file: skillMdPath,
						suggestion:
							"Ensure allowed-tools is a comma-separated list of tool names (e.g., 'Read, Grep, Write')",
					});
				}
			}
		}
	} catch (error) {
		issues.push({
			ruleId: "skill/validation-error",
			severity: "error",
			message: `Failed to validate skills: ${error instanceof Error ? error.message : String(error)}`,
			file: skillsDir,
			suggestion: "Check that the skills directory is accessible and readable",
		});
	}

	return issues;
}
