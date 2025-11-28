import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
	createTemplateContext,
	generateCommands,
	generateHooks,
	generateMcpServer,
	generatePluginStructure,
	generateSkill,
	generateSrcDirectory,
} from "./generator";
import type { PluginConfig } from "./types";

const TEST_DIR = "/tmp/plugin-template-tests";

const baseConfig: PluginConfig = {
	name: "test-plugin",
	description: "A test plugin",
	author: { name: "Test Author", email: "test@example.com" },
	implementationType: "typescript",
	components: {
		commands: false,
		mcpServer: false,
		hooks: false,
		skills: false,
	},
};

const markdownConfig: PluginConfig = {
	...baseConfig,
	implementationType: "markdown",
};

beforeEach(() => {
	if (existsSync(TEST_DIR)) {
		rmSync(TEST_DIR, { recursive: true });
	}
	mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
	if (existsSync(TEST_DIR)) {
		rmSync(TEST_DIR, { recursive: true });
	}
});

describe("createTemplateContext", () => {
	test("creates context from config", () => {
		const ctx = createTemplateContext(baseConfig);
		expect(ctx.name).toBe("test-plugin");
		expect(ctx.description).toBe("A test plugin");
		expect(ctx.authorName).toBe("Test Author");
		expect(ctx.authorEmail).toBe("test@example.com");
	});

	test("converts name to PascalCase", () => {
		const ctx = createTemplateContext(baseConfig);
		expect(ctx.pascalName).toBe("TestPlugin");
	});

	test("converts name to snake_case", () => {
		const ctx = createTemplateContext(baseConfig);
		expect(ctx.snakeName).toBe("test_plugin");
	});
});

describe("generatePluginStructure", () => {
	test("creates plugin directory", async () => {
		const pluginPath = join(TEST_DIR, "test-plugin");
		await generatePluginStructure(baseConfig, TEST_DIR);
		expect(existsSync(pluginPath)).toBe(true);
	});

	test("creates package.json", async () => {
		await generatePluginStructure(baseConfig, TEST_DIR);
		const pkgPath = join(TEST_DIR, "test-plugin", "package.json");
		expect(existsSync(pkgPath)).toBe(true);

		const pkg = await Bun.file(pkgPath).json();
		expect(pkg.name).toBe("@sidequest/test-plugin");
	});

	test("creates .claude-plugin/plugin.json", async () => {
		await generatePluginStructure(baseConfig, TEST_DIR);
		const pluginJsonPath = join(
			TEST_DIR,
			"test-plugin",
			".claude-plugin",
			"plugin.json",
		);
		expect(existsSync(pluginJsonPath)).toBe(true);

		const pluginJson = await Bun.file(pluginJsonPath).json();
		expect(pluginJson.name).toBe("test-plugin");
		expect(pluginJson.description).toBe("A test plugin");
	});

	test("creates tsconfig.json for typescript type", async () => {
		await generatePluginStructure(baseConfig, TEST_DIR);
		const tsconfigPath = join(TEST_DIR, "test-plugin", "tsconfig.json");
		expect(existsSync(tsconfigPath)).toBe(true);

		const tsconfig = await Bun.file(tsconfigPath).json();
		expect(tsconfig.extends).toBe("../../tsconfig.base.json");
	});

	test("does not create tsconfig.json for markdown type", async () => {
		await generatePluginStructure(markdownConfig, TEST_DIR);
		const tsconfigPath = join(TEST_DIR, "test-plugin", "tsconfig.json");
		expect(existsSync(tsconfigPath)).toBe(false);
	});

	test("creates src/ directory for typescript type", async () => {
		await generatePluginStructure(baseConfig, TEST_DIR);
		expect(existsSync(join(TEST_DIR, "test-plugin", "src", "index.ts"))).toBe(
			true,
		);
		expect(
			existsSync(join(TEST_DIR, "test-plugin", "src", "index.test.ts")),
		).toBe(true);
	});

	test("does not create src/ directory for markdown type", async () => {
		await generatePluginStructure(markdownConfig, TEST_DIR);
		expect(existsSync(join(TEST_DIR, "test-plugin", "src"))).toBe(false);
	});

	test("creates stub scripts for markdown type", async () => {
		await generatePluginStructure(markdownConfig, TEST_DIR);
		const pkgPath = join(TEST_DIR, "test-plugin", "package.json");
		const pkg = await Bun.file(pkgPath).json();
		expect(pkg.scripts.test).toBe("echo 'No tests'");
		expect(pkg.scripts.typecheck).toBe("echo 'No typecheck'");
	});

	test("creates full scripts for typescript type", async () => {
		await generatePluginStructure(baseConfig, TEST_DIR);
		const pkgPath = join(TEST_DIR, "test-plugin", "package.json");
		const pkg = await Bun.file(pkgPath).json();
		expect(pkg.scripts.test).toBe("bun test --recursive");
		expect(pkg.scripts.typecheck).toBe("tsc --noEmit");
	});

	test("returns result with files created", async () => {
		const result = await generatePluginStructure(baseConfig, TEST_DIR);
		expect(result.success).toBe(true);
		expect(result.pluginPath).toBe(join(TEST_DIR, "test-plugin"));
		expect(result.filesCreated.length).toBeGreaterThan(0);
	});
});

