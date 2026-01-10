/**
 * WebClipper template parser and validator.
 *
 * Parses WebClipper JSON templates and validates against the schema.
 * Supports both individual templates and full settings exports.
 *
 * @module clipper/parser
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCorrelationId, getSubsystemLogger } from "../shared/logger";
import type {
	ParseResult,
	WebClipperProperty,
	WebClipperSettings,
	WebClipperTemplate,
} from "./types";

const logger = getSubsystemLogger("cli");

/** Valid property types in WebClipper schema */
const VALID_PROPERTY_TYPES = [
	"text",
	"date",
	"multitext",
	"number",
	"checkbox",
] as const;

/** Current schema version */
const CURRENT_SCHEMA_VERSION = "0.1.0";

/**
 * Validate a single property object.
 */
function validateProperty(
	prop: unknown,
	index: number,
): { valid: boolean; error?: string } {
	if (typeof prop !== "object" || prop === null) {
		return { valid: false, error: `Property ${index} is not an object` };
	}

	const p = prop as Record<string, unknown>;

	if (typeof p.name !== "string" || p.name.trim() === "") {
		return { valid: false, error: `Property ${index} missing valid 'name'` };
	}

	if (typeof p.value !== "string") {
		return { valid: false, error: `Property ${index} missing 'value'` };
	}

	if (
		typeof p.type !== "string" ||
		!VALID_PROPERTY_TYPES.includes(
			p.type as (typeof VALID_PROPERTY_TYPES)[number],
		)
	) {
		return {
			valid: false,
			error: `Property ${index} has invalid 'type': ${p.type}`,
		};
	}

	return { valid: true };
}

/**
 * Validate a WebClipper template object.
 */
function validateTemplate(template: unknown): {
	valid: boolean;
	errors: string[];
	warnings: string[];
} {
	const errors: string[] = [];
	const warnings: string[] = [];

	if (typeof template !== "object" || template === null) {
		return { valid: false, errors: ["Template is not an object"], warnings };
	}

	const t = template as Record<string, unknown>;

	// Required fields
	if (typeof t.name !== "string" || t.name.trim() === "") {
		errors.push("Missing or invalid 'name'");
	}

	if (typeof t.noteNameFormat !== "string") {
		errors.push("Missing 'noteNameFormat'");
	}

	if (typeof t.path !== "string") {
		errors.push("Missing 'path'");
	}

	if (typeof t.noteContentFormat !== "string") {
		errors.push("Missing 'noteContentFormat'");
	}

	// Schema version check
	if (typeof t.schemaVersion !== "string") {
		warnings.push("Missing 'schemaVersion', assuming current version");
	} else if (t.schemaVersion !== CURRENT_SCHEMA_VERSION) {
		warnings.push(
			`Schema version '${t.schemaVersion}' differs from current '${CURRENT_SCHEMA_VERSION}'`,
		);
	}

	// Behavior validation
	if (t.behavior !== undefined) {
		if (t.behavior !== "create" && t.behavior !== "append") {
			errors.push(`Invalid 'behavior': ${t.behavior}`);
		}
	}

	// Properties validation
	if (!Array.isArray(t.properties)) {
		errors.push("'properties' must be an array");
	} else {
		for (let i = 0; i < t.properties.length; i++) {
			const propResult = validateProperty(t.properties[i], i);
			if (!propResult.valid && propResult.error) {
				errors.push(propResult.error);
			}
		}
	}

	// Triggers validation (optional)
	if (t.triggers !== undefined && !Array.isArray(t.triggers)) {
		errors.push("'triggers' must be an array");
	}

	return { valid: errors.length === 0, errors, warnings };
}

/**
 * Parse a WebClipper template from JSON string.
 */
export function parseTemplate(json: string): ParseResult<WebClipperTemplate> {
	const cid = createCorrelationId();
	logger.info`clipper:parse:start cid=${cid}`;

	try {
		const parsed = JSON.parse(json);
		const validation = validateTemplate(parsed);

		if (!validation.valid) {
			const error = validation.errors.join("; ");
			logger.error`clipper:parse:error cid=${cid} error=${error}`;
			return {
				success: false,
				error,
				warnings: validation.warnings,
			};
		}

		// H4: Cast to template type with defaults
		// NOTE: Extra fields on property objects will pass through without validation.
		// This is acceptable for forward compatibility with future schema versions.
		const template: WebClipperTemplate = {
			schemaVersion: parsed.schemaVersion || CURRENT_SCHEMA_VERSION,
			name: parsed.name,
			behavior: parsed.behavior || "create",
			noteNameFormat: parsed.noteNameFormat,
			path: parsed.path,
			context: parsed.context,
			noteContentFormat: parsed.noteContentFormat,
			properties: parsed.properties as WebClipperProperty[],
			triggers: parsed.triggers,
		};

		logger.info`clipper:parse:success cid=${cid} name=${template.name}`;
		return {
			success: true,
			data: template,
			warnings:
				validation.warnings.length > 0 ? validation.warnings : undefined,
		};
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		logger.error`clipper:parse:error cid=${cid} error=${errorMsg}`;
		return {
			success: false,
			error: `JSON parse error: ${errorMsg}`,
		};
	}
}

