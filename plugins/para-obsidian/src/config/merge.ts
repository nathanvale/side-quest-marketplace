/**
 * Deep merge utilities for template configuration.
 *
 * Enables per-template overrides where user config merges into defaults
 * rather than replacing all defaults. Each merge function handles a
 * specific merge strategy appropriate for its config field.
 *
 * @module config/merge
 */
import type { TemplateSection } from "./defaults";
import type { FieldRule, FrontmatterRules } from "./index";

/**
 * Deep-merges frontmatter rules: defaults <- user overrides.
 *
 * Merges per-template, then per-field within each template's `required` block.
 * User fields are merged into default fields. Setting a field to `null`
 * removes it from the merged result.
 *
 * Templates not present in overrides are passed through unchanged.
 * Entirely new templates in overrides are added.
 *
 * @param defaults - Default frontmatter rules from defaults.ts
 * @param overrides - User-provided overrides (partial)
 * @returns Merged frontmatter rules
 *
 * @example
 * ```typescript
 * // User adds a field and modifies an enum for "meeting":
 * const merged = mergeFrontmatterRules(DEFAULT_FRONTMATTER_RULES, {
 *   meeting: {
 *     required: {
 *       location: { type: "string", optional: true },
 *       meeting_type: { type: "enum", enum: ["1-on-1", "standup", "workshop"] },
 *     },
 *   },
 * });
 * // Result: meeting keeps all default fields, plus location, with meeting_type overridden
 * ```
 */
export function mergeFrontmatterRules(
	defaults: Record<string, FrontmatterRules>,
	overrides: Record<string, FrontmatterRules>,
): Record<string, FrontmatterRules> {
	const result: Record<string, FrontmatterRules> = { ...defaults };

	for (const [templateName, overrideRules] of Object.entries(overrides)) {
		const defaultRules = defaults[templateName];

		if (!defaultRules) {
			// Entirely new template type from user config
			result[templateName] = overrideRules;
			continue;
		}

		// Deep merge required fields
		// Cast overrides to allow null values (used for field removal from JSON config)
		const mergedRequired = mergeRequiredFields(
			defaultRules.required ?? {},
			(overrideRules.required ?? {}) as Record<string, FieldRule | null>,
		);

		// forbidden and oneOfRequired: override replaces (arrays are atomic)
		result[templateName] = {
			required:
				Object.keys(mergedRequired).length > 0 ? mergedRequired : undefined,
			forbidden: overrideRules.forbidden ?? defaultRules.forbidden,
			oneOfRequired: overrideRules.oneOfRequired ?? defaultRules.oneOfRequired,
		};
	}

	return result;
}

/**
 * Merges required field maps. User fields override defaults per-field.
 * A field set to `null` is removed from the result.
 */
function mergeRequiredFields(
	defaults: Record<string, FieldRule>,
	overrides: Record<string, FieldRule | null>,
): Record<string, FieldRule> {
	const result: Record<string, FieldRule> = { ...defaults };

	for (const [fieldName, fieldValue] of Object.entries(overrides)) {
		if (fieldValue === null) {
			// null means "remove this field"
			delete result[fieldName];
		} else {
			result[fieldName] = fieldValue;
		}
	}

	return result;
}

/**
 * Shallow-merges per-template values (versions, destinations, prefixes).
 *
 * User values override defaults for specific templates. Templates not
 * present in overrides keep their default values.
 *
 * @param defaults - Default values from defaults.ts
 * @param overrides - User-provided overrides
 * @returns Merged record
 *
 * @example
 * ```typescript
 * const versions = mergePerTemplate(
 *   DEFAULT_TEMPLATE_VERSIONS,
 *   { meeting: 2 },
 * );
 * // Result: all defaults, but meeting version is now 2
 * ```
 */
export function mergePerTemplate<T>(
	defaults: Record<string, T>,
	overrides: Record<string, T>,
): Record<string, T> {
	return { ...defaults, ...overrides };
}

/**
 * Merges template sections: user sections REPLACE defaults for that template.
 *
 * Sections define document structure (heading order, content). Merging
 * arrays of sections is ambiguous, so user sections completely replace
 * the default sections for any template they customize.
 *
 * Templates not present in overrides keep their default sections.
 *
 * @param defaults - Default sections from defaults.ts
 * @param overrides - User-provided section overrides
 * @returns Merged sections map
 *
 * @example
 * ```typescript
 * const sections = mergeTemplateSections(DEFAULT_TEMPLATE_SECTIONS, {
 *   meeting: [
 *     { heading: "Notes", hasPrompt: false },
 *     { heading: "Action Items", hasPrompt: false },
 *   ],
 * });
 * // Result: meeting has only the user's 2 sections; all other templates unchanged
 * ```
 */
export function mergeTemplateSections(
	defaults: Partial<Record<string, ReadonlyArray<TemplateSection>>>,
	overrides: Partial<Record<string, ReadonlyArray<TemplateSection>>>,
): Partial<Record<string, ReadonlyArray<TemplateSection>>> {
	return { ...defaults, ...overrides };
}
