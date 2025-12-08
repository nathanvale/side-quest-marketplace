/**
 * Composable prompt builder for LLM-based note conversion.
 *
 * Provides declarative, reusable prompt construction that can be used for:
 * - Full conversion (existing behavior)
 * - Field suggestions (lighter extraction)
 * - Bulk operations (reuse constraints)
 * - Custom tasks (flexible composition)
 *
 * @module llm/prompt-builder
 */

import type {
	ConstraintSet,
	FieldConstraint,
	VaultContextConstraint,
} from "./constraints";

/**
 * Example for few-shot learning in prompts.
 */
export interface PromptExample {
	/** Example input text */
	readonly input: string;
	/** Expected output structure */
	readonly output: {
		readonly args: Record<string, string | null>;
		readonly content: Record<string, string>;
		readonly title: string;
	};
}

/**
 * Template for building structured prompts.
 */
export interface PromptTemplate {
	/** System role instruction */
	readonly systemRole: string;
	/** Source content to extract from */
	readonly sourceContent: string;
	/** Constraint set (fields, validation, vault context, output schema) */
	readonly constraints: ConstraintSet;
	/** Critical rules to follow (uses defaults if not provided) */
	readonly criticalRules?: ReadonlyArray<string>;
	/** Optional few-shot examples */
	readonly examples?: ReadonlyArray<PromptExample>;
}

/**
 * Default critical rules for LLM extraction.
 *
 * These rules are applied unless custom rules are provided.
 * Extracted from existing llm.ts:276-290.
 */
export const DEFAULT_CRITICAL_RULES: ReadonlyArray<string> = [
	"1. Extract values from the note content for BOTH frontmatter (args) AND body sections (content)",
	"2. Use null for missing/unknown values in args - DO NOT invent data",
	'3. For "content", use EXACT heading names from BODY SECTIONS TO FILL above',
	"4. Omit content sections that have no relevant content to extract",
	'5. String values must be properly quoted: "500" not 500',
	'6. Dates MUST be YYYY-MM-DD format (e.g., "2025-12-26")',
	"7. Enum values MUST match exactly from the validation rules",
	"8. For content sections, preserve markdown formatting (lists, bold, links, etc.)",
	"9. The title should be descriptive and based on the note content",
	"10. For wikilink fields (area, project): Use literal null when no value exists",
	'    - CORRECT: "area": null',
	'    - WRONG: "area": "[[null]]" or "area": "null"',
	'11. Tags MUST include required values from validation rules (check "includes" field)',
	'    - Example: area notes must include "area" in tags array',
	"12. All field values must be valid YAML primitives:",
	'    - Strings: "value" (single string, NOT arrays unless field type is array)',
	'    - Null: null (literal null, not "null" or [null])',
	"    - Arrays only for 'tags' and explicit array fields",
	'    - Example CORRECT: "location": "Cradle Mountain"',
	'    - Example WRONG: "location": [["- Cradle Mountain"]]',
];

/**
 * Build a structured prompt from a template.
 *
 * Composes all prompt sections in the correct order:
 * 1. System role
 * 2. Source content
 * 3. Constraints (fields, validation, vault context, output schema)
 * 4. Critical rules
 * 5. Examples (if provided)
 * 6. Output instruction
 *
 * @param template - Prompt template with all configuration
 * @returns Complete prompt string ready for LLM
 *
 * @example
 * ```typescript
 * const prompt = buildStructuredPrompt({
 *   systemRole: 'You are extracting structured data from a note...',
 *   sourceContent: noteContent,
 *   constraints: constraintSet,
 *   criticalRules: DEFAULT_CRITICAL_RULES,
 * });
 * ```
 */
