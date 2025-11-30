/**
 * Tests for MCP tool naming validator
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { validateMcpToolNaming } from "./mcp-tool-naming.js";

const TEST_DIR = join(import.meta.dir, "test-fixtures", "mcp-tool-naming");

beforeEach(() => {
	if (!existsSync(TEST_DIR)) {
		mkdirSync(TEST_DIR, { recursive: true });
	}
});

afterEach(() => {
	if (existsSync(TEST_DIR)) {
		rmSync(TEST_DIR, { recursive: true, force: true });
	}
});

/**
 * Helper to write package.json with plugin name
 */
function writePackageJson(pluginName: string) {
	writeFileSync(
		join(TEST_DIR, "package.json"),
		JSON.stringify({ name: `@sidequest/${pluginName}` }, null, 2),
	);
}

/**
 * Helper to write MCP server index.ts
 */
function writeMcpServer(serverName: string, sourceCode: string) {
	const serverDir = join(TEST_DIR, "mcp-servers", serverName);
	mkdirSync(serverDir, { recursive: true });
	writeFileSync(join(serverDir, "index.ts"), sourceCode);
}

describe("validateMcpToolNaming", () => {
	test("should pass when tool names follow convention (mcpez pattern)", async () => {
		writePackageJson("test-plugin");

		const source = `
import { tool, z } from "mcpez";

tool(
  "mcp__plugin_test-plugin_test-server__my_tool",
  {
    description: "Test tool",
    inputSchema: {
      query: z.string(),
      response_format: z.enum(["markdown", "json"]).optional(),
    },
  },
  async (args) => {
    return { content: [{ type: "text", text: "result" }] };
  },
);
`;
		writeMcpServer("test-server", source);

		const issues = await validateMcpToolNaming({ pluginRoot: TEST_DIR });

		expect(issues).toHaveLength(0);
	});

	test("should pass when tool names follow convention (MCP SDK pattern)", async () => {
		writePackageJson("test-plugin");

		const source = `
import { Server } from "@modelcontextprotocol/sdk/server/index.js";

const server = new Server({ name: "test" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "mcp__plugin_test-plugin_test-server__sdk_tool",
      description: "SDK-style tool",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          response_format: { type: "string", enum: ["markdown", "json"] }
        }
      }
    }
  ]
}));
`;
		writeMcpServer("test-server", source);

		const issues = await validateMcpToolNaming({ pluginRoot: TEST_DIR });

		expect(issues).toHaveLength(0);
	});

	test("should warn when tool name doesn't follow convention", async () => {
		writePackageJson("test-plugin");

		const source = `
import { tool, z } from "mcpez";

tool(
  "invalid_tool_name",
  {
    description: "Test tool",
    inputSchema: {
      query: z.string(),
      response_format: z.enum(["markdown", "json"]).optional(),
    },
  },
  async (args) => {
    return { content: [{ type: "text", text: "result" }] };
  },
);
`;
		writeMcpServer("test-server", source);

		const issues = await validateMcpToolNaming({ pluginRoot: TEST_DIR });

		expect(issues.length).toBeGreaterThan(0);

		const namingIssue = issues.find((i) =>
			i.message.includes("does not follow naming convention"),
		);
		expect(namingIssue).toBeDefined();
		expect(namingIssue?.message).toContain("invalid_tool_name");
		expect(namingIssue?.suggestion).toContain(
			"mcp__plugin_test-plugin_test-server__",
		);
	});

	test("should error when plugin/server names are incorrect", async () => {
		writePackageJson("test-plugin");

		const source = `
import { tool, z } from "mcpez";

tool(
  "mcp__plugin_wrong-plugin_wrong-server__my_tool",
  {
    description: "Test tool",
    inputSchema: {
      query: z.string(),
      response_format: z.enum(["markdown", "json"]).optional(),
    },
  },
  async (args) => {
    return { content: [{ type: "text", text: "result" }] };
  },
);
`;
		writeMcpServer("test-server", source);

		const issues = await validateMcpToolNaming({ pluginRoot: TEST_DIR });

		expect(issues.length).toBeGreaterThan(0);

		const namingIssue = issues.find((i) =>
			i.message.includes("incorrect plugin/server name"),
		);
		expect(namingIssue).toBeDefined();
		expect(namingIssue?.message).toContain(
			"mcp__plugin_test-plugin_test-server__my_tool",
		);
		expect(namingIssue?.severity).toBe("error");
	});

	test("should warn when response_format parameter is missing", async () => {
		writePackageJson("test-plugin");

		const source = `
import { tool, z } from "mcpez";

tool(
  "mcp__plugin_test-plugin_test-server__my_tool",
  {
    description: "Test tool",
    inputSchema: {
      query: z.string(),
    },
  },
  async (args) => {
    return { content: [{ type: "text", text: "result" }] };
  },
);
`;
		writeMcpServer("test-server", source);

		const issues = await validateMcpToolNaming({ pluginRoot: TEST_DIR });

		expect(issues.length).toBeGreaterThan(0);

		const formatIssue = issues.find((i) =>
			i.message.includes("missing response_format parameter"),
		);
		expect(formatIssue).toBeDefined();
		expect(formatIssue?.suggestion).toContain(
			'z.enum(["markdown", "json"]).optional()',
		);
	});

	test("should detect multiple tool definitions", async () => {
		writePackageJson("test-plugin");

		const source = `
import { tool, z } from "mcpez";

tool("tool_one", {
  inputSchema: { query: z.string() },
}, async (args) => {});

tool("mcp__plugin_test-plugin_test-server__tool_two", {
  inputSchema: {
    query: z.string(),
    response_format: z.enum(["markdown", "json"]).optional(),
  },
}, async (args) => {});
`;
		writeMcpServer("test-server", source);

		const issues = await validateMcpToolNaming({ pluginRoot: TEST_DIR });

		// tool_one should have 1 issue: naming
		// Note: response_format is checked file-wide, and tool_two has it, so no response_format issue
		expect(issues.length).toBeGreaterThanOrEqual(1);

		// Check for naming issue
		const namingIssue = issues.find(
			(i) =>
				i.message.includes("tool_one") &&
				i.message.includes("does not follow naming convention"),
		);
		expect(namingIssue).toBeDefined();
		expect(namingIssue?.ruleId).toBe("mcp/invalid-tool-naming");
	});

	test("should skip validation when no mcp-servers directory exists", async () => {
		writePackageJson("test-plugin");

		const issues = await validateMcpToolNaming({ pluginRoot: TEST_DIR });

		expect(issues).toHaveLength(0);
	});

	test("should warn when server directory has no index.ts", async () => {
		writePackageJson("test-plugin");

		const serverDir = join(TEST_DIR, "mcp-servers", "test-server");
		mkdirSync(serverDir, { recursive: true });

		const issues = await validateMcpToolNaming({ pluginRoot: TEST_DIR });

		expect(issues.length).toBeGreaterThan(0);

		const missingIndexIssue = issues.find((i) =>
			i.message.includes("missing index.ts"),
		);
		expect(missingIndexIssue).toBeDefined();
		expect(missingIndexIssue?.severity).toBe("warning");
	});

	test("should handle kebab-case in plugin and server names", async () => {
		writePackageJson("my-plugin");

		const source = `
import { tool, z } from "mcpez";

tool("mcp__plugin_my-plugin_my-server__my_tool", {
  inputSchema: {
    response_format: z.enum(["markdown", "json"]).optional(),
  },
}, async (args) => {});
`;
		writeMcpServer("my-server", source);

		const issues = await validateMcpToolNaming({ pluginRoot: TEST_DIR });

		// No naming issues - kebab-case is valid
		const namingIssues = issues.filter((i) =>
			i.message.includes("does not follow naming convention"),
		);
		expect(namingIssues).toHaveLength(0);
	});

	test("should handle snake_case in tool names", async () => {
		writePackageJson("test-plugin");

		const source = `
import { tool, z } from "mcpez";

tool("mcp__plugin_test-plugin_test-server__get_recent_commits", {
  inputSchema: {
    response_format: z.enum(["markdown", "json"]).optional(),
  },
}, async (args) => {});
`;
		writeMcpServer("test-server", source);

		const issues = await validateMcpToolNaming({ pluginRoot: TEST_DIR });

		// No naming issues - snake_case is valid for tool names
		const namingIssues = issues.filter((i) =>
			i.message.includes("does not follow naming convention"),
		);
		expect(namingIssues).toHaveLength(0);
	});

	test("should not duplicate issues for same tool appearing multiple times", async () => {
		writePackageJson("test-plugin");

		const source = `
import { tool, z } from "mcpez";

// Tool defined once
tool("mcp__plugin_test-plugin_test-server__my_tool", {
  inputSchema: {
    query: z.string(),
    response_format: z.enum(["markdown", "json"]).optional(),
  },
}, async (args) => {});

// Same tool name referenced elsewhere (e.g., in comments or tests)
// name: "mcp__plugin_test-plugin_test-server__my_tool"
`;
		writeMcpServer("test-server", source);

		const issues = await validateMcpToolNaming({ pluginRoot: TEST_DIR });

		// Should only validate the tool once, not duplicate for the comment
		expect(issues).toHaveLength(0);
	});

	test("should info when no tools found in server", async () => {
		writePackageJson("test-plugin");

		const source = `
import { Server } from "@modelcontextprotocol/sdk/server/index.js";

const server = new Server({ name: "test" }, { capabilities: {} });
`;
		writeMcpServer("test-server", source);

		const issues = await validateMcpToolNaming({ pluginRoot: TEST_DIR });

		const noToolsIssue = issues.find((i) =>
			i.message.includes("No MCP tools found"),
		);
		expect(noToolsIssue).toBeDefined();
		expect(noToolsIssue?.severity).toBe("info");
	});
});
