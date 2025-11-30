import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { ValidationIssue, ValidatorOptions } from "../types.ts";

/**
 * Validates SKILL.md files in skills directories
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