export function buildStructuredPrompt(template: PromptTemplate): string {
	const sections: string[] = [];

	// System role
	sections.push(template.systemRole);
	sections.push("");

	// Source content
	sections.push("EXISTING NOTE CONTENT:");
	sections.push("---");
	sections.push(template.sourceContent);
	sections.push("---");
	sections.push("");

	// Constraints (fields, validation, vault context, output schema)
	sections.push(buildConstraintSection(template.constraints));
	sections.push("");

	// Critical rules
	sections.push("CRITICAL RULES:");
	sections.push(buildCriticalRules(template.criticalRules));
	sections.push("");

	// Examples (if provided)
	if (template.examples && template.examples.length > 0) {
		sections.push(buildExamplesSection(template.examples));
		sections.push("");
	}

	// Output instruction
	sections.push("OUTPUT (JSON only, no explanation, no markdown fences):");

	return sections.join("\n");
}

/**
 * Build the constraint section of a prompt.
 *
 * Includes:
 * - Required fields (cannot be null)
 * - Optional fields (use null if not applicable)
 * - Body sections to fill
 * - Vault context (areas, projects, tags)
 * - Output schema
 *
 * @param constraints - Complete constraint set
 * @returns Formatted constraint section
 */
export function buildConstraintSection(constraints: ConstraintSet): string {
	const sections: string[] = [];

	// Separate required vs optional fields
	const requiredFields = constraints.fields.filter((f) => f.required);
	const optionalFields = constraints.fields.filter((f) => !f.required);

	// Required fields
	if (requiredFields.length > 0) {
		sections.push("REQUIRED FIELDS (cannot be null):");
		sections.push(formatFieldConstraints(requiredFields));
	}

	// Optional fields
	if (optionalFields.length > 0) {
		sections.push("");
		sections.push("OPTIONAL FIELDS (use null if not applicable):");
		sections.push(formatFieldConstraints(optionalFields));
	}

	// Body sections to fill
	if (constraints.outputSchema.sections.length > 0) {
		sections.push("");
		sections.push("BODY SECTIONS TO FILL:");
		sections.push(
			constraints.outputSchema.sections.map((s) => `- "${s}"`).join("\n"),
		);
	}

	// Vault context
	if (constraints.vaultContext) {
		sections.push("");
		sections.push(formatVaultContext(constraints.vaultContext));
	}

	// Output schema
	sections.push("");
	sections.push(formatOutputSchema(constraints.outputSchema));

	return sections.join("\n");
}

/**
 * Format field constraints for display in prompt.
 *
 * @param fields - Array of field constraints
 * @returns Formatted field list
 */
function formatFieldConstraints(
	fields: ReadonlyArray<FieldConstraint>,
): string {
	return fields
		.map((f) => {
			let line = `- "${f.key}" (${f.location})`;

			// Add type-specific constraints
			if (f.type === "enum" && f.enumValues) {
				line += ` - must be one of: ${f.enumValues.join(", ")}`;
			} else if (f.type === "date") {
				line += " - date in YYYY-MM-DD format";
			} else if (f.type === "wikilink") {
				line +=
					" - wikilink format [[Name]], or null if not applicable (use literal null, not a string)";
				line += "\n  → Output as SINGLE STRING VALUE, not an array";
				line += '\n  → Example: "accommodation": "Booking - Lodge"';
				line += '\n  → WRONG: "accommodation": [["- Lodge"]]';
			} else if (f.type === "array") {
				line += " - array of strings";
				if (f.arrayIncludes && f.arrayIncludes.length > 0) {
					line += `\n  → MUST include these values: ${f.arrayIncludes.join(", ")}`;
				}
			}

			// Special handling for location field
			if (f.key.toLowerCase() === "location") {
				line +=
					"\n  → Extract from: headings, first paragraph, filename, or explicit mentions";
				line +=
					"\n  → Use specific place name (e.g., 'Cradle Mountain', 'Strahan', 'Lake St Clair')";
				line += "\n  → Use null ONLY if truly no location mentioned anywhere";
			}

			return line;
		})
		.join("\n");
}

/**
 * Format vault context for display in prompt.
 *
 * @param vaultContext - Vault context with areas, projects, tags
 * @returns Formatted vault context section
 */
