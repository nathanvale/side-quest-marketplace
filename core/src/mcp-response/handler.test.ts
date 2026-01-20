import { describe, expect, test } from "bun:test";
import type { Logger } from "./handler";
import { categorizeError, wrapToolHandler } from "./handler";
import { ResponseFormat } from "./response";

/**
 * Create a mock logger for testing.
 */
function createMockLogger(): Logger & {
	logs: Array<{ level: string; message: string; properties?: unknown }>;
} {
	const logs: Array<{ level: string; message: string; properties?: unknown }> =
		[];

	return {
		logs,
		info(message: string, properties?: Record<string, unknown>) {
			logs.push({ level: "info", message, properties });
		},
		error(message: string, properties?: Record<string, unknown>) {
			logs.push({ level: "error", message, properties });
		},
	};
}

/**
 * Create a mock correlation ID generator.
 */
function createMockCidGenerator(): () => string {
	let counter = 0;
	return () => `test-cid-${++counter}`;
}

describe("categorizeError", () => {
	test("categorizes network errors as transient", () => {
		const error = new Error("ECONNREFUSED: Connection refused");
		const result = categorizeError(error);
		expect(result.category).toBe("transient");
		expect(result.code).toBe("NETWORK_ERROR");
	});

	test("categorizes not found errors as permanent", () => {
		const error = new Error("ENOENT: File not found");
		const result = categorizeError(error);
		expect(result.category).toBe("permanent");
		expect(result.code).toBe("NOT_FOUND");
	});

	test("categorizes validation errors as permanent", () => {
		const error = new Error("Validation failed: required field missing");
		const result = categorizeError(error);
		expect(result.category).toBe("permanent");
		expect(result.code).toBe("VALIDATION");
	});

	test("categorizes permission errors as configuration", () => {
		const error = new Error("EACCES: Permission denied");
		const result = categorizeError(error);
		expect(result.category).toBe("configuration");
		expect(result.code).toBe("PERMISSION");
	});

	test("categorizes unknown errors as unknown", () => {
		const error = new Error("Something weird happened");
		const result = categorizeError(error);
		expect(result.category).toBe("unknown");
		expect(result.code).toBe("UNKNOWN_ERROR");
	});
});

