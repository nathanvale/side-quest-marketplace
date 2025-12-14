/**
 * LLM client for inbox processing.
 *
 * Provides a wrapper around the @sidequest/core/llm abstraction
 * with lazy loading to avoid circular dependencies.
 *
 * @module inbox/core/llm/client
 */

// Lazy-loaded LLM module to avoid circular dependencies at module load time
let llmModule: typeof import("@sidequest/core/llm") | null = null;

/**
 * Supported LLM model types.
 */
export type LLMModel =
	| "sonnet"
	| "haiku"
	| "qwen:7b"
	| "qwen:14b"
	| "qwen2.5:14b"
	| "qwen-coder:17b"
	| "qwen-coder:14b";

/**
 * Call LLM using the @sidequest/core/llm abstraction.
 *
 * @param prompt - The prompt to send to the LLM
 * @param provider - The LLM provider (e.g., "haiku", "sonnet")
 * @param model - Optional specific model override
 * @returns The LLM response text
 */
export async function callLLM(
	prompt: string,
	provider: string,
	model?: string,
): Promise<string> {
	// Lazy load once, then reuse cached module
	if (!llmModule) {
		llmModule = await import("@sidequest/core/llm");
	}
	const { callModel } = llmModule;

	// Determine the model to use based on provider
	// Cast to satisfy the type - callModel will validate
	const resolvedModel = (model ??
		(provider === "haiku" ? "haiku" : "sonnet")) as LLMModel;

	return callModel({
		model: resolvedModel,
		prompt,
	});
}
