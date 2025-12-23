/**
 * Tests for MCP utils enhanced error logging.
 */

import {
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test";
import { mcpLogger } from "../src/shared/logger";
import { type LogEntry, log } from "./utils";

describe("log() with enhanced error handling", () => {
	let logCalls: Array<{ level: string; message: string; properties: unknown }> =
		[];

	beforeEach(() => {
		logCalls = [];
		// Mock the logger to capture calls using spyOn
		// Use mockImplementation with any to handle overloaded function signatures
		spyOn(mcpLogger, "info").mockImplementation(((
			message: string,
			properties?: unknown,
		) => {
			logCalls.push({ level: "info", message, properties });
		}) as typeof mcpLogger.info);

		spyOn(mcpLogger, "error").mockImplementation(((
			message: string,
			properties?: unknown,
		) => {
			logCalls.push({ level: "error", message, properties });
		}) as typeof mcpLogger.error);
	});

	afterEach(() => {
		// Restore all mocks automatically
		mock.restore();
		logCalls = [];
	});

	test("successful operation logs as info", () => {
		const entry: LogEntry = {
			cid: "test-cid",
			tool: "test_tool",
			durationMs: 100,
			success: true,
		};

		log(entry);

		expect(logCalls.length).toBe(1);
		expect(logCalls[0]?.level).toBe("info");
		expect(logCalls[0]?.message).toBe("MCP tool response");
	});

	test("failed operation with Error instance logs with stack trace", () => {
		const testError = new Error("Test error message");
		const entry: LogEntry = {
			cid: "test-cid",
			tool: "test_tool",
			durationMs: 100,
			success: false,
			error: testError,
		};

		log(entry);

		expect(logCalls.length).toBe(1);
		expect(logCalls[0]?.level).toBe("error");
		expect(logCalls[0]?.message).toBe("MCP tool response");

		const props = logCalls[0]?.properties as Record<string, unknown>;
		expect(props.error).toBe("Test error message");
		expect(props.errorCode).toBeDefined();
		expect(props.errorCategory).toBeDefined();
		expect(props.stack).toBeDefined();
		expect(typeof props.stack).toBe("string");
	});

	test("failed operation with string error logs without stack", () => {
		const entry: LogEntry = {
			cid: "test-cid",
			tool: "test_tool",
			durationMs: 100,
			success: false,
			error: "Simple error string",
		};

		log(entry);

		expect(logCalls.length).toBe(1);
		expect(logCalls[0]?.level).toBe("error");

		const props = logCalls[0]?.properties as Record<string, unknown>;
		expect(props.error).toBe("Simple error string");
		expect(props.errorCode).toBeDefined();
		expect(props.errorCategory).toBeDefined();
		expect(props.stack).toBeUndefined();
	});

	test("error categorization for network errors", () => {
		const networkError = new Error("fetch failed: ECONNREFUSED");
		const entry: LogEntry = {
			cid: "test-cid",
			tool: "test_tool",
			durationMs: 100,
			success: false,
			error: networkError,
		};

		log(entry);

		const props = logCalls[0]?.properties as Record<string, unknown>;
		expect(props.errorCode).toBe("NETWORK_ERROR");
		expect(props.errorCategory).toBe("transient");
	});

	test("error categorization for not found errors", () => {
		const notFoundError = new Error("ENOENT: no such file or directory");
		const entry: LogEntry = {
			cid: "test-cid",
			tool: "test_tool",
			durationMs: 100,
			success: false,
			error: notFoundError,
		};

		log(entry);

		const props = logCalls[0]?.properties as Record<string, unknown>;
		expect(props.errorCode).toBe("NOT_FOUND");
		expect(props.errorCategory).toBe("permanent");
	});

	test("error categorization for validation errors", () => {
		const validationError = new Error("Invalid input: field is required");
		const entry: LogEntry = {
			cid: "test-cid",
			tool: "test_tool",
			durationMs: 100,
			success: false,
			error: validationError,
		};

		log(entry);

		const props = logCalls[0]?.properties as Record<string, unknown>;
		expect(props.errorCode).toBe("VALIDATION");
		expect(props.errorCategory).toBe("permanent");
	});

	test("error categorization for permission errors", () => {
		const permissionError = new Error("EACCES: permission denied");
		const entry: LogEntry = {
			cid: "test-cid",
			tool: "test_tool",
			durationMs: 100,
			success: false,
			error: permissionError,
		};

		log(entry);

		const props = logCalls[0]?.properties as Record<string, unknown>;
		expect(props.errorCode).toBe("PERMISSION");
		expect(props.errorCategory).toBe("configuration");
	});

	test("filters out raw error object from logged properties", () => {
		const testError = new Error("Test error");
		const entry: LogEntry = {
			cid: "test-cid",
			tool: "test_tool",
			durationMs: 100,
			success: false,
			error: testError,
			extraContext: "some value",
		};

		log(entry);

		const props = logCalls[0]?.properties as Record<string, unknown>;
		// Should have the string error message, not the Error object
		expect(props.error).toBe("Test error");
		expect(typeof props.error).toBe("string");
		// Should preserve extra context
		expect(props.extraContext).toBe("some value");
	});

	// =========================================================================
	// Edge Case Tests for Error Categorization
	// =========================================================================

	test("ambiguous error matching multiple patterns prioritizes network errors", () => {
		// Error message that matches both network (ECONNREFUSED) and validation (Invalid)
		const ambiguousError = new Error("Invalid connection: ECONNREFUSED");
		const entry: LogEntry = {
			cid: "test-cid",
			tool: "test_tool",
			durationMs: 100,
			success: false,
			error: ambiguousError,
		};

		log(entry);

		const props = logCalls[0]?.properties as Record<string, unknown>;
		// Network error pattern should win (checked first in categorizeError)
		expect(props.errorCode).toBe("NETWORK_ERROR");
		expect(props.errorCategory).toBe("transient");
	});

	test("handles null error input", () => {
		const entry: LogEntry = {
			cid: "test-cid",
			tool: "test_tool",
			durationMs: 100,
			success: false,
			error: null,
		};

		log(entry);

		const props = logCalls[0]?.properties as Record<string, unknown>;
		// Should use fallback "Unknown error" string
		expect(props.error).toBe("Unknown error");
		expect(props.errorCode).toBe("UNKNOWN_ERROR");
		expect(props.errorCategory).toBe("unknown");
	});

	test("handles undefined error input", () => {
		const entry: LogEntry = {
			cid: "test-cid",
			tool: "test_tool",
			durationMs: 100,
			success: false,
			error: undefined,
		};

		log(entry);

		const props = logCalls[0]?.properties as Record<string, unknown>;
		// Should use fallback "Unknown error" string
		expect(props.error).toBe("Unknown error");
		expect(props.errorCode).toBe("UNKNOWN_ERROR");
		expect(props.errorCategory).toBe("unknown");
	});

	test("unknown error type falls back to UNKNOWN_ERROR category", () => {
		const unknownError = new Error("Something completely unexpected happened");
		const entry: LogEntry = {
			cid: "test-cid",
			tool: "test_tool",
			durationMs: 100,
			success: false,
			error: unknownError,
		};

		log(entry);

		const props = logCalls[0]?.properties as Record<string, unknown>;
		expect(props.error).toBe("Something completely unexpected happened");
		expect(props.errorCode).toBe("UNKNOWN_ERROR");
		expect(props.errorCategory).toBe("unknown");
	});

	test("not-found error takes precedence over validation when both patterns match", () => {
		// Error message that matches both not-found (404) and validation (Invalid)
		const ambiguousError = new Error("Invalid resource: 404 not found");
		const entry: LogEntry = {
			cid: "test-cid",
			tool: "test_tool",
			durationMs: 100,
			success: false,
			error: ambiguousError,
		};

		log(entry);

		const props = logCalls[0]?.properties as Record<string, unknown>;
		// Not-found pattern should win (checked before validation in categorizeError)
		expect(props.errorCode).toBe("NOT_FOUND");
		expect(props.errorCategory).toBe("permanent");
	});
});
