/**
 * Local LLM integration for note conversion.
 *
 * Uses Ollama's HTTP API to extract structured data from freeform notes.
 * This module provides:
 * - HTTP client for Ollama API
 * - Prompt building utilities (re-exported from submodules)
 * - High-level orchestration workflows (re-exported from submodules)
 *
 * @module llm
 */

// Re-export types and functions from submodules
export type {
	ConstraintSet,
	FieldConstraint,
	VaultContext,
} from "./llm/constraints";
export { buildConstraintSet } from "./llm/constraints";
export type {
	BatchConvertOptions,
	ConversionResult,
	ConvertNoteOptions,
	ExtractMetadataOptions,
	SuggestFieldValuesOptions,
} from "./llm/orchestration";
export {
	batchConvert,
	convertNoteToTemplate,
	extractMetadata,
	getWikilinkFieldsFromRules,
	suggestFieldValues,
} from "./llm/orchestration";
export type { PromptExample, PromptTemplate } from "./llm/prompt-builder";
export {
	buildCriticalRules,
	buildExamplesSection,
	buildStructuredPrompt,
	DEFAULT_CRITICAL_RULES,
} from "./llm/prompt-builder";

/** Default LLM model for extraction tasks (uses Claude Haiku via headless CLI) */
export const DEFAULT_LLM_MODEL = "haiku";

/** Default Ollama API URL */
export const DEFAULT_OLLAMA_URL = "http://localhost:11434";

/**
 * Model name type - supports Claude models and Ollama models.
 */
export type ModelName =
	| "sonnet"
	| "haiku"
	| "qwen:7b"
	| "qwen:14b"
	| "qwen2.5:14b"
	| "qwen-coder:17b"
	| "qwen-coder:14b";

/**
 * Validate that a model name is in the allowed models list.
 *
 * @param model - Model name to validate
 * @param allowedModels - List of allowed model names from config
 * @returns The validated model name
 * @throws Error if model is not in allowed list
 *
 * @example
 * ```typescript
 * const model = validateModel("sonnet", ["sonnet", "haiku"]);
 * // Returns: "sonnet"
 *
 * validateModel("qwen:7b", ["sonnet", "haiku"]);
 * // Throws: Invalid model "qwen:7b". Allowed models: sonnet, haiku
 * ```
 */
export function validateModel(
	model: string,
	allowedModels: ReadonlyArray<string>,
): ModelName {
	if (!allowedModels.includes(model)) {
		throw new Error(
			`Invalid model "${model}". Allowed models: ${allowedModels.join(", ")}\n` +
				`Add to .paraobsidianrc "availableModels" to enable.`,
		);
	}
	return model as ModelName;
}

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
