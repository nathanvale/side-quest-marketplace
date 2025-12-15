/**
 * Classifier Code Generator
 *
 * Generates TypeScript classifier files from configuration.
 * Uses medical-statement.ts as the template structure.
 *
 * @module classifiers/generator
 */

import type { FieldDefinition, InboxConverter } from "./types";

/**
 * Convert classifier ID to camelCase identifier.
 *
 * @param id - Kebab-case classifier ID
 * @returns camelCase identifier
 *
 * @example
 * ```typescript
 * toCamelCase('medical-bill') // => 'medicalBill'
 * toCamelCase('invoice') // => 'invoice'
 * ```
 */
function toCamelCase(id: string): string {
	return id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Format a pattern array for code generation.
 *
 * @param patterns - Array of patterns with weights
 * @returns Formatted TypeScript code
 */
function formatPatterns(
	patterns: ReadonlyArray<{ pattern: string; weight: number }>,
	indent = "\t\t",
): string {
	return patterns
		.map((p) => `${indent}{ pattern: "${p.pattern}", weight: ${p.weight} },`)
		.join("\n");
}

/**
 * Format field definitions for code generation.
 *
 * @param fields - Array of field definitions
 * @returns Formatted TypeScript code
 */
function formatFields(
	fields: readonly FieldDefinition[],
	indent = "\t",
): string {
	return fields
		.map((field) => {
			const lines = [`${indent}{`];
			lines.push(`${indent}\tname: "${field.name}",`);
			lines.push(`${indent}\ttype: "${field.type}",`);
			lines.push(`${indent}\tdescription:`);
			lines.push(`${indent}\t\t"${field.description}",`);
			lines.push(`${indent}\trequirement: "${field.requirement}",`);

			if (field.conditionalOn) {
				lines.push(`${indent}\tconditionalOn: "${field.conditionalOn}",`);
			}
			if (field.conditionalDescription) {
				lines.push(`${indent}\tconditionalDescription:`);
				lines.push(`${indent}\t\t"${field.conditionalDescription}",`);
			}
			if (field.allowedValues && field.allowedValues.length > 0) {
				lines.push(
					`${indent}\tallowedValues: [${field.allowedValues.map((v) => `"${v}"`).join(", ")}],`,
				);
			}
			if (field.validationPattern) {
				lines.push(
					`${indent}\tvalidationPattern: "${field.validationPattern}",`,
				);
			}

			lines.push(`${indent}},`);
			return lines.join("\n");
		})
		.join("\n");
}

/**
 * Format field mappings for code generation.
 *
 * @param mappings - Field mappings object
 * @returns Formatted TypeScript code
 */
function formatFieldMappings(
	mappings: Readonly<Record<string, string>>,
	indent = "\t\t",
): string {
	return Object.entries(mappings)
		.map(([key, value]) => `${indent}${key}: "${value}",`)
		.join("\n");
}

/**
 * Generate TypeScript classifier code from configuration.
 *
 * Uses medical-statement.ts as the structural template.
 * Produces formatted, valid TypeScript with proper indentation.
 *
 * @param config - Classifier configuration
 * @returns Generated TypeScript code
 *
 * @example
 * ```typescript
 * const code = generateClassifierCode(myConfig);
 * await writeFile('definitions/my-classifier.ts', code);
 * ```
 */
export function generateClassifierCode(config: InboxConverter): string {
	const camelName = toCamelCase(config.id);

	return `/**
 * ${config.displayName} Classifier
 *
 * ${config.extraction.promptHint}
 *
 * @module classifiers/definitions/${config.id}
 */

import type { InboxConverter } from "../types";

/**
 * ${config.displayName} classifier
 */
export const ${camelName}Classifier: InboxConverter = {
	schemaVersion: ${config.schemaVersion},
	id: "${config.id}",
	displayName: "${config.displayName}",
	enabled: ${config.enabled},
	priority: ${config.priority},

	heuristics: {
		filenamePatterns: [
${formatPatterns(config.heuristics.filenamePatterns)}
		],
		contentMarkers: [
${formatPatterns(config.heuristics.contentMarkers)}
		],
		threshold: ${config.heuristics.threshold ?? 0.5},
	},

	fields: [
${formatFields(config.fields)}
	],

	extraction: {
		promptHint:
			"${config.extraction.promptHint}",
		keyFields: [${config.extraction.keyFields.map((f) => `"${f}"`).join(", ")}],
	},

	template: {
		name: "${config.template.name}",
		fieldMappings: {
${formatFieldMappings(config.template.fieldMappings)}
		},
	},

	scoring: {
		heuristicWeight: ${config.scoring.heuristicWeight},
		llmWeight: ${config.scoring.llmWeight},
		highThreshold: ${config.scoring.highThreshold},
		mediumThreshold: ${config.scoring.mediumThreshold},
	},
};
`;
}

/**
 * Generate import statement for registry.
 *
 * @param classifierId - Kebab-case classifier ID
 * @returns Import statement
 *
 * @example
 * ```typescript
 * generateImportStatement('medical-bill')
 * // => "import { medicalBillClassifier } from './medical-bill';"
 * ```
 */
export function generateImportStatement(classifierId: string): string {
	const camelName = toCamelCase(classifierId);
	return `import { ${camelName}Classifier } from "./${classifierId}";`;
}

/**
 * Generate export statement for classifier.
 *
 * @param classifierId - Kebab-case classifier ID
 * @returns Export reference
 *
 * @example
 * ```typescript
 * generateExportStatement('medical-bill')
 * // => "\tmedicalBillClassifier,"
 * ```
 */
export function generateExportStatement(classifierId: string): string {
	const camelName = toCamelCase(classifierId);
	return `\t${camelName}Classifier,`;
}
