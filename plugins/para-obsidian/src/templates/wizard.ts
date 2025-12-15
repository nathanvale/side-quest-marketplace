/**
 * Interactive wizard for gathering template configuration.
 *
 * Provides step-by-step prompts for defining template metadata,
 * frontmatter fields, and body sections.
 *
 * @module templates/wizard
 */
import { confirm, input, select } from "@inquirer/prompts";
import type { TemplateConfig, TemplateField, TemplateSection } from "./types";

/**
 * Runs the interactive wizard to gather template configuration.
 *
 * Prompts user for:
 * 1. Template metadata (name, display name, note type, version)
 * 2. Frontmatter fields (iteratively add fields)
 * 3. Body sections (iteratively add sections)
 *
 * @returns Complete template configuration
 *
 * @example
 * ```typescript
 * const config = await runWizard();
 * // User interactively defines their template
 * const template = generateTemplate(config);
 * ```
 */
export async function runWizard(): Promise<TemplateConfig> {
	console.log("\n📝 Template Creation Wizard\n");

	// Step 1: Gather metadata
	const name = await input({
		message: "Template name (kebab-case, e.g., custom-project):",
		validate: (value) => {
			if (!/^[a-z][a-z0-9-]*$/.test(value)) {
				return "Must be kebab-case (lowercase letters, numbers, hyphens)";
			}
			return true;
		},
	});

	const displayName = await input({
		message: "Display name (e.g., Custom Project):",
		default: toTitleCase(name),
	});

	const noteType = await input({
		message: "Note type (matches frontmatter type field):",
		default: name,
	});

	const versionStr = await input({
		message: "Template version:",
		default: "1",
		validate: (value) => {
			const num = Number.parseInt(value, 10);
			if (Number.isNaN(num) || num < 1) {
				return "Must be a positive integer";
			}
			return true;
		},
	});
	const version = Number.parseInt(versionStr, 10);

	// Step 2: Gather frontmatter fields
	console.log("\n📋 Frontmatter Fields\n");
	const fields = await gatherFields();

	// Step 3: Gather body sections
	console.log("\n📄 Body Sections\n");
	const sections = await gatherSections();

	return {
		name,
		displayName,
		noteType,
		version,
		fields,
		sections,
	};
}

/**
 * Iteratively gathers frontmatter field definitions.
 */
async function gatherFields(): Promise<TemplateField[]> {
	const fields: TemplateField[] = [];

	// eslint-disable-next-line no-constant-condition
	while (true) {
		const addField = await confirm({
			message: `Add a frontmatter field? (${fields.length} added)`,
			default: fields.length === 0,
		});

		if (!addField) break;

		const field = await gatherField();
		fields.push(field);
	}

	return fields;
}

/**
 * Gathers a single frontmatter field definition.
 */
async function gatherField(): Promise<TemplateField> {
	const name = await input({
		message: "Field name (camelCase, e.g., projectStatus):",
		validate: (value) => {
			if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(value)) {
				return "Must be camelCase (letters and numbers only)";
			}
			return true;
		},
	});

	const displayName = await input({
		message: "Display name for prompt:",
		default: toTitleCase(name),
	});

	const type = await select({
		message: "Field type:",
		choices: [
			{ value: "string", name: "String" },
			{ value: "number", name: "Number" },
			{ value: "date", name: "Date" },
			{ value: "array", name: "Array (comma-separated)" },
			{ value: "wikilink", name: "Wikilink (note reference)" },
			{ value: "enum", name: "Enum (predefined values)" },
		],
	});

	const required = await confirm({
		message: "Is this field required?",
		default: true,
	});

	let defaultValue: string | undefined;
	let autoFill: string | undefined;
	let enumValues: string[] | undefined;

	// Auto-fill for date fields
	if (type === "date") {
		const useAutoFill = await confirm({
			message: "Auto-fill with current date?",
			default: true,
		});

		if (useAutoFill) {
			const format = await input({
				message: "Date format (Moment.js/Templater format):",
				default: "YYYY-MM-DD",
			});
			autoFill = `tp.date.now("${format}")`;
		}
	}

	// Enum values
	if (type === "enum") {
		const valuesStr = await input({
			message: "Enum values (comma-separated):",
			validate: (value) =>
				value.trim() ? true : "Must provide at least one value",
		});
		enumValues = valuesStr.split(",").map((v) => v.trim());

		defaultValue = await input({
			message: "Default value (leave empty for first enum value):",
			default: enumValues[0],
		});
	}

	// Default value for optional fields
	if (!required && !autoFill && type !== "enum") {
		defaultValue = await input({
			message: "Default value (leave empty for none):",
		});
	}

	return {
		name,
		displayName,
		type: type as TemplateField["type"],
		required,
		default: defaultValue || undefined,
		autoFill,
		enumValues,
	};
}

/**
 * Iteratively gathers body section definitions.
 */
async function gatherSections(): Promise<TemplateSection[]> {
	const sections: TemplateSection[] = [];

	// eslint-disable-next-line no-constant-condition
	while (true) {
		const addSection = await confirm({
			message: `Add a body section? (${sections.length} added)`,
			default: sections.length === 0,
		});

		if (!addSection) break;

		const section = await gatherSection();
		sections.push(section);
	}

	return sections;
}

/**
 * Gathers a single body section definition.
 */
async function gatherSection(): Promise<TemplateSection> {
	const heading = await input({
		message: "Section heading (e.g., Why This Matters):",
		validate: (value) => (value.trim() ? true : "Heading cannot be empty"),
	});

	const hasPrompt = await confirm({
		message: "Include interactive prompt for this section?",
		default: true,
	});

	let promptText: string | undefined;
	if (hasPrompt) {
		promptText = await input({
			message: "Prompt text:",
			default: heading,
		});
	}

	return {
		heading,
		hasPrompt,
		promptText,
	};
}

/**
 * Converts kebab-case or camelCase to Title Case.
 */
function toTitleCase(str: string): string {
	// Split on hyphens or camelCase boundaries
	const words = str
		.replace(/-/g, " ")
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.split(" ");

	return words
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(" ");
}