describe("generateCommands", () => {
	test("creates commands/ directory", async () => {
		const pluginPath = join(TEST_DIR, "test-plugin");
		mkdirSync(pluginPath, { recursive: true });

		await generateCommands(pluginPath, createTemplateContext(baseConfig));
		expect(existsSync(join(pluginPath, "commands"))).toBe(true);
	});

	test("creates sample command file", async () => {
		const pluginPath = join(TEST_DIR, "test-plugin");
		mkdirSync(pluginPath, { recursive: true });

		await generateCommands(pluginPath, createTemplateContext(baseConfig));
		const cmdPath = join(pluginPath, "commands", "sample.md");
		expect(existsSync(cmdPath)).toBe(true);
	});

	test("command has correct frontmatter", async () => {
		const pluginPath = join(TEST_DIR, "test-plugin");
		mkdirSync(pluginPath, { recursive: true });

		await generateCommands(pluginPath, createTemplateContext(baseConfig));
		const cmdPath = join(pluginPath, "commands", "sample.md");
		const content = await Bun.file(cmdPath).text();
		expect(content).toContain("description:");
		expect(content).toContain("argument-hint:");
	});
});

describe("generateMcpServer", () => {
	test("creates mcp-servers/ directory structure", async () => {
		const pluginPath = join(TEST_DIR, "test-plugin");
		mkdirSync(pluginPath, { recursive: true });

		await generateMcpServer(pluginPath, createTemplateContext(baseConfig));
		expect(existsSync(join(pluginPath, "mcp-servers", "test-plugin"))).toBe(
			true,
		);
	});

	test("creates .mcp.json configuration", async () => {
		const pluginPath = join(TEST_DIR, "test-plugin");
		mkdirSync(pluginPath, { recursive: true });

		await generateMcpServer(pluginPath, createTemplateContext(baseConfig));
		const mcpJsonPath = join(pluginPath, ".mcp.json");
		expect(existsSync(mcpJsonPath)).toBe(true);

		const mcpJson = await Bun.file(mcpJsonPath).json();
		expect(mcpJson.mcpServers["test-plugin"]).toBeDefined();
	});

	test("creates index.ts with mcpez boilerplate", async () => {
		const pluginPath = join(TEST_DIR, "test-plugin");
		mkdirSync(pluginPath, { recursive: true });

		await generateMcpServer(pluginPath, createTemplateContext(baseConfig));
		const indexPath = join(
			pluginPath,
			"mcp-servers",
			"test-plugin",
			"index.ts",
		);
		expect(existsSync(indexPath)).toBe(true);

		const content = await Bun.file(indexPath).text();
		expect(content).toContain("from 'mcpez'");
		expect(content).toContain("export");
	});

	test("creates package.json for MCP server", async () => {
		const pluginPath = join(TEST_DIR, "test-plugin");
		mkdirSync(pluginPath, { recursive: true });

		await generateMcpServer(pluginPath, createTemplateContext(baseConfig));
		const pkgPath = join(
			pluginPath,
			"mcp-servers",
			"test-plugin",
			"package.json",
		);
		expect(existsSync(pkgPath)).toBe(true);

		const pkg = await Bun.file(pkgPath).json();
		expect(pkg.dependencies.mcpez).toBeDefined();
	});
});

describe("generateHooks", () => {
	test("creates hooks/ directory", async () => {
		const pluginPath = join(TEST_DIR, "test-plugin");
		mkdirSync(pluginPath, { recursive: true });

		await generateHooks(pluginPath, createTemplateContext(baseConfig));
		expect(existsSync(join(pluginPath, "hooks"))).toBe(true);
	});

	test("creates hooks.json", async () => {
		const pluginPath = join(TEST_DIR, "test-plugin");
		mkdirSync(pluginPath, { recursive: true });

		await generateHooks(pluginPath, createTemplateContext(baseConfig));
		const hooksPath = join(pluginPath, "hooks", "hooks.json");
		expect(existsSync(hooksPath)).toBe(true);

		const hooks = await Bun.file(hooksPath).json();
		expect(hooks.hooks).toBeDefined();
	});
});

describe("generateSkill", () => {
	test("creates skills/ directory", async () => {
		const pluginPath = join(TEST_DIR, "test-plugin");
		mkdirSync(pluginPath, { recursive: true });

		await generateSkill(pluginPath, createTemplateContext(baseConfig));
		expect(existsSync(join(pluginPath, "skills", "test-plugin"))).toBe(true);
	});

	test("creates SKILL.md", async () => {
		const pluginPath = join(TEST_DIR, "test-plugin");
		mkdirSync(pluginPath, { recursive: true });

		await generateSkill(pluginPath, createTemplateContext(baseConfig));
		const skillPath = join(pluginPath, "skills", "test-plugin", "SKILL.md");
		expect(existsSync(skillPath)).toBe(true);
	});

	test("SKILL.md has correct frontmatter", async () => {
		const pluginPath = join(TEST_DIR, "test-plugin");
		mkdirSync(pluginPath, { recursive: true });

		await generateSkill(pluginPath, createTemplateContext(baseConfig));
		const skillPath = join(pluginPath, "skills", "test-plugin", "SKILL.md");
		const content = await Bun.file(skillPath).text();

		expect(content).toContain("name: test-plugin");
		expect(content).toContain("description:");
	});
});

