/**
 * Tests for MCP utils enhanced error logging.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mcpLogger } from "../src/shared/logger";
import { type LogEntry, log } from "./utils";

describe("log() with enhanced error handling", () => {
	let logCalls: Array<{ level: string; message: string; properties: unknown }> =
		[];
	let originalInfo: typeof mcpLogger.info | null = null;
	let originalError: typeof mcpLogger.error | null = null;

	beforeEach(() => {
		logCalls = [];
		// Mock the logger to capture calls
		if (mcpLogger) {
			originalInfo = mcpLogger.info.bind(mcpLogger);
			originalError = mcpLogger.error.bind(mcpLogger);

			// Replace with mock that only captures - cast to any to bypass overload types
			(mcpLogger as { info: unknown }).info = (
				message: string,
				properties?: unknown,
			) => {
				logCalls.push({ level: "info", message, properties });
			};

			(mcpLogger as { error: unknown }).error = (
				message: string,
				properties?: unknown,
			) => {
				logCalls.push({ level: "error", message, properties });
			};
		}
	});

	afterEach(() => {
		// Restore original methods
		if (mcpLogger && originalInfo && originalError) {
			(mcpLogger as { info: unknown }).info = originalInfo;
			(mcpLogger as { error: unknown }).error = originalError;
		}
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
});
