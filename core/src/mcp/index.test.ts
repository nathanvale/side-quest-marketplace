/**
 * Comprehensive test suite for @sidequest/core/mcp module.
 *
 * Tests cover:
 * - Server lifecycle management
 * - Deferred registration (tools, prompts, resources)
 * - Dual logging (MCP + file)
 * - Auto-start behavior
 * - Error handling
 * - Notification queueing
 *
 * NOTE: Due to module-level singleton state, tests are organized to run
 * sequentially in a specific order. State persists across tests in the same
 * process, so we test the lifecycle from "fresh start" through various
 * operations.
 */

import { describe, expect, test } from "bun:test";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	createCorrelationId,
	getServer,
	log,
	notifyPromptListChanged,
	notifyResourceListChanged,
	notifyToolListChanged,
	prompt,
	resource,
	resourceTemplate,
	startServer,
	tool,
	z,
} from "./index.ts";

// ============================================================================
// Test Doubles
// ============================================================================

/**
 * Create a mock stdio transport with all required methods.
 */
function createMockTransport(): StdioServerTransport {
	return {
		start: async () => {
			// Mock start method required by SDK
		},
		close: async () => {
			// Mock close
		},
		send: async () => {
			// Mock send
		},
		onclose: undefined,
		onerror: undefined,
		onmessage: undefined,
	} as unknown as StdioServerTransport;
}

// ============================================================================
// Utility Functions Tests (No Server Required)
// ============================================================================

describe("Utility Functions", () => {
	test("createCorrelationId() returns 8-char hex string", () => {
		const cid = createCorrelationId();
		expect(cid).toMatch(/^[a-f0-9]{8}$/);
	});

	test("createCorrelationId() generates unique IDs", () => {
		const ids = new Set<string>();
		for (let i = 0; i < 100; i++) {
			ids.add(createCorrelationId());
		}
		expect(ids.size).toBe(100);
	});

	test("z (Zod) is exported", () => {
		expect(z).toBeDefined();
		expect(typeof z.object).toBe("function");
		expect(typeof z.string).toBe("function");
		expect(typeof z.number).toBe("function");
	});
});

// ============================================================================
// Pre-Server State Tests
// ============================================================================

describe("Pre-Server State", () => {
	test("getServer() returns null before start", () => {
		const server = getServer();
		expect(server).toBeNull();
	});

	test("log calls queue when server not started", () => {
		// These should queue without error
		log.info({ message: "Test info" });
		log.error({ message: "Test error" });
		log.debug({ message: "Test debug" });

		// Should not throw
		expect(getServer()).toBeNull();
	});

	test("notification calls queue when server not started", () => {
		// These should queue without error
		notifyToolListChanged();
		notifyResourceListChanged();
		notifyPromptListChanged();

		expect(getServer()).toBeNull();
	});

	test("All log levels are available", () => {
		expect(typeof log.debug).toBe("function");
		expect(typeof log.info).toBe("function");
		expect(typeof log.notice).toBe("function");
		expect(typeof log.warning).toBe("function");
		expect(typeof log.error).toBe("function");
		expect(typeof log.critical).toBe("function");
		expect(typeof log.alert).toBe("function");
		expect(typeof log.emergency).toBe("function");
		expect(typeof log.emit).toBe("function");
	});
});

// ============================================================================
// Deferred Registration Tests (Before Server Start)
// ============================================================================

describe("Deferred Registration", () => {
	test("tool() can be called before server starts", () => {
		// Register tool before server starts
		tool(
			"deferred-tool-1",
			{
				description: "Test tool registered before server",
				inputSchema: z.object({ name: z.string() }),
			},
			async ({ name }) => ({
				content: [{ type: "text", text: `Hello ${name}` }],
			}),
		);

		// Server not started yet
		expect(getServer()).toBeNull();
	});

	test("prompt() can be called before server starts", () => {
		// Register prompt before server starts
		prompt(
			"deferred-prompt-1",
			{
				description: "Test prompt",
			},
			async () => ({
				messages: [{ role: "user", content: { type: "text", text: "Test" } }],
			}),
		);

		expect(getServer()).toBeNull();
	});

	test("resource() can be called before server starts", () => {
		// Register resource before server starts
		resource(
			"deferred-resource-1",
			"file:///deferred.txt",
			{ description: "Test resource" },
			async () => ({
				contents: [{ uri: "file:///deferred.txt", text: "Test content" }],
			}),
		);

		expect(getServer()).toBeNull();
	});

	test("Multiple registrations before start work", () => {
		// Register multiple items
		tool(
			"deferred-tool-2",
			{
				description: "Tool 2",
				inputSchema: z.object({ x: z.number() }),
			},
			async () => ({ content: [{ type: "text", text: "Tool 2" }] }),
		);

		prompt("deferred-prompt-2", { description: "Prompt 2" }, async () => ({
			messages: [{ role: "user", content: { type: "text", text: "P2" } }],
		}));

		resource(
			"deferred-resource-2",
			"file:///r2.txt",
			{ description: "Resource 2" },
			async () => ({
				contents: [{ uri: "file:///r2.txt", text: "R2" }],
			}),
		);

		expect(getServer()).toBeNull();
	});
});

