/**
 * Bidirectional converter between WebClipper JSON and Templater MD formats.
 *
 * Handles the mapping of template variables, frontmatter properties,
 * and content formatting between the two systems.
 *
 * @module clipper/converter
 */

import { createCorrelationId, getSubsystemLogger } from "../shared/logger";
import type {
	ConversionResult,
	TemplateMetadata,
	TemplaterVariable,
	WebClipperProperty,
	WebClipperTemplate,
} from "./types";

const logger = getSubsystemLogger("cli");

/**
 * Maximum allowed content length to prevent DoS via regex processing.
 * 1MB is generous for any reasonable template.
 */
const MAX_CONTENT_LENGTH = 1024 * 1024; // 1MB

/**
 * Maximum regex iterations to prevent ReDoS attacks.
 * Even with valid content length, malformed patterns could cause backtracking.
 */
const MAX_REGEX_ITERATIONS = 10000;

/**
 * Validate content length before regex processing.
 * Throws if content exceeds maximum allowed length.
 */
function validateContentLength(content: string, context: string): void {
	if (content.length > MAX_CONTENT_LENGTH) {
		throw new Error(
			`${context} exceeds maximum length (${content.length} > ${MAX_CONTENT_LENGTH} bytes)`,
		);
	}
}

/**
 * WebClipper variables that can be mapped to Templater prompts.
 * These are extracted from the page at clip time.
 */
const MAPPABLE_VARIABLES: Record<string, string> = {
	title: "Title",
	url: "URL",
	description: "Description",
	author: "Author",
	domain: "Domain",
	content: "Content",
	highlights: "Highlights",
};

/**
 * WebClipper-only features that have no Templater equivalent.
 * These will be stripped with a warning.
 *
 * Order matters: AI prompt blocks must be stripped BEFORE schema patterns
 * because AI prompts can contain nested patterns.
 */
const WEBCLIPPER_ONLY_PATTERNS = [
	/\{\{"[^"]*"\|blockquote\}\}/g, // AI prompt blocks (must come first - full pattern)
	/\{\{schema:[^}]+\}\}/g, // Schema.org data extraction
	/\{\{selector:[^}]+\}\}/g, // CSS selector extraction
	/\{\{selectorHtml:[^}]+\}\}/g, // HTML selector extraction
	/\{\{meta:[^}]+\}\}/g, // Meta tag extraction
];

/**
 * Extract emoji prefix from WebClipper noteNameFormat.
 *
 * WebClipper format: "✂️📰 {{title|safe_name|slice:0,80}}"
 * Returns: "✂️📰" or undefined if no emoji prefix found
 *
 * Emoji detection uses Unicode properties to match emoji sequences,
 * including multi-codepoint emoji (e.g., skin tones, ZWJ sequences).
 */
function extractEmojiPrefix(noteNameFormat: string): string | undefined {
	// Match leading emoji characters (emoji, variation selectors, ZWJ sequences)
	// followed by optional whitespace before the first {{
	// Note: Using alternation instead of character class to avoid combining character issues
	// with \p{Emoji_Component} (Biome lint/suspicious/noMisleadingCharacterClass)
	const emojiRegex = /^((?:\p{Emoji}|\p{Emoji_Component}|\uFE0F|\u200D)+)\s*/u;
	const match = noteNameFormat.match(emojiRegex);

	if (match?.[1]) {
		return match[1].trim();
	}

	return undefined;
}

/**
 * Generate Templater rename script for emoji prefix.
 *
 * Creates a Templater execution block that renames the file
 * to add the emoji prefix if not already present.
 */
