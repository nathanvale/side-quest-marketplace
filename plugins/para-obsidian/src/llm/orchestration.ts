/**
 * High-level LLM orchestration workflows.
 *
 * Provides complete end-to-end operations that combine:
 * - Template metadata extraction
 * - Constraint building
 * - Prompt generation
 * - LLM inference
 * - Note creation and validation
 *
 * @module llm/orchestration
 */

import {
	callModel,
	type LLMModel,
	parseOllamaResponse,
} from "@sidequest/core/llm";
import type { ParaObsidianConfig } from "../config/index";
import {
	readFrontmatterFile,
	updateFrontmatterFile,
	type ValidationIssue,
	validateFrontmatterFile,
} from "../frontmatter/index";
import { readFile } from "../fs";
import { autoCommitChanges } from "../git/index";
import { listAreas, listProjects, listTags } from "../indexer";
import { DEFAULT_LLM_MODEL, type ExtractionResult } from "../llm";
import {
	createFromTemplate,
	replaceH1Title,
	replaceSections,
} from "../notes/create";
import {
	extractSourceHeadings,
	getEditableSections,
	getTemplate,
	getTemplateFields,
	suggestSectionMapping,
} from "../templates/index";
import { applyTitlePrefix } from "../utils/title";
import { stripWikilinks } from "../utils/wikilinks";
import { buildConstraintSet, type VaultContext } from "./constraints";
import {
	buildStructuredPrompt,
	DEFAULT_CRITICAL_RULES,
} from "./prompt-builder";

// Re-export for backward compatibility
export { applyTitlePrefix } from "../utils/title";

/**
 * Recursively flatten a nested array to extract the innermost string value.
 * Handles malformed LLM output like `[["- Lodge Name"]]` or `[[["value"]]]`.
 *
 * @example
 * flattenToString([["- Lodge Name"]]) // "- Lodge Name"
 * flattenToString([[["deep"]]]) // "deep"
 * flattenToString("simple") // "simple"
 * flattenToString([]) // null
 * flattenToString(null) // null
 */
export function flattenToString(value: unknown): string | null {
	if (value === null || value === undefined) return null;
	if (typeof value === "string") return value;
	if (Array.isArray(value)) {
		if (value.length === 0) return null;
		// Recursively extract from first element
		return flattenToString(value[0]);
	}
	// For other types (number, boolean), convert to string
	return String(value);
}

/**
 * Clean up a wikilink value extracted from LLM response.
 * - Flattens nested arrays to string
 * - Removes markdown list prefixes (- or *)
 * - Strips wikilink brackets
 *
 * Order matters: prefix must be removed before wikilink detection
 * since "- [[Foo]]" doesn't start with "[[".
 *
 * @example
 * cleanWikilinkValue([["- Lake St Clair Lodge"]]) // "Lake St Clair Lodge"
 * cleanWikilinkValue("[[Home]]") // "Home"
 * cleanWikilinkValue("- [[Some Project]]") // "Some Project"
 */
export function cleanWikilinkValue(value: unknown): string | null {
	// First flatten any nested arrays
	const flattened = flattenToString(value);
	if (flattened === null) return null;

	// Remove markdown list prefixes FIRST (before wikilink stripping)
	// because "- [[Foo]]" doesn't start with "[[" so wikilink detection fails
	const withoutPrefix = flattened.replace(/^[-*]\s*/, "").trim();

	// Then strip wikilinks
	const stripped = stripWikilinks(withoutPrefix);
	if (stripped === null) return null;

	return stripped.trim() || null;
}

/**
 * Check if a value represents a null/empty value.
 * Handles various null representations from LLM responses.
 *
 * @example
 * isNullishValue(null) // true
 * isNullishValue("null") // true
 * isNullishValue("NULL") // true
 * isNullishValue("  null  ") // true
 * isNullishValue("") // true
 * isNullishValue("  ") // true
 * isNullishValue("Strahan") // false
 */
function isNullishValue(value: string | null): boolean {
	if (value === null) return true;
	if (typeof value !== "string") return false;

	const trimmed = value.trim();
	if (trimmed === "") return true;

	// Check for various null representations (case-insensitive)
	const lowerValue = trimmed.toLowerCase();
	return lowerValue === "null" || lowerValue === "none" || lowerValue === "n/a";
}