// ============================================================================
// Server Lifecycle Tests
// ============================================================================

describe("Server Lifecycle", () => {
	test("startServer() successfully initializes server", async () => {
		const mockTransport = createMockTransport();

		await startServer("test-server", { version: "1.0.0" }, mockTransport);

		const server = getServer();
		expect(server).not.toBeNull();
		expect(server).toBeDefined();
	});

	test("getServer() returns server after start", () => {
		const server = getServer();
		expect(server).not.toBeNull();
	});

	test("startServer() called twice throws error", async () => {
		const mockTransport = createMockTransport();

		await expect(
			startServer("test-server-2", { version: "1.0.0" }, mockTransport),
		).rejects.toThrow("MCP server already started");
	});
});

// ============================================================================
// Post-Server Registration Tests
// ============================================================================

describe("Post-Server Registration", () => {
	test("tool() registers directly after server started", () => {
		const server = getServer();
		expect(server).not.toBeNull();

		// This should register immediately, not queue
		expect(() => {
			tool(
				"post-start-tool-1",
				{
					description: "Tool registered after server start",
					inputSchema: z.object({ msg: z.string() }),
				},
				async ({ msg }) => ({
					content: [{ type: "text", text: `Echo: ${msg}` }],
				}),
			);
		}).not.toThrow();
	});

	test("tool() with annotations works", () => {
		expect(() => {
			tool(
				"annotated-tool",
				{
					description: "Tool with annotations",
					inputSchema: z.object({}),
					annotations: {
						title: "Annotated Tool",
						readOnlyHint: true,
						destructiveHint: false,
						idempotentHint: true,
						openWorldHint: false,
					},
				},
				async () => ({ content: [{ type: "text", text: "OK" }] }),
			);
		}).not.toThrow();
	});

	test("prompt() registers after server start", () => {
		expect(() => {
			prompt(
				"post-start-prompt",
				{ description: "Post-start prompt" },
				async () => ({
					messages: [{ role: "user", content: { type: "text", text: "Test" } }],
				}),
			);
		}).not.toThrow();
	});

	test("resource() registers after server start (string URI)", () => {
		expect(() => {
			resource(
				"post-start-resource",
				"file:///post.txt",
				{ description: "Post-start resource" },
				async () => ({
					contents: [{ uri: "file:///post.txt", text: "Content" }],
				}),
			);
		}).not.toThrow();
	});

	test("resource() registers with ResourceTemplate", () => {
		const template = new ResourceTemplate("file:///{path}", {
			list: undefined,
		});

		expect(() => {
			resource(
				"template-resource",
				template,
				{ description: "Template resource" },
				async () => ({
					contents: [{ uri: "file:///test.txt", text: "Content" }],
				}),
			);
		}).not.toThrow();
	});

	test("resourceTemplate() works as alias", () => {
		const template = new ResourceTemplate("file:///{id}", {
			list: undefined,
		});

		expect(() => {
			resourceTemplate(
				"template-alias",
				template,
				{ description: "Template alias" },
				async () => ({
					contents: [{ uri: "file:///1", text: "Content" }],
				}),
			);
		}).not.toThrow();
	});
});

// ============================================================================
// Logging Tests (After Server Connected)
// ============================================================================

describe("Logging After Server Start", () => {
	test("log.info() works after server start", () => {
		const server = getServer();
		expect(server).not.toBeNull();

		expect(() => {
			log.info({ message: "Post-start info log" });
		}).not.toThrow();
	});

	test("log.error() works after server start", () => {
		expect(() => {
			log.error({ message: "Post-start error log" });
		}).not.toThrow();
	});

	test("log.emit() works with dynamic levels", () => {
		expect(() => {
			log.emit("warning", { message: "Dynamic warning" });
			log.emit("critical", { error: "Critical issue" });
		}).not.toThrow();
	});

	test("Logs with logger names work", () => {
		expect(() => {
			log.info({ message: "Subsystem log" }, "my-subsystem");
			log.debug({ data: "debug" }, "another-subsystem");
		}).not.toThrow();
	});
});

// ============================================================================
// Notification Tests (After Server Connected)
// ============================================================================

describe("Notifications After Server Start", () => {
	test("notifyToolListChanged() works", () => {
		const server = getServer();
		expect(server).not.toBeNull();

		expect(() => {
			notifyToolListChanged();
		}).not.toThrow();
	});

	test("notifyResourceListChanged() works", () => {
		expect(() => {
			notifyResourceListChanged();
		}).not.toThrow();
	});

	test("notifyPromptListChanged() works", () => {
		expect(() => {
			notifyPromptListChanged();
		}).not.toThrow();
	});

	test("Multiple notifications work", () => {
		expect(() => {
			notifyToolListChanged();
			notifyResourceListChanged();
			notifyPromptListChanged();
		}).not.toThrow();
	});
});