describe("wrapToolHandler", () => {
	describe("data handler (automatic formatting)", () => {
		test("handles successful data handler with JSON format", async () => {
			const logger = createMockLogger();
			const createCid = createMockCidGenerator();

			const handler = wrapToolHandler(
				async (
					args: { query: string; response_format?: string },
					_format: ResponseFormat,
				) => {
					return { result: args.query };
				},
				{
					toolName: "test_tool",
					logger,
					createCid,
				},
			);

			const result = await handler({ query: "test", response_format: "json" });

			// Check response
			expect(result).toMatchObject({
				content: [
					{
						type: "text",
						text: expect.stringContaining('"result": "test"'),
					},
				],
			});

			// Check logs
			expect(logger.logs).toHaveLength(2);
			expect(logger.logs[0]).toMatchObject({
				level: "info",
				message: "MCP tool request",
				properties: expect.objectContaining({
					cid: "test-cid-1",
					tool: "test_tool",
					event: "request",
				}),
			});
			expect(logger.logs[1]).toMatchObject({
				level: "info",
				message: "MCP tool response",
				properties: expect.objectContaining({
					cid: "test-cid-1",
					tool: "test_tool",
					event: "response",
					success: true,
					durationMs: expect.any(Number),
				}),
			});
		});

		test("handles successful data handler with markdown format", async () => {
			const logger = createMockLogger();
			const createCid = createMockCidGenerator();

			const handler = wrapToolHandler(
				async (
					args: { query: string; response_format?: string },
					_format: ResponseFormat,
				) => {
					return { result: args.query };
				},
				{
					toolName: "test_tool",
					logger,
					createCid,
				},
			);

			const result = await handler({
				query: "test",
				response_format: "markdown",
			});

			// Check response - markdown format still gets JSON stringified by default
			expect(result).toMatchObject({
				content: [
					{
						type: "text",
						text: expect.stringContaining('"result": "test"'),
					},
				],
			});
		});

		test("defaults to markdown format when response_format not provided", async () => {
			const logger = createMockLogger();
			const createCid = createMockCidGenerator();

			const handler = wrapToolHandler(
				async (
					args: { query: string; response_format?: string },
					_format: ResponseFormat,
				) => {
					return { result: args.query };
				},
				{
					toolName: "test_tool",
					logger,
					createCid,
				},
			);

			const result = await handler({ query: "test" });

			// Should still work without response_format
			expect(result).toMatchObject({
				content: [
					{
						type: "text",
						text: expect.stringContaining('"result": "test"'),
					},
				],
			});
		});
	});

	describe("formatted handler (custom formatting)", () => {
		test("handles formatted handler with JSON format", async () => {
			const logger = createMockLogger();
			const createCid = createMockCidGenerator();

			const handler = wrapToolHandler(
				async (
					args: { query: string; response_format?: string },
					format: ResponseFormat,
				) => {
					if (format === ResponseFormat.JSON) {
						return JSON.stringify({ result: args.query }, null, 2);
					}
					return `Result: ${args.query}`;
				},
				{
					toolName: "test_tool",
					logger,
					createCid,
				},
			);

			const result = await handler({ query: "test", response_format: "json" });

			// Check response
			expect(result).toMatchObject({
				content: [
					{
						type: "text",
						text: expect.stringContaining('"result": "test"'),
					},
				],
			});
		});

		test("handles formatted handler with markdown format", async () => {
			const logger = createMockLogger();
			const createCid = createMockCidGenerator();

			const handler = wrapToolHandler(
				async (
					args: { query: string; response_format?: string },
					format: ResponseFormat,
				) => {
					if (format === ResponseFormat.JSON) {
						return JSON.stringify({ result: args.query }, null, 2);
					}
					return `Result: ${args.query}`;
				},
				{
					toolName: "test_tool",
					logger,
					createCid,
				},
			);

			const result = await handler({
				query: "test",
				response_format: "markdown",
			});

			// Check response - custom markdown
			expect(result).toMatchObject({
				content: [
					{
						type: "text",
						text: "Result: test",
					},
				],
			});
		});
	});

	describe("error handling", () => {
		test("handles handler errors with proper logging", async () => {
			const logger = createMockLogger();
			const createCid = createMockCidGenerator();

			const handler = wrapToolHandler(
				async () => {
					throw new Error("Test error");
				},
				{
					toolName: "test_tool",
					logger,
					createCid,
				},
			);

			const result = await handler({ response_format: "json" });

			// Check error response
			expect(result).toMatchObject({
				isError: true,
				content: [
					{
						type: "text",
						text: expect.stringContaining("Test error"),
					},
				],
			});

			// Check logs
			expect(logger.logs).toHaveLength(2);
			expect(logger.logs[0]).toMatchObject({
				level: "info",
				message: "MCP tool request",
			});
			expect(logger.logs[1]).toMatchObject({
				level: "error",
				message: "MCP tool response",
				properties: expect.objectContaining({
					cid: "test-cid-1",
					tool: "test_tool",
					event: "error",
					success: false,
					error: "Test error",
					errorCategory: expect.any(String),
					errorCode: expect.any(String),
					durationMs: expect.any(Number),
				}),
			});
		});

		test("includes stack trace in error logs", async () => {
			const logger = createMockLogger();
			const createCid = createMockCidGenerator();

			const handler = wrapToolHandler(
				async () => {
					throw new Error("Test error with stack");
				},
				{
					toolName: "test_tool",
					logger,
					createCid,
				},
			);

			await handler({ response_format: "json" });

			// Check that stack trace is included
			const errorLog = logger.logs[1];
			expect(errorLog?.properties).toMatchObject({
				stack: expect.stringContaining("Error: Test error with stack"),
			});
		});

		test("categorizes network errors correctly", async () => {
			const logger = createMockLogger();
			const createCid = createMockCidGenerator();

			const handler = wrapToolHandler(
				async () => {
					throw new Error("ECONNREFUSED: Connection refused");
				},
				{
					toolName: "test_tool",
					logger,
					createCid,
				},
			);

			await handler({ response_format: "json" });

			// Check error categorization
			const errorLog = logger.logs[1];
			expect(errorLog?.properties).toMatchObject({
				errorCategory: "transient",
				errorCode: "NETWORK_ERROR",
			});
		});
	});

	describe("log context", () => {
		test("includes custom log context in all logs", async () => {
			const logger = createMockLogger();
			const createCid = createMockCidGenerator();

			const handler = wrapToolHandler(async () => ({ result: "test" }), {
				toolName: "test_tool",
				logger,
				createCid,
				logContext: {
					sessionCid: "session-123",
					userId: "user-456",
				},
			});

			await handler({ response_format: "json" });

			// Check that context is in all logs
			expect(logger.logs[0]?.properties).toMatchObject({
				sessionCid: "session-123",
				userId: "user-456",
			});
			expect(logger.logs[1]?.properties).toMatchObject({
				sessionCid: "session-123",
				userId: "user-456",
			});
		});

		test("includes custom log context in error logs", async () => {
			const logger = createMockLogger();
			const createCid = createMockCidGenerator();

			const handler = wrapToolHandler(
				async () => {
					throw new Error("Test error");
				},
				{
					toolName: "test_tool",
					logger,
					createCid,
					logContext: {
						sessionCid: "session-123",
					},
				},
			);

			await handler({ response_format: "json" });

			// Check that context is in error log
			expect(logger.logs[1]?.properties).toMatchObject({
				sessionCid: "session-123",
			});
		});
	});

	describe("timing", () => {
		test("records accurate duration in logs", async () => {
			const logger = createMockLogger();
			const createCid = createMockCidGenerator();

			const handler = wrapToolHandler(
				async () => {
					// Simulate some work
					await new Promise((resolve) => setTimeout(resolve, 50));
					return { result: "test" };
				},
				{
					toolName: "test_tool",
					logger,
					createCid,
				},
			);

			await handler({ response_format: "json" });

			// Check duration is reasonable (at least 50ms)
			const responseLog = logger.logs[1];
			const durationMs = (responseLog?.properties as { durationMs?: number })
				?.durationMs;
			expect(durationMs).toBeGreaterThanOrEqual(50);
		});
	});
});