/**
 * List of known wikilink field names (case-insensitive).
 * These fields may contain nested arrays from LLM output that need flattening.
 * Used for normalizing LLM output before further processing.
 */
const WIKILINK_FIELD_NAMES = [
	"area",
	"project",
	"accommodation",
	"decision",
] as const;

/**
 * Extract wikilink field names from a template's frontmatter rules.
 * Returns only fields that are defined with type: "wikilink" in the schema.
 *
 * @param rules - The frontmatter rules for a specific template type
 * @returns Array of field names that are wikilink type
 */
export function getWikilinkFieldsFromRules(
	rules: { required?: Record<string, { type: string }> } | undefined,
): string[] {
	if (!rules?.required) return [];
	return Object.entries(rules.required)
		.filter(([, field]) => field.type === "wikilink")
		.map(([name]) => name);
}

/**
 * Check if a field key represents a wikilink-type field.
 * Matches exact names and partial matches (e.g., "Project title" matches "project").
 */
function isWikilinkField(key: string): boolean {
	const lowerKey = key.toLowerCase();
	return WIKILINK_FIELD_NAMES.some(
		(field) => lowerKey === field || lowerKey.includes(field),
	);
}

/**
 * Normalize extracted args from LLM response.
 * - Flattens nested arrays for wikilink fields (handles malformed LLM output)
 * - Strips wikilink brackets (templates already have them)
 * - Removes markdown list prefixes from wikilink values
 * - Converts empty/null/"null" strings to null (case-insensitive, whitespace-tolerant)
 * - Handles title field specially (never null, use empty check)
 * - Preserves non-wikilink values as-is
 */
function normalizeExtractedArgs(
	args: Record<string, unknown>,
): Record<string, string | null> {
	const normalized: Record<string, string | null> = {};

	for (const [key, value] of Object.entries(args)) {
		if (isWikilinkField(key)) {
			// Use cleanWikilinkValue which handles nested arrays, wikilinks, and markdown prefixes
			normalized[key] = cleanWikilinkValue(value);
		} else if (isNullishValue(value as string | null)) {
			normalized[key] = null;
		} else {
			// Handle non-wikilink fields
			// First flatten any arrays (shouldn't happen, but safety net)
			const flattened = flattenToString(value);
			// Trim whitespace from non-null values
			normalized[key] =
				typeof flattened === "string" ? flattened.trim() : flattened;
		}
	}

	return normalized;
}

/**
 * Result of a note conversion operation.
 */
export interface ConversionResult {
	/** Path to the created note file */
	filePath: string;
	/** Validation results */
	validation: {
		valid: boolean;
		issues: ReadonlyArray<ValidationIssue>;
	};
	/** Sections successfully injected */
	sectionsInjected: string[];
	/** Sections that were skipped (with reasons) */
	sectionsSkipped: Array<{ heading: string; reason: string }>;
}

/**
 * Options for converting a note to a template.
 */
export interface ConvertNoteOptions {
	/** Path to the source note file (relative to vault) */
	sourceFile: string;
	/** Target template name */
	template: string;
	/** LLM model to use (default: qwen2.5:14b) */
	model?: string;
	/** Override the extracted title */
	titleOverride?: string;
	/** Destination folder (default: template's default folder) */
	dest?: string;
	/** Dry run mode - extract but don't create note */
	dryRun?: boolean;
}

/**
 * Convert a freeform note to a structured template using LLM extraction.
 *
 * This is the complete conversion workflow extracted from the CLI convert command.
 * It handles:
 * 1. Reading source note
 * 2. Building vault context
 * 3. LLM extraction
 * 4. Note creation
 * 5. Frontmatter updates
 * 6. Content injection
 * 7. Validation
 * 8. Auto-commit (if enabled)
 *
 * @param config - Para-obsidian configuration
 * @param options - Conversion options
 * @returns Conversion result with file path, validation, and injection stats
 *
 * @example
 * ```typescript
 * const result = await convertNoteToTemplate(config, {
 *   sourceFile: "inbox/rough-notes.md",
 *   template: "project",
 *   model: "qwen2.5:14b"
 * });
 *
 * console.log(`Created: ${result.filePath}`);
 * console.log(`Valid: ${result.validation.valid}`);
 * ```
 */
