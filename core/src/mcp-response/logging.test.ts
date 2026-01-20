/**
 * Tests for MCP logging utilities.
 *
 * Verifies:
 * - log() function with success and error cases
 * - withLogFile() function for JSON and Markdown formats
 * - Logger and log file configuration
 */

import { describe, expect, test } from "bun:test";
import {
	getLogFile,
	type LogEntry,
	log,
	type McpLogger,
	setLogFile,
	setMcpLogger,
	withLogFile,
} from "./logging";
import { ResponseFormat } from "./response";

describe("MCP logging utilities", () => {
	describe("setMcpLogger and log", () => {
		test("logs success case to info", () => {
			const logged: Array<{
				message: string;
				properties: Record<string, unknown>;
			}> = [];

			const mockLogger: McpLogger = {
				info: (message, properties) => {
					logged.push({ message, properties });
				},
				error: () => {
					throw new Error("Should not call error for success");
				},
			};

			setMcpLogger(mockLogger);

			const entry: LogEntry = {
				cid: "test-cid",
				tool: "test_tool",
				durationMs: 100,
				success: true,
				query: "test query",
			};

			log(entry);

			expect(logged).toHaveLength(1);
			expect(logged[0]?.message).toBe("MCP tool response");
			expect(logged[0]?.properties).toMatchObject({
				cid: "test-cid",
				tool: "test_tool",
				durationMs: 100,
				query: "test query",
			});
			expect(logged[0]?.properties.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		});

		test("logs error case to error with categorization", () => {
			const logged: Array<{
				message: string;
				properties: Record<string, unknown>;
			}> = [];

			const mockLogger: McpLogger = {
				info: () => {
					throw new Error("Should not call info for error");
				},
				error: (message, properties) => {
					logged.push({ message, properties });
				},
			};

			setMcpLogger(mockLogger);

			const error = new Error("File not found");
			const entry: LogEntry = {
				cid: "test-cid",
				tool: "test_tool",
				durationMs: 150,
				success: false,
				error,
			};

			log(entry);

			expect(logged).toHaveLength(1);
			expect(logged[0]?.message).toBe("MCP tool response");
			expect(logged[0]?.properties).toMatchObject({
				cid: "test-cid",
				tool: "test_tool",
				durationMs: 150,
				error: "File not found",
				errorCategory: "permanent",
				errorCode: "NOT_FOUND",
			});
			expect(logged[0]?.properties.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
			expect(logged[0]?.properties.stack).toBeDefined();
		});

		test("handles non-Error error objects", () => {
			const logged: Array<{
				message: string;
				properties: Record<string, unknown>;
			}> = [];

			const mockLogger: McpLogger = {
				info: () => {
					throw new Error("Should not call info for error");
				},
				error: (message, properties) => {
					logged.push({ message, properties });
				},
			};

			setMcpLogger(mockLogger);

			const entry: LogEntry = {
				cid: "test-cid",
				tool: "test_tool",
				success: false,
				error: "String error message",
			};

			log(entry);

			expect(logged).toHaveLength(1);
			expect(logged[0]?.properties.error).toBe("String error message");
		});

		test("does nothing if logger not set", () => {
			// Reset logger by setting a no-op logger
			const emptyLogger: McpLogger = {
				info: () => {},
				error: () => {},
			};
			setMcpLogger(emptyLogger);

			// This should not throw even with no-op logger
			log({
				cid: "test",
				tool: "test",
				success: true,
			});
		});
	});

	describe("setLogFile and withLogFile", () => {
		test("returns text unchanged when no log file set", () => {
			setLogFile("");

			const text = "test response";
			const result = withLogFile(text, ResponseFormat.MARKDOWN);

			expect(result).toBe(text);
		});

		test("appends log file path for markdown format", () => {
			setLogFile("/path/to/log.txt");

			const text = "test response";
			const result = withLogFile(text, ResponseFormat.MARKDOWN);

			expect(result).toBe("test response\n\nLogs: /path/to/log.txt");
		});

		test("injects log file into JSON object", () => {
			setLogFile("/path/to/log.txt");

			const text = JSON.stringify({ result: "success" });
			const result = withLogFile(text, ResponseFormat.JSON);

			const parsed = JSON.parse(result);
			expect(parsed).toMatchObject({
				result: "success",
				logFile: "/path/to/log.txt",
			});
		});

		test("wraps JSON array with logFile", () => {
			setLogFile("/path/to/log.txt");

			const text = JSON.stringify(["item1", "item2"]);
			const result = withLogFile(text, ResponseFormat.JSON);

			const parsed = JSON.parse(result);
			expect(parsed).toMatchObject({
				data: ["item1", "item2"],
				logFile: "/path/to/log.txt",
			});
		});

		test("wraps invalid JSON with logFile", () => {
			setLogFile("/path/to/log.txt");

			const text = "not valid json";
			const result = withLogFile(text, ResponseFormat.JSON);

			const parsed = JSON.parse(result);
			expect(parsed).toMatchObject({
				data: "not valid json",
				logFile: "/path/to/log.txt",
			});
		});
	});

	describe("getLogFile", () => {
		test("returns current log file path", () => {
			setLogFile("/test/path.log");
			expect(getLogFile()).toBe("/test/path.log");
		});

		test("returns undefined when not set", () => {
			setLogFile("");
			expect(getLogFile()).toBe("");
		});
	});
});
