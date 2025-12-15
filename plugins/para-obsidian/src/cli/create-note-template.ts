/**
 * CLI handler for creating note templates.
 *
 * Orchestrates the template creation wizard and generates template files
 * in the vault's Templates directory.
 *
 * @module cli/create-note-template
 */
import path from "node:path";
import { confirm } from "@inquirer/prompts";
import { pathExists, writeTextFile } from "@sidequest/core/fs";
import type { ParaObsidianConfig } from "../config";
import { generateTemplate } from "../templates/generator";
import { validateTemplate } from "../templates/validator";
import { runWizard } from "../templates/wizard";
import type { CommandContext, CommandResult } from "./types";

/**
 * Handles the create-note-template command.
 *
 * Runs an interactive wizard to create a new note template.
 *
 * @param ctx - Command context with config and flags
 * @returns Command result
 *
 * @example
 * ```bash
 * bun run src/cli.ts create-note-template
 * # Interactive wizard guides user through template creation
 * ```
 */
export async function handleCreateNoteTemplate(
	ctx: CommandContext,
): Promise<CommandResult> {
	try {
		await createNoteTemplate(ctx.config);
		return { success: true, exitCode: 0 };
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Unknown error occurred";
		if (!ctx.isJson) {
			console.error(`\n❌ Error: ${message}\n`);
		}
		return { success: false, error: message, exitCode: 1 };
	}
}

/**
 * Creates a new note template via interactive wizard.
 *
 * Steps:
 * 1. Run wizard to gather template configuration
 * 2. Generate template content
 * 3. Validate template syntax
 * 4. Check for existing template (offer to overwrite)
 * 5. Write template file to vault
 *
 * @param config - Para-obsidian configuration with templatesDir
 */
async function createNoteTemplate(config: ParaObsidianConfig): Promise<void> {
	// Ensure templates directory exists
	if (!config.templatesDir) {
		throw new Error(
			"Templates directory not configured. Set PARA_VAULT and ensure vault has Templates folder.",
		);
	}

	if (!(await pathExists(config.templatesDir))) {
		throw new Error(
			`Templates directory does not exist: ${config.templatesDir}`,
		);
	}

	// Run wizard to gather configuration
	const templateConfig = await runWizard();

	// Generate template content
	const content = generateTemplate(templateConfig);

	// Validate template
	const validation = validateTemplate(content);

	if (!validation.isValid) {
		console.error("\n❌ Template validation failed:\n");
		for (const error of validation.errors) {
			console.error(`  - ${error}`);
		}
		throw new Error("Generated template is invalid");
	}

	if (validation.warnings.length > 0) {
		console.warn("\n⚠️  Warnings:\n");
		for (const warning of validation.warnings) {
			console.warn(`  - ${warning}`);
		}
	}

	// Check for existing template
	const templatePath = path.join(
		config.templatesDir,
		`${templateConfig.name}.md`,
	);
	const exists = await pathExists(templatePath);

	if (exists) {
		const overwrite = await confirm({
			message: `Template "${templateConfig.name}.md" already exists. Overwrite?`,
			default: false,
		});

		if (!overwrite) {
			console.log("\n❌ Template creation cancelled.");
			return;
		}
	}

	// Write template file
	await writeTextFile(templatePath, content);

	console.log(`\n✅ Template created: ${templatePath}\n`);
	console.log("Preview:");
	console.log("─".repeat(60));
	console.log(content);
	console.log("─".repeat(60));
}
