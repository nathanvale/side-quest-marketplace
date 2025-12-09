/**
 * LLM prompt constraints builder.
 *
 * This module extracts and formats constraints from template definitions
 * and frontmatter rules to guide LLM extraction with deterministic prompts.
 *
 * Key improvements over llm.ts formatRules():
 * - Inline enum values with field descriptions
 * - Explicit required vs optional marking
 * - Better wikilink null handling guidance
 * - Array includes constraints shown clearly
 *
 * @module llm/constraints
 */

import type { FieldRule, FrontmatterRules } from "../config";
import type { TemplateField } from "../templates";

/**
 * Vault context for guiding LLM extraction.
 */
export interface VaultContext {
	/** Existing area names from 02_Areas/ */
	readonly areas: ReadonlyArray<string>;
	/** Existing project names from 01_Projects/ */
	readonly projects: ReadonlyArray<string>;
	/** Allowed tag values from config */
	readonly suggestedTags: ReadonlyArray<string>;
}

/**
 * Describes constraints for a single field.
 */
export interface FieldConstraint {
	/** Field key (exact prompt text from template) */
	readonly key: string;
	/** Detected field type */
	readonly type: "string" | "date" | "number" | "array" | "wikilink" | "enum";
	/** Whether this field is required */
	readonly required: boolean;
	/** For enum types, the allowed values */
	readonly enumValues?: ReadonlyArray<string>;
	/** For array types, values that must be included */
	readonly arrayIncludes?: ReadonlyArray<string>;
	/** Whether field appears in frontmatter vs body */
	readonly location: "frontmatter" | "body";
}

/**
 * Vault context constraint with guidance.
 */
export interface VaultContextConstraint {
	/** Existing area names */
	readonly areas: ReadonlyArray<string>;
	/** Existing project names */
	readonly projects: ReadonlyArray<string>;
	/** Allowed tag values */
	readonly suggestedTags: ReadonlyArray<string>;
}

/**
 * Output schema constraint with examples.
 */
export interface OutputSchemaConstraint {
	/** Body section headings from template */
	readonly sections: ReadonlyArray<string>;
	/** Output format specification */
	readonly format: "json";
	/** Example args structure with placeholder values */
	readonly argsExample: Record<string, string | null>;
	/** Example content structure with section headings */
	readonly contentExample: Record<string, string>;
}

/**
 * Complete constraint set for LLM prompting.
 */
export interface ConstraintSet {
	/** Field constraints extracted from template + rules */
	readonly fields: ReadonlyArray<FieldConstraint>;
	/** Output schema with examples */
	readonly outputSchema: OutputSchemaConstraint;
	/** Optional vault context for guidance */
	readonly vaultContext?: VaultContextConstraint;
}

/**
 * Detect field type from template field and frontmatter rule.
 *
 * @param field - Template field info
 * @param rule - Frontmatter validation rule (if any)
 * @returns Detected field type
 */
function detectFieldType(
	_field: TemplateField,
	rule?: FieldRule,
): FieldConstraint["type"] {
	if (!rule) return "string";
	return rule.type;
}

/**
 * Determine if a field is required.
 *
 * @param field - Template field info
 * @param rule - Frontmatter validation rule (if any)
 * @returns True if field is required
 */
function isFieldRequired(_field: TemplateField, rule?: FieldRule): boolean {
	if (!rule) return false; // No rule = optional
	return !rule.optional; // Rule present and not optional = required
}

/**
 * Build example args object with placeholder values.
 *
 * @param fields - Field constraints
 * @returns Example args structure
 */
function buildArgsExample(
	fields: ReadonlyArray<FieldConstraint>,
): Record<string, string | null> {
	const example: Record<string, string | null> = {};

	for (const field of fields) {
		if (field.location !== "frontmatter") continue;

		// Use null for optional fields to demonstrate null handling
		if (!field.required) {
			example[field.key] = null;
			continue;
		}

		// Use meaningful placeholders for required fields
		switch (field.type) {
			case "date":
				example[field.key] = "YYYY-MM-DD";
				break;
			case "enum":
				example[field.key] = field.enumValues?.[0] ?? "<enum value from rules>";
				break;
			case "wikilink":
				example[field.key] = "[[Name]]";
				break;
			case "array":
				example[field.key] = "tag1, tag2";
				break;
			default:
				example[field.key] = "<value>";
		}
	}

	return example;
}

