/**
 * Export WebClipper templates to various formats.
 *
 * Supports:
 * - Export to WebClipper settings.json (for importing into browser extension)
 * - Export to Templater MD (for manual note creation in Obsidian)
 * - Sync from WebClipper settings.json (import changes made in extension)
 *
 * @module clipper/exporter
 */

import fs from "node:fs";
import path from "node:path";
import type { ParaObsidianConfig } from "../config/index";
import { atomicWriteFile } from "../shared/atomic-fs";
import { compareTemplates, webClipperToTemplater } from "./converter";
import {
	getTemplatesDirectory,
	loadTemplatesFromDirectory,
	parseSettingsFile,
} from "./parser";
import type { WebClipperSettings, WebClipperTemplate } from "./types";

/**
 * Maximum allowed template name length to prevent abuse.
 */
const MAX_TEMPLATE_NAME_LENGTH = 200;

/**
 * Sanitize a template name to prevent path traversal attacks.
 * Removes dangerous characters and patterns.
 */
function sanitizeTemplateName(name: string): string {
	// Reject overly long names
	if (name.length > MAX_TEMPLATE_NAME_LENGTH) {
		throw new Error(
			`Template name too long: ${name.length} chars (max ${MAX_TEMPLATE_NAME_LENGTH})`,
		);
	}

	// Remove null bytes, path separators, and parent directory references
	const sanitized = name
		.replace(/\0/g, "") // Null bytes
		.replace(/[/\\]/g, "-") // Path separators
		.replace(/\.\./g, "") // Parent directory traversal
		.replace(/^\.+/, "") // Leading dots
		.trim();

	// Ensure we have something left
	if (!sanitized || sanitized.length === 0) {
		throw new Error(`Invalid template name: '${name}' sanitizes to empty`);
	}

	return sanitized;
}

/**
 * Validate that a file path is safely within the expected directory.
 * Prevents path traversal attacks.
 */
function validatePathWithinDir(filePath: string, allowedDir: string): void {
	const resolvedPath = path.resolve(filePath);
	const resolvedDir = path.resolve(allowedDir);

	// Use path.relative to check containment
	const relative = path.relative(resolvedDir, resolvedPath);

	// If relative path starts with ".." or is absolute, it escapes the directory
	if (relative.startsWith("..") || path.isAbsolute(relative)) {
		throw new Error(
			`Path traversal detected: '${filePath}' escapes '${allowedDir}'`,
		);
	}
}

/**
 * Result of an export operation.
 */
export interface ExportResult {
	success: boolean;
	outputPath?: string;
	templateCount?: number;
	error?: string;
	warnings?: string[];
}

/**
 * Result of a sync operation.
 */
export interface SyncResult {
	success: boolean;
	added: string[];
	updated: string[];
	unchanged: string[];
	error?: string;
	warnings?: string[];
}

/**
 * List all available WebClipper templates.
 */
export function listTemplates(): {
	templates: Array<{ name: string; file: string; triggers: string[] }>;
	error?: string;
} {
	const templatesDir = getTemplatesDirectory();
	const result = loadTemplatesFromDirectory(templatesDir);

	if (!result.success || !result.data) {
		return { templates: [], error: result.error };
	}

	const templates = result.data.map((t) => ({
		name: t.name,
		file: `${t.name.toLowerCase().replace(/\s+/g, "-")}.json`,
		triggers: t.triggers || [],
	}));

	return { templates };
}

/**
 * Export all templates to WebClipper settings.json format.
 * This can be imported into the WebClipper browser extension.
 *
 * Uses atomic writes to prevent corruption.
 */
