/**
 * Inbox Engine Factory Tests
 *
 * Tests for the createInboxEngine factory function and basic configuration.
 */

// IMPORTANT: Configure logtape BEFORE importing any modules that use logging
import { setupTestLogging } from "../../testing/logger";

await setupTestLogging();

import { describe, expect, test } from "bun:test";
import type { InboxEngineConfig } from "../types";
import { createInboxEngine } from "./engine";
import { createTestLLMClient } from "./llm/client";

/**
 * Create test engine with injected test LLM client for fast testing.
 * This avoids calling real LLM APIs during tests.
 */
function createTestEngine(config: Omit<InboxEngineConfig, "llmClient">) {
	return createInboxEngine({
		...config,
		llmClient: createTestLLMClient(),
	});
}

describe("createInboxEngine", () => {
	const testConfig: InboxEngineConfig = {
		vaultPath: "/test/vault",
		llmClient: createTestLLMClient(),
	};

	test("should create engine with config", () => {
		const engine = createInboxEngine(testConfig);
		expect(engine).toBeDefined();
	});

	test("should create engine with minimal config", () => {
		const engine = createTestEngine({ vaultPath: "/minimal" });
		expect(engine).toBeDefined();
	});

	test("should create engine with full config options", () => {
		const fullConfig: InboxEngineConfig = {
			vaultPath: "/test/vault",
			inboxFolder: "Inbox",
			attachmentsFolder: "Assets",
			templatesFolder: "Templates",
			llmProvider: "sonnet",
			llmModel: "claude-3-sonnet",
			concurrency: {
				pdfExtraction: 3,
				llmCalls: 2,
				fileIO: 5,
			},
		};
		const engine = createInboxEngine(fullConfig);
		expect(engine).toBeDefined();
	});

	test("should have all required methods", () => {
		const engine = createTestEngine({ vaultPath: "/test" });
		expect(typeof engine.scan).toBe("function");
		expect(typeof engine.execute).toBe("function");
		expect(typeof engine.editWithPrompt).toBe("function");
		expect(typeof engine.challenge).toBe("function");
		expect(typeof engine.generateReport).toBe("function");
	});
});