export async function convertNoteToTemplate(
	config: ParaObsidianConfig,
	options: ConvertNoteOptions,
): Promise<ConversionResult> {
	// 1. Read source note
	let existingContent: string;
	try {
		const { body, attributes } = readFrontmatterFile(
			config,
			options.sourceFile,
		);
		existingContent =
			Object.keys(attributes).length > 0
				? `Existing frontmatter:\n${JSON.stringify(attributes, null, 2)}\n\nBody:\n${body}`
				: body;
	} catch {
		// File might not have frontmatter, read as plain text
		existingContent = readFile(config.vault, options.sourceFile);
	}

	// 2. Build vault context
	const vaultContext: VaultContext = {
		areas: listAreas(config),
		projects: listProjects(config),
		suggestedTags: listTags(config),
	};

	// 3. Get template info
	const templateInfo = getTemplate(config, options.template);
	if (!templateInfo) {
		throw new Error(`Template "${options.template}" not found`);
	}

	const fields = getTemplateFields(templateInfo);
	const sections = getEditableSections(templateInfo);
	const rules = config.frontmatterRules?.[options.template];

	// 4. Extract source document structure for intelligent mapping
	const sourceHeadings = extractSourceHeadings(existingContent);
	const sectionMapping = suggestSectionMapping(
		sourceHeadings.map((h) => h.text),
		sections,
	);

	// 5. Build constraints and prompt
	const constraints = buildConstraintSet(fields, sections, rules, vaultContext);
	const prompt = buildStructuredPrompt({
		systemRole: `You are extracting structured data from an existing note to convert it to a "${options.template}" template.`,
		sourceContent: existingContent,
		constraints,
		criticalRules: DEFAULT_CRITICAL_RULES,
		sourceHeadings: sourceHeadings.map((h) => h.text),
		sectionMapping,
	});

	// 6. Call LLM
	const model = options.model ?? DEFAULT_LLM_MODEL;
	const rawResponse = await callModel({ model: model as LLMModel, prompt });
	const extracted = parseOllamaResponse(rawResponse);

	// 6b. Normalize extracted args (strip wikilinks, handle nulls)
	extracted.args = normalizeExtractedArgs(extracted.args);

	// 7. Dry run check
	if (options.dryRun) {
		return {
			filePath: "[dry-run]",
			validation: { valid: true, issues: [] },
			sectionsInjected: Object.keys(extracted.content),
			sectionsSkipped: [],
		};
	}

	// 8. Create note from template
	// Resolve title with fallbacks, rejecting "null" and "Untitled" as invalid
	const isValidTitle = (t: unknown): t is string =>
		typeof t === "string" && t !== "" && t !== "null" && t !== "Untitled";

	const baseTitle =
		options.titleOverride ??
		(isValidTitle(extracted.title) ? extracted.title : null) ??
		(isValidTitle(extracted.args.title) ? extracted.args.title : null) ??
		extracted.title;

	// Apply template-specific prefix (e.g., "Research -", "Booking -")
	const resolvedTitle = applyTitlePrefix(baseTitle, options.template, config);

	// Filter out null values before passing to template substitution
	// (null values would otherwise be coerced to "null" strings)
	const nonNullArgs: Record<string, string> = {};
	for (const [key, value] of Object.entries(extracted.args)) {
		if (value !== null) {
			nonNullArgs[key] = value;
		}
	}

	const result = createFromTemplate(config, {
		template: options.template,
		title: resolvedTitle,
		dest: options.dest,
		args: nonNullArgs,
	});

	// 9. Update frontmatter with extracted values
	// - Wikilink fields defined in template schema get explicit null to overwrite bad template defaults
	// - Other null values are skipped
	// - Templater prompt keys are used to extract wikilink values, then skipped for direct frontmatter updates
	const frontmatterUpdates: Record<string, unknown> = {};

	// Track which wikilink fields we've seen values for
	// Only include fields that are defined in this template's schema (not all possible wikilink fields)
	const templateWikilinkFields = getWikilinkFieldsFromRules(rules);
	const wikilinkFieldsFound: Record<string, string | null> = {};
	for (const field of templateWikilinkFields) {
		wikilinkFieldsFound[field] = null;
	}

	// Helper to check if a key refers to a wikilink field defined in this template
	// Returns the canonical field name if match found, null otherwise
	const getWikilinkFieldName = (k: string): string | null => {
		const lower = k.toLowerCase();
		for (const field of templateWikilinkFields) {
			if (lower === field || lower.includes(field)) return field;
		}
		return null;
	};

	for (const [key, value] of Object.entries(extracted.args)) {
		// Check if this is a wikilink field (even if it's a Templater prompt key)
		const wikilinkField = getWikilinkFieldName(key);
		if (wikilinkField && value !== null) {
			wikilinkFieldsFound[wikilinkField] = value;
		}

		// Skip Templater prompt text for direct frontmatter updates
		// Templater prompts contain: spaces, parentheses, or start with capital letter
		// Valid field names: title, trip_date, day_number, location, accommodation
		// Invalid (prompt text): "Day title", "Date (YYYY-MM-DD)", "Location", "Project"
		if (
			key.includes(" ") ||
			key.includes("(") ||
			key.includes(")") ||
			/^[A-Z]/.test(key)
		) {
			continue; // Skip Templater prompt keys
		}

		// Add non-wikilink fields if they have a value
		if (!wikilinkField && value !== null && value !== "null") {
			frontmatterUpdates[key] = value;
		}
	}

	// Always set wikilink fields (to value or null) to overwrite bad template defaults
	for (const [field, value] of Object.entries(wikilinkFieldsFound)) {
		frontmatterUpdates[field] = value;
	}

	// Always set template_version to the current expected version
	const expectedVersion = config.templateVersions?.[options.template];
	if (expectedVersion !== undefined) {
		frontmatterUpdates.template_version = expectedVersion;
	}

	if (Object.keys(frontmatterUpdates).length > 0) {
		updateFrontmatterFile(config, result.filePath, {
			set: frontmatterUpdates,
			dryRun: false,
		});
	}

	// 10. Replace H1 title placeholder with actual title
	const noteTitle =
		typeof extracted.args.title === "string"
			? extracted.args.title
			: (options.titleOverride ?? extracted.title);
	replaceH1Title(config, result.filePath, noteTitle);

	// 11. Replace content sections (not append)
	let sectionsInjected: string[] = [];
	let sectionsSkipped: Array<{ heading: string; reason: string }> = [];

	if (extracted.content && Object.keys(extracted.content).length > 0) {
		const injectionResult = replaceSections(
			config,
			result.filePath,
			extracted.content,
			{ preserveComments: true },
		);
		sectionsInjected = injectionResult.injected;
		sectionsSkipped = injectionResult.skipped;
	}

	// 12. Validate the result
	const validation = validateFrontmatterFile(config, result.filePath);

	// 13. Auto-commit if enabled
	if (config.autoCommit) {
		await autoCommitChanges(
			config,
			[result.filePath],
			`convert ${options.sourceFile} to ${options.template}`,
		);
	}

	return {
		filePath: result.filePath,
		validation: {
			valid: validation.valid,
			issues: validation.issues,
		},
		sectionsInjected,
		sectionsSkipped,
	};
}

