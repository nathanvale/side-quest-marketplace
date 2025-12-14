/**
 * Frontmatter hints and suggestions
 *
 * Helper functions for computing field suggestions and validation hints.
 *
 * @module cli/frontmatter/hints
 */

import type { ParaObsidianConfig } from "../../config/index";

/**
 * Get allowed fields and enum values for a note type
 */
export function suggestFieldsForType(
	config: ParaObsidianConfig,
	type?: string,
): { allowed: string[]; enums: Record<string, ReadonlyArray<string>> } {
	const rules = type ? config.frontmatterRules?.[type] : undefined;
	const allowed = rules?.required ? Object.keys(rules.required).sort() : [];
	const enums: Record<string, ReadonlyArray<string>> = {};
	if (rules?.required) {
		for (const [field, rule] of Object.entries(rules.required)) {
			if (rule.type === "enum" && rule.enum) {
				enums[field] = rule.enum;
			}
		}
	}
	return { allowed, enums };
}

/**
 * Compute warnings and hints for frontmatter edits
 */
export function computeFrontmatterHints(
	config: ParaObsidianConfig,
	noteType: string | undefined,
	setPairs: Record<string, string>,
	attributes: Record<string, unknown>,
) {
	const suggestions = suggestFieldsForType(config, noteType);
	const warnings: string[] = [];
	const fixHints: string[] = [];

	// Unknown fields
	if (suggestions.allowed.length > 0) {
		for (const key of Object.keys(setPairs)) {
			if (!suggestions.allowed.includes(key)) {
				warnings.push(`Unknown field for type ${noteType}: ${key}`);
				fixHints.push(
					`Remove or rename "${key}" to a known field for type ${noteType}`,
				);
			}
		}
		if (warnings.length > 0) {
			fixHints.push(
				`Allowed fields for type ${noteType}: ${suggestions.allowed.join(", ")}`,
			);
		}
	}

	// Enum mismatches
	if (noteType) {
		const rules = config.frontmatterRules?.[noteType]?.required ?? {};
		for (const [field, rule] of Object.entries(rules)) {
			if (rule.type === "enum" && rule.enum && field in attributes) {
				const val = attributes[field];
				if (typeof val === "string" && !rule.enum.includes(val)) {
					warnings.push(
						`Invalid value for ${field}: ${val} (allowed: ${rule.enum.join(", ")})`,
					);
					fixHints.push(
						`Field "${field}" allowed values: ${rule.enum.join(", ")}`,
					);
				}
			}
		}
	}

	return { warnings, fixHints, suggestions };
}
