/**
 * Template choice wizard
 *
 * Interactive prompts for handling existing templates.
 * Provides use-existing/create-new/skip workflow.
 *
 * @module templates/choice
 */

import { confirm, input, select } from "@inquirer/prompts";
import type { TemplateChoice } from "../inbox/classify/classifiers/types";

/**
 * Shared mode selection choices for template creation
 */
const MODE_CHOICES = [
	{
		value: "basic",
		name: "Basic scaffold (quick)",
		description: "Simple Templater prompts for each field",
	},
	{
		value: "rich",
		name: "Rich template (coming soon)",
		description: "Enhanced AI-assisted template (falls back to basic for now)",
	},
] as const;

/**
 * Prompts user for template choice when template already exists.
 *
 * Offers three options:
 * 1. Use existing template
 * 2. Create new template (with optional suffix)
 * 3. Skip template creation
 *
 * @param templateName - Name of existing template
 * @param existingPath - Path to existing template file
 * @returns User's template choice
 *
 * @example
 * ```typescript
 * const choice = await promptTemplateChoice('invoice', '/vault/Templates/invoice.md');
 * if (choice.action === 'create-new') {
 *   const newName = choice.suffix ? `invoice-${choice.suffix}` : 'invoice';
 *   // Create template in mode: choice.mode
 * }
 * ```
 */
export async function promptTemplateChoice(
	templateName: string,
	existingPath: string,
): Promise<TemplateChoice> {
	console.log(
		`\n⚠️  Template already exists: ${templateName}.md\nLocation: ${existingPath}\n`,
	);

	const action = await select({
		message: "How would you like to proceed?",
		choices: [
			{
				value: "use-existing",
				name: "Use existing template (recommended)",
				description: "Keep the existing template and reference it",
			},
			{
				value: "create-new",
				name: "Create new template with different name",
				description: "Generate a new template alongside the existing one",
			},
			{
				value: "skip",
				name: "Skip template creation",
				description: "Don't create or reference a template",
			},
		],
	});

	if (action === "use-existing") {
		return { action: "use-existing" };
	}

	if (action === "skip") {
		return { action: "skip" };
	}

	// Create new template - gather suffix and mode
	const suffix = await input({
		message: "Template name suffix (leave empty to replace existing):",
		validate: (value) => {
			if (value && !/^[a-z0-9-]*$/.test(value)) {
				return "Suffix must be lowercase letters, numbers, or hyphens";
			}
			return true;
		},
	});

	const mode = await select({
		message: "Template generation mode:",
		choices: MODE_CHOICES,
		default: "basic",
	});

	return {
		action: "create-new",
		suffix: suffix || undefined,
		mode: mode as "basic" | "rich",
	};
}

/**
 * Prompts user for template creation mode when no template exists.
 *
 * Asks user if they want to create a template and in which mode.
 *
 * @returns User's template choice
 *
 * @example
 * ```typescript
 * const choice = await promptTemplateCreation();
 * if (choice.action === 'create-new') {
 *   // Create template in mode: choice.mode
 * } else {
 *   // Skip template creation
 * }
 * ```
 */
export async function promptTemplateCreation(): Promise<TemplateChoice> {
	console.log("\n📄 No existing template found\n");

	const shouldCreate = await confirm({
		message: "Would you like to create a template for this classifier?",
		default: false,
	});

	if (!shouldCreate) {
		return { action: "skip" };
	}

	const mode = await select({
		message: "Template generation mode:",
		choices: MODE_CHOICES,
		default: "basic",
	});

	return {
		action: "create-new",
		mode: mode as "basic" | "rich",
	};
}