/**
 * Build example content object with section headings.
 *
 * @param sections - Body section headings
 * @returns Example content structure
 */
function buildContentExample(
	sections: ReadonlyArray<string>,
): Record<string, string> {
	const example: Record<string, string> = {};
	for (const section of sections) {
		example[section] = "<content for this section>";
	}
	return example;
}

/**
 * Extract constraint set from template and rules.
 *
 * Analyzes template fields and frontmatter validation rules to build
 * a comprehensive constraint set for LLM prompting.
 *
 * @param fields - Template fields (from getTemplateFields or equivalent)
 * @param sections - Body section headings (from getTemplateSections or equivalent)
 * @param rules - Frontmatter validation rules for this template type
 * @param vaultContext - Optional vault context (areas, projects, tags)
 * @returns Complete constraint set
 *
 * @example
 * ```typescript
 * const fields = getTemplateFields(template);
 * const sections = getTemplateSections(template);
 * const rules = config.frontmatterRules?.booking;
 * const constraints = buildConstraintSet(fields, sections, rules, vaultContext);
 * ```
 */
export function buildConstraintSet(
	fields: ReadonlyArray<TemplateField>,
	sections: ReadonlyArray<string>,
	rules: FrontmatterRules | undefined,
	vaultContext?: VaultContext,
): ConstraintSet {
	// Extract field constraints
	const fieldConstraints = fields
		.filter((f) => !f.isAutoDate) // Skip auto-date fields
		.map((f) => {
			const fieldRule = rules?.required?.[f.key];
			return {
				key: f.key,
				type: detectFieldType(f, fieldRule),
				required: isFieldRequired(f, fieldRule),
				enumValues: fieldRule?.type === "enum" ? fieldRule.enum : undefined,
				arrayIncludes:
					fieldRule?.type === "array" ? fieldRule.includes : undefined,
				location: f.inFrontmatter
					? ("frontmatter" as const)
					: ("body" as const),
			};
		});

	// Build output schema with examples
	const outputSchema: OutputSchemaConstraint = {
		sections,
		format: "json" as const,
		argsExample: buildArgsExample(fieldConstraints),
		contentExample: buildContentExample(sections),
	};

	// Include vault context if provided
	const vaultCtx = vaultContext
		? {
				areas: vaultContext.areas,
				projects: vaultContext.projects,
				suggestedTags: vaultContext.suggestedTags,
			}
		: undefined;

	return { fields: fieldConstraints, outputSchema, vaultContext: vaultCtx };
}

/**
 * Format field constraints as prompt text.
 *
 * Produces deterministic, inline constraint descriptions.
 *
 * @param fields - Field constraints to format
 * @returns Formatted constraint text
 *
 * @example
 * ```typescript
 * const formatted = formatFieldConstraints(constraints.fields);
 * // "status" (frontmatter) REQUIRED - must be one of: active, on-hold, completed
 * // "area" (frontmatter) REQUIRED - wikilink format [[Name]], or null if not applicable
 * ```
 */
export function formatFieldConstraints(
	fields: ReadonlyArray<FieldConstraint>,
): string {
	const lines: string[] = [];

	for (const field of fields) {
		let constraint = `"${field.key}" (${field.location})`;

		// Mark required vs optional
		constraint += field.required ? " REQUIRED" : " OPTIONAL";

		// Inline enum values
		if (field.type === "enum" && field.enumValues) {
			constraint += ` - must be one of: ${field.enumValues.join(", ")}`;
		}
		// Inline date format
		else if (field.type === "date") {
			constraint += " - date in YYYY-MM-DD format";
		}
		// Wikilink with null guidance
		else if (field.type === "wikilink") {
			constraint +=
				" - wikilink format [[Name]], or null if not applicable (use literal null, not a string)";
		}
		// Array type
		else if (field.type === "array") {
			constraint += " - array of strings";
			// Add includes constraint if present
			if (field.arrayIncludes && field.arrayIncludes.length > 0) {
				constraint += `\n  → MUST include these values: ${field.arrayIncludes.join(", ")}`;
			}
		}
		// Generic string
		else {
			constraint += ` - ${field.type}`;
		}

		lines.push(constraint);
	}

	return lines.join("\n");
}

