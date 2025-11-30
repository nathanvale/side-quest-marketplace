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

	test("returns no issues when .mcp.json does not exist", async () => {
		const issues = await validateMcpJson({ pluginRoot: testDir });
		expect(issues).toEqual([]);
	});

	test("validates valid .mcp.json structure", async () => {
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

	test("validates multiple servers", async () => {
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

	test("returns error when mcpServers is missing", async () => {
		writeFileSync(join(testDir, ".mcp.json"), JSON.stringify({}));

		const issues = await validateMcpJson({ pluginRoot: testDir });
		expect(issues).toHaveLength(1);
		expect(issues[0]!.severity).toBe("error");
		expect(issues[0]!.message).toContain("must contain an 'mcpServers' object");
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

	test("returns error when server config is missing command", async () => {
		const mcpJson = {
			mcpServers: {
				"my-server": {
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

	test("returns error when server config is missing args", async () => {
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
		expect(issues).toHaveLength(1);
		expect(issues[0]!.severity).toBe("error");
		expect(issues[0]!.message).toContain("is missing 'args' property");
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

	test("returns multiple errors for invalid server configs", async () => {
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

	test("returns error when .mcp.json contains invalid JSON", async () => {
		writeFileSync(join(testDir, ".mcp.json"), "{ invalid json }");

		const issues = await validateMcpJson({ pluginRoot: testDir });
		expect(issues).toHaveLength(1);
		expect(issues[0]!.severity).toBe("error");
		expect(issues[0]!.message).toContain("Failed to parse .mcp.json");
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
