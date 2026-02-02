/**
 * Tests for testing utilities
 *
 * Demonstrates usage of new test helper functions.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { pathExistsSync } from "@side-quest/core/fs";
import {
	createTestContext,
	createTestSuggestion,
	createTestVault,
	useTestVaultCleanup,
	withTempVault,
	writeVaultFile,
} from "./utils";

describe("withTempVault", () => {
	test("creates vault, runs function, and cleans up", async () => {
		let capturedVault = "";

		await withTempVault(async (vault, config) => {
			capturedVault = vault;

			// Vault should exist during execution
			expect(pathExistsSync(vault)).toBe(true);

			// Config should be loaded
			expect(config.vault).toBe(vault);

			// Should be able to write files
			writeVaultFile(vault, "test.md", "# Test");
			const testPath = join(vault, "test.md");
			expect(pathExistsSync(testPath)).toBe(true);
		});

		// Vault should be cleaned up after function completes
		expect(pathExistsSync(capturedVault)).toBe(false);
	});

	test("restores PARA_VAULT environment variable", async () => {
		const originalEnv = process.env.PARA_VAULT;

		await withTempVault(async (vault) => {
			// PARA_VAULT should be set to temp vault during execution
			expect(process.env.PARA_VAULT).toBe(vault);
		});

		// PARA_VAULT should be restored after completion
		expect(process.env.PARA_VAULT).toBe(originalEnv);
	});

	test("propagates errors from test function", async () => {
		await expect(
			withTempVault(async () => {
				throw new Error("Test error");
			}),
		).rejects.toThrow("Test error");
	});

	test("cleans up even when test function throws", async () => {
		let capturedVault = "";

		try {
			await withTempVault(async (vault) => {
				capturedVault = vault;
				throw new Error("Test error");
			});
		} catch {
			// Expected
		}

		// Vault should still be cleaned up
		expect(pathExistsSync(capturedVault)).toBe(false);
	});
});

describe("createTestContext", () => {
	const { trackVault, getAfterEachHook } = useTestVaultCleanup();
	afterEach(getAfterEachHook());

	/**
	 * Helper to create and track a test vault in one call
	 */
	const setupTest = () => {
		const vault = createTestVault();
		trackVault(vault);
		return vault;
	};

	test("creates context with sensible defaults", () => {
		const vault = setupTest();

		const context = createTestContext(vault);

		expect(context.vaultPath).toBe(vault);
		expect(context.inboxFolder).toBe("00 Inbox");
		expect(context.attachmentsFolder).toBe("Attachments");
		expect(context.templatesFolder).toBe("Templates");
		expect(context.registry).toBeDefined();
		expect(context.cid).toMatch(/^test-cid-\d+$/);
		expect(context.sessionCid).toMatch(/^test-session-\d+$/);
	});

	test("allows overriding defaults", () => {
		const vault = setupTest();

		const context = createTestContext(vault, {
			inboxFolder: "Custom Inbox",
			cid: "custom-cid",
		});

		expect(context.inboxFolder).toBe("Custom Inbox");
		expect(context.cid).toBe("custom-cid");
		expect(context.attachmentsFolder).toBe("Attachments"); // Default preserved
	});
});

describe("createTestSuggestion", () => {
	test("creates suggestion with sensible defaults", () => {
		const suggestion = createTestSuggestion();

		expect(suggestion.action).toBe("create-note");
		expect(suggestion.source).toBe("00 Inbox/test-document.pdf");
		expect(suggestion.processor).toBe("attachments");
		expect(suggestion.confidence).toBe("high");
		expect(suggestion.suggestedTitle).toBe("Test Document");
		expect(suggestion.suggestedNoteType).toBe("resource");
		expect(suggestion.detectionSource).toBe("heuristic");
		// ID format is UUID v4 (8-4-4-4-12 hex pattern)
		expect(suggestion.id).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
		);
	});

	test("allows overriding defaults", () => {
		const suggestion = createTestSuggestion({
			suggestedTitle: "Custom Title",
			suggestedNoteType: "project",
			confidence: "medium",
		});

		expect(suggestion.suggestedTitle).toBe("Custom Title");
		expect(suggestion.suggestedNoteType).toBe("project");
		expect(suggestion.confidence).toBe("medium");
		expect(suggestion.source).toBe("00 Inbox/test-document.pdf"); // Default preserved
	});

	test("generates unique IDs for each suggestion", () => {
		const suggestion1 = createTestSuggestion();
		const suggestion2 = createTestSuggestion();

		expect(suggestion1.id).not.toBe(suggestion2.id);
	});
});

describe("useTestVaultCleanup", () => {
	/**
	 * Helper to create and track a test vault in one call
	 */
	const setupTestVault = (cleanup: { trackVault: (vault: string) => void }) => {
		const vault = createTestVault();
		cleanup.trackVault(vault);
		return vault;
	};

	test("tracks and cleans up multiple vaults", () => {
		const { trackVault, getAfterEachHook } = useTestVaultCleanup();

		// Create and track vaults
		const vault1 = setupTestVault({ trackVault });

		const vault2 = setupTestVault({ trackVault });

		// Both should exist
		expect(pathExistsSync(vault1)).toBe(true);
		expect(pathExistsSync(vault2)).toBe(true);

		// Run cleanup hook
		const cleanup = getAfterEachHook();
		cleanup();

		// Both should be cleaned up
		expect(pathExistsSync(vault1)).toBe(false);
		expect(pathExistsSync(vault2)).toBe(false);
	});

	test("restores PARA_VAULT after cleanup", () => {
		const originalEnv = process.env.PARA_VAULT;
		const { trackVault, getAfterEachHook } = useTestVaultCleanup();

		const vault = setupTestVault({ trackVault });

		// Modify PARA_VAULT
		process.env.PARA_VAULT = vault;

		// Run cleanup
		const cleanup = getAfterEachHook();
		cleanup();

		// Should be restored (handle both defined and undefined cases)
		if (originalEnv === undefined) {
			expect(process.env.PARA_VAULT).toBeUndefined();
		} else {
			expect(process.env.PARA_VAULT).toBe(originalEnv);
		}
	});
});

describe("useTestVaultCleanup integration", () => {
	const { trackVault, getAfterEachHook } = useTestVaultCleanup();
	afterEach(getAfterEachHook());

	/**
	 * Helper to create and track a test vault in one call
	 */
	const setupTest = () => {
		const vault = createTestVault();
		trackVault(vault);
		return vault;
	};

	test("first test creates vault", () => {
		const vault = setupTest();

		writeVaultFile(vault, "test1.md", "# Test 1");
		expect(pathExistsSync(join(vault, "test1.md"))).toBe(true);
	});

	test("second test creates different vault", () => {
		const vault = setupTest();

		writeVaultFile(vault, "test2.md", "# Test 2");
		expect(pathExistsSync(join(vault, "test2.md"))).toBe(true);
	});

	// Each test's vault is cleaned up automatically by afterEach
});
