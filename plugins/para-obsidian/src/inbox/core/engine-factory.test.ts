/**
 * Inbox Engine Factory Tests
 *
 * Tests for the createInboxEngine factory function and basic configuration.
 */

// IMPORTANT: Configure logtape BEFORE importing any modules that use logging
import { setupTestLogging } from "../../testing/logger";

await setupTestLogging();

import { afterEach, describe, expect, mock, test } from "bun:test";
import { createTestVault, useTestVaultCleanup } from "../../testing/utils";
import type { InboxEngineConfig } from "../types";
import { createInboxEngine } from "./engine";
import { createTestLLMClient } from "./llm/client";
import { createTestEngine } from "./testing";

// Track test vaults for cleanup
useTestVaultCleanup();

// Test constants - extracted for clarity and maintainability
const TEST_FOLDERS = {
	INBOX: "Inbox", // Custom inbox folder name for testing
	ATTACHMENTS: "Assets", // Custom attachments folder name for testing
	TEMPLATES: "Templates", // Standard templates folder
} as const;

const TEST_LLM_CONFIG = {
	PROVIDER: "sonnet" as const, // Using Claude Sonnet for testing
	MODEL: "claude-3-sonnet", // Specific model version
} as const;

const TEST_CONCURRENCY = {
	PDF_EXTRACTION: 3, // Parallel PDF processing limit
	LLM_CALLS: 2, // Concurrent LLM API calls limit
	FILE_IO: 5, // Concurrent file operations limit
} as const;

// Engine method names - ensures consistency across tests
const REQUIRED_ENGINE_METHODS = [
	"scan", // Scan inbox for new items
	"execute", // Execute approved suggestions
	"editWithPrompt", // Re-process with user guidance
	"challenge", // Request LLM justification
	"generateReport", // Create markdown summary
] as const;

// Add afterEach to restore mocks in case any future tests use them
afterEach(() => {
	mock.restore();
});

describe("createInboxEngine", () => {
	test("should create engine with config", () => {
		const vault = createTestVault();
		const testConfig: InboxEngineConfig = {
			vaultPath: vault,
			llmClient: createTestLLMClient(),
		};
		const engine = createInboxEngine(testConfig);
		expect(engine).toBeDefined();
	});

	test("should create engine with minimal config", () => {
		const vault = createTestVault();
		const engine = createTestEngine({ vaultPath: vault });
		expect(engine).toBeDefined();
	});

	test("should create engine with full config options", () => {
		const vault = createTestVault();
		const fullConfig: InboxEngineConfig = {
			vaultPath: vault,
			inboxFolder: TEST_FOLDERS.INBOX,
			attachmentsFolder: TEST_FOLDERS.ATTACHMENTS,
			templatesFolder: TEST_FOLDERS.TEMPLATES,
			llmProvider: TEST_LLM_CONFIG.PROVIDER,
			llmModel: TEST_LLM_CONFIG.MODEL,
			concurrency: {
				pdfExtraction: TEST_CONCURRENCY.PDF_EXTRACTION,
				llmCalls: TEST_CONCURRENCY.LLM_CALLS,
				fileIO: TEST_CONCURRENCY.FILE_IO,
			},
		};
		const engine = createInboxEngine(fullConfig);
		expect(engine).toBeDefined();
	});

	test("should have all required methods", () => {
		const vault = createTestVault();
		const engine = createTestEngine({ vaultPath: vault });

		// Verify each required method exists and is callable
		for (const methodName of REQUIRED_ENGINE_METHODS) {
			expect(typeof engine[methodName]).toBe("function");
		}
	});
});