describe("generateSrcDirectory", () => {
	test("creates src/ directory", async () => {
		const pluginPath = join(TEST_DIR, "test-plugin");
		mkdirSync(pluginPath, { recursive: true });

		await generateSrcDirectory(pluginPath, createTemplateContext(baseConfig));
		expect(existsSync(join(pluginPath, "src"))).toBe(true);
	});

	test("creates index.ts", async () => {
		const pluginPath = join(TEST_DIR, "test-plugin");
		mkdirSync(pluginPath, { recursive: true });

		await generateSrcDirectory(pluginPath, createTemplateContext(baseConfig));
		const indexPath = join(pluginPath, "src", "index.ts");
		expect(existsSync(indexPath)).toBe(true);

		const content = await Bun.file(indexPath).text();
		expect(content).toContain("export interface TestPluginResult");
		expect(content).toContain("export function processTestPlugin");
	});

	test("creates index.test.ts", async () => {
		const pluginPath = join(TEST_DIR, "test-plugin");
		mkdirSync(pluginPath, { recursive: true });

		await generateSrcDirectory(pluginPath, createTemplateContext(baseConfig));
		const testPath = join(pluginPath, "src", "index.test.ts");
		expect(existsSync(testPath)).toBe(true);

		const content = await Bun.file(testPath).text();
		expect(content).toContain("from 'bun:test'");
		expect(content).toContain("processTestPlugin");
	});
});

describe("full plugin generation", () => {
	test("generates typescript plugin with all components", async () => {
		const fullConfig: PluginConfig = {
			...baseConfig,
			implementationType: "typescript",
			components: {
				commands: true,
				mcpServer: true,
				hooks: true,
				skills: true,
			},
		};

		const result = await generatePluginStructure(fullConfig, TEST_DIR);
		const pluginPath = result.pluginPath;

		// Core files
		expect(existsSync(join(pluginPath, "package.json"))).toBe(true);
		expect(existsSync(join(pluginPath, ".claude-plugin", "plugin.json"))).toBe(
			true,
		);
		expect(existsSync(join(pluginPath, "tsconfig.json"))).toBe(true);

		// TypeScript src/
		expect(existsSync(join(pluginPath, "src", "index.ts"))).toBe(true);
		expect(existsSync(join(pluginPath, "src", "index.test.ts"))).toBe(true);

		// Commands
		expect(existsSync(join(pluginPath, "commands", "sample.md"))).toBe(true);

		// MCP Server
		expect(
			existsSync(join(pluginPath, "mcp-servers", "test-plugin", "index.ts")),
		).toBe(true);
		expect(existsSync(join(pluginPath, ".mcp.json"))).toBe(true);

		// Hooks
		expect(existsSync(join(pluginPath, "hooks", "hooks.json"))).toBe(true);

		// Skills
		expect(
			existsSync(join(pluginPath, "skills", "test-plugin", "SKILL.md")),
		).toBe(true);
	});

	test("generates markdown plugin with all components", async () => {
		const fullConfig: PluginConfig = {
			...baseConfig,
			implementationType: "markdown",
			components: {
				commands: true,
				mcpServer: true,
				hooks: true,
				skills: true,
			},
		};

		const result = await generatePluginStructure(fullConfig, TEST_DIR);
		const pluginPath = result.pluginPath;

		// Core files (no tsconfig for markdown)
		expect(existsSync(join(pluginPath, "package.json"))).toBe(true);
		expect(existsSync(join(pluginPath, ".claude-plugin", "plugin.json"))).toBe(
			true,
		);
		expect(existsSync(join(pluginPath, "tsconfig.json"))).toBe(false);
		expect(existsSync(join(pluginPath, "src"))).toBe(false);

		// Commands
		expect(existsSync(join(pluginPath, "commands", "sample.md"))).toBe(true);

		// MCP Server (still created even for markdown)
		expect(
			existsSync(join(pluginPath, "mcp-servers", "test-plugin", "index.ts")),
		).toBe(true);
		expect(existsSync(join(pluginPath, ".mcp.json"))).toBe(true);

		// Hooks
		expect(existsSync(join(pluginPath, "hooks", "hooks.json"))).toBe(true);

		// Skills
		expect(
			existsSync(join(pluginPath, "skills", "test-plugin", "SKILL.md")),
		).toBe(true);

		// Check stub scripts
		const pkg = await Bun.file(join(pluginPath, "package.json")).json();
		expect(pkg.scripts.test).toBe("echo 'No tests'");
	});
});