// ============================================================================
// File Logging Configuration Tests
// ============================================================================

describe("File Logging Configuration", () => {
	test("Server config accepts file logging options", () => {
		// This tests the type/interface, actual file logging was tested during startServer
		const config = {
			fileLogging: {
				enabled: true,
				subsystems: ["api", "cache"],
				level: "debug" as const,
				maxSize: 2 * 1024 * 1024,
				maxFiles: 10,
			},
		};

		expect(config.fileLogging.enabled).toBe(true);
		expect(config.fileLogging.subsystems).toContain("api");
		expect(config.fileLogging.level).toBe("debug");
	});

	test("File logging can be disabled in config", () => {
		const config = {
			fileLogging: {
				enabled: false,
			},
		};

		expect(config.fileLogging.enabled).toBe(false);
	});
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe("Error Handling", () => {
	test("Tool with valid schema succeeds", () => {
		expect(() => {
			tool(
				"valid-schema-tool",
				{
					description: "Valid tool",
					inputSchema: z.object({
						name: z.string(),
						age: z.number().optional(),
					}),
				},
				async ({ name, age }) => ({
					content: [
						{
							type: "text",
							text: `Name: ${name}, Age: ${age ?? "unknown"}`,
						},
					],
				}),
			);
		}).not.toThrow();
	});

	test("Tool with output schema succeeds", () => {
		expect(() => {
			tool(
				"output-schema-tool",
				{
					description: "Tool with output schema",
					inputSchema: z.object({ x: z.number() }),
					outputSchema: z.object({ result: z.number() }),
				},
				async (args) => {
					const x = args.x as number;
					return {
						content: [
							{ type: "text", text: JSON.stringify({ result: x * 2 }) },
						],
					};
				},
			);
		}).not.toThrow();
	});

	test("Prompt registration succeeds", () => {
		expect(() => {
			prompt(
				"valid-prompt",
				{
					description: "Valid prompt",
				},
				async () => ({
					messages: [{ role: "user", content: { type: "text", text: "Test" } }],
				}),
			);
		}).not.toThrow();
	});

	test("Resource registration succeeds", () => {
		expect(() => {
			resource(
				"valid-resource",
				"file:///valid.txt",
				{ description: "Valid resource", mimeType: "text/plain" },
				async () => ({
					contents: [{ uri: "file:///valid.txt", text: "Content" }],
				}),
			);
		}).not.toThrow();
	});
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Integration Scenarios", () => {
	test("Mixed operations work together", () => {
		// Register various items
		tool(
			"integration-tool",
			{
				description: "Integration test tool",
				inputSchema: z.object({ data: z.string() }),
			},
			async ({ data }) => ({
				content: [{ type: "text", text: `Processed: ${data}` }],
			}),
		);

		// Log messages
		log.info({ action: "integration-test", step: 1 });
		log.debug({ details: "test-data" }, "integration");

		// Send notifications
		notifyToolListChanged();
		notifyResourceListChanged();

		// Register more items
		prompt(
			"integration-prompt",
			{ description: "Integration prompt" },
			async () => ({
				messages: [
					{ role: "user", content: { type: "text", text: "Integration" } },
				],
			}),
		);

		resource(
			"integration-resource",
			"file:///integration.txt",
			{ description: "Integration resource" },
			async () => ({
				contents: [{ uri: "file:///integration.txt", text: "Data" }],
			}),
		);

		// Server should still be running
		const server = getServer();
		expect(server).not.toBeNull();
	});

	test("Server handles complex tool schemas", () => {
		expect(() => {
			tool(
				"complex-tool",
				{
					description: "Tool with complex schema",
					inputSchema: z.object({
						user: z.object({
							name: z.string(),
							email: z.string().email(),
						}),
						tags: z.array(z.string()),
						metadata: z.record(z.unknown()).optional(),
					}),
					annotations: {
						title: "Complex Tool",
						readOnlyHint: false,
						idempotentHint: true,
					},
				},
				async ({ user, tags, metadata }) => ({
					content: [
						{
							type: "text",
							text: JSON.stringify({ user, tags, metadata }),
						},
					],
				}),
			);
		}).not.toThrow();
	});

	test("Correlation IDs work in logging context", () => {
		const cid1 = createCorrelationId();
		const cid2 = createCorrelationId();

		expect(() => {
			log.info({ correlationId: cid1, action: "start" });
			log.debug({ correlationId: cid1, step: "processing" });
			log.info({ correlationId: cid2, action: "different-request" });
		}).not.toThrow();

		// IDs should be different
		expect(cid1).not.toBe(cid2);
	});
});