/**
 * Options for extracting metadata from a source file or raw content.
 */
export interface ExtractMetadataOptions {
	/** Path to the source note file (relative to vault) - mutually exclusive with sourceContent */
	sourceFile?: string;
	/** Raw source content to extract from - mutually exclusive with sourceFile */
	sourceContent?: string;
	/** Target template name */
	template: string;
	/** LLM model to use (default: qwen2.5:14b) */
	model?: string;
	/** Whether to extract full content sections (default: true) */
	extractContent?: boolean;
	/** Optional arg overrides to apply to LLM suggestions */
	argOverrides?: Record<string, string>;
}

/**
 * Extract metadata from a source file without creating a note (preview mode).
 *
 * This is a lightweight version of convertNoteToTemplate that only extracts
 * and returns the metadata without creating files. Useful for preview/suggestion
 * workflows where the user wants to see what the LLM will extract before committing.
 *
 * @param config - Para-obsidian configuration
 * @param options - Extraction options
 * @returns Extraction result with suggested args and content
 *
 * @example
 * ```typescript
 * // Preview mode - extract suggestions without creating note
 * const metadata = await extractMetadata(config, {
 *   sourceFile: "inbox/rough-notes.md",
 *   template: "project",
 *   extractContent: false  // Skip content extraction for faster preview
 * });
 *
 * console.log(`Suggested title: ${metadata.title}`);
 * console.log(`Suggested args:`, metadata.args);
 *
 * // With overrides - user provides some args, LLM fills in the rest
 * const metadata = await extractMetadata(config, {
 *   sourceFile: "inbox/rough-notes.md",
 *   template: "project",
 *   argOverrides: { area: "[[Work]]" }  // User-provided value
 * });
 * ```
 */
