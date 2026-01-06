/**
 * Bidirectional converter between WebClipper JSON and Templater MD formats.
 *
 * Handles the mapping of template variables, frontmatter properties,
 * and content formatting between the two systems.
 *
 * @module clipper/converter
 */

import type {
	ConversionResult,
	TemplateMetadata,
	TemplaterVariable,
	WebClipperProperty,
	WebClipperTemplate,
} from "./types";

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
 */
const WEBCLIPPER_ONLY_PATTERNS = [
	/\{\{schema:[^}]+\}\}/g, // Schema.org data extraction
	/\{\{selector:[^}]+\}\}/g, // CSS selector extraction
	/\{\{selectorHtml:[^}]+\}\}/g, // HTML selector extraction
	/\{\{meta:[^}]+\}\}/g, // Meta tag extraction
	/\|blockquote\}\}/g, // AI prompt blocks
];

/**
 * Convert a WebClipper date format to Templater date format.
 * WebClipper: {{time|date:"YYYY-MM-DD"}}
 * Templater: <% tp.date.now("YYYY-MM-DD") %>
 */
function convertDateFormat(value: string): {
	converted: string;
	isDate: boolean;
} {
	const dateMatch = value.match(/\{\{time\|date:"([^"]+)"\}\}/);
	if (dateMatch) {
		return {
			converted: `<% tp.date.now("${dateMatch[1]}") %>`,
			isDate: true,
		};
	}

	// Also handle schema date formats
	const schemaDateMatch = value.match(/\{\{schema:[^|]+\|date:"([^"]+)"\}\}/);
	if (schemaDateMatch) {
		return {
			converted: `<% tp.date.now("${schemaDateMatch[1]}") %>`,
			isDate: true,
		};
	}

	return { converted: value, isDate: false };
}

/**
 * Convert a WebClipper variable to Templater prompt.
 * WebClipper: {{variable}} or {{variable|default:""}}
 * Templater: <% tp.system.prompt("Variable", "") %>
 */
function convertVariable(variable: string, defaultValue?: string): string {
	const label = MAPPABLE_VARIABLES[variable] || variable;
	if (defaultValue !== undefined) {
		return `<% tp.system.prompt("${label}", "${defaultValue}") %>`;
	}
	return `<% tp.system.prompt("${label}") %>`;
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
	if (/\|blockquote\}\}/.test(content)) {
		features.push("AI prompt blocks (|blockquote)");
	}

	return features;
}

/**
 * Strip WebClipper-only features from content.
 */
function stripWebClipperOnlyFeatures(content: string): string {
	let result = content;

	for (const pattern of WEBCLIPPER_ONLY_PATTERNS) {
		result = result.replace(pattern, "");
	}

	// Clean up AI prompt blocks entirely (they're multiline)
	result = result.replace(/\{\{"[^"]+"\|blockquote\}\}/g, "");

	return result;
}

/**
 * Convert WebClipper property to Templater frontmatter value.
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
 * Generate Templater frontmatter from WebClipper properties.
 *
 * Adds template_version and type fields for PARA system compatibility.
 */
function generateFrontmatter(
	properties: WebClipperProperty[],
	templateName: string,
): string {
	const lines: string[] = ["---"];

	// Add PARA template versioning
	lines.push(`template_version: ${CURRENT_TEMPLATE_VERSION}`);

	// Derive type from template name (kebab-case to identifier)
	const clippingType = templateName.toLowerCase().replace(/\s+/g, "-");
	lines.push(`type: ${clippingType}`);

	for (const prop of properties) {
		// Skip if property is already 'type' (we set it above)
		if (prop.name === "type") {
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
		} else if (value.includes("\n") || value.includes('"')) {
			// Quote complex values
			lines.push(`${prop.name}: "${value.replace(/"/g, '\\"')}"`);
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

	// Convert Dataview inline fields that reference frontmatter
	// `= this.field` -> <% tp.frontmatter.field %>
	converted = converted.replace(/`= this\.(\w+)`/g, "<% tp.frontmatter.$1 %>");

	return { converted, warnings };
}

/**
 * Convert a WebClipper template to Templater MD format.
 */
export function webClipperToTemplater(
	template: WebClipperTemplate,
): ConversionResult {
	const warnings: string[] = [];
	const unsupportedFeatures: string[] = [];

	// Check for unsupported features in the template
	const contentFeatures = containsWebClipperOnlyFeatures(
		template.noteContentFormat,
	);
	const nameFeatures = containsWebClipperOnlyFeatures(template.noteNameFormat);

	if (contentFeatures.length > 0 || nameFeatures.length > 0) {
		unsupportedFeatures.push(...contentFeatures, ...nameFeatures);
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

	// Combine into final template
	const content = `${frontmatter}\n\n${body}`;

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