function generateEmojiRenameScript(emojiPrefix: string): string {
	// Escape the emoji for safe embedding in JavaScript string
	const escapedEmoji = emojiPrefix.replace(/"/g, '\\"');

	return `
<%*
// Auto-rename to add emoji prefix if not present
const title = tp.file.title;
if (!title.startsWith("${escapedEmoji}")) {
  await tp.file.rename("${escapedEmoji} " + title);
}
-%>`;
}

/**
 * Escape a string for safe embedding in Templater code.
 *
 * Prevents template injection by escaping:
 * - Double quotes: " → \"
 * - Backslashes: \ → \\
 * - Templater delimiters: <% → \<%, %> → %\>
 *
 * Security: Protects against code injection via date formats,
 * variable labels, and default values.
 */
function escapeTemplaterString(str: string): string {
	return str
		.replace(/\\/g, "\\\\") // Escape backslashes first
		.replace(/"/g, '\\"') // Escape double quotes
		.replace(/<%/g, "\\<%") // Escape opening delimiter
		.replace(/%>/g, "%\\>"); // Escape closing delimiter
}

/**
 * Convert a WebClipper date format to Templater date format.
 * WebClipper: {{time|date:"YYYY-MM-DD"}}
 * Templater: <% tp.date.now("YYYY-MM-DD") %>
 *
 * Security: Escapes date format string to prevent template injection.
 */
function convertDateFormat(value: string): {
	converted: string;
	isDate: boolean;
} {
	const dateMatch = value.match(/\{\{time\|date:"([^"]+)"\}\}/);
	if (dateMatch?.[1]) {
		const escapedFormat = escapeTemplaterString(dateMatch[1]);
		return {
			converted: `<% tp.date.now("${escapedFormat}") %>`,
			isDate: true,
		};
	}

	// Also handle schema date formats
	const schemaDateMatch = value.match(/\{\{schema:[^|]+\|date:"([^"]+)"\}\}/);
	if (schemaDateMatch?.[1]) {
		const escapedFormat = escapeTemplaterString(schemaDateMatch[1]);
		return {
			converted: `<% tp.date.now("${escapedFormat}") %>`,
			isDate: true,
		};
	}

	return { converted: value, isDate: false };
}

/**
 * Convert a WebClipper variable to Templater prompt.
 * WebClipper: {{variable}} or {{variable|default:""}}
 * Templater: <% tp.system.prompt("Variable", "") %>
 *
 * Security: Escapes label and defaultValue to prevent template injection.
 */
function convertVariable(variable: string, defaultValue?: string): string {
	const label = MAPPABLE_VARIABLES[variable] || variable;
	const escapedLabel = escapeTemplaterString(label);
	if (defaultValue !== undefined) {
		const escapedDefault = escapeTemplaterString(defaultValue);
		return `<% tp.system.prompt("${escapedLabel}", "${escapedDefault}") %>`;
	}
	return `<% tp.system.prompt("${escapedLabel}") %>`;
}

/**
 * Extract WebClipper variables from a string.
 * Returns the variable name and any default value.
 *
 * Protected against ReDoS with iteration limit.
 */
function extractVariables(
	content: string,
): Array<{ variable: string; defaultValue?: string; fullMatch: string }> {
	// Validate content length before regex processing
	validateContentLength(content, "Template content");

	const results: Array<{
		variable: string;
		defaultValue?: string;
		fullMatch: string;
	}> = [];

	// Match {{variable}} or {{variable|default:"value"}} or {{variable|default:""}}
	const regex = /\{\{(\w+)(?:\|default:"([^"]*)")?\}\}/g;
	let match: RegExpExecArray | null = regex.exec(content);
	let iterations = 0;

	while (match !== null) {
		iterations++;
		if (iterations > MAX_REGEX_ITERATIONS) {
			throw new Error(
				`Regex iteration limit exceeded (${MAX_REGEX_ITERATIONS}). Input may contain malicious patterns.`,
			);
		}

		const variable = match[1];
		if (variable) {
			results.push({
				variable,
				defaultValue: match[2],
				fullMatch: match[0],
			});
		}
		match = regex.exec(content);
	}

	return results;
}

/**
 * Check if a string contains WebClipper-only features.
 */
function containsWebClipperOnlyFeatures(content: string): string[] {
	// Validate content length before regex processing
	validateContentLength(content, "Template content");

	const features: string[] = [];

	// Check for AI prompt blocks first (full pattern)
	if (/\{\{"[^"]*"\|blockquote\}\}/.test(content)) {
		features.push('AI prompt blocks ({{"..."|blockquote}})');
	}
	if (/\{\{schema:[^}]+\}\}/.test(content)) {
		features.push("Schema.org data extraction ({{schema:...}})");
	}
	if (/\{\{selector:[^}]+\}\}/.test(content)) {
		features.push("CSS selector extraction ({{selector:...}})");
	}
	if (/\{\{selectorHtml:[^}]+\}\}/.test(content)) {
		features.push("HTML selector extraction ({{selectorHtml:...}})");
	}
	if (/\{\{meta:[^}]+\}\}/.test(content)) {
		features.push("Meta tag extraction ({{meta:...}})");
	}

	return features;
}

/**
 * Strip WebClipper-only features from content.
 */
function stripWebClipperOnlyFeatures(content: string): string {
	// Defense-in-depth: validate content length before regex processing
	validateContentLength(content, "Template content");

	let result = content;

	for (const pattern of WEBCLIPPER_ONLY_PATTERNS) {
		result = result.replace(pattern, "");
	}

	return result;
}

/**
 * Check if a value contains WebClipper-only patterns (schema, selector, etc.)
 * that cannot be converted to Templater equivalents.
 */
function containsWebClipperOnlyPatterns(value: string): boolean {
	return WEBCLIPPER_ONLY_PATTERNS.some((pattern) => {
		// Reset lastIndex for global regexes
		pattern.lastIndex = 0;
		return pattern.test(value);
	});
}

/**
 * Convert WebClipper property to Templater frontmatter value.
 *
 * Handles conversion of:
 * - Date variables: {{time|date:"..."}} → <% tp.date.now("...") %>
 * - Simple variables: {{url}} → <% tp.system.prompt("URL") %>
 * - WebClipper-only patterns: {{schema:...}} → "" (empty, with Templater prompt as fallback)
 */
function convertPropertyValue(prop: WebClipperProperty): string {
	const { value, type } = prop;

	// Handle date types
	if (type === "date") {
		const dateResult = convertDateFormat(value);
		if (dateResult.isDate) {
			return dateResult.converted;
		}
	}

	// Handle WebClipper-only patterns (schema, selector, meta, etc.)
	// These have no Templater equivalent - convert to empty string or prompt
	if (containsWebClipperOnlyPatterns(value)) {
		// If the value is ONLY a WebClipper pattern, convert to empty string
		// The user will fill this in manually when using the template
		return "";
	}

	// Handle simple variable references
	const variables = extractVariables(value);
	const firstVar = variables[0];
	if (variables.length === 1 && firstVar && firstVar.fullMatch === value) {
		return convertVariable(firstVar.variable, firstVar.defaultValue);
	}

	// Handle static values
	if (!value.includes("{{")) {
		return value;
	}

	// Complex values with multiple variables - convert each
	let converted = value;
	for (const v of variables) {
		converted = converted.replace(
			v.fullMatch,
			convertVariable(v.variable, v.defaultValue),
		);
	}

	return converted;
}

/** Current template version for converted Templater templates */
const CURRENT_TEMPLATE_VERSION = 1;

/**
 * Sanitize a string for safe use in YAML frontmatter.
 * Removes or escapes characters that could break YAML parsing.
 *
 * H12: Use this instead of simple `.replace(/\s+/g, "-")` for YAML safety.
 */
function sanitizeYamlValue(value: string): string {
	// Remove or replace characters that could break YAML
	return value
		.replace(/[:"'`]/g, "") // Remove quotes and colons
		.replace(/[/\\]/g, "-") // Replace path separators
		.replace(/\.\./g, "") // Remove parent directory traversal
		.replace(/\s+/g, "-") // Replace whitespace with hyphens
		.replace(/[^\w-]/g, "") // Remove non-word characters except hyphens
		.toLowerCase()
		.trim();
}

/**
 * Generate Templater frontmatter from WebClipper properties.
 *
 * Adds template_version, type: clipping, and clipping_type fields for PARA system compatibility.
 * All WebClipper templates are type: clipping with clipping_type derived from the template name.
 */
function generateFrontmatter(
	properties: WebClipperProperty[],
	templateName: string,
): string {
	const lines: string[] = ["---"];

	// Add PARA template versioning
	lines.push(`template_version: ${CURRENT_TEMPLATE_VERSION}`);

	// All WebClipper templates are type: clipping
	lines.push("type: clipping");

	// Derive clipping_type from template name using proper YAML sanitization
	const clippingType = sanitizeYamlValue(templateName);
	lines.push(`clipping_type: ${clippingType}`);

	for (const prop of properties) {
		// Skip if property is already 'type' or 'clipping_type' (we set them above)
		if (prop.name === "type" || prop.name === "clipping_type") {
			continue;
		}

		const value = convertPropertyValue(prop);

		// Handle multitext as array
		if (prop.type === "multitext") {
			if (value === "" || value === '""') {
				lines.push(`${prop.name}: []`);
			} else {
				lines.push(`${prop.name}: ${value}`);
			}
		} else if (value.includes("\n")) {
			// Multiline values need double quotes with escaped inner quotes
			lines.push(`${prop.name}: "${value.replace(/"/g, '\\"')}"`);
		} else if (value.includes('"')) {
			// Values with double quotes use single quote wrapper (for Templater syntax)
			lines.push(`${prop.name}: '${value}'`);
		} else if (value === "" || value.includes(":") || value.includes("#")) {
			// Empty values or values with YAML special chars need quoting
			lines.push(`${prop.name}: "${value}"`);
		} else {
			lines.push(`${prop.name}: ${value}`);
		}
	}

	lines.push("---");
	return lines.join("\n");
}

/**
 * Convert WebClipper note content format to Templater body.
 */
function convertNoteContent(content: string): {
	converted: string;
	warnings: string[];
} {
	const warnings: string[] = [];
	let converted = content;

	// Check for WebClipper-only features
	const unsupported = containsWebClipperOnlyFeatures(content);
	if (unsupported.length > 0) {
		warnings.push(
			`Unsupported WebClipper features will be stripped: ${unsupported.join(", ")}`,
		);
		converted = stripWebClipperOnlyFeatures(converted);
	}

	// Convert date variables
	converted = converted.replace(
		/\{\{time\|date:"([^"]+)"\}\}/g,
		'<% tp.date.now("$1") %>',
	);

	// Convert simple variables
	const variables = extractVariables(converted);
	for (const v of variables) {
		const replacement = convertVariable(v.variable, v.defaultValue);
		converted = converted.replace(v.fullMatch, replacement);
	}

	// H2: Check for unmatched {{...}} patterns (e.g., {{meta:og:title}})
	// These patterns contain characters not matched by \w+ (like : or -)
	const unmatchedPattern = /\{\{([^}]+)\}\}/g;
	const allMatches = [...converted.matchAll(unmatchedPattern)];
	const convertedMatches = new Set(variables.map((v) => v.fullMatch));
	const unmatched = allMatches.filter((m) => !convertedMatches.has(m[0]));
	if (unmatched.length > 0) {
		const patterns = unmatched
			.map((m) => m[0])
			.slice(0, 3)
			.join(", ");
		const suffix =
			unmatched.length > 3 ? ` (and ${unmatched.length - 3} more)` : "";
		warnings.push(
			`Unmatched variable patterns found: ${patterns}${suffix}. These may require manual conversion.`,
		);
	}

	// Convert Dataview inline fields that reference frontmatter
	// `= this.field` -> <% tp.frontmatter.field %>
	converted = converted.replace(/`= this\.(\w+)`/g, "<% tp.frontmatter.$1 %>");

	// Replace H1 title with Dataview inline reference to filename
	// This ensures the note title dynamically matches the filename (which includes emoji prefix)
	// Using Dataview instead of Templater prevents file modification on open
	// Matches any H1 at start of line and replaces with dynamic file name reference
	converted = converted.replace(/^# .+$/m, "# `= this.file.name`");

	return { converted, warnings };
}

/**
 * Convert a WebClipper template to Templater MD format.
 */
export function webClipperToTemplater(
	template: WebClipperTemplate,
): ConversionResult {
	const cid = createCorrelationId();
	logger.info`clipper:convert:start cid=${cid} name=${template.name}`;

	const warnings: string[] = [];
	const unsupportedFeatures: string[] = [];

	// Check for unsupported features in the template
	const contentFeatures = containsWebClipperOnlyFeatures(
		template.noteContentFormat,
	);
	const nameFeatures = containsWebClipperOnlyFeatures(template.noteNameFormat);

	if (contentFeatures.length > 0 || nameFeatures.length > 0) {
		unsupportedFeatures.push(...contentFeatures, ...nameFeatures);
		logger.warn`clipper:convert:warning cid=${cid} unsupportedFeatures=${unsupportedFeatures.length}`;
	}

	// Triggers are WebClipper-only
	if (template.triggers && template.triggers.length > 0) {
		unsupportedFeatures.push(
			`URL triggers (${template.triggers.length} patterns)`,
		);
	}

	// Context is WebClipper-only
	if (template.context) {
		unsupportedFeatures.push("Context selector");
	}

	// Generate frontmatter with template versioning
	const frontmatter = generateFrontmatter(template.properties, template.name);

	// Convert note content
	const { converted: body, warnings: contentWarnings } = convertNoteContent(
		template.noteContentFormat,
	);
	warnings.push(...contentWarnings);

	// Extract emoji prefix from noteNameFormat and generate Templater rename script
	const emojiPrefix = extractEmojiPrefix(template.noteNameFormat);
	const emojiScript = emojiPrefix ? generateEmojiRenameScript(emojiPrefix) : "";

	// Combine into final template
	// Note: emoji script is appended at the end to auto-rename files with emoji prefix
	// Ensure trailing newline for POSIX compliance
	const content = `${frontmatter}\n\n${body}${emojiScript}\n`;

	logger.info`clipper:convert:success cid=${cid} name=${template.name} contentLength=${content.length}`;

	return {
		success: true,
		content,
		unsupportedFeatures:
			unsupportedFeatures.length > 0 ? unsupportedFeatures : undefined,
		warnings: warnings.length > 0 ? warnings : undefined,
	};
}

/**
 * Extract metadata from a WebClipper template.
 */
export function extractTemplateMetadata(
	template: WebClipperTemplate,
): TemplateMetadata {
	const variables: TemplaterVariable[] = [];

	// Extract variables from properties
	for (const prop of template.properties) {
		const vars = extractVariables(prop.value);
		for (const v of vars) {
			const existing = variables.find((x) => x.name === v.variable);
			if (!existing) {
				const dateResult = convertDateFormat(prop.value);
				variables.push({
					name: v.variable,
					defaultValue: v.defaultValue,
					isDate: dateResult.isDate,
					promptLabel: MAPPABLE_VARIABLES[v.variable],
				});
			}
		}
	}

	// Extract variables from content
	const contentVars = extractVariables(template.noteContentFormat);
	for (const v of contentVars) {
		const existing = variables.find((x) => x.name === v.variable);
		if (!existing) {
			variables.push({
				name: v.variable,
				defaultValue: v.defaultValue,
				promptLabel: MAPPABLE_VARIABLES[v.variable],
			});
		}
	}

	// Get clipping_type if present
	const clippingType = template.properties.find(
		(p) => p.name === "clipping_type",
	);

	return {
		name: template.name,
		type: clippingType?.value,
		sourceFormat: "webclipper",
		variables,
		frontmatterFields: template.properties.map((p) => p.name),
	};
}

/**
 * Compare two templates and identify differences.
 * Used for sync operations to detect changes.
 */
export function compareTemplates(
	source: WebClipperTemplate,
	target: WebClipperTemplate,
): {
	identical: boolean;
	differences: string[];
} {
	const differences: string[] = [];

	if (source.noteNameFormat !== target.noteNameFormat) {
		differences.push("noteNameFormat changed");
	}

	if (source.path !== target.path) {
		differences.push("path changed");
	}

	if (source.noteContentFormat !== target.noteContentFormat) {
		differences.push("noteContentFormat changed");
	}

	if (source.context !== target.context) {
		differences.push("context changed");
	}

	// Compare properties
	const sourceProps = new Map(source.properties.map((p) => [p.name, p]));
	const targetProps = new Map(target.properties.map((p) => [p.name, p]));

	for (const [name, prop] of sourceProps) {
		const targetProp = targetProps.get(name);
		if (!targetProp) {
			differences.push(`property '${name}' removed`);
		} else if (
			prop.value !== targetProp.value ||
			prop.type !== targetProp.type
		) {
			differences.push(`property '${name}' changed`);
		}
	}

	for (const name of targetProps.keys()) {
		if (!sourceProps.has(name)) {
			differences.push(`property '${name}' added`);
		}
	}

	// Compare triggers
	const sourceTriggers = new Set(source.triggers || []);
	const targetTriggers = new Set(target.triggers || []);

	if (sourceTriggers.size !== targetTriggers.size) {
		differences.push("triggers changed");
	} else {
		for (const trigger of sourceTriggers) {
			if (!targetTriggers.has(trigger)) {
				differences.push("triggers changed");
				break;
			}
		}
	}

	return {
		identical: differences.length === 0,
		differences,
	};
}