export async function extractMetadata(
	config: ParaObsidianConfig,
	options: ExtractMetadataOptions,
): Promise<ExtractionResult> {
	// 1. Get source content - either from file or directly provided
	let existingContent: string;

	if (options.sourceContent) {
		// Raw content provided directly
		existingContent = options.sourceContent;
	} else if (options.sourceFile) {
		// Read from file
		try {
			const { body, attributes } = readFrontmatterFile(
				config,
				options.sourceFile,
			);
			existingContent =
				Object.keys(attributes).length > 0
					? `Existing frontmatter:\n${JSON.stringify(attributes, null, 2)}\n\nBody:\n${body}`
					: body;
		} catch {
			// File might not have frontmatter, read as plain text
			existingContent = readFile(config.vault, options.sourceFile);
		}
	} else {
		throw new Error(
			"Either sourceFile or sourceContent must be provided to extractMetadata",
		);
	}

	// 2. Build vault context
	const vaultContext: VaultContext = {
		areas: listAreas(config),
		projects: listProjects(config),
		suggestedTags: listTags(config),
	};

	// 3. Get template info
	const templateInfo = getTemplate(config, options.template);
	if (!templateInfo) {
		throw new Error(`Template "${options.template}" not found`);
	}

	const fields = getTemplateFields(templateInfo);
	const sections = getEditableSections(templateInfo);
	const rules = config.frontmatterRules?.[options.template];

	// 4. Extract source document structure for intelligent mapping
	const sourceHeadings = extractSourceHeadings(existingContent);
	const sectionMapping = suggestSectionMapping(
		sourceHeadings.map((h) => h.text),
		sections,
	);

	// 5. Build constraints and prompt
	const constraints = buildConstraintSet(fields, sections, rules, vaultContext);

	// If extractContent is false, add a critical rule to skip content extraction
	const criticalRules =
		options.extractContent === false
			? [
					...DEFAULT_CRITICAL_RULES,
					'You MUST set "content" to an empty object {}. DO NOT extract section content.',
				]
			: DEFAULT_CRITICAL_RULES;

	const prompt = buildStructuredPrompt({
		systemRole: `You are extracting structured data from an existing note to convert it to a "${options.template}" template.`,
		sourceContent: existingContent,
		constraints,
		criticalRules,
		sourceHeadings: sourceHeadings.map((h) => h.text),
		sectionMapping,
	});

	// 6. Call LLM
	const model = options.model ?? DEFAULT_LLM_MODEL;
	const rawResponse = await callModel({ model: model as LLMModel, prompt });
	const extracted = parseOllamaResponse(rawResponse);

	// 6b. Normalize extracted args (strip wikilinks, handle nulls)
	extracted.args = normalizeExtractedArgs(extracted.args);

	// 6c. Normalize title (treat "null" string as "Untitled")
	if (extracted.title === "null" || extracted.title === "") {
		extracted.title = "Untitled";
	}

	// 6d. Apply template-specific prefix to title
	extracted.title = applyTitlePrefix(extracted.title, options.template, config);

	// 7. Apply arg overrides if provided
	if (options.argOverrides) {
		for (const [key, value] of Object.entries(options.argOverrides)) {
			extracted.args[key] = value;
		}
	}

	return extracted;
}

