import { describe, expect, test } from "bun:test";
import type {
	Confidence,
	ErrorCategory,
	ErrorCode,
	ErrorContext,
	ExecutionResult,
	InboxAction,
	InboxEngine,
	InboxEngineConfig,
	InboxSuggestion,
	ProcessedRegistry,
	ProcessorResult,
	ProcessorType,
} from "./types";

describe("inbox/types", () => {
	describe("InboxSuggestion", () => {
		test("should have all required fields for a complete suggestion", () => {
			const suggestion: InboxSuggestion = {
				id: "abc123",
				source: "/vault/00 Inbox/invoice-001.pdf",
				processor: "attachments",
				confidence: "high",
				action: "create-note",
				suggestedNoteType: "invoice",
				suggestedTitle: "Dr Smith Invoice Dec 2024",
				suggestedDestination: "/vault/03 Resources/Receipts",
				suggestedArea: "[[Health]]",
				suggestedProject: undefined,
				extractedFields: {
					amount: "$220 AUD",
					provider: "Dr Smith",
					date: "2024-12-01",
				},
				suggestedAttachmentName: "2024-12-01-invoice-001.pdf",
				attachmentLink: "[[Attachments/2024-12-01-invoice-001.pdf]]",
				reason: "Detected invoice pattern in filename and content",
			};

			expect(suggestion.id).toBe("abc123");
			expect(suggestion.processor).toBe("attachments");
			expect(suggestion.confidence).toBe("high");
			expect(suggestion.action).toBe("create-note");
			expect(suggestion.extractedFields?.amount).toBe("$220 AUD");
		});

		test("should allow minimal suggestion for skip action", () => {
			const suggestion: InboxSuggestion = {
				id: "def456",
				source: "/vault/00 Inbox/random.txt",
				processor: "notes",
				confidence: "low",
				action: "skip",
				reason: "Unsupported file type",
			};

			expect(suggestion.action).toBe("skip");
			expect(suggestion.suggestedTitle).toBeUndefined();
		});
	});

	describe("ProcessorResult", () => {
		test("should aggregate suggestions and errors from a processor", () => {
			const result: ProcessorResult = {
				processor: "attachments",
				itemsScanned: 5,
				suggestions: [
					{
						id: "1",
						source: "/vault/00 Inbox/file1.pdf",
						processor: "attachments",
						confidence: "high",
						action: "create-note",
						reason: "Invoice detected",
					},
				],
				errors: [
					{ file: "/vault/00 Inbox/corrupt.pdf", error: "PDF is corrupted" },
				],
			};

			expect(result.itemsScanned).toBe(5);
			expect(result.suggestions).toHaveLength(1);
			expect(result.errors).toHaveLength(1);
		});
	});

	describe("ExecutionResult", () => {
		test("should track successful execution", () => {
			const result: ExecutionResult = {
				suggestionId: "abc123",
				success: true,
				action: "create-note",
				createdNote: "/vault/03 Resources/Receipts/Invoice Dec 2024.md",
				movedAttachment: "/vault/Attachments/2024-12-01-invoice.pdf",
			};

			expect(result.success).toBe(true);
			expect(result.createdNote).toBeDefined();
		});

		test("should track failed execution", () => {
			const result: ExecutionResult = {
				suggestionId: "def456",
				success: false,
				action: "create-note",
				error: "Template not found: invoice.md",
			};

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
		});
	});

	describe("ProcessedRegistry", () => {
		test("should track processed items with hashes", () => {
			const registry: ProcessedRegistry = {
				version: 1,
				items: [
					{
						sourceHash: "sha256-abc123...",
						sourcePath: "/vault/00 Inbox/invoice.pdf",
						processedAt: "2024-12-01T10:00:00.000Z",
						createdNote: "/vault/03 Resources/Invoice.md",
						movedAttachment: "/vault/Attachments/invoice.pdf",
					},
				],
			};

			expect(registry.version).toBe(1);
			expect(registry.items).toHaveLength(1);
			expect(registry.items[0]?.sourceHash).toContain("sha256");
		});
	});

	describe("InboxEngineConfig", () => {
		test("should configure engine with vault path and options", () => {
			const config: InboxEngineConfig = {
				vaultPath: "/Users/me/vault",
				inboxFolder: "00 Inbox",
				attachmentsFolder: "Attachments",
				templatesFolder: "Templates",
				llmProvider: "haiku",
				concurrency: {
					pdfExtraction: 5,
					llmCalls: 3,
					fileIO: 10,
				},
			};

			expect(config.vaultPath).toBe("/Users/me/vault");
			expect(config.concurrency?.llmCalls).toBe(3);
		});
	});

	describe("InboxEngine interface", () => {
		test("should define the engine contract", () => {
			// This test validates the interface shape at compile time
			const mockEngine: InboxEngine = {
				scan: async () => [],
				editWithPrompt: async (_id: string, _prompt: string) => ({
					id: "test",
					source: "/test",
					processor: "attachments",
					confidence: "medium",
					action: "create-note",
					reason: "Updated",
				}),
				execute: async (_ids: string[]) => [],
				generateReport: (_suggestions: InboxSuggestion[]) => "# Report",
			};

			expect(mockEngine.scan).toBeDefined();
			expect(mockEngine.editWithPrompt).toBeDefined();
			expect(mockEngine.execute).toBeDefined();
			expect(mockEngine.generateReport).toBeDefined();
		});
	});

	describe("ErrorContext", () => {
		test("should capture error context for debugging", () => {
			const context: ErrorContext = {
				source: "/vault/00 Inbox/file.pdf",
				itemId: "abc123",
				operation: "pdf-extraction",
				cid: "corr-xyz",
				additionalData: { fileSize: 1024 },
			};

			expect(context.cid).toBe("corr-xyz");
			expect(context.operation).toBe("pdf-extraction");
		});
	});

	describe("Type unions", () => {
		test("Confidence should be high | medium | low", () => {
			const high: Confidence = "high";
			const medium: Confidence = "medium";
			const low: Confidence = "low";

			expect([high, medium, low]).toEqual(["high", "medium", "low"]);
		});

		test("ProcessorType should be attachments | notes | images", () => {
			const types: ProcessorType[] = ["attachments", "notes", "images"];
			expect(types).toHaveLength(3);
		});

		test("InboxAction should cover all actions", () => {
			const actions: InboxAction[] = [
				"create-note",
				"move",
				"rename",
				"link",
				"skip",
			];
			expect(actions).toHaveLength(5);
		});

		test("ErrorCategory should cover all categories", () => {
			const categories: ErrorCategory[] = [
				"dependency",
				"extraction",
				"detection",
				"validation",
				"execution",
				"registry",
				"user",
				"system",
			];
			expect(categories).toHaveLength(8);
		});

		test("ErrorCode should be a string literal union", () => {
			const code: ErrorCode = "DEP_PDFTOTEXT_MISSING";
			expect(code).toBe("DEP_PDFTOTEXT_MISSING");
		});
	});
});
