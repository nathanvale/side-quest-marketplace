/**
 * LLM client for inbox processing.
 *
 * Provides a wrapper around the @sidequest/core/llm abstraction
 * with lazy loading to avoid circular dependencies.
 *
 * Includes automatic fallback from Claude to local Ollama when Claude fails.
 *
 * Timeout configuration (priority order, highest wins):
 * 1. PARA_LLM_TIMEOUT_MS env var
 * 2. llmTimeoutMs in config files (.paraobsidianrc, ~/.config/para-obsidian/config.json)
 * 3. Model-aware defaults (60s Claude, 10min Ollama)
 *
 * @module inbox/core/llm/client
 */

import { loadConfig } from "../../../config";
import { llmLogger } from "../../../shared/logger";
import type { OperationContext } from "../../shared/context";

// Lazy-loaded LLM module to avoid circular dependencies at module load time
let llmModule: typeof import("@sidequest/marketplace-core/llm") | null = null;

/** Default fallback model when Claude fails */
const DEFAULT_FALLBACK_MODEL = "qwen2.5:14b";

/**
 * Get timeout from PARA_LLM_TIMEOUT_MS env var.
 * @returns Timeout in ms, or undefined if not set
 */
function getEnvTimeoutMs(): number | undefined {
	const val = process.env.PARA_LLM_TIMEOUT_MS;
	if (!val) return undefined;
	const parsed = Number.parseInt(val, 10);
	return !Number.isNaN(parsed) && parsed > 0 ? parsed : undefined;
}

/**
 * Get timeout from config files (via loadConfig cascade).
 * @returns Timeout in ms, or undefined if not configured
 */
function getConfigTimeoutMs(): number | undefined {
	try {
		const config = loadConfig();
		return config.llmTimeoutMs;
	} catch {
		// Config not available (e.g., PARA_VAULT not set in tests)
		return undefined;
	}
}

/**
 * Resolve timeout for a model using priority cascade:
 * 1. PARA_LLM_TIMEOUT_MS env var (highest)
 * 2. llmTimeoutMs in config files
 * 3. Model-aware defaults (60s Claude, 10min Ollama)
 *
 * @param model - The LLM model to get timeout for
 * @param sessionCid - Optional session correlation ID for logging
 * @returns Timeout in milliseconds
 */
async function resolveTimeout(
	model: LLMModel,
	sessionCid?: string,
): Promise<number> {
	// Lazy load to get getDefaultTimeoutMs
	if (!llmModule) {
		llmModule = await import("@sidequest/marketplace-core/llm");
	}
	const { getDefaultTimeoutMs } = llmModule;

	const timeout =
		getEnvTimeoutMs() ?? getConfigTimeoutMs() ?? getDefaultTimeoutMs(model);

	if (llmLogger) {
		llmLogger.debug(
			`Resolved timeout for ${model}: ${timeout}ms${sessionCid ? ` ${sessionCid}` : ""}`,
			{
				event: "llm_timeout_resolved",
				model,
				timeout,
				...(sessionCid && { sessionCid }),
			},
		);
	}

	return timeout;
}

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
 * Environment variables:
 * - PARA_LLM_MODEL: Override the primary model (e.g., "qwen2.5:14b", "haiku", "sonnet")
 * - PARA_LLM_FALLBACK_MODEL: Override the fallback model when Claude fails
 *
 * @param prompt - The prompt to send to the LLM
 * @param provider - The LLM provider (e.g., "haiku", "sonnet")
 * @param model - Optional specific model override
 * @param context - Optional operation context with sessionCid
 * @returns LLMCallResult with response text and fallback metadata
 */
