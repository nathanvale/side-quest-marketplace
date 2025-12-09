/**
 * LLM model routing and execution.
 *
 * This module provides utilities for routing LLM calls to different providers:
 * - Claude headless CLI (Sonnet, Haiku)
 * - Ollama API (Qwen models)
 *
 * @module llm/model-router
 */

import { spawnAndCollect } from "../spawn/index.js";

/** Claude model identifiers */
export type ClaudeModel = "sonnet" | "haiku";

/** Ollama model identifiers */
export type OllamaModel =
	| "qwen:7b"
	| "qwen:14b"
	| "qwen2.5:14b"
	| "qwen-coder:17b"
	| "qwen-coder:14b";

/** All supported LLM models */
export type LLMModel = ClaudeModel | OllamaModel;

/** Default Ollama API URL */
export const DEFAULT_OLLAMA_URL = "http://localhost:11434";

/** Default timeout for LLM calls in milliseconds (60 seconds) */
export const DEFAULT_LLM_TIMEOUT_MS = 60000;

/**
 * Options for calling an LLM model.
 */
export interface CallModelOptions {
	/** The model to use */
	model: LLMModel;
	/** The prompt to send */
	prompt: string;
	/** Ollama API URL (only used for Ollama models) */
	ollamaUrl?: string;
	/** Timeout in milliseconds (default: 60000ms / 60 seconds) */
	timeoutMs?: number;
}

/**
 * Determine if a model is a Claude model.
 *
 * @param model - Model identifier
 * @returns True if model is a Claude model
 */
export function isClaudeModel(model: LLMModel): model is ClaudeModel {
	return model === "sonnet" || model === "haiku";
}

/**
 * Determine if a model is an Ollama model.
 *
 * @param model - Model identifier
 * @returns True if model is an Ollama model
 */
export function isOllamaModel(model: LLMModel): model is OllamaModel {
	return (
		model === "qwen:7b" ||
		model === "qwen:14b" ||
		model === "qwen2.5:14b" ||
		model === "qwen-coder:17b" ||
		model === "qwen-coder:14b"
	);
}

/**
 * Validate a model against allowed models list.
 *
 * @param model - Model to validate
 * @param allowedModels - List of allowed models
 * @throws Error if model is not in allowed list
 */
export function validateModel(
	model: LLMModel,
	allowedModels: readonly LLMModel[],
): void {
	if (!allowedModels.includes(model)) {
		throw new Error(
			`Model "${model}" not allowed. Allowed models: ${allowedModels.join(", ")}`,
		);
	}
}

/**
 * Call Claude headless CLI.
 *
 * @param prompt - The prompt to send
 * @param model - Claude model identifier (sonnet or haiku)
 * @param timeoutMs - Timeout in milliseconds (default: 60000ms / 60 seconds)
 * @returns The generated response text
 * @throws Error if Claude CLI fails, times out, or is not installed
 */
export async function callClaudeHeadless(
	prompt: string,
	model: ClaudeModel,
	timeoutMs: number = DEFAULT_LLM_TIMEOUT_MS,
): Promise<string> {
	try {
		// Create a timeout promise
		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(() => {
				reject(
					new Error(
						`Claude CLI call timed out after ${timeoutMs}ms. Try using --model haiku for faster responses.`,
					),
				);
			}, timeoutMs);
		});

		// Race between the actual call and timeout
		const result = await Promise.race([
			spawnAndCollect(
				[
					"claude",
					"-p",
					prompt,
					"--output-format",
					"json",
					"--model",
					model,
					"--tools",
					'""',
				],
				{ cwd: process.cwd() },
			),
			timeoutPromise,
		]);

		if (result.exitCode !== 0) {
			throw new Error(
				`Claude CLI failed with exit code ${result.exitCode}: ${result.stderr}`,
			);
		}

		// Parse the JSON output and extract the result field
		// Claude headless returns: {"type":"result","result":"...","..."}
		try {
			const output = JSON.parse(result.stdout) as {
				type: string;
				result: string;
				is_error?: boolean;
			};

			if (output.is_error) {
				throw new Error(`Claude returned error: ${output.result}`);
			}

			return output.result;
		} catch (parseError) {
			// If parsing fails, return raw output (backwards compatibility)
			if (parseError instanceof SyntaxError) {
				return result.stdout;
			}
			throw parseError;
		}
	} catch (error) {
		if (error instanceof Error && error.message.includes("command not found")) {
			throw new Error(
				"Claude CLI not found. Install it from: https://claude.ai/download",
			);
		}
		throw error;
	}
}

/**
 * Call Ollama's generate API with a prompt.
 *
 * Uses JSON format mode for structured output.
 *
 * @param prompt - The prompt to send
 * @param model - Ollama model identifier
 * @param ollamaUrl - Ollama API URL (default: http://localhost:11434)
 * @param timeoutMs - Timeout in milliseconds (default: 60000ms / 60 seconds)
 * @returns The generated response text
 * @throws Error if Ollama is not running, model not found, or call times out
 */
export async function callOllamaModel(
	prompt: string,
	model: OllamaModel,
	ollamaUrl: string = DEFAULT_OLLAMA_URL,
	timeoutMs: number = DEFAULT_LLM_TIMEOUT_MS,
): Promise<string> {
	let response: Response;

	try {
		// Create AbortController for timeout
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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
				signal: controller.signal,
			});
		} finally {
			clearTimeout(timeoutId);
		}
	} catch (error) {
		if (error instanceof Error) {
			if (error.name === "AbortError") {
				throw new Error(
					`Ollama call timed out after ${timeoutMs}ms. Try using a smaller model or increasing timeout.`,
				);
			}
			if (error.message.includes("ECONNREFUSED")) {
				throw new Error(`Ollama is not running. Start it with: ollama serve`);
			}
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
 * Call an LLM model, routing to the appropriate provider.
 *
 * @param options - Call options including model and prompt
 * @returns The generated response text
 * @throws Error if model is unknown or call fails
 */
export async function callModel(options: CallModelOptions): Promise<string> {
	const { model, prompt, ollamaUrl, timeoutMs } = options;

	if (isClaudeModel(model)) {
		return callClaudeHeadless(prompt, model, timeoutMs);
	}

	if (isOllamaModel(model)) {
		return callOllamaModel(prompt, model, ollamaUrl, timeoutMs);
	}

	throw new Error(`Unknown model: ${model}`);
}
