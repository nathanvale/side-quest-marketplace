import fs from "node:fs";
import path from "node:path";

import { parse, stringify } from "yaml";

import type { FieldRule, FrontmatterRules, ParaObsidianConfig } from "./config";
import { readFile, resolveVaultPath } from "./fs";

export interface FrontmatterParseResult {
	readonly attributes: Record<string, unknown>;
	readonly body: string;
}

/**
 * Parse YAML frontmatter from Markdown content.
 * Returns empty attributes if no frontmatter is present.
 */
export function parseFrontmatter(content: string): FrontmatterParseResult {
	if (!content.startsWith("---")) {
		return { attributes: {}, body: content };
	}

	const end = content.indexOf("\n---", 3);
	if (end === -1) {
		return { attributes: {}, body: content };
	}

	const raw = content.slice(3, end + 1); // include leading newline
	const body = content.slice(end + 4); // skip closing newline and markers

	try {
		const attributes = parse(raw) as Record<string, unknown>;
		return { attributes, body };
	} catch (error) {
		throw new Error(
			error instanceof Error
				? `Invalid frontmatter: ${error.message}`
				: "Invalid frontmatter",
		);
	}
}

export function serializeFrontmatter(
	attributes: Record<string, unknown>,
	body: string,
): string {
	const yaml = stringify(attributes).trimEnd();
	return `---\n${yaml}\n---\n${body.replace(/^\n/, "")}`;
}

export interface ValidationIssue {
	readonly field: string;
	readonly message: string;
}

export interface ValidationResult {
	readonly valid: boolean;
	readonly issues: ReadonlyArray<ValidationIssue>;
}

function isDateLike(value: unknown): boolean {
	if (typeof value !== "string") return false;
	// Simple ISO-ish check
	return /^\d{4}-\d{2}-\d{2}/.test(value);
}

function isArray(value: unknown): value is ReadonlyArray<unknown> {
	return Array.isArray(value);
}

function includesRequired(
	array: ReadonlyArray<unknown>,
	required: ReadonlyArray<string>,
) {
	return required.every((r) => array.includes(r));
}

function validateField(
	field: string,
	value: unknown,
	rule: FieldRule,
): ValidationIssue | undefined {
	switch (rule.type) {
		case "string": {
			if (typeof value !== "string") {
				return { field, message: "must be a string" };
			}
			return undefined;
		}
		case "date": {
			if (typeof value !== "string" || !isDateLike(value)) {
				return { field, message: "must be a date string (YYYY-MM-DD)" };
			}
			return undefined;
		}
		case "array": {
			if (!isArray(value)) {
				return { field, message: "must be an array" };
			}
			if (rule.includes && !includesRequired(value, rule.includes)) {
				return { field, message: `must include: ${rule.includes.join(", ")}` };
			}
			return undefined;
		}
		case "wikilink": {
			if (typeof value !== "string" || !value.startsWith("[[")) {
				return { field, message: "must be a wikilink [[...]]" };
			}
			return undefined;
		}
		case "enum": {
			if (typeof value !== "string" || !rule.enum?.includes(value)) {
				return {
					field,
					message: `must be one of: ${rule.enum?.join(", ") ?? ""}`,
				};
			}
			return undefined;
		}
		default:
			return { field, message: "unknown rule" };
	}
}

export function validateFrontmatter(
	attributes: Record<string, unknown>,
	rules?: FrontmatterRules,
): ValidationResult {
	if (!rules?.required) {
		return { valid: true, issues: [] };
	}

	const issues: ValidationIssue[] = [];
	for (const [field, rule] of Object.entries(rules.required)) {
		const value = attributes[field];
		if (value === undefined || value === null || value === "") {
			if (!rule.optional) {
				issues.push({ field, message: "is required" });
			}
			continue;
		}

		const issue = validateField(field, value, rule);
		if (issue) issues.push(issue);
	}

	return { valid: issues.length === 0, issues };
}

export function readFrontmatterFile(
	config: ParaObsidianConfig,
	filePath: string,
): { attributes: Record<string, unknown>; body: string; relative: string } {
	const { relative } = resolveVaultPath(config.vault, filePath);
	const content = readFile(config.vault, relative);
	const { attributes, body } = parseFrontmatter(content);
	return { attributes, body, relative };
}

