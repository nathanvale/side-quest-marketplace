#!/usr/bin/env bun

/**
 * PostToolUse hook: Skill Lint
 *
 * Fast frontmatter + registration lint for SKILL.md files.
 * Fires after Write/Edit tool calls filtered to skills directories.
 *
 * Exit codes:
 * - 0: Pass (or non-matching file)
 * - 2: Hard block (missing required frontmatter)
 *
 * Warnings (stdout, exit 0):
 * - Missing plugin.json entry
 * - Missing SKILL_RESULT for user-invocable skills
 */

import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const PLUGIN_ROOT = resolve(import.meta.dirname, "..");

interface ToolInput {
	file_path?: string;
	old_string?: string;
	new_string?: string;
	content?: string;
}

/** Parse YAML frontmatter from a SKILL.md file (simple parser, no deps) */
function parseFrontmatter(content: string): Record<string, string> {
	const match = content.match(/^---\n([\s\S]*?)\n---/);
	if (!match?.[1]) return {};

	const fields: Record<string, string> = {};
	for (const line of match[1].split("\n")) {
		const colonIdx = line.indexOf(":");
		if (colonIdx === -1) continue;
		const key = line.slice(0, colonIdx).trim();
		const value = line.slice(colonIdx + 1).trim();
		if (key && value) {
			fields[key] = value;
		}
	}
	return fields;
}

function main(): void {
	const toolInput = process.env.CLAUDE_TOOL_INPUT ?? "{}";

	let input: ToolInput;
	try {
		input = JSON.parse(toolInput);
	} catch {
		process.exit(0);
	}

	const filePath = input.file_path;
	if (!filePath) {
		process.exit(0);
	}

	// Only lint SKILL.md files under our skills/ directory
	const relPath = relative(PLUGIN_ROOT, filePath);
	const skillMatch = relPath.match(/^skills\/([^/]+)\/SKILL\.md$/);
	if (!skillMatch) {
		process.exit(0);
	}

	const skillDirName = skillMatch[1];

	// Read the file content
	if (!existsSync(filePath)) {
		process.exit(0);
	}

	const content = readFileSync(filePath, "utf-8");
	const fm = parseFrontmatter(content);

	// Check required frontmatter fields
	const requiredFields = [
		"name",
		"description",
		"user-invocable",
		"allowed-tools",
	];
	const missingFields = requiredFields.filter((f) => !fm[f]);

	if (missingFields.length > 0) {
		console.error(
			`[skill-lint] BLOCKED: skills/${skillDirName}/SKILL.md missing required frontmatter: ${missingFields.join(", ")}`,
		);
		console.error(
			"Required fields: name, description, user-invocable, allowed-tools",
		);
		process.exit(2);
	}

	// Check name matches directory
	if (fm.name !== skillDirName) {
		console.error(
			`[skill-lint] BLOCKED: frontmatter name "${fm.name}" does not match directory name "${skillDirName}"`,
		);
		process.exit(2);
	}

	// Warnings (non-blocking)
	const warnings: string[] = [];

	// Check plugin.json registration
	const pluginJsonPath = join(PLUGIN_ROOT, ".claude-plugin", "plugin.json");
	if (existsSync(pluginJsonPath)) {
		try {
			const pluginJson = JSON.parse(readFileSync(pluginJsonPath, "utf-8"));
			const skills: string[] = pluginJson.skills ?? [];
			const expectedEntry = `./skills/${skillDirName}`;
			if (!skills.includes(expectedEntry)) {
				warnings.push(
					`skills/${skillDirName} not registered in plugin.json — add "${expectedEntry}" to the skills array`,
				);
			}
		} catch {
			// Can't parse plugin.json — skip this check
		}
	}

	// Check SKILL_RESULT for user-invocable skills
	const isUserInvocable =
		fm["user-invocable"] === "true" || fm["user-invocable"] === "yes";
	if (isUserInvocable && !content.includes("SKILL_RESULT")) {
		warnings.push(
			`User-invocable skill "${skillDirName}" lacks SKILL_RESULT completion signal — brain can't parse outcomes`,
		);
	}

	if (warnings.length > 0) {
		for (const w of warnings) {
			console.log(`[skill-lint] WARNING: ${w}`);
		}
	}

	process.exit(0);
}

main();
