import { describe, expect, test } from "bun:test";
import type { ErrorCategory, ErrorCode } from "../types";
import {
	createInboxError,
	InboxError,
	isDependencyError,
	isRecoverableError,
	isUserError,
	USER_MESSAGES,
} from "./errors";

describe("inbox/errors", () => {
	describe("InboxError", () => {
		test("should create error with all required fields", () => {
			const error = new InboxError(
				"pdftotext not found",
				"DEP_PDFTOTEXT_MISSING",
				"dependency",
				false,
				{ cid: "test-123", operation: "pdf-extraction" },
			);

			expect(error.message).toBe("pdftotext not found");
			expect(error.code).toBe("DEP_PDFTOTEXT_MISSING");
			expect(error.category).toBe("dependency");
			expect(error.recoverable).toBe(false);
			expect(error.context.cid).toBe("test-123");
			expect(error.name).toBe("InboxError");
		});

		test("should be instanceof Error", () => {
			const error = new InboxError("test", "SYS_UNEXPECTED", "system", false, {
				cid: "x",
			});

			expect(error).toBeInstanceOf(Error);
			expect(error).toBeInstanceOf(InboxError);
		});

		test("should capture stack trace", () => {
			const error = new InboxError("test", "SYS_UNEXPECTED", "system", false, {
				cid: "x",
			});

			expect(error.stack).toBeDefined();
			expect(error.stack).toContain("InboxError");
		});
	});

	describe("createInboxError factory", () => {
		test("should create DEP_PDFTOTEXT_MISSING error", () => {
			const error = createInboxError("DEP_PDFTOTEXT_MISSING", {
				cid: "test-1",
			});

			expect(error.code).toBe("DEP_PDFTOTEXT_MISSING");
			expect(error.category).toBe("dependency");
			expect(error.recoverable).toBe(false);
		});

		test("should create recoverable DEP_LLM_RATE_LIMITED error", () => {
			const error = createInboxError("DEP_LLM_RATE_LIMITED", {
				cid: "test-2",
			});

			expect(error.code).toBe("DEP_LLM_RATE_LIMITED");
			expect(error.recoverable).toBe(true);
		});

		test("should include source in context", () => {
			const error = createInboxError("EXT_PDF_CORRUPT", {
				cid: "test-3",
				source: "/vault/00 Inbox/bad.pdf",
			});

			expect(error.context.source).toBe("/vault/00 Inbox/bad.pdf");
		});

		test("should include custom context fields", () => {
			const error = createInboxError("EXT_PDF_TOO_LARGE", {
				cid: "test-4",
				source: "/vault/00 Inbox/huge.pdf",
				fileSize: 100_000_000,
				maxSize: 50_000_000,
			});

			expect(error.context.fileSize).toBe(100_000_000);
			expect(error.context.maxSize).toBe(50_000_000);
		});
	});

	describe("USER_MESSAGES", () => {
		test("should have friendly message for each error code", () => {
			const codes: ErrorCode[] = [
				"DEP_PDFTOTEXT_MISSING",
				"DEP_LLM_UNAVAILABLE",
				"EXT_PDF_CORRUPT",
				"DET_TYPE_UNKNOWN",
				"VAL_AREA_NOT_FOUND",
				"EXE_NOTE_CREATE_FAILED",
				"REG_READ_FAILED",
				"USR_INVALID_COMMAND",
				"SYS_UNEXPECTED",
			];

			for (const code of codes) {
				expect(USER_MESSAGES[code]).toBeDefined();
				expect(typeof USER_MESSAGES[code]).toBe("string");
				expect(USER_MESSAGES[code].length).toBeGreaterThan(0);
			}
		});

		test("DEP_PDFTOTEXT_MISSING should include install instructions", () => {
			expect(USER_MESSAGES.DEP_PDFTOTEXT_MISSING).toContain("brew install");
		});

		test("DET_TYPE_UNKNOWN should suggest edit command", () => {
			expect(USER_MESSAGES.DET_TYPE_UNKNOWN).toContain("e{n}");
		});
	});

	describe("Error type guards", () => {
		test("isDependencyError should identify dependency errors", () => {
			const depError = createInboxError("DEP_PDFTOTEXT_MISSING", {
				cid: "x",
			});
			const extError = createInboxError("EXT_PDF_CORRUPT", { cid: "x" });

			expect(isDependencyError(depError)).toBe(true);
			expect(isDependencyError(extError)).toBe(false);
		});

		test("isRecoverableError should identify recoverable errors", () => {
			const recoverable = createInboxError("DEP_LLM_RATE_LIMITED", {
				cid: "x",
			});
			const notRecoverable = createInboxError("DEP_PDFTOTEXT_MISSING", {
				cid: "x",
			});

			expect(isRecoverableError(recoverable)).toBe(true);
			expect(isRecoverableError(notRecoverable)).toBe(false);
		});

		test("isUserError should identify user input errors", () => {
			const userError = createInboxError("USR_INVALID_COMMAND", { cid: "x" });
			const sysError = createInboxError("SYS_UNEXPECTED", { cid: "x" });

			expect(isUserError(userError)).toBe(true);
			expect(isUserError(sysError)).toBe(false);
		});
	});

	describe("Error metadata mapping", () => {
		const testCases: Array<{
			code: ErrorCode;
			expectedCategory: ErrorCategory;
			expectedRecoverable: boolean;
		}> = [
			// Dependency errors
			{
				code: "DEP_PDFTOTEXT_MISSING",
				expectedCategory: "dependency",
				expectedRecoverable: false,
			},
			{
				code: "DEP_LLM_UNAVAILABLE",
				expectedCategory: "dependency",
				expectedRecoverable: false,
			},
			{
				code: "DEP_LLM_RATE_LIMITED",
				expectedCategory: "dependency",
				expectedRecoverable: true,
			},
			// Extraction errors
			{
				code: "EXT_PDF_CORRUPT",
				expectedCategory: "extraction",
				expectedRecoverable: false,
			},
			{
				code: "EXT_PDF_EMPTY",
				expectedCategory: "extraction",
				expectedRecoverable: false,
			},
			{
				code: "EXT_PDF_TIMEOUT",
				expectedCategory: "extraction",
				expectedRecoverable: true,
			},
			{
				code: "EXT_PDF_TOO_LARGE",
				expectedCategory: "extraction",
				expectedRecoverable: false,
			},
			// Detection errors
			{
				code: "DET_TYPE_UNKNOWN",
				expectedCategory: "detection",
				expectedRecoverable: false,
			},
			{
				code: "DET_TYPE_AMBIGUOUS",
				expectedCategory: "detection",
				expectedRecoverable: false,
			},
			{
				code: "DET_FIELDS_INCOMPLETE",
				expectedCategory: "detection",
				expectedRecoverable: false,
			},
			{
				code: "DET_LLM_PARSE_FAILED",
				expectedCategory: "detection",
				expectedRecoverable: true,
			},
			// Validation errors
			{
				code: "VAL_AREA_NOT_FOUND",
				expectedCategory: "validation",
				expectedRecoverable: false,
			},
			{
				code: "VAL_PROJECT_NOT_FOUND",
				expectedCategory: "validation",
				expectedRecoverable: false,
			},
			{
				code: "VAL_TEMPLATE_MISSING",
				expectedCategory: "validation",
				expectedRecoverable: false,
			},
			{
				code: "VAL_DUPLICATE_NOTE",
				expectedCategory: "validation",
				expectedRecoverable: false,
			},
			// Execution errors
			{
				code: "EXE_NOTE_CREATE_FAILED",
				expectedCategory: "execution",
				expectedRecoverable: false,
			},
			{
				code: "EXE_ATTACHMENT_MOVE_FAILED",
				expectedCategory: "execution",
				expectedRecoverable: false,
			},
			{
				code: "EXE_PERMISSION_DENIED",
				expectedCategory: "execution",
				expectedRecoverable: false,
			},
			// Registry errors
			{
				code: "REG_READ_FAILED",
				expectedCategory: "registry",
				expectedRecoverable: true,
			},
			{
				code: "REG_WRITE_FAILED",
				expectedCategory: "registry",
				expectedRecoverable: true,
			},
			{
				code: "REG_CORRUPT",
				expectedCategory: "registry",
				expectedRecoverable: true,
			},
			// User errors
			{
				code: "USR_INVALID_COMMAND",
				expectedCategory: "user",
				expectedRecoverable: true,
			},
			{
				code: "USR_INVALID_ITEM_ID",
				expectedCategory: "user",
				expectedRecoverable: true,
			},
			{
				code: "USR_EDIT_PROMPT_EMPTY",
				expectedCategory: "user",
				expectedRecoverable: true,
			},
			// System errors
			{
				code: "SYS_UNEXPECTED",
				expectedCategory: "system",
				expectedRecoverable: false,
			},
		];

		for (const { code, expectedCategory, expectedRecoverable } of testCases) {
			test(`${code} should have category=${expectedCategory}, recoverable=${expectedRecoverable}`, () => {
				const error = createInboxError(code, { cid: "test" });
				expect(error.category).toBe(expectedCategory);
				expect(error.recoverable).toBe(expectedRecoverable);
			});
		}
	});
});
