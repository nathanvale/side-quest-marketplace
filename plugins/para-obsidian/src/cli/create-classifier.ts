/**
 * CLI handler for creating inbox classifiers.
 *
 * Orchestrates the classifier creation wizard and generates classifier files,
 * registry updates, and basic template scaffolds.
 *
 * @module cli/create-classifier
 */
import path from "node:path";
import { confirm, input, select } from "@inquirer/prompts";
import { pathExists, readTextFile } from "@sidequest/core/fs";
import type { ParaObsidianConfig } from "../config";
import { generateClassifierCode } from "../inbox/classify/classifiers/generator";
import {
	generateRegistryPatch,
	updateRegistry,
} from "../inbox/classify/classifiers/registry-updater";
import type {
	FieldDefinition,
	InboxConverter,
	TemplateChoice,
} from "../inbox/classify/classifiers/types";
import { validateClassifier } from "../inbox/classify/classifiers/validator";
import { atomicWriteFile } from "../shared/atomic-fs";
import { withFileLock } from "../shared/file-lock";
import { Transaction } from "../shared/transaction";
import {
	validateClassifierId,
	validateDisplayName,
	validateFieldName,
	validatePriority,
	validateTemplateName,
	validateWeight,
} from "../shared/validation";
import {
	promptTemplateChoice,
	promptTemplateCreation,
} from "../templates/choice";
import { createTemplate } from "../templates/create";
import { detectTemplate } from "../templates/detection";
import type { CommandContext, CommandResult } from "./types";

/**
 * Handles the create-classifier command.
 *
 * Runs an interactive wizard to create a new inbox classifier.
 *
 * @param ctx - Command context with config and flags
 * @returns Command result
 *
 * @example
 * ```bash
 * bun run src/cli.ts create-classifier medical-bill
 * # Interactive wizard guides user through classifier creation
 * ```
 */
