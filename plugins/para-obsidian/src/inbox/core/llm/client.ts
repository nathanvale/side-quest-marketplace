/**
 * LLM client for inbox processing.
 *
 * Provides a wrapper around the @sidequest/core/llm abstraction
 * with lazy loading to avoid circular dependencies.
 *
 * Includes automatic fallback from Claude to local Ollama when Claude fails.
 *
 * @module inbox/core/llm/client
 */

import { llmLogger } from "../../../shared/logger";

// Lazy-loaded LLM module to avoid circular dependencies at module load time
let llmModule: typeof import("@sidequest/core/llm") | null = null;

/** Default fallback model when Claude fails */
const DEFAULT_FALLBACK_MODEL = "qwen2.5:14b";

/** Timeout for Claude calls before triggering fallback (15 seconds) */
const CLAUDE_FALLBACK_TIMEOUT_MS = 15_000;

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

/** Claude model identifiers for fallback detection */
const CLAUDE_MODELS: LLMModel[] = ["sonnet", "haiku"];

/**
 * Check if a model is a Claude model.
 */
function isClaudeModel(model: LLMModel): boolean {
	return CLAUDE_MODELS.includes(model);
}

/**
 * Result from callLLMWithMetadata including fallback information.
 */
export interface LLMCallResult {
	/** The LLM response text */
	readonly response: string;
	/** The actual model that was used */
	readonly modelUsed: string;
	/** True if a fallback model was used instead of the primary */
	readonly isFallback: boolean;
	/** Reason for fallback (only set if isFallback is true) */
	readonly fallbackReason?: string;
}

/**
 * Test LLM client that returns fast, valid classification responses.
 * Use this in tests by injecting via InboxEngineConfig.llmClient.
 *
 * Returns responses in the format expected by parseDetectionResponse():
 * - documentType: string (required)
 * - confidence: number 0-1 (required)
 * - suggestedArea, suggestedProject, extractedFields, reasoning (optional)
 *
 * @param documentType - Document type to return (default: "generic")
 * @param confidence - Confidence level 0-1 (default: 0.85)
 * @returns LLM client function suitable for testing
 *
 * @example
 * ```typescript
 * const engine = createInboxEngine({
 *   vaultPath: testVault,
 *   llmClient: createTestLLMClient(),
 * });
 * ```
 */
export function createTestLLMClient(
	documentType = "generic",
	confidence = 0.85,
): (prompt: string, provider: string, model?: string) => Promise<string> {
	return async (_prompt: string, _provider: string, _model?: string) => {
		// Return a valid JSON response matching DocumentTypeResult schema
		return JSON.stringify({
			documentType,
			confidence,
			suggestedArea: null,
			suggestedProject: null,
			extractedFields: null,
			reasoning: "Test LLM classification (instant response)",
		});
	};
}

/**
 * Call LLM with metadata about which model was used and fallback status.
 *
 * When a Claude model fails (auth issues, rate limits, etc.),
 * automatically falls back to local Ollama model.
 *
 * @param prompt - The prompt to send to the LLM
 * @param provider - The LLM provider (e.g., "haiku", "sonnet")
 * @param model - Optional specific model override
 * @returns LLMCallResult with response text and fallback metadata
 */
export async function callLLMWithMetadata(
	prompt: string,
	provider: string,
	model?: string,
): Promise<LLMCallResult> {
	// Lazy load once, then reuse cached module
	if (!llmModule) {
		llmModule = await import("@sidequest/core/llm");
	}
	const { callModel } = llmModule;

	// Determine the model to use based on provider
	// Cast to satisfy the type - callModel will validate
	const resolvedModel = (model ??
		(provider === "haiku" ? "haiku" : "sonnet")) as LLMModel;

	// If using Claude, try it first with fallback to Ollama
	// Use shorter timeout to fail fast and trigger fallback
	if (isClaudeModel(resolvedModel)) {
		try {
			const response = await callModel({
				model: resolvedModel,
				prompt,
				timeoutMs: CLAUDE_FALLBACK_TIMEOUT_MS,
			});
			return {
				response,
				modelUsed: resolvedModel,
				isFallback: false,
			};
		} catch (claudeError) {
			// Claude failed - try fallback to local Ollama
			const fallbackModel =
				(process.env.PARA_LLM_FALLBACK_MODEL as LLMModel) ??
				DEFAULT_FALLBACK_MODEL;

			const errorMsg =
				claudeError instanceof Error ? claudeError.message : "unknown";

			// Log the fallback attempt
			if (llmLogger) {
				llmLogger.warn`Claude (${resolvedModel}) failed: ${errorMsg}. Falling back to ${fallbackModel}`;
			}

			try {
				const response = await callModel({
					model: fallbackModel,
					prompt,
				});

				// Log successful fallback
				if (llmLogger) {
					llmLogger.info`Fallback to ${fallbackModel} succeeded`;
				}

				return {
					response,
					modelUsed: fallbackModel,
					isFallback: true,
					fallbackReason: errorMsg,
				};
			} catch (fallbackError) {
				const fallbackMsg =
					fallbackError instanceof Error ? fallbackError.message : "unknown";

				// Log both failures
				if (llmLogger) {
					llmLogger.error`Both Claude and fallback failed: claude=${errorMsg} fallback=${fallbackMsg}`;
				}

				// Both failed - throw combined error
				throw new Error(
					`Claude failed: ${errorMsg}. Fallback to ${fallbackModel} also failed: ${fallbackMsg}`,
				);
			}
		}
	}

	// Non-Claude model - call directly
	const response = await callModel({
		model: resolvedModel,
		prompt,
	});
	return {
		response,
		modelUsed: resolvedModel,
		isFallback: false,
	};
}

/**
 * Call LLM using the @sidequest/core/llm abstraction.
 *
 * When a Claude model fails (auth issues, rate limits, etc.),
 * automatically falls back to local Ollama model.
 *
 * @param prompt - The prompt to send to the LLM
 * @param provider - The LLM provider (e.g., "haiku", "sonnet")
 * @param model - Optional specific model override
 * @returns The LLM response text
 * @deprecated Use callLLMWithMetadata for fallback visibility
 */
export async function callLLM(
	prompt: string,
	provider: string,
	model?: string,
): Promise<string> {
	const result = await callLLMWithMetadata(prompt, provider, model);
	return result.response;
}