function formatVaultContext(vaultContext: VaultContextConstraint): string {
	const sections: string[] = ["VAULT CONTEXT:"];
	sections.push("");

	// Existing areas
	sections.push("EXISTING AREAS (prefer these if content matches):");
	if (vaultContext.areas.length > 0) {
		sections.push(vaultContext.areas.map((a: string) => `- ${a}`).join("\n"));
	} else {
		sections.push("[None yet - suggest one based on content analysis]");
	}
	sections.push(
		"→ Area assignment is REQUIRED for projects/resources - analyze content to determine life domain",
	);
	sections.push("→ If existing areas match, use one: [[AreaName]]");
	sections.push(
		"→ If no existing areas match, SUGGEST a new area based on content",
	);
	sections.push(
		"→ Common areas: Home, Work, Health, Finance, Learning, Family, Personal, Career, Hobbies",
	);
	sections.push(
		"→ Area = ongoing RESPONSIBILITY or LIFE DOMAIN (not a temporary project)",
	);
	sections.push(
		"→ Example: Garden shed → [[Home]], Fitness goals → [[Health]], Work project → [[Work]]",
	);
	sections.push(
		'→ CRITICAL: Wikilinks must NOT be quoted: area: [[Home]] NOT area: "[[Home]]"',
	);
	sections.push("");

	// Existing projects
	sections.push("EXISTING PROJECTS (for task linking):");
	if (vaultContext.projects.length > 0) {
		sections.push(
			vaultContext.projects.map((p: string) => `- ${p}`).join("\n"),
		);
	} else {
		sections.push("[None yet - suggest one if task relates to a project]");
	}
	sections.push("→ Tasks should link to projects when applicable");
	sections.push("→ If existing project matches, use: [[ProjectName]]");
	sections.push(
		"→ If no project matches, suggest new project name based on content",
	);
	sections.push(
		"→ Use null ONLY if task is standalone (not part of any project)",
	);
	sections.push("");

	// Allowed tags
	sections.push("ALLOWED TAGS (choose ONLY from this list):");
	sections.push(vaultContext.suggestedTags.join(", "));
	sections.push("→ DO NOT invent new tags - only use tags from this list");
	sections.push("→ Select 1-3 most relevant tags for the content");
	sections.push(
		'→ IMPORTANT: Check VALIDATION RULES for required tag inclusions (e.g., area notes MUST include "area" tag)',
	);

	return sections.join("\n");
}

/**
 * Format output schema for display in prompt.
 *
 * @param schema - Output schema definition
 * @returns Formatted output schema section
 */
function formatOutputSchema(schema: ConstraintSet["outputSchema"]): string {
	const sections: string[] = ["OUTPUT FORMAT:"];
	sections.push("Return ONLY a JSON object with this exact structure:");
	sections.push("{");
	sections.push(`  "args": ${JSON.stringify(schema.argsExample, null, 2)},`);
	sections.push(
		`  "content": ${JSON.stringify(schema.contentExample, null, 2)},`,
	);
	sections.push('  "title": "<suggested title for the note>"');
	sections.push("}");

	return sections.join("\n");
}

/**
 * Build critical rules section.
 *
 * Uses default rules if no custom rules provided.
 *
 * @param customRules - Optional custom critical rules
 * @returns Formatted critical rules string
 */
export function buildCriticalRules(
	customRules?: ReadonlyArray<string>,
): string {
	const rules = customRules ?? DEFAULT_CRITICAL_RULES;
	return rules.join("\n");
}

/**
 * Build examples section for few-shot learning.
 *
 * @param examples - Array of example input/output pairs
 * @returns Formatted examples section
 */
export function buildExamplesSection(
	examples: ReadonlyArray<PromptExample>,
): string {
	const sections: string[] = ["EXAMPLES:"];

	for (const [i, example] of examples.entries()) {
		sections.push("");
		sections.push(`Example ${i + 1}:`);
		sections.push(`Input: ${example.input}`);
		sections.push(`Output: ${JSON.stringify(example.output, null, 2)}`);
	}

	return sections.join("\n");
}
