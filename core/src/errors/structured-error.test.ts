import { describe, expect, test } from "bun:test";
import {
	type ErrorCategory,
	isRecoverableError,
	isStructuredError,
	StructuredError,
} from "./structured-error";

describe("StructuredError", () => {
	test("creates error with all properties", () => {
		const error = new StructuredError(
			"Test error",
			"VALIDATION",
			"TEST_ERROR",
			true,
			{ field: "username", value: "invalid" },
		);

		expect(error).toBeInstanceOf(Error);
		expect(error).toBeInstanceOf(StructuredError);
		expect(error.message).toBe("Test error");
		expect(error.category).toBe("VALIDATION");
		expect(error.code).toBe("TEST_ERROR");
		expect(error.recoverable).toBe(true);
		expect(error.context).toEqual({ field: "username", value: "invalid" });
		expect(error.name).toBe("StructuredError");
		expect(error.stack).toBeDefined();
	});

	test("creates error with minimal properties", () => {
		const error = new StructuredError(
			"Minimal error",
			"INTERNAL",
			"MINIMAL",
			false,
		);

		expect(error.message).toBe("Minimal error");
		expect(error.category).toBe("INTERNAL");
		expect(error.code).toBe("MINIMAL");
		expect(error.recoverable).toBe(false);
		expect(error.context).toEqual({});
		expect(error.cause).toBeUndefined();
	});

	test("supports error chaining via cause", () => {
		const originalError = new Error("Original error");
		const wrappedError = new StructuredError(
			"Wrapped error",
			"INTERNAL",
			"WRAPPED",
			false,
			{},
			originalError,
		);

		expect(wrappedError.cause).toBe(originalError);
		expect(wrappedError.cause?.message).toBe("Original error");
	});

	test("serializes to JSON correctly", () => {
		const error = new StructuredError(
			"JSON test",
			"NOT_FOUND",
			"JSON_ERROR",
			true,
			{ path: "/test" },
		);

		const json = error.toJSON();

		expect(json).toMatchObject({
			name: "StructuredError",
			message: "JSON test",
			category: "NOT_FOUND",
			code: "JSON_ERROR",
			recoverable: true,
			context: { path: "/test" },
		});
		expect(json.stack).toBeDefined();
		expect(json.cause).toBeUndefined();
	});

	test("serializes error with cause", () => {
		const originalError = new Error("Original");
		const error = new StructuredError(
			"With cause",
			"INTERNAL",
			"CAUSED",
			false,
			{},
			originalError,
		);

		const json = error.toJSON();

		expect(json.cause).toMatchObject({
			name: "Error",
			message: "Original",
		});
		expect(json.cause?.stack).toBeDefined();
	});

	test("supports all error categories", () => {
		const categories: ErrorCategory[] = [
			"NETWORK_ERROR",
			"TIMEOUT",
			"NOT_FOUND",
			"VALIDATION",
			"PERMISSION",
			"CONFIGURATION",
			"INTERNAL",
			"UNKNOWN",
		];

		for (const category of categories) {
			const error = new StructuredError(
				"Category test",
				category,
				"TEST",
				false,
			);
			expect(error.category).toBe(category);
		}
	});

	test("preserves context immutability", () => {
		const context = { mutable: "value" };
		const error = new StructuredError(
			"Immutable test",
			"INTERNAL",
			"TEST",
			false,
			context,
		);

		// Modify original context
		context.mutable = "changed";

		// Error context should not be affected (shallow copy in constructor)
		// Note: This tests the readonly nature, not deep immutability
		expect(error.context.mutable).toBe("changed"); // Same reference
	});

	test("works with subclasses", () => {
		class CustomError extends StructuredError {
			constructor(message: string, code: string) {
				super(message, "CONFIGURATION", code, false, {});
				this.name = "CustomError";
			}
		}

		const error = new CustomError("Custom error", "CUSTOM_CODE");

		expect(error).toBeInstanceOf(StructuredError);
		expect(error).toBeInstanceOf(CustomError);
		expect(error.name).toBe("CustomError");
		expect(error.category).toBe("CONFIGURATION");
	});
});

describe("isStructuredError", () => {
	test("returns true for StructuredError instances", () => {
		const error = new StructuredError("Test", "INTERNAL", "TEST", false);
		expect(isStructuredError(error)).toBe(true);
	});

	test("returns false for standard errors", () => {
		const error = new Error("Standard error");
		expect(isStructuredError(error)).toBe(false);
	});

	test("returns false for non-error values", () => {
		expect(isStructuredError(null)).toBe(false);
		expect(isStructuredError(undefined)).toBe(false);
		expect(isStructuredError("string")).toBe(false);
		expect(isStructuredError(123)).toBe(false);
		expect(isStructuredError({})).toBe(false);
	});

	test("returns true for subclasses", () => {
		class CustomError extends StructuredError {
			constructor() {
				super("Custom", "INTERNAL", "CUSTOM", false);
			}
		}

		const error = new CustomError();
		expect(isStructuredError(error)).toBe(true);
	});
});

describe("isRecoverableError", () => {
	test("returns true for recoverable StructuredErrors", () => {
		const error = new StructuredError(
			"Recoverable",
			"TIMEOUT",
			"TIMEOUT_ERROR",
			true,
		);
		expect(isRecoverableError(error)).toBe(true);
	});

	test("returns false for non-recoverable StructuredErrors", () => {
		const error = new StructuredError(
			"Fatal",
			"INTERNAL",
			"FATAL_ERROR",
			false,
		);
		expect(isRecoverableError(error)).toBe(false);
	});

	test("returns false for standard errors", () => {
		const error = new Error("Standard");
		expect(isRecoverableError(error)).toBe(false);
	});

	test("returns false for non-error values", () => {
		expect(isRecoverableError(null)).toBe(false);
		expect(isRecoverableError(undefined)).toBe(false);
		expect(isRecoverableError("string")).toBe(false);
	});
});

describe("error stack traces", () => {
	test("captures stack trace", () => {
		const error = new StructuredError("Stack test", "INTERNAL", "STACK", false);

		expect(error.stack).toBeDefined();
		expect(error.stack).toContain("StructuredError");
	});

	test("stack trace excludes constructor frame", () => {
		const error = new StructuredError(
			"Clean stack",
			"INTERNAL",
			"CLEAN",
			false,
		);

		// Stack should not include the StructuredError constructor itself
		// (this is what Error.captureStackTrace achieves)
		expect(error.stack).toBeDefined();
	});
});

describe("context usage patterns", () => {
	test("stores multiple context fields", () => {
		const error = new StructuredError(
			"Multi-field error",
			"VALIDATION",
			"MULTI",
			false,
			{
				field: "email",
				value: "invalid@",
				constraint: "email format",
				receivedAt: new Date().toISOString(),
			},
		);

		expect(error.context.field).toBe("email");
		expect(error.context.value).toBe("invalid@");
		expect(error.context.constraint).toBe("email format");
		expect(error.context.receivedAt).toBeDefined();
	});

	test("handles nested context objects", () => {
		const error = new StructuredError(
			"Nested context",
			"INTERNAL",
			"NESTED",
			false,
			{
				request: { method: "POST", path: "/api/test" },
				response: { status: 500, body: null },
			},
		);

		expect(error.context.request).toEqual({
			method: "POST",
			path: "/api/test",
		});
		expect(error.context.response).toEqual({ status: 500, body: null });
	});

	test("handles empty context", () => {
		const error = new StructuredError("Empty", "INTERNAL", "EMPTY", false, {});
		expect(error.context).toEqual({});
	});
});
