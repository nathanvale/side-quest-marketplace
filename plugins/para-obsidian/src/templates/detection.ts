/**
 * Template detection service
 *
 * Detects existing templates in the vault and provides discriminated union
 * results for type-safe pattern matching.
 *
 * @module templates/detection
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathExists } from "@sidequest/core/fs";
import type { TemplateDetectionResult } from "../inbox/classify/classifiers/types";

/**
 * Detects if a template file exists in the vault.
 *
 * Returns a discriminated union for type-safe pattern matching:
 * - If exists: includes path and content
 * - If not exists: includes suggested path for creation
 *
 * @param vaultPath - Path to Obsidian vault
 * @param templateName - Template name (without .md extension)
 * @returns Template detection result
 *
 * @example
 * ```typescript
 * const result = await detectTemplate('/vault', 'invoice');
 * if (result.exists) {
 *   console.log(`Found at: ${result.path}`);
 *   console.log(`Content: ${result.content}`);
 * } else {
 *   console.log(`Not found. Create at: ${result.suggestedPath}`);
 * }
 * ```
 */
export async function detectTemplate(
	vaultPath: string,
	templateName: string,
	templatesDir = "Templates",
): Promise<TemplateDetectionResult> {
	const templatePath = join(vaultPath, templatesDir, `${templateName}.md`);

	try {
		const exists = await pathExists(templatePath);

		if (exists) {
			const content = await readFile(templatePath, "utf-8");
			return {
				exists: true,
				path: templatePath,
				content,
			};
		}

		return {
			exists: false,
			suggestedPath: templatePath,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(
			`Template detection failed: ${message}\n` +
				`Recovery: 1) Check vault path exists, 2) Verify ${templatesDir}/ directory is accessible`,
		);
	}
}
