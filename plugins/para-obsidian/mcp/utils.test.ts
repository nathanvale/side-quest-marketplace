/**
 * Tests for MCP utils integration with core logging.
 *
 * Most logging functionality is now tested in @sidequest/core/mcp-response/logging.test.ts.
 * These tests verify the integration layer that configures the core module.
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
import {
	getLogFile as coreGetLogFile,
	log,
	setLogFile,
	setMcpLogger,
} from "@sidequest/core/mcp-response";
import { getLogFile, mcpLogger } from "../src/shared/logger";
import type { LogEntry } from "./utils";
import { initMcpLogger } from "./utils";

describe("initMcpLogger integration", () => {
	test("configures core logging module with plugin logger", async () => {
		// Initialize the logger
		await initMcpLogger();

		// Verify the core module is configured with our logger
		const logFile = getLogFile();
		expect(logFile).toBeDefined();
		expect(coreGetLogFile()).toBe(logFile);
	});

	test("logger receives log calls after initialization", async () => {
		const logCalls: Array<{
			message: string;
			properties: Record<string, unknown>;
		}> = [];

		// Mock the logger
		spyOn(mcpLogger, "info").mockImplementation(((
			message: string,
			properties?: unknown,
		) => {
			logCalls.push({
				message,
				properties: properties as Record<string, unknown>,
			});
		}) as typeof mcpLogger.info);

		// Initialize
		await initMcpLogger();

		// Now log something
		const entry: LogEntry = {
			cid: "test-cid",
			tool: "test_tool",
			durationMs: 100,
			success: true,
		};

		log(entry);

		// Verify the mock was called
		expect(logCalls.length).toBe(1);
		expect(logCalls[0]?.message).toBe("MCP tool response");
	});

	test("handles case where log file is not yet initialized", async () => {
		// Reset log file
		setLogFile("");

		// This should not throw
		await initMcpLogger();

		// Core should still work (just without log file path injection)
		expect(coreGetLogFile()).toBeTruthy(); // Will have a value from initLogger
	});
});

describe("log() integration with core", () => {
	let logCalls: Array<{ level: string; message: string; properties: unknown }> =
		[];

	beforeEach(async () => {
		logCalls = [];

		// Re-initialize to ensure clean state
		await initMcpLogger();

		// Mock the logger to capture calls
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

		// Reconfigure core with the mocked logger
		setMcpLogger(mcpLogger);
	});

	afterEach(() => {
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

	test("failed operation with Error logs with categorization", () => {
		const testError = new Error("File not found");
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
		expect(props.error).toBe("File not found");
		expect(props.errorCode).toBe("NOT_FOUND");
		expect(props.errorCategory).toBe("permanent");
		expect(props.stack).toBeDefined();
	});

	test("error categorization uses core implementation", () => {
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
		// Verify it uses core's categorizeError
		expect(props.errorCode).toBe("NETWORK_ERROR");
		expect(props.errorCategory).toBe("transient");
	});
});