export function validateFrontmatterFile(
	config: ParaObsidianConfig,
	filePath: string,
): ValidationResult & {
	relative: string;
	attributes: Record<string, unknown>;
} {
	const { attributes, relative } = readFrontmatterFile(config, filePath);
	const type = attributes.type as string | undefined;
	const rules = type ? config.frontmatterRules?.[type] : undefined;
	const result = validateFrontmatter(attributes, rules);

	const versionIssues: ValidationIssue[] = [];
	const expectedVersion =
		typeof type === "string" ? config.templateVersions?.[type] : undefined;
	const templateVersion = attributes.template_version;
	if (expectedVersion !== undefined) {
		if (templateVersion === undefined) {
			versionIssues.push({
				field: "template_version",
				message: `missing (expected ${expectedVersion})`,
			});
		} else if (
			typeof templateVersion === "number" &&
			templateVersion < expectedVersion
		) {
			versionIssues.push({
				field: "template_version",
				message: `outdated (found ${templateVersion}, expected ${expectedVersion})`,
			});
		}
	}

	const issues = [...result.issues, ...versionIssues];
	return { valid: issues.length === 0, issues, relative, attributes };
}

export interface MigrateTemplateOptions {
	readonly forceVersion?: number;
	readonly dryRun?: boolean;
}

export function migrateTemplateVersion(
	config: ParaObsidianConfig,
	filePath: string,
	options: MigrateTemplateOptions = {},
): {
	relative: string;
	fromVersion?: number;
	toVersion: number;
	updated: boolean;
	wouldChange: boolean;
	dryRun: boolean;
} {
	const { attributes, body, relative } = readFrontmatterFile(config, filePath);
	const type = attributes.type as string | undefined;
	const expected =
		options.forceVersion ??
		(type ? config.templateVersions?.[type] : undefined);
	if (expected === undefined) {
		throw new Error(
			`No template version configured for ${type ?? "unknown type"}`,
		);
	}

	const current =
		typeof attributes.template_version === "number"
			? attributes.template_version
			: undefined;

	const dryRun = options.dryRun ?? false;
	const wouldChange = current !== expected;

	if (!wouldChange) {
		return {
			relative,
			fromVersion: current,
			toVersion: expected,
			updated: false,
			wouldChange: false,
			dryRun,
		};
	}

	attributes.template_version = expected;
	const content = serializeFrontmatter(attributes, body);
	if (!dryRun) {
		const { absolute } = resolveVaultPath(config.vault, relative);
		fs.writeFileSync(absolute, content, "utf8");
	}

	return {
		relative,
		fromVersion: current,
		toVersion: expected,
		updated: !dryRun,
		wouldChange: true,
		dryRun,
	};
}

interface ListOptions {
	readonly extensions?: ReadonlyArray<string>;
}

function listFilesRecursive(root: string, options: ListOptions = {}): string[] {
	const exts = options.extensions ?? [];
	const entries = fs.readdirSync(root, { withFileTypes: true });
	const files: string[] = [];
	for (const entry of entries) {
		const full = path.join(root, entry.name);
		if (entry.isDirectory()) {
			files.push(...listFilesRecursive(full, options));
		} else if (
			entry.isFile() &&
			(exts.length === 0 || exts.some((ext) => entry.name.endsWith(ext)))
		) {
			files.push(full);
		}
	}
	return files;
}

export interface MigrateAllOptions {
	readonly dir?: string;
	readonly dryRun?: boolean;
}

export function migrateAllTemplateVersions(
	config: ParaObsidianConfig,
	options: MigrateAllOptions = {},
): {
	results: Array<
		ReturnType<typeof migrateTemplateVersion> & { error?: string }
	>;
	updated: number;
	wouldUpdate: number;
	skipped: number;
	errors: number;
	dir: string;
	dryRun: boolean;
} {
	const targetDir = options.dir
		? resolveVaultPath(config.vault, options.dir).absolute
		: config.vault;
	const dryRun = options.dryRun ?? false;
	const files = listFilesRecursive(targetDir, { extensions: [".md"] });

	const results: Array<
		ReturnType<typeof migrateTemplateVersion> & { error?: string }
	> = [];
	let updated = 0;
	let wouldUpdate = 0;
	let skipped = 0;
	let errors = 0;

	for (const file of files) {
		const relative = path.relative(config.vault, file);
		try {
			const result = migrateTemplateVersion(config, relative, { dryRun });
			results.push(result);
			if (result.wouldChange) {
				wouldUpdate++;
				if (result.updated) updated++;
			} else {
				skipped++;
			}
		} catch (error) {
			errors++;
			results.push({
				relative,
				fromVersion: undefined,
				toVersion: 0,
				updated: false,
				wouldChange: false,
				dryRun,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return {
		results,
		updated,
		wouldUpdate,
		skipped,
		errors,
		dir: targetDir,
		dryRun,
	};
}
