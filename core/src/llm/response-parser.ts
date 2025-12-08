/**
 * LLM response parsing utilities.
 *
 * This module handles parsing and validating responses from LLM APIs,
 * including Ollama's JSON format mode.
 *
 * @module llm/response-parser
 */

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
 * Parse LLM response, handling potential markdown code fences and thinking blocks.
 *
 * @param response - Raw response from LLM
 * @returns Parsed extraction result
 * @throws Error if response is not valid JSON
 */
export function parseOllamaResponse(response: string): ExtractionResult {
	let json = response.trim();

	// Strip <thinking>...</thinking> blocks (Claude extended thinking)
	json = json.replace(/<thinking>[\s\S]*?<\/thinking>/g, "").trim();

	// Strip markdown code fences if present
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
