/**
 * Local LLM integration for note conversion.
 *
 * Uses Ollama's HTTP API to extract structured data from freeform notes.
 * This module provides:
 * - HTTP client for Ollama API
 * - Prompt builder for note-to-template conversion
 *
 * @module llm
 */

import type { FrontmatterRules } from "./config";
import { DEFAULT_FRONTMATTER_RULES } from "./defaults";
import type { TemplateField } from "./templates";

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

/** Default Ollama model for extraction tasks */
export const DEFAULT_LLM_MODEL = "qwen2.5:14b";

/** Default Ollama API URL */
export const DEFAULT_OLLAMA_URL = "http://localhost:11434";

/**
 * Result of LLM extraction from a note.
 */
export interface ExtractionResult {
	/** Frontmatter field values keyed by prompt name */
	args: Record<string, string | null>;
	/** Body section content keyed by heading name */
	content: Record<string, string>;
	/** Suggested title for the new note */
	title: string;
}

/**
 * Call Ollama's generate API with a prompt.
 *
 * Uses JSON format mode for structured output.
 *
 * @param prompt - The prompt to send
 * @param model - Ollama model name (default: qwen2.5:14b)
 * @param ollamaUrl - Ollama API URL (default: http://localhost:11434)
 * @returns The generated response text
 * @throws Error if Ollama is not running or model not found
 *
 * @example
 * ```typescript
 * const response = await callOllama("Extract: {...}", "qwen2.5:7b");
 * const data = JSON.parse(response);
 * ```
 */
export async function callOllama(
	prompt: string,
	model: string = DEFAULT_LLM_MODEL,
	ollamaUrl: string = DEFAULT_OLLAMA_URL,
): Promise<string> {
	let response: Response;

	try {
		response = await fetch(`${ollamaUrl}/api/generate`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				model,
				prompt,
				stream: false,
				format: "json",
			}),
		});
	} catch (error) {
		if (error instanceof Error && error.message.includes("ECONNREFUSED")) {
			throw new Error(`Ollama is not running. Start it with: ollama serve`);
		}
		throw error;
	}

	if (!response.ok) {
		const errorText = await response.text();
		if (response.status === 404 && errorText.includes("model")) {
			throw new Error(
				`Model "${model}" not found. Install it with: ollama pull ${model}`,
			);
		}
		throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
	}

	const data = (await response.json()) as { response: string };
	return data.response;
}

/**
 * Parse LLM response, handling potential markdown code fences.
 *
 * @param response - Raw response from LLM
 * @returns Parsed extraction result
 * @throws Error if response is not valid JSON
 */
export function parseOllamaResponse(response: string): ExtractionResult {
	// Strip markdown code fences if present
	let json = response.trim();
	if (json.startsWith("```json")) {
		json = json.slice(7);
	} else if (json.startsWith("```")) {
		json = json.slice(3);
	}
	if (json.endsWith("```")) {
		json = json.slice(0, -3);
	}
	json = json.trim();

	try {
		const parsed = JSON.parse(json) as ExtractionResult;

		// Ensure required fields exist with defaults
		return {
			args: parsed.args ?? {},
			content: parsed.content ?? {},
			title: parsed.title ?? "Untitled",
		};
	} catch (_error) {
		throw new Error(
			`Failed to parse LLM response as JSON. Raw response:\n${response}`,
		);
	}
}

/**
 * Format validation rules for inclusion in prompt.
 *
 * @param rules - Frontmatter rules for a template type
 * @returns Formatted rules string
 */
function formatRules(rules: FrontmatterRules | undefined): string {
	if (!rules?.required) {
		return "No specific validation rules";
	}

	const lines: string[] = [];
	for (const [field, rule] of Object.entries(rules.required)) {
		if (rule.type === "enum" && rule.enum) {
			lines.push(`- ${field}: must be one of [${rule.enum.join(", ")}]`);
		} else if (rule.type === "date") {
			lines.push(`- ${field}: date in YYYY-MM-DD format`);
		} else if (rule.type === "wikilink") {
			lines.push(`- ${field}: wikilink format [[Name]]`);
		} else if (rule.type === "array") {
			const includesNote = rule.includes
				? ` (must include: ${rule.includes.join(", ")})`
				: "";
			lines.push(`- ${field}: array of strings${includesNote}`);
		} else {
			lines.push(`- ${field}: ${rule.type}`);
		}
	}

	return lines.join("\n");
}

