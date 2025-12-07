/**
 * LLM integration utilities for SideQuest plugins.
 *
 * This module provides shared utilities for:
 * - Model routing (Claude headless CLI, Ollama API)
 * - Response parsing
 * - Constraint building for deterministic extraction
 * - Prompt construction
 *
 * @module llm
 */

export type {
	ConstraintSet,
	FieldConstraint,
	OutputSchemaConstraint,
	VaultContext,
	VaultContextConstraint,
} from "./constraints.js";
// Export constraint functions
export {
	buildConstraintSet,
	formatConstraintSet,
	formatFieldConstraints,
	formatOutputSchema,
	formatVaultContext,
} from "./constraints.js";
export type {
	CallModelOptions,
	ClaudeModel,
	LLMModel,
	OllamaModel,
} from "./model-router.js";
// Export model router functions
export {
	callClaudeHeadless,
	callModel,
	callOllamaModel,
	DEFAULT_OLLAMA_URL,
	isClaudeModel,
	isOllamaModel,
	validateModel,
} from "./model-router.js";
export type { PromptExample, PromptTemplate } from "./prompt-builder.js";
// Export prompt builder functions
export {
	buildConstraintSection,
	buildCriticalRules,
	buildExamplesSection,
	buildStructuredPrompt,
	DEFAULT_CRITICAL_RULES,
} from "./prompt-builder.js";
export type { ExtractionResult } from "./response-parser.js";

// Export response parser
export { parseOllamaResponse } from "./response-parser.js";
// Export types
export type {
	FieldRule,
	FrontmatterRules,
	TemplateField,
	TemplateInfo,
} from "./types.js";
