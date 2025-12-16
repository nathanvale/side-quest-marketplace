/**
 * Integration test harness for inbox processing.
 *
 * Wraps the InboxEngine with test utilities for LLM injection, vault management,
 * and cleanup. Provides a simplified API for setting up integration tests.
 *
 * Key features:
 * - Automatic vault creation with git initialization
 * - LLM response injection for testing classification logic
 * - Environment variable management (save/restore PARA_VAULT)
 * - File tracking for test assertions
 * - Cleanup utilities to ensure no test pollution
 *
 * @example
 * ```typescript
 * import { createTestHarness } from "./helpers/test-harness";
 *
 * const harness = createTestHarness({
 *   llmResponse: {
 *     documentType: "invoice",
 *     confidence: 0.95,
 *     suggestedArea: "Finance"
 *   }
 * });
 *
 * await harness.addToInbox("test-invoice.pdf", "INVOICE\nAmount: $100");
 * const suggestions = await harness.scan();
 * const results = await harness.execute();
 *
 * harness.cleanup();
 * ```
 *
 * @module test/integration/helpers/test-harness
 */

import { join } from "node:path";
import { createInboxEngine } from "../../../src/inbox";
import type { DocumentTypeResult } from "../../../src/inbox/classify/llm-classifier";
import type {
	ExecutionResult,
	InboxEngine,
	InboxEngineConfig,
	InboxSuggestion,
	SuggestionId,
} from "../../../src/inbox/types";
import {
	cleanupTestVault,
	createTestVault,
	writeVaultFile,
} from "../../../src/testing/utils";

/**
 * Options for creating a test harness.
 */
export interface TestHarnessOptions {
	/**
	 * Classifier to use for detection.
	 * If not provided, uses default classifiers.
	 */
	readonly classifier?: string;

	/**
	 * Mock LLM response to return during classification.
	 * If an Error is provided, the LLM call will throw that error.
	 * If not provided, uses real LLM calls (requires Ollama).
	 */
	readonly llmResponse?: DocumentTypeResult | Error;

	/**
	 * Auto-commit vault changes after execution.
	 * @default true
	 */
	readonly autoCommit?: boolean;

	/**
	 * LLM provider to use for real LLM calls.
	 * @default "haiku"
	 */
	readonly llmProvider?: "haiku" | "sonnet";

	/**
	 * Specific LLM model to use.
	 * Overrides llmProvider if provided.
	 */
	readonly llmModel?: string;

	/**
	 * Whether to use real LLM calls instead of injecting responses.
	 * @default false (uses injected responses if llmResponse provided)
	 */
	readonly useLlm?: boolean;

	/**
	 * Optional vault path to reuse.
	 * If provided, skips vault creation and uses this path.
	 * Useful for sharing vaults between multiple test harnesses.
	 */
	readonly vault?: string;
}

/**
 * Integration test harness for inbox processing.
 *
 * Provides methods to simulate the complete inbox workflow:
 * 1. Add files to inbox
 * 2. Scan inbox to generate suggestions
 * 3. Execute suggestions to create notes
 * 4. Cleanup test artifacts
 */
export interface IntegrationTestHarness {
	/**
	 * Absolute path to the test vault.
	 * Safe to use in assertions and file operations.
	 */
	readonly vault: string;

	/**
	 * Original PARA_VAULT environment variable value.
	 * Restored on cleanup.
	 */
	readonly originalEnv: string | undefined;

	/**
	 * Scan the inbox and generate suggestions.
	 *
	 * Uses the injected LLM response if configured.
	 * Otherwise uses real LLM calls (requires Ollama).
	 *
	 * @returns Array of suggestions for inbox items
	 */
	scan(): Promise<InboxSuggestion[]>;

	/**
	 * Execute suggestions to create notes and move files.
	 *
	 * @param ids - Optional array of suggestion IDs to execute.
	 *              If omitted, executes all suggestions from the last scan.
	 * @returns Array of execution results
	 */
	execute(ids?: SuggestionId[]): Promise<ExecutionResult[]>;

	/**
	 * Add a file to the inbox for testing.
	 *
	 * Creates the file in the "00 Inbox" folder with the given content.
	 *
	 * @param filename - Name of the file (e.g., "test.pdf", "note.md")
	 * @param content - File content as string
	 */
	addToInbox(filename: string, content: string): Promise<void>;

	/**
	 * Set or update the mock LLM response.
	 *
	 * Useful for testing different classification scenarios
	 * without recreating the entire harness.
	 *
	 * @param response - New LLM response or Error to inject
	 */
	setLLMResponse(response: DocumentTypeResult | Error): void;

