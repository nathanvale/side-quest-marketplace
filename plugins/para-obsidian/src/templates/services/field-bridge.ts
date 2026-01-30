/**
 * Bridge between FieldRule (validation) and TemplateField (generation).
 *
 * Converts DEFAULT_FRONTMATTER_RULES entries into TemplateField arrays
 * suitable for template generation. This enables generating templates
 * directly from the same rules used for validation.
 *
 * Also provides `buildTemplateConfig()` which constructs a complete
 * TemplateConfig from defaults — the single source of truth for
 * template structure. Used by `createFromTemplate()` and `generateAllTemplates()`.
 *
 * @module templates/services/field-bridge
 */
import type {
	FieldRule,
	FrontmatterRules,
	ParaObsidianConfig,
} from "../../config/index";
import type { TemplateConfig, TemplateField } from "../types";

/**
 * Converts frontmatter rules for a template type into TemplateField definitions.
 *
 * Mapping logic:
 * - `type: "date"` + name "created" → auto-fill with current datetime
 * - `type: "enum"` → first enum value as default
 * - `type: "wikilink"` → wikilink field type
 * - `optional: true` → `required: false`
 * - All others → prompted string/number/array fields
 *
 * @param rules - Frontmatter rules for a specific template type
 * @returns Array of TemplateField definitions for template generation
 */
export function fieldRulesToTemplateFields(
	rules: FrontmatterRules,
): TemplateField[] {
	const fields: TemplateField[] = [];
	const required = rules.required ?? {};

	for (const [name, rule] of Object.entries(required)) {
		fields.push(fieldRuleToTemplateField(name, rule));
	}

	return fields;
}

/**
 * Converts a single FieldRule into a TemplateField.
 *
 * @param name - Field name in frontmatter
 * @param rule - Validation rule for the field
 * @returns TemplateField definition
 */
function fieldRuleToTemplateField(
	name: string,
	rule: FieldRule,
): TemplateField {
	const displayName = toDisplayName(name);
	const isOptional = rule.optional === true;

	// Auto-fill date fields named "created", "clipped", or "modified"
	const isAutoDate =
		rule.type === "date" &&
		(name === "created" || name === "clipped" || name === "modified");

	if (isAutoDate) {
		return {
			name,
			displayName,
			type: "date",
			required: !isOptional,
			autoFill: 'tp.date.now("YYYY-MM-DDTHH:mm:ss")',
		};
	}

	// Auto-fill for specific date fields that use date-only format
	const isDateOnlyAutoFill =
		rule.type === "date" &&
		(name === "start_date" ||
			name === "week_start" ||
			name === "meeting_date" ||
			name === "session_date" ||
			name === "invoice_date" ||
			name === "statement_date");

	if (isDateOnlyAutoFill) {
		return {
			name,
			displayName,
			type: "date",
			required: !isOptional,
			autoFill: 'tp.date.now("YYYY-MM-DD")',
		};
	}

	// Enum fields
	if (rule.type === "enum" && rule.enum) {
		const defaultVal =
			typeof rule.defaultValue === "string"
				? rule.defaultValue
				: rule.enum[0]?.toString();
		return {
			name,
			displayName,
			type: "enum",
			required: !isOptional,
			enumValues: rule.enum,
			default: defaultVal,
		};
	}

	// Wikilink fields
	if (rule.type === "wikilink") {
		return {
			name,
			displayName,
			type: "wikilink",
			required: !isOptional,
			default: isOptional ? "" : undefined,
		};
	}

	// Array fields — default to empty array
	if (rule.type === "array") {
		return {
			name,
			displayName,
			type: "array",
			required: !isOptional,
			default: "[]",
		};
	}

	// Boolean fields — represent as string
	if (rule.type === "boolean") {
		return {
			name,
			displayName,
			type: "string",
			required: !isOptional,
			default:
				typeof rule.defaultValue === "string" ? rule.defaultValue : "false",
		};
	}

	// Number fields
	if (rule.type === "number") {
		return {
			name,
			displayName,
			type: "number",
			required: !isOptional,
			default: isOptional ? "0" : undefined,
		};
	}

	// Date fields (non-auto-fill)
	if (rule.type === "date") {
		return {
			name,
			displayName,
			type: "date",
			required: !isOptional,
			default: isOptional ? "" : undefined,
		};
	}

	// String fields (default)
	return {
		name,
		displayName,
		type: "string",
		required: !isOptional,
		default: isOptional ? "" : undefined,
	};
}

/**
 * Converts a snake_case or kebab-case field name to a human-readable display name.
 *
 * @param name - Field name (e.g., "start_date", "booking_type")
 * @returns Display name (e.g., "Start Date", "Booking Type")
 */
function toDisplayName(name: string): string {
	return name.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Builds a complete TemplateConfig from the merged configuration defaults.
 *
 * This is the single source of truth for template structure — it reads
 * frontmatter rules, sections, body config, and version from config
 * (which merges defaults + user overrides) and produces a TemplateConfig
 * suitable for `generateTemplate()`.
 *
 * Used by:
 * - `createFromTemplate()` to generate templates in-memory (no vault file dependency)
 * - `generateAllTemplates()` to produce vault `.md` files (DRY)
 *
 * @param templateName - Template key (e.g., "clipping", "project")
 * @param config - Loaded para-obsidian configuration (merged defaults + user overrides)
 * @returns Complete TemplateConfig, or undefined if no rules exist for this template
 */
export function buildTemplateConfig(
	templateName: string,
	config: ParaObsidianConfig,
): TemplateConfig | undefined {
	const rules = config.frontmatterRules?.[templateName];
	if (!rules) return undefined;

	const fields = fieldRulesToTemplateFields(rules);
	const sections = config.templateSections?.[templateName] ?? [];
	const version = config.templateVersions?.[templateName] ?? 1;
	const bodyConfig = config.templateBodyConfig?.[templateName];

	// Determine the noteType — strip clipping-/processor- prefixes
	const noteType = templateName
		.replace(/^clipping-/, "")
		.replace(/^processor-/, "");

	return {
		name: templateName,
		displayName: templateName,
		noteType,
		version,
		fields,
		sections,
		bodyConfig,
	};
}