/**
 * Format vault context as prompt text.
 *
 * Provides guidance on using existing vault entities and constraints.
 *
 * @param context - Vault context constraint
 * @returns Formatted vault context text
 *
 * @example
 * ```typescript
 * const formatted = formatVaultContext(constraints.vaultContext);
 * ```
 */
export function formatVaultContext(context: VaultContextConstraint): string {
	const areaList =
		context.areas.length > 0
			? context.areas.map((a) => `- ${a}`).join("\n")
			: "[None yet - suggest one based on content analysis]";

	const projectList =
		context.projects.length > 0
			? context.projects.map((p) => `- ${p}`).join("\n")
			: "[None yet - suggest one if task relates to a project]";

	return `VAULT CONTEXT:

EXISTING AREAS (prefer these if content matches):
${areaList}
→ Area assignment is REQUIRED for projects/resources - analyze content to determine life domain
→ If existing areas match, use one: [[AreaName]]
→ If no existing areas match, SUGGEST a new area based on content
→ Common areas: Home, Work, Health, Finance, Learning, Family, Personal, Career, Hobbies
→ Area = ongoing RESPONSIBILITY or LIFE DOMAIN (not a temporary project)
→ Example: Garden shed → [[Home]], Fitness goals → [[Health]], Work project → [[Work]]
→ CRITICAL: Wikilinks MUST be quoted: area: "[[Home]]" (valid YAML, Dataview-compatible)

EXISTING PROJECTS (for task linking):
${projectList}
→ Tasks should link to projects when applicable
→ If existing project matches, use: "[[ProjectName]]" (QUOTED in YAML)
→ If no project matches, suggest new project name based on content
→ Use null ONLY if task is standalone (not part of any project)
→ CRITICAL: Wikilinks MUST be quoted for YAML validity and Dataview compatibility

ALLOWED TAGS (choose ONLY from this list):
${context.suggestedTags.join(", ")}
→ DO NOT invent new tags - only use tags from this list
→ Select 1-3 most relevant tags for the content
→ IMPORTANT: Check field constraints for required tag inclusions`;
}

/**
 * Format output schema as prompt text.
 *
 * Shows expected JSON structure with examples.
 *
 * @param schema - Output schema constraint
 * @returns Formatted schema text
 *
 * @example
 * ```typescript
 * const formatted = formatOutputSchema(constraints.outputSchema);
 * ```
 */
export function formatOutputSchema(schema: OutputSchemaConstraint): string {
	const argsExample = JSON.stringify(schema.argsExample, null, 2);
	const contentExample = JSON.stringify(schema.contentExample, null, 2);

	return `OUTPUT FORMAT:
Return ONLY a JSON object with this exact structure:
{
  "args": ${argsExample},
  "content": ${contentExample},
  "title": "<suggested title for the note>"
}

CRITICAL RULES:
1. Extract values for BOTH frontmatter (args) AND body sections (content)
2. Use literal null for missing/unknown values in args - DO NOT invent data
3. For "content", use EXACT heading names shown in schema above
4. Omit content sections that have no relevant content to extract
5. String values must be properly quoted: "500" not 500
6. Dates MUST be YYYY-MM-DD format (e.g., "2025-12-26")
7. Enum values MUST match exactly from field constraints
8. For content sections, preserve markdown formatting (lists, bold, links, etc.)
9. The title should be descriptive and based on the note content
10. For wikilink fields: Use literal null when no value exists
    - CORRECT: "area": null
    - WRONG: "area": "[[null]]" or "area": "null"`;
}

/**
 * Format complete constraint set as prompt text.
 *
 * Combines field constraints, vault context, and output schema.
 *
 * @param constraints - Complete constraint set
 * @returns Formatted prompt sections
 *
 * @example
 * ```typescript
 * const formatted = formatConstraintSet(constraints);
 * console.log(formatted.fields);
 * console.log(formatted.vaultContext); // undefined if no context
 * console.log(formatted.outputSchema);
 * ```
 */
export function formatConstraintSet(constraints: ConstraintSet): {
	fields: string;
	vaultContext?: string;
	outputSchema: string;
} {
	return {
		fields: formatFieldConstraints(constraints.fields),
		vaultContext: constraints.vaultContext
			? formatVaultContext(constraints.vaultContext)
			: undefined,
		outputSchema: formatOutputSchema(constraints.outputSchema),
	};
}