	/**
	 * Clean up test artifacts and restore environment.
	 *
	 * - Removes vault directory (unless vault was provided externally)
	 * - Restores PARA_VAULT environment variable
	 */
	cleanup(): void;
}

/**
 * Create an integration test harness for inbox processing.
 *
 * Automatically sets up:
 * - Temporary vault with git initialization
 * - PARA folder structure (Projects, Areas, Resources, Archives)
 * - Inbox folder (00 Inbox)
 * - Templates directory
 * - LLM client injection (if llmResponse provided)
 *
 * @param options - Harness configuration options
 * @returns Configured test harness ready for use
 *
 * @example
 * ```typescript
 * // Basic usage with mock LLM
 * const harness = createTestHarness({
 *   llmResponse: {
 *     documentType: "invoice",
 *     confidence: 0.95,
 *     suggestedArea: "Finance"
 *   }
 * });
 *
 * // Use real LLM (requires Ollama)
 * const realLlmHarness = createTestHarness({
 *   useLlm: true,
 *   llmProvider: "haiku"
 * });
 *
 * // Share vault between tests
 * const sharedVault = createTestVault({ gitInit: true });
 * const harness1 = createTestHarness({ vault: sharedVault });
 * const harness2 = createTestHarness({ vault: sharedVault });
 * ```
 */