export async function exportToWebClipperSettings(
	outputPath: string,
): Promise<ExportResult> {
	const templatesDir = getTemplatesDirectory();
	const result = loadTemplatesFromDirectory(templatesDir);

	if (!result.success || !result.data) {
		return { success: false, error: result.error };
	}

	const settings: WebClipperSettings = {
		templates: result.data,
		vaults: [],
		propertyTypes: [],
	};

	try {
		// Use atomic write for crash safety
		await atomicWriteFile(outputPath, JSON.stringify(settings, null, "\t"));

		return {
			success: true,
			outputPath,
			templateCount: result.data.length,
			warnings: result.warnings,
		};
	} catch (error) {
		return {
			success: false,
			error: `Failed to write ${outputPath}: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}

/**
 * Export a single template to Templater MD format.
 *
 * Security: Sanitizes template names to prevent path traversal.
 * Uses atomic writes to prevent corruption.
 */
export async function exportToTemplater(
	templateName: string,
	outputPath?: string,
	config?: ParaObsidianConfig,
): Promise<ExportResult> {
	const templatesDir = getTemplatesDirectory();
	const result = loadTemplatesFromDirectory(templatesDir);

	if (!result.success || !result.data) {
		return { success: false, error: result.error };
	}

	// Find template by name (case-insensitive)
	const template = result.data.find(
		(t) => t.name.toLowerCase() === templateName.toLowerCase(),
	);

	if (!template) {
		const available = result.data.map((t) => t.name).join(", ");
		return {
			success: false,
			error: `Template '${templateName}' not found. Available: ${available}`,
		};
	}

	// Convert to Templater format
	const conversionResult = webClipperToTemplater(template);

	if (!conversionResult.success || !conversionResult.content) {
		return { success: false, error: conversionResult.error };
	}

	// Determine output path with sanitization
	let finalOutputPath = outputPath;
	if (!finalOutputPath && config) {
		try {
			const sanitizedName = sanitizeTemplateName(templateName);
			// Default to vault Templates folder
			finalOutputPath = path.join(
				config.templatesDir || path.join(config.vault, "Templates"),
				`${sanitizedName.toLowerCase().replace(/\s+/g, "-")}.md`,
			);
		} catch (error) {
			return {
				success: false,
				error: `Invalid template name: ${error instanceof Error ? error.message : String(error)}`,
			};
		}
	}

	if (!finalOutputPath) {
		// Return content for stdout
		return {
			success: true,
			templateCount: 1,
			outputPath: undefined,
			warnings: [
				...(conversionResult.warnings || []),
				`Content:\n${conversionResult.content}`,
			],
		};
	}

	try {
		// Use atomic write for crash safety
		await atomicWriteFile(finalOutputPath, conversionResult.content);

		const warnings = [...(conversionResult.warnings || [])];
		if (
			conversionResult.unsupportedFeatures &&
			conversionResult.unsupportedFeatures.length > 0
		) {
			warnings.push(
				`Unsupported features stripped: ${conversionResult.unsupportedFeatures.join(", ")}`,
			);
		}

		return {
			success: true,
			outputPath: finalOutputPath,
			templateCount: 1,
			warnings: warnings.length > 0 ? warnings : undefined,
		};
	} catch (error) {
		return {
			success: false,
			error: `Failed to write ${finalOutputPath}: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}

/**
 * Export all templates to Templater MD format.
 *
 * Security: Sanitizes template names to prevent path traversal.
 * Uses atomic writes to prevent corruption.
 */
export async function exportAllToTemplater(
	outputDir: string,
	config?: ParaObsidianConfig,
): Promise<ExportResult> {
	const templatesDir = getTemplatesDirectory();
	const result = loadTemplatesFromDirectory(templatesDir);

	if (!result.success || !result.data) {
		return { success: false, error: result.error };
	}

	const warnings: string[] = [];
	let successCount = 0;

	// Use vault templates dir or provided outputDir
	const targetDir =
		outputDir ||
		(config
			? config.templatesDir || path.join(config.vault, "Templates")
			: null);

	if (!targetDir) {
		return { success: false, error: "No output directory specified" };
	}

	// Ensure target directory exists
	if (!fs.existsSync(targetDir)) {
		fs.mkdirSync(targetDir, { recursive: true });
	}

	for (const template of result.data) {
		const conversionResult = webClipperToTemplater(template);

		if (!conversionResult.success || !conversionResult.content) {
			warnings.push(`${template.name}: ${conversionResult.error}`);
			continue;
		}

		try {
			// Sanitize template name
			const sanitizedName = sanitizeTemplateName(template.name);
			const fileName = `${sanitizedName.toLowerCase().replace(/\s+/g, "-")}.md`;
			const filePath = path.join(targetDir, fileName);

			// Validate path is within target directory
			validatePathWithinDir(filePath, targetDir);

			// Use atomic write
			await atomicWriteFile(filePath, conversionResult.content);
			successCount++;

			if (conversionResult.warnings) {
				warnings.push(
					`${template.name}: ${conversionResult.warnings.join("; ")}`,
				);
			}
		} catch (error) {
			warnings.push(
				`${template.name}: Failed to write - ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	return {
		success: successCount > 0,
		outputPath: targetDir,
		templateCount: successCount,
		warnings: warnings.length > 0 ? warnings : undefined,
	};
}

/**
 * Sync templates from WebClipper settings.json.
 * Imports changes made in the browser extension back to the repo.
 *
 * Security: Validates template names and paths to prevent traversal attacks.
 * Uses atomic writes to prevent corruption.
 */
export async function syncFromWebClipperSettings(
	settingsPath: string,
): Promise<SyncResult> {
	// Parse the settings file
	const settingsResult = parseSettingsFile(settingsPath);

	if (!settingsResult.success || !settingsResult.data) {
		return {
			success: false,
			added: [],
			updated: [],
			unchanged: [],
			error: settingsResult.error,
		};
	}

	// Load existing templates
	const templatesDir = getTemplatesDirectory();
	const existingResult = loadTemplatesFromDirectory(templatesDir);

	if (!existingResult.success) {
		return {
			success: false,
			added: [],
			updated: [],
			unchanged: [],
			error: existingResult.error,
		};
	}

	const existingTemplates = new Map<string, WebClipperTemplate>(
		(existingResult.data || []).map((t) => [t.name.toLowerCase(), t]),
	);

	const added: string[] = [];
	const updated: string[] = [];
	const unchanged: string[] = [];
	const warnings: string[] = [];

	// Process templates from settings
	for (const template of settingsResult.data.templates) {
		try {
			// Sanitize template name to prevent path traversal
			const sanitizedName = sanitizeTemplateName(template.name);
			const normalizedName = sanitizedName.toLowerCase();
			const existing = existingTemplates.get(normalizedName);

			// Build safe file path
			const fileName = `${normalizedName.replace(/\s+/g, "-")}.json`;
			const filePath = path.join(templatesDir, fileName);

			// Validate the path is within templates directory
			validatePathWithinDir(filePath, templatesDir);

			if (!existing) {
				// New template - use atomic write
				await atomicWriteFile(filePath, JSON.stringify(template, null, "\t"));
				added.push(template.name);
			} else {
				// Compare and update if changed
				const comparison = compareTemplates(existing, template);

				if (!comparison.identical) {
					// Use atomic write for updates
					await atomicWriteFile(filePath, JSON.stringify(template, null, "\t"));
					updated.push(
						`${template.name} (${comparison.differences.join(", ")})`,
					);
				} else {
					unchanged.push(template.name);
				}
			}
		} catch (error) {
			warnings.push(
				`Failed to process ${template.name}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	return {
		success: true,
		added,
		updated,
		unchanged,
		warnings: warnings.length > 0 ? warnings : undefined,
	};
}

/**
 * Get a single template by name.
 */
export function getTemplate(templateName: string): {
	template?: WebClipperTemplate;
	error?: string;
} {
	const templatesDir = getTemplatesDirectory();
	const result = loadTemplatesFromDirectory(templatesDir);

	if (!result.success || !result.data) {
		return { error: result.error };
	}

	const template = result.data.find(
		(t) => t.name.toLowerCase() === templateName.toLowerCase(),
	);

	if (!template) {
		return { error: `Template '${templateName}' not found` };
	}

	return { template };
}
