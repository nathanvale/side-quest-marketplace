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
import { withFileLock } from "../shared/file-lock";
import { createCorrelationId, getSubsystemLogger } from "../shared/logger";
import { Transaction } from "../shared/transaction";
import { compareTemplates, webClipperToTemplater } from "./converter";
import {
	getTemplatesDirectory,
	loadTemplatesFromDirectory,
	parseSettingsFile,
} from "./parser";
import type { WebClipperSettings, WebClipperTemplate } from "./types";

const logger = getSubsystemLogger("cli");

/**
 * Maximum allowed template name length to prevent abuse.
 */
const MAX_TEMPLATE_NAME_LENGTH = 200;

/**
 * Sanitize a template name to prevent path traversal attacks.
 * Removes dangerous characters and patterns.
 *
 * Strips common file extensions before sanitization to prevent
 * template names like "article.html" becoming "article-html.md".
 */
function sanitizeTemplateName(name: string): string {
	// Reject overly long names
	if (name.length > MAX_TEMPLATE_NAME_LENGTH) {
		throw new Error(
			`Template name too long: ${name.length} chars (max ${MAX_TEMPLATE_NAME_LENGTH})`,
		);
	}

	// H5: Strip common file extensions before sanitization
	const cleaned = name.replace(/\.(json|md|html|txt)$/i, "");

	// Remove null bytes, path separators, and parent directory references
	const sanitized = cleaned
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
 *
 * NOTE: Path validation intentionally omitted - allows exporting to arbitrary
 * locations (user's Downloads, Documents, etc.). Atomic writes ensure crash safety.
 */
export async function exportToWebClipperSettings(
	outputPath: string,
): Promise<ExportResult> {
	const cid = createCorrelationId();
	logger.info`clipper:export:start cid=${cid} outputPath=${outputPath}`;

	const templatesDir = getTemplatesDirectory();
	const result = loadTemplatesFromDirectory(templatesDir);

	if (!result.success || !result.data) {
		logger.error`clipper:export:error cid=${cid} error=${result.error || "Unknown error"}`;
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

		logger.info`clipper:export:success cid=${cid} outputPath=${outputPath} templateCount=${result.data.length}`;
		return {
			success: true,
			outputPath,
			templateCount: result.data.length,
			warnings: result.warnings,
		};
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		logger.error`clipper:export:error cid=${cid} error=${errorMsg}`;
		return {
			success: false,
			error: `Failed to write ${outputPath}: ${errorMsg}`,
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
 *
 * Failure threshold: Returns success=false if >50% of templates fail.
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

	// H7: Explicit error when no templates exist
	if (result.data.length === 0) {
		return {
			success: false,
			error: "No templates found to export. Check templates directory.",
		};
	}

	const warnings: string[] = [];
	let successCount = 0;
	let failedCount = 0;

	// Use vault templates dir or provided outputDir
	const targetDir =
		outputDir ||
		(config
			? config.templatesDir || path.join(config.vault, "Templates")
			: null);

	if (!targetDir) {
		return { success: false, error: "No output directory specified" };
	}

	// Ensure target directory exists (handle race condition)
	try {
		fs.mkdirSync(targetDir, { recursive: true });
	} catch (error) {
		// Ignore EEXIST - another process may have created it
		if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
			throw error;
		}
	}

	for (const template of result.data) {
		const conversionResult = webClipperToTemplater(template);

		if (!conversionResult.success || !conversionResult.content) {
			warnings.push(`${template.name}: ${conversionResult.error}`);
			failedCount++;
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
			failedCount++;
		}
	}

	// Calculate failure rate
	const totalTemplates = result.data.length;
	const failureRate = totalTemplates > 0 ? failedCount / totalTemplates : 0;

	// Fail if more than 50% of templates failed
	if (failureRate > 0.5) {
		return {
			success: false,
			outputPath: targetDir,
			templateCount: successCount,
			error: `Excessive failure rate: ${failedCount}/${totalTemplates} templates failed (${Math.round(failureRate * 100)}%)`,
			warnings: warnings.length > 0 ? warnings : undefined,
		};
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
 * Concurrency: File lock prevents race conditions between concurrent syncs.
 * Transactional: All-or-nothing semantics with automatic rollback on failure.
 *
 * Conflict detection: Warns when overwriting locally modified templates.
 */
export async function syncFromWebClipperSettings(
	settingsPath: string,
): Promise<SyncResult> {
	const cid = createCorrelationId();
	logger.info`clipper:sync:start cid=${cid} settingsPath=${settingsPath}`;

	// Parse the settings file
	const settingsResult = parseSettingsFile(settingsPath);

	if (!settingsResult.success || !settingsResult.data) {
		logger.error`clipper:sync:error cid=${cid} error=${settingsResult.error || "Unknown error"}`;
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
		logger.error`clipper:sync:error cid=${cid} error=${existingResult.error || "Unknown error"}`;
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

	// Extract settings data for type narrowing in closure
	const settingsData = settingsResult.data;

	// Use file lock to prevent concurrent modifications to templates directory
	return withFileLock(`templates-sync-${templatesDir}`, async () => {
		const added: string[] = [];
		const updated: string[] = [];
		const unchanged: string[] = [];
		const warnings: string[] = [];

		// Wrap template processing in a transaction for rollback support
		const tx = new Transaction();

		// Process templates from settings
		for (const template of settingsData.templates) {
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
					// New template - add to transaction
					tx.add({
						name: `create-template-${template.name}`,
						execute: async () => {
							await atomicWriteFile(
								filePath,
								JSON.stringify(template, null, "\t"),
							);
							added.push(template.name);
							return { filePath, isNew: true };
						},
						rollback: async (result) => {
							const state = result as { filePath: string; isNew: boolean };
							if (state?.isNew) {
								// Remove newly created file
								await fs.promises.unlink(state.filePath).catch(() => {
									// Ignore - file may not exist
								});
							}
						},
					});
				} else {
					// Compare and update if changed
					const comparison = compareTemplates(existing, template);

					if (!comparison.identical) {
						// H11: Check if local file was modified (compare disk vs memory)
						let fileModified = false;
						try {
							const diskContent = fs.readFileSync(filePath, "utf-8");
							const diskTemplate = JSON.parse(
								diskContent,
							) as WebClipperTemplate;
							const diskComparison = compareTemplates(diskTemplate, existing);
							fileModified = !diskComparison.identical;
						} catch {
							// If we can't read/parse disk file, assume not modified
							fileModified = false;
						}

						if (fileModified) {
							warnings.push(
								`${template.name}: Overwriting locally modified template (${comparison.differences.join(", ")})`,
							);
						}

						// Update - add to transaction with backup
						const backupContent = JSON.stringify(existing, null, "\t");

						tx.add({
							name: `update-template-${template.name}`,
							execute: async () => {
								await atomicWriteFile(
									filePath,
									JSON.stringify(template, null, "\t"),
								);
								updated.push(
									`${template.name} (${comparison.differences.join(", ")})`,
								);
								return { filePath, backupContent };
							},
							rollback: async (result) => {
								const state = result as {
									filePath: string;
									backupContent: string;
								};
								// Restore original content
								await atomicWriteFile(state.filePath, state.backupContent);
							},
						});
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

		// Execute transaction - rolls back all operations on failure
		const txResult = await tx.execute();

		if (!txResult.success) {
			logger.error`clipper:sync:error cid=${cid} failedAt=${txResult.failedAt} error=${txResult.error.message}`;
			return {
				success: false,
				added: [],
				updated: [],
				unchanged: [],
				error: `Transaction failed at ${txResult.failedAt}: ${txResult.error.message}`,
			};
		}

		logger.info`clipper:sync:complete cid=${cid} added=${added.length} updated=${updated.length} unchanged=${unchanged.length}`;
		return {
			success: true,
			added,
			updated,
			unchanged,
			warnings: warnings.length > 0 ? warnings : undefined,
		};
	});
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