export function createTestHarness(
	options: TestHarnessOptions = {},
): IntegrationTestHarness {
	// Save original environment variable
	const originalEnv = process.env.PARA_VAULT;

	// Create or reuse vault
	const vaultPath = options.vault ?? createTestVault({ gitInit: true });
	const ownsVault = !options.vault; // Only cleanup if we created it

	// Set PARA_VAULT for the engine
	process.env.PARA_VAULT = vaultPath;

	// Create PARA folder structure
	const folders = [
		"00 Inbox",
		"01 Projects",
		"02 Areas",
		"03 Resources",
		"04 Archives",
		"Templates",
		"Attachments",
	];

	for (const folder of folders) {
		writeVaultFile(vaultPath, `${folder}/.gitkeep`, "");
	}

	// Create minimal template files for common note types
	// These templates match the classifiers defined in src/inbox/classify/classifiers/definitions/
	const templates: Record<string, string> = {
		bookmark: `---
type: bookmark
url: <% tp.system.prompt("URL") %>
title: <% tp.system.prompt("Title") %>
clipped: <% tp.date.now("YYYY-MM-DD") %>
para: <% tp.system.prompt("PARA (Projects/Areas/Resources/Archives)") %>
template_version: 1
category: <% tp.system.prompt("Category (optional)", "") %>
author: <% tp.system.prompt("Author (optional)", "") %>
published: <% tp.system.prompt("Published date (YYYY-MM-DD, optional)", "") %>
tags: <% tp.system.prompt("Tags (optional)", "") %>
notes: <% tp.system.prompt("Notes (optional)", "") %>
---
# <% tp.frontmatter.title %>

## Notes

## Highlights
`,
		invoice: `---
type: invoice
title: <% tp.system.prompt("Invoice title") %>
created: <% tp.date.now("YYYY-MM-DD") %>
invoice_date: <% tp.system.prompt("Invoice date (YYYY-MM-DD)") %>
provider: <% tp.system.prompt("Provider name") %>
amount: <% tp.system.prompt("Amount") %>
currency: <% tp.system.prompt("Currency (AUD/USD/EUR)", "AUD") %>
status: <% tp.system.prompt("Status (unpaid/paid/pending)", "unpaid") %>
due_date: <% tp.system.prompt("Due date (YYYY-MM-DD, optional)", "") %>
payment_date: <% tp.system.prompt("Payment date (YYYY-MM-DD, optional)", "") %>
area: <% tp.system.prompt("Area (leave empty if using project)", "") %>
project: <% tp.system.prompt("Project (leave empty if using area)", "") %>
template_version: 1
tags:
  - invoice
---
# <% tp.frontmatter.title %>

## Details

## Notes
`,
		booking: `---
type: booking
title: <% tp.system.prompt("Booking title") %>
created: <% tp.date.now("YYYY-MM-DD") %>
booking_type: <% tp.system.prompt("Booking type (accommodation/flight/activity/transport/dining)") %>
status: <% tp.system.prompt("Status (pending/confirmed/cancelled)", "pending") %>
project: <% tp.system.prompt("Project (optional)", "") %>
booking_ref: <% tp.system.prompt("Booking reference (optional)", "") %>
provider: <% tp.system.prompt("Provider (optional)", "") %>
date: <% tp.system.prompt("Date (YYYY-MM-DD)") %>
time: <% tp.system.prompt("Time (optional)", "") %>
end_date: <% tp.system.prompt("End date (YYYY-MM-DD, optional)", "") %>
cost: <% tp.system.prompt("Cost") %>
currency: <% tp.system.prompt("Currency (AUD/USD/EUR)", "AUD") %>
payment_status: <% tp.system.prompt("Payment status (pending/partial/paid/refunded/cancelled)", "pending") %>
template_version: 3
tags:
  - booking
---
# <% tp.frontmatter.title %>

## Details

## Notes
`,
	};

	// Write template files
	for (const [name, content] of Object.entries(templates)) {
		writeVaultFile(vaultPath, `Templates/${name}.md`, content);
	}

	// Commit the initial structure to avoid git guard errors
	Bun.spawnSync(["git", "add", "."], {
		cwd: vaultPath,
		stdout: "ignore",
		stderr: "ignore",
	});
	Bun.spawnSync(["git", "commit", "-m", "chore: initialize vault structure"], {
		cwd: vaultPath,
		stdout: "ignore",
		stderr: "ignore",
	});

	// Track suggestions from last scan
	let lastSuggestions: InboxSuggestion[] = [];

	// LLM response injection state (mutable for setLLMResponse)
	let llmResponse = options.llmResponse;

	/**
	 * Create LLM client that injects the configured response.
	 * Returns a function matching the LLMClientFunction signature.
	 */
	function createInjectedLLMClient(): (
		prompt: string,
		provider: string,
		model?: string,
	) => Promise<string> {
		return async (_prompt: string, _provider: string, _model?: string) => {
			// If llmResponse is an Error, throw it
			if (llmResponse instanceof Error) {
				throw llmResponse;
			}

			// If no llmResponse, return generic response
			if (!llmResponse) {
				return JSON.stringify({
					documentType: "generic",
					confidence: 0.5,
					suggestedArea: null,
					suggestedProject: null,
					extractedFields: null,
					reasoning: "Test harness: no LLM response configured",
				});
			}

			// Return the configured response as JSON
			return JSON.stringify(llmResponse);
		};
	}

	// Create engine configuration
	// IMPORTANT: Always inject mock LLM client by default to prevent spawning
	// real Claude CLI processes during tests. The injected client reads from
	// the mutable llmResponse variable, so setLLMResponse() works correctly.
	// Only use real LLM if explicitly requested via useLlm: true.
	const engineConfig: InboxEngineConfig = {
		vaultPath,
		inboxFolder: "00 Inbox",
		attachmentsFolder: "Attachments",
		templatesFolder: "Templates",
		llmProvider: options.llmProvider ?? "haiku",
		llmModel: options.llmModel,
		// Always inject mock LLM client unless useLlm is explicitly true
		// This prevents zombie claude processes from spawning during tests
		llmClient: options.useLlm ? undefined : createInjectedLLMClient(),
	};

	// Create the inbox engine
	const engine: InboxEngine = createInboxEngine(engineConfig);

	// Return the harness interface
	return {
		vault: vaultPath,
		originalEnv,

		async scan(): Promise<InboxSuggestion[]> {
			lastSuggestions = await engine.scan();
			return lastSuggestions;
		},

		async execute(ids?: SuggestionId[]): Promise<ExecutionResult[]> {
			// If no IDs provided, execute all suggestions from last scan
			const idsToExecute =
				ids ?? lastSuggestions.map((suggestion) => suggestion.id);
			return await engine.execute(idsToExecute);
		},

		async addToInbox(filename: string, content: string): Promise<void> {
			const inboxPath = join("00 Inbox", filename);
			writeVaultFile(vaultPath, inboxPath, content);
		},

		setLLMResponse(response: DocumentTypeResult | Error): void {
			// Update the mutable llmResponse variable that the injected LLM client reads.
			// This works because createInjectedLLMClient() captures llmResponse by reference.
			llmResponse = response;
		},

		cleanup(): void {
			// Restore environment variable
			if (originalEnv === undefined) {
				delete process.env.PARA_VAULT;
			} else {
				process.env.PARA_VAULT = originalEnv;
			}

			// Only cleanup vault if we created it
			if (ownsVault) {
				cleanupTestVault(vaultPath);
			}
		},
	};
}