/**
 * Build a conversion prompt for extracting data from a note.
 *
 * @param existingContent - The freeform note content to convert
 * @param template - Target template name (e.g., "booking")
 * @param fields - Template fields to extract
 * @param sections - Body section headings from the template
 * @param rules - Validation rules for the template type
 * @param vaultContext - Optional vault context (existing areas, projects, tags) to guide extraction
 * @returns Prompt string for LLM
 *
 * @example
 * ```typescript
 * const prompt = buildConversionPrompt(
 *   noteContent,
 *   "booking",
 *   templateFields,
 *   ["Booking Details", "Cost & Payment"],
 *   frontmatterRules,
 *   { areas: ["Work", "Family"], projects: [], suggestedTags: ["travel", "project"] }
 * );
 * ```
 */
export function buildConversionPrompt(
	existingContent: string,
	template: string,
	fields: TemplateField[],
	sections: string[] = [],
	rules?: FrontmatterRules,
	vaultContext?: VaultContext,
): string {
	// Get rules from defaults if not provided
	const effectiveRules = rules ?? DEFAULT_FRONTMATTER_RULES[template];

	const fieldList = fields
		.filter((f) => !f.isAutoDate) // Skip auto-filled date fields
		.map((f) => `- "${f.key}"${f.inFrontmatter ? " (frontmatter)" : " (body)"}`)
		.join("\n");

	// Build section list if provided
	const sectionList =
		sections.length > 0
			? `\nBODY SECTIONS TO FILL:\n${sections.map((s) => `- "${s}"`).join("\n")}\n`
			: "";

	// Build vault context section if provided
	const vaultContextSection = vaultContext
		? `
VAULT CONTEXT:

EXISTING AREAS (prefer these if content matches):
${vaultContext.areas.map((a) => `- ${a}`).join("\n")}
→ If an area fits the content, use wikilink format: [[AreaName]]
→ If none fit, you may suggest a new area name
→ CRITICAL: Wikilinks must NOT be quoted in frontmatter for Dataview compatibility

EXISTING PROJECTS (for task linking):
${vaultContext.projects.map((p) => `- ${p}`).join("\n")}
→ Link tasks to relevant existing projects when applicable

ALLOWED TAGS (choose ONLY from this list):
${vaultContext.suggestedTags.join(", ")}
→ DO NOT invent new tags - only use tags from this list
→ Select 1-3 most relevant tags for the content

`
		: "";

	return `You are extracting structured data from an existing note to convert it to a "${template}" template.

EXISTING NOTE CONTENT:
---
${existingContent}
---

TARGET TEMPLATE: ${template}

REQUIRED FIELDS TO EXTRACT:
${fieldList}
${sectionList}
VALIDATION RULES:
${formatRules(effectiveRules)}
${vaultContextSection}
OUTPUT FORMAT:
Return ONLY a JSON object with this exact structure:
{
  "args": {
    "<field key exactly as shown above>": "<extracted value>",
    ...
  },
  "content": {
    "<Section Heading>": "<content to inject under that heading>",
    ...
  },
  "title": "<suggested title for the note>"
}

CRITICAL RULES:
1. Extract values from the note content for BOTH frontmatter (args) AND body sections (content)
2. Use null for missing/unknown values in args - DO NOT invent data
3. For "content", use EXACT heading names from BODY SECTIONS TO FILL above
4. Omit content sections that have no relevant content to extract
5. String values must be properly quoted: "500" not 500
6. Dates MUST be YYYY-MM-DD format (e.g., "2025-12-26")
7. Enum values MUST match exactly from the validation rules
8. For content sections, preserve markdown formatting (lists, bold, links, etc.)
9. The title should be descriptive and based on the note content

OUTPUT (JSON only, no explanation, no markdown fences):`;
}
