import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateMcpJson } from "./mcp-json.js";

describe("validateMcpJson", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = mkdtempSync(join(tmpdir(), "mcp-json-test-"));
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	describe("basic validation", () => {
		test("returns no issues when .mcp.json does not exist", async () => {
			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues).toEqual([]);
		});

		test("returns error when mcpServers is missing", async () => {
			writeFileSync(join(testDir, ".mcp.json"), JSON.stringify({}));

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues).toHaveLength(1);
			expect(issues[0]!.severity).toBe("error");
			expect(issues[0]!.message).toContain(
				"must contain an 'mcpServers' object",
			);
		});

		test("returns error when mcpServers is not an object", async () => {
			const mcpJson = { mcpServers: "invalid" };
			writeFileSync(
				join(testDir, ".mcp.json"),
				JSON.stringify(mcpJson, null, "\t"),
			);

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues).toHaveLength(1);
			expect(issues[0]!.severity).toBe("error");
			expect(issues[0]!.message).toContain("'mcpServers' must be an object");
		});

		test("returns error when .mcp.json contains invalid JSON", async () => {
			writeFileSync(join(testDir, ".mcp.json"), "{ invalid json }");

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues).toHaveLength(1);
			expect(issues[0]!.severity).toBe("error");
			expect(issues[0]!.message).toContain("Failed to parse .mcp.json");
		});

		test("returns error when server config is not an object", async () => {
			const mcpJson = {
				mcpServers: {
					"my-server": "invalid",
				},
			};

			writeFileSync(
				join(testDir, ".mcp.json"),
				JSON.stringify(mcpJson, null, "\t"),
			);

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues).toHaveLength(1);
			expect(issues[0]!.severity).toBe("error");
			expect(issues[0]!.message).toContain("configuration must be an object");
		});
	});

	describe("stdio transport validation", () => {
		test("validates valid stdio server (implicit type)", async () => {
			const mcpJson = {
				mcpServers: {
					"my-server": {
						command: "bun",
						args: ["run", "src/index.ts"],
						env: {},
					},
				},
			};

			writeFileSync(
				join(testDir, ".mcp.json"),
				JSON.stringify(mcpJson, null, "\t"),
			);

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues).toEqual([]);
		});

		test("validates valid stdio server (explicit type)", async () => {
			const mcpJson = {
				mcpServers: {
					"my-server": {
						type: "stdio",
						command: "bun",
						args: ["run", "src/index.ts"],
					},
				},
			};

			writeFileSync(
				join(testDir, ".mcp.json"),
				JSON.stringify(mcpJson, null, "\t"),
			);

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues).toEqual([]);
		});

		test("validates multiple stdio servers", async () => {
			const mcpJson = {
				mcpServers: {
					"server-one": {
						command: "bun",
						args: ["run", "src/server1.ts"],
					},
					"server-two": {
						command: "node",
						args: ["dist/server2.js"],
						env: { NODE_ENV: "production" },
					},
				},
			};

			writeFileSync(
				join(testDir, ".mcp.json"),
				JSON.stringify(mcpJson, null, "\t"),
			);

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues).toEqual([]);
		});

		test("returns error when stdio server is missing command", async () => {
			const mcpJson = {
				mcpServers: {
					"my-server": {
						type: "stdio",
						args: ["run", "src/index.ts"],
					},
				},
			};

			writeFileSync(
				join(testDir, ".mcp.json"),
				JSON.stringify(mcpJson, null, "\t"),
			);

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues).toHaveLength(1);
			expect(issues[0]!.severity).toBe("error");
			expect(issues[0]!.message).toContain("is missing 'command' property");
		});

		test("returns error when command is not a string", async () => {
			const mcpJson = {
				mcpServers: {
					"my-server": {
						command: 123,
						args: ["run", "src/index.ts"],
					},
				},
			};

			writeFileSync(
				join(testDir, ".mcp.json"),
				JSON.stringify(mcpJson, null, "\t"),
			);

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues).toHaveLength(1);
			expect(issues[0]!.severity).toBe("error");
			expect(issues[0]!.message).toContain("'command' must be a string");
		});

		test("accepts stdio server with only command (args is optional)", async () => {
			const mcpJson = {
				mcpServers: {
					"my-server": {
						command: "bun",
					},
				},
			};

			writeFileSync(
				join(testDir, ".mcp.json"),
				JSON.stringify(mcpJson, null, "\t"),
			);

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues).toEqual([]);
		});

		test("accepts stdio server with command and empty args array", async () => {
			const mcpJson = {
				mcpServers: {
					"my-server": {
						command: "node",
						args: [],
					},
				},
			};

			writeFileSync(
				join(testDir, ".mcp.json"),
				JSON.stringify(mcpJson, null, "\t"),
			);

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues).toEqual([]);
		});

		test("returns error when args is not an array", async () => {
			const mcpJson = {
				mcpServers: {
					"my-server": {
						command: "bun",
						args: "not-an-array",
					},
				},
			};

			writeFileSync(
				join(testDir, ".mcp.json"),
				JSON.stringify(mcpJson, null, "\t"),
			);

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues).toHaveLength(1);
			expect(issues[0]!.severity).toBe("error");
			expect(issues[0]!.message).toContain("'args' must be an array");
		});

		test("accepts server config without env property", async () => {
			const mcpJson = {
				mcpServers: {
					"my-server": {
						command: "bun",
						args: ["run", "src/index.ts"],
					},
				},
			};

			writeFileSync(
				join(testDir, ".mcp.json"),
				JSON.stringify(mcpJson, null, "\t"),
			);

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues).toEqual([]);
		});

		test("accepts env as empty object", async () => {
			const mcpJson = {
				mcpServers: {
					"my-server": {
						command: "bun",
						args: ["run", "src/index.ts"],
						env: {},
					},
				},
			};

			writeFileSync(
				join(testDir, ".mcp.json"),
				JSON.stringify(mcpJson, null, "\t"),
			);

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues).toEqual([]);
		});

		test("returns error when env is not an object", async () => {
			const mcpJson = {
				mcpServers: {
					"my-server": {
						command: "bun",
						args: ["run", "src/index.ts"],
						env: "not-an-object",
					},
				},
			};

			writeFileSync(
				join(testDir, ".mcp.json"),
				JSON.stringify(mcpJson, null, "\t"),
			);

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues).toHaveLength(1);
			expect(issues[0]!.severity).toBe("error");
			expect(issues[0]!.message).toContain("'env' must be an object");
		});

		test("returns error when stdio server has url field", async () => {
			const mcpJson = {
				mcpServers: {
					"my-server": {
						type: "stdio",
						command: "bun",
						args: ["run", "src/index.ts"],
						url: "https://api.example.com",
					},
				},
			};

			writeFileSync(
				join(testDir, ".mcp.json"),
				JSON.stringify(mcpJson, null, "\t"),
			);

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues).toHaveLength(1);
			expect(issues[0]!.ruleId).toBe("mcp/conflicting-transport-fields");
			expect(issues[0]!.message).toContain("should not have 'url' field");
		});

		test("returns error when stdio server has headers field", async () => {
			const mcpJson = {
				mcpServers: {
					"my-server": {
						command: "bun",
						args: ["run", "src/index.ts"],
						headers: { Authorization: "Bearer token" },
					},
				},
			};

			writeFileSync(
				join(testDir, ".mcp.json"),
				JSON.stringify(mcpJson, null, "\t"),
			);

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues).toHaveLength(1);
			expect(issues[0]!.ruleId).toBe("mcp/conflicting-transport-fields");
			expect(issues[0]!.message).toContain("should not have 'headers' field");
		});

		test("validates cwd field for stdio servers", async () => {
			const mcpJson = {
				mcpServers: {
					"my-server": {
						command: "bun",
						args: ["run", "src/index.ts"],
						cwd: "/path/to/directory",
					},
				},
			};

			writeFileSync(
				join(testDir, ".mcp.json"),
				JSON.stringify(mcpJson, null, "\t"),
			);

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues).toEqual([]);
		});

		test("returns error when cwd is not a string", async () => {
			const mcpJson = {
				mcpServers: {
					"my-server": {
						command: "bun",
						args: ["run", "src/index.ts"],
						cwd: 123,
					},
				},
			};

			writeFileSync(
				join(testDir, ".mcp.json"),
				JSON.stringify(mcpJson, null, "\t"),
			);

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues).toHaveLength(1);
			expect(issues[0]!.ruleId).toBe("mcp/invalid-cwd");
			expect(issues[0]!.message).toContain("'cwd' must be a string");
		});

		test("returns multiple errors for invalid stdio server configs", async () => {
			const mcpJson = {
				mcpServers: {
					"server-one": {
						// missing command and args
					},
					"server-two": {
						command: 123, // wrong type
						args: "not-array", // wrong type
					},
				},
			};

			writeFileSync(
				join(testDir, ".mcp.json"),
				JSON.stringify(mcpJson, null, "\t"),
			);

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues.length).toBeGreaterThan(2);
			expect(issues.every((issue) => issue.severity === "error")).toBe(true);
		});
	});

	describe("http transport validation", () => {
		test("validates valid HTTP server", async () => {
			const mcpJson = {
				mcpServers: {
					"my-server": {
						type: "http",
						url: "https://api.example.com/mcp",
					},
				},
			};

			writeFileSync(
				join(testDir, ".mcp.json"),
				JSON.stringify(mcpJson, null, "\t"),
			);

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues).toEqual([]);
		});

		test("validates HTTP server with headers", async () => {
			const mcpJson = {
				mcpServers: {
					"my-server": {
						type: "http",
						url: "https://api.example.com/mcp",
						headers: {
							Authorization: "Bearer ${API_KEY}",
							"X-Custom-Header": "value",
						},
					},
				},
			};

			writeFileSync(
				join(testDir, ".mcp.json"),
				JSON.stringify(mcpJson, null, "\t"),
			);

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues).toEqual([]);
		});

		test("returns error when HTTP server is missing url", async () => {
			const mcpJson = {
				mcpServers: {
					"my-server": {
						type: "http",
					},
				},
			};

			writeFileSync(
				join(testDir, ".mcp.json"),
				JSON.stringify(mcpJson, null, "\t"),
			);

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues).toHaveLength(1);
			expect(issues[0]!.ruleId).toBe("mcp/missing-url");
			expect(issues[0]!.message).toContain("is missing 'url' property");
		});

		test("returns error when url is not a string", async () => {
			const mcpJson = {
				mcpServers: {
					"my-server": {
						type: "http",
						url: 123,
					},
				},
			};

			writeFileSync(
				join(testDir, ".mcp.json"),
				JSON.stringify(mcpJson, null, "\t"),
			);

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues).toHaveLength(1);
			expect(issues[0]!.ruleId).toBe("mcp/invalid-url");
			expect(issues[0]!.message).toContain("'url' must be a string");
		});

		test("returns error when url format is invalid", async () => {
			const mcpJson = {
				mcpServers: {
					"my-server": {
						type: "http",
						url: "not-a-valid-url",
					},
				},
			};

			writeFileSync(
				join(testDir, ".mcp.json"),
				JSON.stringify(mcpJson, null, "\t"),
			);

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues).toHaveLength(1);
			expect(issues[0]!.ruleId).toBe("mcp/invalid-url");
			expect(issues[0]!.message).toContain("invalid 'url' format");
		});

		test("returns error when headers is not an object", async () => {
			const mcpJson = {
				mcpServers: {
					"my-server": {
						type: "http",
						url: "https://api.example.com/mcp",
						headers: "not-an-object",
					},
				},
			};

			writeFileSync(
				join(testDir, ".mcp.json"),
				JSON.stringify(mcpJson, null, "\t"),
			);

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues).toHaveLength(1);
			expect(issues[0]!.ruleId).toBe("mcp/invalid-headers-type");
			expect(issues[0]!.message).toContain("'headers' must be an object");
		});

		test("returns error when HTTP server has command field", async () => {
			const mcpJson = {
				mcpServers: {
					"my-server": {
						type: "http",
						url: "https://api.example.com/mcp",
						command: "bun",
					},
				},
			};

			writeFileSync(
				join(testDir, ".mcp.json"),
				JSON.stringify(mcpJson, null, "\t"),
			);

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues).toHaveLength(1);
			expect(issues[0]!.ruleId).toBe("mcp/conflicting-transport-fields");
			expect(issues[0]!.message).toContain("should not have 'command' field");
		});

		test("returns error when HTTP server has args field", async () => {
			const mcpJson = {
				mcpServers: {
					"my-server": {
						type: "http",
						url: "https://api.example.com/mcp",
						args: ["run"],
					},
				},
			};

			writeFileSync(
				join(testDir, ".mcp.json"),
				JSON.stringify(mcpJson, null, "\t"),
			);

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues).toHaveLength(1);
			expect(issues[0]!.ruleId).toBe("mcp/conflicting-transport-fields");
			expect(issues[0]!.message).toContain("should not have 'args' field");
		});
	});

	describe("sse transport validation", () => {
		test("validates valid SSE server", async () => {
			const mcpJson = {
				mcpServers: {
					"my-server": {
						type: "sse",
						url: "https://api.example.com/sse",
					},
				},
			};

			writeFileSync(
				join(testDir, ".mcp.json"),
				JSON.stringify(mcpJson, null, "\t"),
			);

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues).toEqual([]);
		});

		test("validates SSE server with headers", async () => {
			const mcpJson = {
				mcpServers: {
					"my-server": {
						type: "sse",
						url: "https://api.example.com/sse",
						headers: {
							"X-API-Key": "${API_KEY}",
						},
					},
				},
			};

			writeFileSync(
				join(testDir, ".mcp.json"),
				JSON.stringify(mcpJson, null, "\t"),
			);

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues).toEqual([]);
		});

		test("returns error when SSE server is missing url", async () => {
			const mcpJson = {
				mcpServers: {
					"my-server": {
						type: "sse",
					},
				},
			};

			writeFileSync(
				join(testDir, ".mcp.json"),
				JSON.stringify(mcpJson, null, "\t"),
			);

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues).toHaveLength(1);
			expect(issues[0]!.ruleId).toBe("mcp/missing-url");
			expect(issues[0]!.message).toContain("is missing 'url' property");
		});
	});

	describe("transport type validation", () => {
		test("returns error when transport type is invalid", async () => {
			const mcpJson = {
				mcpServers: {
					"my-server": {
						type: "invalid",
						url: "https://api.example.com",
					},
				},
			};

			writeFileSync(
				join(testDir, ".mcp.json"),
				JSON.stringify(mcpJson, null, "\t"),
			);

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues).toHaveLength(1);
			expect(issues[0]!.ruleId).toBe("mcp/invalid-transport-type");
			expect(issues[0]!.message).toContain("invalid transport type");
		});

		test("returns error when no transport type can be determined", async () => {
			const mcpJson = {
				mcpServers: {
					"my-server": {
						// No type, no command, no url
						env: {},
					},
				},
			};

			writeFileSync(
				join(testDir, ".mcp.json"),
				JSON.stringify(mcpJson, null, "\t"),
			);

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues).toHaveLength(1);
			expect(issues[0]!.ruleId).toBe("mcp/missing-transport-type");
		});
	});

	describe("environment variable validation", () => {
		test("accepts valid environment variables in command", async () => {
			const mcpJson = {
				mcpServers: {
					"my-server": {
						command: "${NODE_BIN:-node}",
						args: ["${SCRIPT_PATH}"],
					},
				},
			};

			writeFileSync(
				join(testDir, ".mcp.json"),
				JSON.stringify(mcpJson, null, "\t"),
			);

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues).toEqual([]);
		});

		test("accepts valid environment variables in args", async () => {
			const mcpJson = {
				mcpServers: {
					"my-server": {
						command: "bun",
						args: ["run", "${SERVER_SCRIPT:-src/index.ts}"],
					},
				},
			};

			writeFileSync(
				join(testDir, ".mcp.json"),
				JSON.stringify(mcpJson, null, "\t"),
			);

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues).toEqual([]);
		});

		test("accepts valid environment variables in env values", async () => {
			const mcpJson = {
				mcpServers: {
					"my-server": {
						command: "bun",
						args: ["run", "src/index.ts"],
						env: {
							API_KEY: "${API_KEY}",
							BASE_URL: "${BASE_URL:-https://api.example.com}",
						},
					},
				},
			};

			writeFileSync(
				join(testDir, ".mcp.json"),
				JSON.stringify(mcpJson, null, "\t"),
			);

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues).toEqual([]);
		});

		test("accepts valid environment variables in URL", async () => {
			const mcpJson = {
				mcpServers: {
					"my-server": {
						type: "http",
						url: "${API_BASE_URL:-https://api.example.com}/mcp",
					},
				},
			};

			writeFileSync(
				join(testDir, ".mcp.json"),
				JSON.stringify(mcpJson, null, "\t"),
			);

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues).toEqual([]);
		});

		test("accepts valid environment variables in headers", async () => {
			const mcpJson = {
				mcpServers: {
					"my-server": {
						type: "http",
						url: "https://api.example.com/mcp",
						headers: {
							Authorization: "Bearer ${API_TOKEN}",
							"X-Custom": "${CUSTOM_HEADER:-default}",
						},
					},
				},
			};

			writeFileSync(
				join(testDir, ".mcp.json"),
				JSON.stringify(mcpJson, null, "\t"),
			);

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues).toEqual([]);
		});

		test("accepts valid environment variables in cwd", async () => {
			const mcpJson = {
				mcpServers: {
					"my-server": {
						command: "bun",
						args: ["run", "src/index.ts"],
						cwd: "${PROJECT_ROOT}/servers",
					},
				},
			};

			writeFileSync(
				join(testDir, ".mcp.json"),
				JSON.stringify(mcpJson, null, "\t"),
			);

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues).toEqual([]);
		});

		test("returns error for invalid environment variable syntax", async () => {
			const mcpJson = {
				mcpServers: {
					"my-server": {
						command: "bun",
						args: ["${INVALID SYNTAX}"], // Space in var name
					},
				},
			};

			writeFileSync(
				join(testDir, ".mcp.json"),
				JSON.stringify(mcpJson, null, "\t"),
			);

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues.length).toBeGreaterThanOrEqual(1);
			expect(
				issues.some((issue) => issue.ruleId === "mcp/invalid-env-var-syntax"),
			).toBe(true);
		});

		test("returns error for unclosed environment variable", async () => {
			const mcpJson = {
				mcpServers: {
					"my-server": {
						command: "bun",
						args: ["${UNCLOSED"],
					},
				},
			};

			writeFileSync(
				join(testDir, ".mcp.json"),
				JSON.stringify(mcpJson, null, "\t"),
			);

			const issues = await validateMcpJson({ pluginRoot: testDir });
			expect(issues.length).toBeGreaterThanOrEqual(1);
			expect(
				issues.some((issue) => issue.ruleId === "mcp/invalid-env-var-syntax"),
			).toBe(true);
		});
	});
});