export async function callLLMWithMetadata(
	prompt: string,
	provider: string,
	model?: string,
	context?: OperationContext,
): Promise<LLMCallResult> {
	// Lazy load once, then reuse cached module
	if (!llmModule) {
		llmModule = await import("@sidequest/marketplace-core/llm");
	}
	const { callModel } = llmModule;

	const { sessionCid } = context ?? {};

	// Priority: env var > explicit model param > provider-based default
	// Cast to satisfy the type - callModel will validate
	const resolvedModel = (process.env.PARA_LLM_MODEL ??
		model ??
		(provider === "haiku" ? "haiku" : "sonnet")) as LLMModel;

	// Resolve timeout using config cascade
	const timeoutMs = await resolveTimeout(resolvedModel, sessionCid);

	// If using Claude, try it first with fallback to Ollama
	if (isClaudeModel(resolvedModel)) {
		try {
			if (llmLogger) {
				llmLogger.debug(
					`Calling Claude model=${resolvedModel}${sessionCid ? ` ${sessionCid}` : ""}`,
					{
						event: "llm_call_started",
						model: resolvedModel,
						provider,
						...(sessionCid && { sessionCid }),
					},
				);
			}

			const response = await callModel({
				model: resolvedModel,
				prompt,
				timeoutMs,
			});

			if (llmLogger) {
				llmLogger.debug(
					`Claude response received model=${resolvedModel}${sessionCid ? ` ${sessionCid}` : ""}`,
					{
						event: "llm_call_completed",
						model: resolvedModel,
						...(sessionCid && { sessionCid }),
					},
				);
			}

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
				llmLogger.warn(
					`Claude (${resolvedModel}) failed: ${errorMsg}. Falling back to ${fallbackModel}${sessionCid ? ` ${sessionCid}` : ""}`,
					{
						event: "llm_fallback_triggered",
						primaryModel: resolvedModel,
						fallbackModel,
						error: errorMsg,
						...(sessionCid && { sessionCid }),
					},
				);
			}

			// Resolve timeout for fallback model (critical fix: was using 60s default!)
			const fallbackTimeoutMs = await resolveTimeout(fallbackModel, sessionCid);

			try {
				const response = await callModel({
					model: fallbackModel,
					prompt,
					timeoutMs: fallbackTimeoutMs,
				});

				// Log successful fallback
				if (llmLogger) {
					llmLogger.info(
						`Fallback to ${fallbackModel} succeeded${sessionCid ? ` ${sessionCid}` : ""}`,
						{
							event: "llm_fallback_succeeded",
							fallbackModel,
							...(sessionCid && { sessionCid }),
						},
					);
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
					llmLogger.error(
						`Both Claude and fallback failed: claude=${errorMsg} fallback=${fallbackMsg}${sessionCid ? ` ${sessionCid}` : ""}`,
						{
							event: "llm_fallback_failed",
							primaryModel: resolvedModel,
							fallbackModel,
							primaryError: errorMsg,
							fallbackError: fallbackMsg,
							...(sessionCid && { sessionCid }),
						},
					);
				}

				// Both failed - throw combined error
				throw new Error(
					`Claude failed: ${errorMsg}. Fallback to ${fallbackModel} also failed: ${fallbackMsg}`,
				);
			}
		}
	}

	// Non-Claude model (Ollama) - call directly with resolved timeout
	if (llmLogger) {
		llmLogger.debug(
			`Calling Ollama model=${resolvedModel}${sessionCid ? ` ${sessionCid}` : ""}`,
			{
				event: "llm_call_started",
				model: resolvedModel,
				provider,
				...(sessionCid && { sessionCid }),
			},
		);
	}

	const response = await callModel({
		model: resolvedModel,
		prompt,
		timeoutMs,
	});

	if (llmLogger) {
		llmLogger.debug(
			`Ollama response received model=${resolvedModel}${sessionCid ? ` ${sessionCid}` : ""}`,
			{
				event: "llm_call_completed",
				model: resolvedModel,
				...(sessionCid && { sessionCid }),
			},
		);
	}

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
 * @param context - Optional operation context with sessionCid
 * @returns The LLM response text
 * @deprecated Use callLLMWithMetadata for fallback visibility
 */
export async function callLLM(
	prompt: string,
	provider: string,
	model?: string,
	context?: OperationContext,
): Promise<string> {
	const result = await callLLMWithMetadata(prompt, provider, model, context);
	return result.response;
}