/**
 * Parse a WebClipper template from a file.
 */
export function parseTemplateFile(
	filePath: string,
): ParseResult<WebClipperTemplate> {
	try {
		const content = fs.readFileSync(filePath, "utf-8");
		const result = parseTemplate(content);

		if (!result.success) {
			return {
				...result,
				error: `${path.basename(filePath)}: ${result.error}`,
			};
		}

		return result;
	} catch (error) {
		return {
			success: false,
			error: `Failed to read ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}

/**
 * Parse WebClipper settings export (contains all templates).
 */
export function parseSettings(json: string): ParseResult<WebClipperSettings> {
	try {
		const parsed = JSON.parse(json);

		if (typeof parsed !== "object" || parsed === null) {
			return { success: false, error: "Settings must be an object" };
		}

		if (!Array.isArray(parsed.templates)) {
			return { success: false, error: "Settings missing 'templates' array" };
		}

		const warnings: string[] = [];
		const validTemplates: WebClipperTemplate[] = [];

		for (let i = 0; i < parsed.templates.length; i++) {
			const templateResult = validateTemplate(parsed.templates[i]);
			if (templateResult.valid) {
				const t = parsed.templates[i];
				validTemplates.push({
					schemaVersion: t.schemaVersion || CURRENT_SCHEMA_VERSION,
					name: t.name,
					behavior: t.behavior || "create",
					noteNameFormat: t.noteNameFormat,
					path: t.path,
					context: t.context,
					noteContentFormat: t.noteContentFormat,
					properties: t.properties,
					triggers: t.triggers,
				});
			} else {
				warnings.push(
					`Template ${i} (${parsed.templates[i]?.name || "unknown"}): ${templateResult.errors.join("; ")}`,
				);
			}
			if (templateResult.warnings.length > 0) {
				warnings.push(...templateResult.warnings);
			}
		}

		const settings: WebClipperSettings = {
			vaults: parsed.vaults,
			templates: validTemplates,
			propertyTypes: parsed.propertyTypes,
			generalSettings: parsed.generalSettings,
		};

		return {
			success: true,
			data: settings,
			warnings: warnings.length > 0 ? warnings : undefined,
		};
	} catch (error) {
		return {
			success: false,
			error: `JSON parse error: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}

/**
 * Parse WebClipper settings from a file.
 */
export function parseSettingsFile(
	filePath: string,
): ParseResult<WebClipperSettings> {
	try {
		const content = fs.readFileSync(filePath, "utf-8");
		return parseSettings(content);
	} catch (error) {
		return {
			success: false,
			error: `Failed to read ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}

/**
 * Load all templates from a directory.
 *
 * Deduplicates templates by name (case-insensitive).
 * When duplicates are found, keeps the first file alphabetically and warns.
 */
export function loadTemplatesFromDirectory(
	dirPath: string,
): ParseResult<WebClipperTemplate[]> {
	const cid = createCorrelationId();
	logger.info`clipper:load:start cid=${cid} dirPath=${dirPath}`;

	try {
		if (!fs.existsSync(dirPath)) {
			const error = `Directory not found: ${dirPath}`;
			logger.error`clipper:load:error cid=${cid} error=${error}`;
			return { success: false, error };
		}

		// Sort files alphabetically so deduplication is deterministic
		const files = fs
			.readdirSync(dirPath)
			.filter((f) => f.endsWith(".json"))
			.sort();

		const templates: WebClipperTemplate[] = [];
		const warnings: string[] = [];

		// Track seen template names (lowercase) to detect duplicates
		const seenNames = new Map<string, string>(); // name -> first filename

		for (const file of files) {
			const filePath = path.join(dirPath, file);
			const result = parseTemplateFile(filePath);

			if (result.success && result.data) {
				const normalizedName = result.data.name.toLowerCase();

				// Check for duplicate template name
				const existingFile = seenNames.get(normalizedName);
				if (existingFile) {
					warnings.push(
						`Duplicate template "${result.data.name}" in ${file} (already loaded from ${existingFile})`,
					);
					continue; // Skip duplicate
				}

				seenNames.set(normalizedName, file);
				templates.push(result.data);
			} else if (result.error) {
				warnings.push(result.error);
			}

			if (result.warnings) {
				warnings.push(...result.warnings);
			}
		}

		logger.info`clipper:load:success cid=${cid} templateCount=${templates.length}`;
		return {
			success: true,
			data: templates,
			warnings: warnings.length > 0 ? warnings : undefined,
		};
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		logger.error`clipper:load:error cid=${cid} error=${errorMsg}`;
		return {
			success: false,
			error: `Failed to read directory: ${errorMsg}`,
		};
	}
}

/**
 * Get the templates directory path within the plugin.
 */
export function getTemplatesDirectory(): string {
	// Resolve relative to this file's location using ES module compatible approach
	const currentFilePath = fileURLToPath(import.meta.url);
	const currentDir = path.dirname(currentFilePath);
	return path.resolve(currentDir, "../../templates/webclipper");
}
