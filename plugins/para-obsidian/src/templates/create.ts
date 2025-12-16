/**
 * Template creation service
 *
 * Orchestrates template creation in basic or rich mode.
 * Handles file writing with atomic operations.
 *
 * @module templates/create
 */

import { join } from "node:path";
import type {
	FieldDefinition,
	TemplateChoice,
} from "../inbox/classify/classifiers/types";
import { atomicWriteFile } from "../shared/atomic-fs";
import { generateBasicScaffold } from "./scaffold";

/**
 * Configuration for template creation
 */
export interface CreateTemplateConfig {
	/** Vault path */
	readonly vaultPath: string;
	/** Template name (base name, without suffix) */
	readonly templateName: string;
	/** Note type identifier */
	readonly noteType: string;
	/** Template version */
	readonly version: number;
	/** Classifier field definitions */
	readonly fields: readonly FieldDefinition[];
	/** Field name to Templater prompt mapping */
	readonly fieldMappings: Readonly<Record<string, string>>;
	/** User's template choice */
	readonly choice: TemplateChoice;
	/** Templates directory name (defaults to "Templates") */
	readonly templatesDir?: string;
}

/**
 * Result of template creation
 */
export interface CreateTemplateResult {
	/** Whether template was created */
	readonly created: boolean;
	/** Path to template file (if created) */
	readonly templatePath?: string;
	/** Final template name used (with suffix if applicable) */
	readonly finalName: string;
}

/**
 * Creates a template file based on user's choice.
 *
 * Handles:
 * - Basic scaffold generation
 * - Rich mode (TODO: integrate template-assistant skill)
 * - Atomic file writes
 * - Template name with suffix
 *
 * @param config - Template creation configuration
 * @returns Creation result with path and final name
 *
 * @example
 * ```typescript
 * const result = await createTemplate({
 *   vaultPath: '/vault',
 *   templateName: 'medical-bill',
 *   noteType: 'medical-bill',
 *   version: 1,
 *   fields: [...],
 *   fieldMappings: {...},
 *   choice: { action: 'create-new', mode: 'basic' }
 * });
 *
 * if (result.created) {
 *   console.log(`Created: ${result.templatePath}`);
 * }
 * ```
 */
export async function createTemplate(
	config: CreateTemplateConfig,
): Promise<CreateTemplateResult> {
	const { vaultPath, templateName, choice } = config;

	// Skip if user chose skip
	if (choice.action === "skip" || choice.action === "use-existing") {
		return {
			created: false,
			finalName: templateName,
		};
	}

	// Determine final template name (with suffix if provided)
	const finalName = choice.suffix
		? `${templateName}-${choice.suffix}`
		: templateName;

	const templatesDir = config.templatesDir ?? "Templates";
	const templatePath = join(vaultPath, templatesDir, `${finalName}.md`);

	// Shared scaffold config for both basic and rich modes
	const scaffoldConfig = {
		name: finalName,
		noteType: config.noteType,
		version: config.version,
		fields: config.fields,
		fieldMappings: config.fieldMappings,
	};

	// Generate template content based on mode
	let content: string;

	if (choice.mode === "basic") {
		content = generateBasicScaffold(scaffoldConfig);
	} else {
		// Rich mode - TODO: integrate template-assistant skill
		// For now, fall back to basic mode
		console.warn(
			"⚠️  Rich mode not yet implemented, falling back to basic scaffold",
		);
		content = generateBasicScaffold(scaffoldConfig);
	}

	// Write template atomically
	await atomicWriteFile(templatePath, content);

	return {
		created: true,
		templatePath,
		finalName,
	};
}