/**
 * Options for suggesting field values.
 */
export interface SuggestFieldValuesOptions {
	/** Target template name */
	template: string;
	/** Hints for field values (e.g., { title: "Build shed" }) */
	hints: Record<string, string>;
	/** LLM model to use (default: qwen2.5:14b) */
	model?: string;
}

/**
 * Suggest field values for a template based on hints.
 *
 * This is a lighter-weight extraction for slash command suggestions.
 * It uses the same constraint building as full conversion, but with
 * minimal source content (just the hints).
 *
 * @param config - Para-obsidian configuration
 * @param options - Suggestion options
 * @returns Extracted field suggestions
 *
 * @example
 * ```typescript
 * const suggestions = await suggestFieldValues(config, {
 *   template: "task",
 *   hints: { title: "Fix the shed door" }
 * });
 *
 * console.log(suggestions.args.project); // LLM suggests: "[[Build Garden Shed]]"
 * ```
 */
export async function suggestFieldValues(
	config: ParaObsidianConfig,
	options: SuggestFieldValuesOptions,
): Promise<ExtractionResult> {
	// Get template info
	const templateInfo = getTemplate(config, options.template);
	if (!templateInfo) {
		throw new Error(`Template "${options.template}" not found`);
	}

	// Build vault context
	const vaultContext: VaultContext = {
		areas: listAreas(config),
		projects: listProjects(config),
		suggestedTags: listTags(config),
	};

	const fields = getTemplateFields(templateInfo);
	const sections = getEditableSections(templateInfo);
	const rules = config.frontmatterRules?.[options.template];

	// Build constraints
	const constraints = buildConstraintSet(fields, sections, rules, vaultContext);

	// Build minimal content from hints
	const hintContent = Object.entries(options.hints)
		.map(([k, v]) => `${k}: ${v}`)
		.join("\n");

	// Build prompt
	const prompt = buildStructuredPrompt({
		systemRole: `You are suggesting field values for a ${options.template} template.`,
		sourceContent: hintContent,
		constraints,
	});

	// Call LLM
	const model = options.model ?? DEFAULT_LLM_MODEL;
	const rawResponse = await callModel({ model: model as LLMModel, prompt });
	const extracted = parseOllamaResponse(rawResponse);

	// Normalize extracted args (strip wikilinks, handle nulls)
	extracted.args = normalizeExtractedArgs(extracted.args);

	// Normalize title (treat "null" string as "Untitled")
	if (extracted.title === "null" || extracted.title === "") {
		extracted.title = "Untitled";
	}

	return extracted;
}

/**
 * Options for batch conversion.
 */
export interface BatchConvertOptions {
	/** List of source files to convert */
	files: ReadonlyArray<string>;
	/** Target template name */
	template: string;
	/** LLM model to use (default: qwen2.5:14b) */
	model?: string;
	/** Parallelism level (not yet implemented) */
	parallelism?: number;
}

/**
 * Convert multiple notes in batch with shared constraints.
 *
 * Processes multiple files sequentially, using the same template
 * and vault context for efficiency.
 *
 * @param config - Para-obsidian configuration
 * @param options - Batch conversion options
 * @returns Array of conversion results
 *
 * @example
 * ```typescript
 * const results = await batchConvert(config, {
 *   files: ["inbox/note1.md", "inbox/note2.md"],
 *   template: "project"
 * });
 *
 * console.log(`Converted ${results.length} notes`);
 * ```
 */
export async function batchConvert(
	config: ParaObsidianConfig,
	options: BatchConvertOptions,
): Promise<ReadonlyArray<ConversionResult>> {
	const results: ConversionResult[] = [];

	// Process files sequentially (parallel processing could be added later)
	for (const file of options.files) {
		const result = await convertNoteToTemplate(config, {
			sourceFile: file,
			template: options.template,
			model: options.model,
		});
		results.push(result);
	}

	return results;
}
