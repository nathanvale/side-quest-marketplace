/**
 * Template validator for Templater syntax and structure.
 *
 * Validates template content for common issues like:
 * - Malformed Templater syntax
 * - Missing required fields
 * - Invalid YAML frontmatter
 * - Unmatched quotes or brackets
 *
 * @module templates/validator
 */
import type { TemplateValidationResult } from "./types";

/**
 * Validates a template for common syntax and structure issues.
 *
 * @param content - Template content to validate
 * @returns Validation result with errors and warnings
 *
 * @example
 * ```typescript
 * const template = `---
 * title: "<% tp.system.prompt("Title") %>"
 * created: <% tp.date.now("YYYY-MM-DD") %>
 * ---
 *
 * # <% tp.system.prompt("Title") %>
 * `;
 * const result = validateTemplate(template);
 * if (!result.isValid) {
 *   console.error("Errors:", result.errors);
 * }
 * ```
 */
export function validateTemplate(content: string): TemplateValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Check for frontmatter
	if (!hasFrontmatter(content)) {
		errors.push("Template must have YAML frontmatter (--- ... ---)");
	}

	// Validate Templater syntax
	const templaterErrors = validateTemplaterSyntax(content);
	errors.push(...templaterErrors);

	// Check for balanced quotes in frontmatter
	const frontmatterQuoteErrors = validateFrontmatterQuotes(content);
	errors.push(...frontmatterQuoteErrors);

	// Check for balanced brackets in wikilinks
	const wikilinkErrors = validateWikilinks(content);
	errors.push(...wikilinkErrors);

	// Warnings for best practices
	if (!hasTemplateVersion(content)) {
		warnings.push(
			"Consider adding template_version field for migration support",
		);
	}

	return {
		isValid: errors.length === 0,
		errors,
		warnings,
	};
}

/**
 * Checks if content has valid frontmatter.
 */
function hasFrontmatter(content: string): boolean {
	return /^---\n[\s\S]*?\n---/.test(content);
}

/**
 * Checks if frontmatter has template_version field.
 */
function hasTemplateVersion(content: string): boolean {
	const match = content.match(/^---\n([\s\S]*?)\n---/);
	if (!match) return false;
	return /^template_version:/m.test(match[1] ?? "");
}

/**
 * Validates Templater syntax patterns.
 *
 * Checks for:
 * - Unclosed <% %> tags
 * - Invalid tp.* function calls
 * - Malformed prompts
 */
function validateTemplaterSyntax(content: string): string[] {
	const errors: string[] = [];

	// Find all <% ... %> blocks
	const templaterRegex = /<%[\s\S]*?%>/g;
	const matches = content.match(templaterRegex) ?? [];

	for (const match of matches) {
		// Check for valid tp.* calls
		if (match.includes("tp.")) {
			// Valid patterns: tp.system.prompt(...), tp.date.now(...), tp.file.*
			if (
				!match.includes("tp.system.prompt") &&
				!match.includes("tp.date.now") &&
				!match.includes("tp.file.")
			) {
				errors.push(`Unknown Templater function in: ${match}`);
			}

			// Check for balanced parentheses in function calls
			const openParens = (match.match(/\(/g) || []).length;
			const closeParens = (match.match(/\)/g) || []).length;
			if (openParens !== closeParens) {
				errors.push(`Unbalanced parentheses in: ${match}`);
			}
		}
	}

	// Check for unclosed <% tags
	const openTags = (content.match(/<%/g) || []).length;
	const closeTags = (content.match(/%>/g) || []).length;
	if (openTags !== closeTags) {
		errors.push("Unclosed Templater tags (<% without matching %>)");
	}

	return errors;
}

/**
 * Validates quote balance in YAML frontmatter.
 *
 * Ensures all quoted values are properly closed.
 */
function validateFrontmatterQuotes(content: string): string[] {
	const errors: string[] = [];
	const match = content.match(/^---\n([\s\S]*?)\n---/);
	if (!match) return errors;

	const frontmatter = match[1] ?? "";
	const lines = frontmatter.split("\n");

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? "";

		// Skip comment lines
		if (line.trim().startsWith("#")) continue;

		// Check for balanced double quotes
		const doubleQuotes = (line.match(/"/g) || []).length;
		if (doubleQuotes % 2 !== 0) {
			errors.push(`Unbalanced quotes on line ${i + 2}: ${line.trim()}`);
		}
	}

	return errors;
}

/**
 * Validates wikilink bracket balance.
 *
 * Ensures all [[ ]] pairs are properly closed.
 */
function validateWikilinks(content: string): string[] {
	const errors: string[] = [];

	const openBrackets = (content.match(/\[\[/g) || []).length;
	const closeBrackets = (content.match(/\]\]/g) || []).length;

	if (openBrackets !== closeBrackets) {
		errors.push("Unbalanced wikilink brackets ([[ without matching ]])");
	}

	return errors;
}
