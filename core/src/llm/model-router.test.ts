/**
 * Tests for LLM model router.
 *
 * @module llm/model-router.test
 */

import { describe, expect, test } from "bun:test";
import {
	DEFAULT_CLAUDE_TIMEOUT_MS,
	DEFAULT_OLLAMA_TIMEOUT_MS,
	getDefaultTimeoutMs,
	isClaudeModel,
	isOllamaModel,
} from "./model-router";

describe("getDefaultTimeoutMs", () => {
	test("returns 60s for Claude sonnet", () => {
		expect(getDefaultTimeoutMs("sonnet")).toBe(DEFAULT_CLAUDE_TIMEOUT_MS);
		expect(getDefaultTimeoutMs("sonnet")).toBe(60_000);
	});

	test("returns 60s for Claude haiku", () => {
		expect(getDefaultTimeoutMs("haiku")).toBe(DEFAULT_CLAUDE_TIMEOUT_MS);
		expect(getDefaultTimeoutMs("haiku")).toBe(60_000);
	});

	test("returns 10min for Ollama qwen models", () => {
		expect(getDefaultTimeoutMs("qwen:7b")).toBe(DEFAULT_OLLAMA_TIMEOUT_MS);
		expect(getDefaultTimeoutMs("qwen:14b")).toBe(DEFAULT_OLLAMA_TIMEOUT_MS);
		expect(getDefaultTimeoutMs("qwen2.5:14b")).toBe(DEFAULT_OLLAMA_TIMEOUT_MS);
		expect(getDefaultTimeoutMs("qwen-coder:17b")).toBe(
			DEFAULT_OLLAMA_TIMEOUT_MS,
		);
		expect(getDefaultTimeoutMs("qwen-coder:14b")).toBe(
			DEFAULT_OLLAMA_TIMEOUT_MS,
		);
	});

	test("Ollama timeout is 10 minutes (600_000ms)", () => {
		expect(DEFAULT_OLLAMA_TIMEOUT_MS).toBe(600_000);
	});

	test("Claude timeout is 60 seconds (60_000ms)", () => {
		expect(DEFAULT_CLAUDE_TIMEOUT_MS).toBe(60_000);
	});
});

describe("isClaudeModel", () => {
	test("returns true for Claude models", () => {
		expect(isClaudeModel("sonnet")).toBe(true);
		expect(isClaudeModel("haiku")).toBe(true);
	});

	test("returns false for Ollama models", () => {
		expect(isClaudeModel("qwen:7b")).toBe(false);
		expect(isClaudeModel("qwen:14b")).toBe(false);
		expect(isClaudeModel("qwen2.5:14b")).toBe(false);
		expect(isClaudeModel("qwen-coder:17b")).toBe(false);
		expect(isClaudeModel("qwen-coder:14b")).toBe(false);
	});
});

describe("isOllamaModel", () => {
	test("returns true for Ollama models", () => {
		expect(isOllamaModel("qwen:7b")).toBe(true);
		expect(isOllamaModel("qwen:14b")).toBe(true);
		expect(isOllamaModel("qwen2.5:14b")).toBe(true);
		expect(isOllamaModel("qwen-coder:17b")).toBe(true);
		expect(isOllamaModel("qwen-coder:14b")).toBe(true);
	});

	test("returns false for Claude models", () => {
		expect(isOllamaModel("sonnet")).toBe(false);
		expect(isOllamaModel("haiku")).toBe(false);
	});
});