export async function handleCreateClassifier(
	ctx: CommandContext,
): Promise<CommandResult> {
	try {
		await createClassifier(ctx.config);
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
 * Creates a new classifier via interactive wizard.
 *
 * Steps:
 * 1. Gather basic information (id, displayName, priority, area)
 * 2. Define heuristic patterns (filename, content markers)
 * 3. Define extraction fields
 * 4. Configure template mapping
 * 5. Configure scoring (optional)
 * 6. Validate configuration
 * 7. Generate classifier file
 * 8. Update registry
 * 9. Create basic template scaffold
 *
 * @param config - Para-obsidian configuration
 */
async function createClassifier(config: ParaObsidianConfig): Promise<void> {
	console.log("\n🔧 Create Inbox Classifier\n");

	// Step 1: Basic Information
	const idInput = await input({
		message: "Classifier ID (kebab-case):",
		validate: (value) => {
			try {
				validateClassifierId(value);
				return true;
			} catch (error) {
				return error instanceof Error ? error.message : "Invalid ID";
			}
		},
	});
	const id = validateClassifierId(idInput);

	// Check uniqueness
	const projectRoot = path.resolve(__dirname, "../../..");
	const definitionsPath = path.join(
		projectRoot,
		"src/inbox/classify/classifiers/definitions",
	);
	const classifierPath = path.join(definitionsPath, `${id}.ts`);
	if (await pathExists(classifierPath)) {
		throw new Error(
			`Classifier '${id}' already exists at ${classifierPath}. Choose a different ID.`,
		);
	}

	const displayNameInput = await input({
		message: "Display name:",
		default: id
			.split("-")
			.map((w) => w[0]?.toUpperCase() + w.slice(1))
			.join(" "),
	});
	const displayName = validateDisplayName(displayNameInput);

	const priorityInput = await input({
		message: "Priority (0-100, higher = checked first, default: 85):",
		default: "85",
		validate: (value) => {
			const num = Number.parseInt(value, 10);
			if (Number.isNaN(num)) return "Must be a number";
			try {
				validatePriority(num);
				return true;
			} catch (error) {
				return error instanceof Error ? error.message : "Invalid priority";
			}
		},
	});
	const priority = validatePriority(Number.parseInt(priorityInput, 10));

	// Note: PARA area is not currently stored in classifier config
	// It's determined dynamically during classification based on content

	// Step 2: Heuristic Patterns
	const filenameInput = await input({
		message:
			"Filename patterns (comma-separated, e.g., 'medical, bill, statement'):",
	});
	const filenamePatterns = filenameInput
		.split(",")
		.map((p) => p.trim())
		.filter((p) => p.length > 0)
		.map((pattern, idx) => ({
			pattern,
			weight: validateWeight(Math.max(0.5, 1.0 - idx * 0.1)),
		}));

	const contentInput = await input({
		message:
			"Content markers (comma-separated, e.g., 'patient name, date of service'):",
	});
	const contentMarkers = contentInput
		.split(",")
		.map((p) => p.trim())
		.filter((p) => p.length > 0)
		.map((pattern, idx) => ({
			pattern,
			weight: validateWeight(Math.max(0.5, 1.0 - idx * 0.1)),
		}));

	// Step 3: Field Extraction
	const fields: FieldDefinition[] = [];

	// Always include title field
	fields.push({
		name: "title",
		type: "string",
		description: `${displayName} title/description`,
		requirement: "required",
	});

	const addMoreFields = await confirm({
		message: "Add custom fields?",
		default: true,
	});

	if (addMoreFields) {
		let addingFields = true;
		while (addingFields) {
			const fieldName = validateFieldName(
				await input({ message: "Field name (camelCase):" }),
			);

			const fieldType = await select<"string" | "date" | "currency" | "number">(
				{
					message: "Field type:",
					choices: [
						{ value: "string", name: "String" },
						{ value: "date", name: "Date (YYYY-MM-DD)" },
						{ value: "currency", name: "Currency (numeric)" },
						{ value: "number", name: "Number" },
					],
				},
			);

			const fieldDescription = await input({
				message: "Description (for LLM extraction):",
			});

			const fieldRequirement = await select<
				"required" | "optional" | "conditional"
			>({
				message: "Requirement level:",
				choices: [
					{ value: "required", name: "Required - must be extracted" },
					{ value: "optional", name: "Optional - nice to have" },
					{
						value: "conditional",
						name: "Conditional - required in some cases",
					},
				],
			});

			fields.push({
				name: fieldName,
				type: fieldType,
				description: fieldDescription,
				requirement: fieldRequirement,
			});

			addingFields = await confirm({
				message: "Add another field?",
				default: false,
			});
		}
	}

	// Step 4: Template Configuration
	const templateNameInput = await input({
		message: "Template filename (without .md):",
		default: id,
	});
	const templateName = validateTemplateName(templateNameInput);

	const fieldMappings: Record<string, string> = {};
	for (const field of fields) {
		const mapping = await input({
			message: `Templater prompt label for '${field.name}':`,
			default: field.description,
		});
		fieldMappings[field.name] = mapping;
	}

	const promptHint = await input({
		message: "LLM prompt hint (what is this document type?):",
		default: `Extract information from ${displayName} documents`,
	});

	// Step 4.5: Template Detection & Choice
	console.log("\n📄 Template Configuration\n");

	const templateDetection = await detectTemplate(config.vault, templateName);

	let templateChoice: TemplateChoice;
	if (templateDetection.exists) {
		templateChoice = await promptTemplateChoice(
			templateName,
			templateDetection.path,
		);
	} else {
		templateChoice = await promptTemplateCreation();
	}

	// Step 5: Scoring Configuration
	const customScoring = await confirm({
		message: "Customize scoring thresholds?",
		default: false,
	});

	const scoring = customScoring
		? {
				heuristicWeight: validateWeight(
					Number.parseFloat(
						await input({
							message: "Heuristic weight (0.0-1.0, default: 0.3):",
							default: "0.3",
						}),
					),
				),
				llmWeight: validateWeight(
					Number.parseFloat(
						await input({
							message: "LLM weight (0.0-1.0, default: 0.7):",
							default: "0.7",
						}),
					),
				),
				highThreshold: validateWeight(
					Number.parseFloat(
						await input({
							message: "High confidence threshold (0.0-1.0, default: 0.85):",
							default: "0.85",
						}),
					),
				),
				mediumThreshold: validateWeight(
					Number.parseFloat(
						await input({
							message: "Medium confidence threshold (0.0-1.0, default: 0.6):",
							default: "0.6",
						}),
					),
				),
			}
		: {
				heuristicWeight: 0.3,
				llmWeight: 0.7,
				highThreshold: 0.85,
				mediumThreshold: 0.6,
			};

	// Build classifier config
	const classifier: InboxConverter = {
		schemaVersion: 1,
		id,
		displayName,
		enabled: true,
		priority,
		heuristics: {
			filenamePatterns,
			contentMarkers,
			threshold: 0.5,
		},
		fields,
		extraction: {
			promptHint,
			keyFields: fields
				.filter((f) => f.requirement === "required")
				.map((f) => f.name),
		},
		template: {
			name: templateName,
			fieldMappings,
		},
		scoring,
	};

	// Validate configuration
	const validation = validateClassifier(classifier);
	if (!validation.isValid) {
		console.error("\n❌ Configuration validation failed:\n");
		for (const error of validation.errors) {
			console.error(`  - ${error}`);
		}
		throw new Error("Invalid classifier configuration");
	}

	if (validation.warnings.length > 0) {
		console.warn("\n⚠️  Warnings:\n");
		for (const warning of validation.warnings) {
			console.warn(`  - ${warning}`);
		}
	}

	// Execute transaction with rollback
	const tx = new Transaction();
	const registryPath = path.join(definitionsPath, "index.ts");

	// Step 1: Create classifier file (atomic write)
	tx.add({
		name: "create-classifier-file",
		execute: async () => {
			const code = generateClassifierCode(classifier);
			await atomicWriteFile(classifierPath, code);
			return { path: classifierPath };
		},
		rollback: async () => {
			// Clean up classifier file on rollback
			const fs = await import("node:fs/promises");
			await fs.unlink(classifierPath).catch(() => {
				// Ignore errors during rollback cleanup
			});
		},
	});

	// Step 2: Update registry (AST-based, atomic write, with locking)
	tx.add({
		name: "update-registry",
		execute: async () => {
			const backup = await readTextFile(registryPath);

			// Use file lock to prevent concurrent registry updates
			await withFileLock("classifier-registry", async () => {
				// Generate patch with priority-based insertion
				const patch = await generateRegistryPatch(registryPath, id, priority);

				// Use AST-based update (preserves formatting/comments)
				await updateRegistry(registryPath, patch);
			});

			return { backup };
		},
		rollback: async (result) => {
			if (result && typeof result === "object" && "backup" in result) {
				// Restore original registry (atomic write)
				await atomicWriteFile(registryPath, result.backup as string);
			}
		},
	});

	// Step 3: Create template
	let templateResult:
		| { created: boolean; templatePath?: string; finalName: string }
		| undefined;

	tx.add({
		name: "create-template",
		execute: async () => {
			templateResult = await createTemplate({
				vaultPath: config.vault,
				templateName,
				noteType: id,
				version: 1,
				fields,
				fieldMappings,
				choice: templateChoice,
			});

			return templateResult;
		},
		rollback: async (result) => {
			// Clean up template file if it was created
			if (
				result &&
				typeof result === "object" &&
				"created" in result &&
				result.created &&
				"templatePath" in result
			) {
				const fs = await import("node:fs/promises");
				await fs.unlink(result.templatePath as string).catch(() => {
					// Ignore errors during rollback cleanup
				});
			}
		},
	});

	// Step 4: Update classifier if template was created with suffix
	tx.add({
		name: "update-classifier-template-name",
		execute: async () => {
			if (
				templateResult?.created &&
				templateResult.finalName !== templateName
			) {
				// Template was created with a suffix - rebuild classifier with correct name
				const originalCode = await readTextFile(classifierPath);
				const updatedClassifier: InboxConverter = {
					...classifier,
					template: {
						...classifier.template,
						name: templateResult.finalName,
					},
				};

				// Regenerate classifier file with correct template name
				const code = generateClassifierCode(updatedClassifier);
				await atomicWriteFile(classifierPath, code);

				return { originalCode };
			}
			return { skipped: true };
		},
		rollback: async (result) => {
			// Restore original classifier code if we updated it
			if (result && typeof result === "object" && "originalCode" in result) {
				await atomicWriteFile(classifierPath, result.originalCode as string);
			}
		},
	});

	const result = await tx.execute();
	if (!result.success) {
		throw new Error(
			`Transaction failed at ${result.failedAt}: ${result.error.message}`,
		);
	}

	console.log(`\n✅ Classifier created: ${classifierPath}`);
	console.log(`✅ Registry updated: ${registryPath}`);

	if (templateResult?.created && templateResult.templatePath) {
		console.log(`✅ Template created: ${templateResult.templatePath}`);
	} else if (templateChoice.action === "use-existing") {
		console.log(`✅ Using existing template: ${templateName}.md`);
	} else if (templateChoice.action === "skip") {
		console.log(`⚠️  Template creation skipped`);
	}

	console.log("\n📝 Next steps:");
	if (!templateResult?.created && templateChoice.action !== "use-existing") {
		console.log(
			`  1. Create template manually: ${config.templatesDir ?? "Templates"}/${templateName}.md`,
		);
		console.log(`  2. Run: bun typecheck`);
		console.log(`  3. Test with: bun run src/cli.ts process-inbox scan`);
	} else {
		console.log(`  1. Run: bun typecheck`);
		console.log(`  2. Test with: bun run src/cli.ts process-inbox scan`);
	}
}
