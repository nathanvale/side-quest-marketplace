import { describe, expect, test } from "bun:test";
import { createTestSuggestion as baseCreateTestSuggestion } from "../testing/utils";
import {
	createSuggestionId,
	type InboxEngineConfig,
	type InboxSuggestion,
	isCreateNoteSuggestion,
	isRoutableSuggestion,
	isValidSuggestionId,
	validateInboxEngineConfig,
} from "./types";

// Local test helper that allows creating any suggestion type
function createTestSuggestion(
	overrides: Partial<InboxSuggestion> = {},
): InboxSuggestion {
	const base = baseCreateTestSuggestion();
	return { ...base, ...overrides } as InboxSuggestion;
}

describe("inbox/types", () => {
	describe("createSuggestionId", () => {
		test("should generate valid UUID v4 when called without args", () => {
			const id = createSuggestionId();
			expect(isValidSuggestionId(id)).toBe(true);
			expect(id).toMatch(
				/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
			);
		});

		test("should accept valid UUID v4 strings", () => {
			const validUuid = "abc12300-0000-4000-8000-000000000001";
			const id = createSuggestionId(validUuid);
			expect(id as string).toBe(validUuid);
		});

		test("should reject invalid UUID formats", () => {
			expect(() => createSuggestionId("not-a-uuid")).toThrow(
				"Invalid suggestion ID format",
			);
			expect(() =>
				createSuggestionId("12345678-1234-1234-1234-123456789012"),
			).toThrow("Invalid suggestion ID format");
			expect(() => createSuggestionId("")).toThrow(
				"Invalid suggestion ID format",
			);
		});

		test("should generate unique IDs on each call", () => {
			const id1 = createSuggestionId();
			const id2 = createSuggestionId();
			expect(id1).not.toBe(id2);
		});
	});

	describe("isValidSuggestionId", () => {
		test("should validate UUID v4 format", () => {
			expect(isValidSuggestionId("abc12300-0000-4000-8000-000000000001")).toBe(
				true,
			);
			expect(isValidSuggestionId("11111111-2222-4333-8444-555555555555")).toBe(
				true,
			);
		});

		test("should reject non-UUID v4 formats", () => {
			expect(isValidSuggestionId("not-a-uuid")).toBe(false);
			expect(isValidSuggestionId("12345678-1234-1234-1234-123456789012")).toBe(
				false,
			);
			expect(isValidSuggestionId("abc12300-0000-3000-8000-000000000001")).toBe(
				false,
			); // Wrong version (3 instead of 4)
			expect(isValidSuggestionId("")).toBe(false);
		});
	});

	describe("Type Guards", () => {
		describe("isCreateNoteSuggestion", () => {
			test("should identify create-note suggestions", () => {
				const suggestion = createTestSuggestion({ action: "create-note" });
				expect(isCreateNoteSuggestion(suggestion)).toBe(true);
			});

			test("should reject other suggestion types", () => {
				const skipSuggestion = createTestSuggestion({ action: "skip" });
				expect(isCreateNoteSuggestion(skipSuggestion)).toBe(false);
			});
		});

		describe("isRoutableSuggestion", () => {
			test("should return true for non-create-note actions", () => {
				expect(
					isRoutableSuggestion(createTestSuggestion({ action: "skip" })),
				).toBe(true);
				expect(
					isRoutableSuggestion(createTestSuggestion({ action: "move" })),
				).toBe(true);
			});

			test("should return true for create-note with destination", () => {
				const suggestion = createTestSuggestion({
					action: "create-note",
					suggestedDestination: "/vault/03 Resources",
				});
				expect(isRoutableSuggestion(suggestion)).toBe(true);
			});

			test("should return false for create-note without destination", () => {
				const suggestion = createTestSuggestion({
					action: "create-note",
					suggestedDestination: undefined,
				});
				expect(isRoutableSuggestion(suggestion)).toBe(false);
			});
		});
	});

	describe("validateInboxEngineConfig", () => {
		test("should accept valid configuration", () => {
			const config: InboxEngineConfig = {
				vaultPath: "/Users/me/vault",
				inboxFolder: "00 Inbox",
				attachmentsFolder: "Attachments",
				concurrency: {
					pdfExtraction: 5,
					llmCalls: 3,
					fileIO: 10,
				},
			};
			expect(validateInboxEngineConfig(config)).toEqual(config);
		});

		test("should reject missing vaultPath", () => {
			const config = {} as InboxEngineConfig;
			expect(() => validateInboxEngineConfig(config)).toThrow(
				"vaultPath is required",
			);
		});

		test("should reject invalid vaultPath type", () => {
			const config = { vaultPath: 123 } as unknown as InboxEngineConfig;
			expect(() => validateInboxEngineConfig(config)).toThrow(
				"vaultPath is required and must be a string",
			);
		});

		test("should reject negative concurrency limits", () => {
			const config: InboxEngineConfig = {
				vaultPath: "/vault",
				concurrency: { pdfExtraction: -1 },
			};
			expect(() => validateInboxEngineConfig(config)).toThrow(
				"concurrency.pdfExtraction must be positive",
			);
		});

		test("should reject zero concurrency limits", () => {
			const config: InboxEngineConfig = {
				vaultPath: "/vault",
				concurrency: { llmCalls: 0 },
			};
			expect(() => validateInboxEngineConfig(config)).toThrow(
				"concurrency.llmCalls must be positive",
			);
		});

		test("should reject invalid fileIO concurrency", () => {
			const config: InboxEngineConfig = {
				vaultPath: "/vault",
				concurrency: { fileIO: -5 },
			};
			expect(() => validateInboxEngineConfig(config)).toThrow(
				"concurrency.fileIO must be positive",
			);
		});
	});
});
