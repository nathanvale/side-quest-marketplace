import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validatePluginStructure } from "./plugin-structure.js";

/**
 * Create a temporary plugin directory with specified structure
 */
function createTestPlugin(name: string, files: Record<string, string>): string {
	const pluginRoot = join(tmpdir(), `test-structure-${name}-${Date.now()}`);
	mkdirSync(pluginRoot, { recursive: true });

	for (const [filePath, content] of Object.entries(files)) {
		const fullPath = join(pluginRoot, filePath);
		const dir = join(fullPath, "..");
		mkdirSync(dir, { recursive: true });
		writeFileSync(fullPath, content);
	}

	return pluginRoot;
}

/**
 * Cleanup temporary plugin directories
 */
const tempDirs: string[] = [];
afterEach(() => {
	for (const dir of tempDirs) {
		try {
			rmSync(dir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	}
	tempDirs.length = 0;
});

describe("validatePluginStructure", () => {
	describe("when not a plugin", () => {
		it("should skip validation if no .claude-plugin/plugin.json exists", async () => {
			const pluginRoot = createTestPlugin("no-plugin-json", {
				"package.json": JSON.stringify({ name: "test" }),
			});
			tempDirs.push(pluginRoot);

			const issues = await validatePluginStructure({ pluginRoot });

			expect(issues).toEqual([]);
		});
	});

	describe("standard folder structure", () => {
		it("should pass for valid plugin with standard folders", async () => {
			const pluginRoot = createTestPlugin("valid-structure", {
				".claude-plugin/plugin.json": JSON.stringify({
					name: "test-plugin",
				}),
				"hooks/hooks.json": JSON.stringify({ hooks: {} }),
				"commands/my-command.md": "# My Command",
				"skills/my-skill/SKILL.md": "# My Skill",
				"package.json": JSON.stringify({ name: "test" }),
			});
			tempDirs.push(pluginRoot);

			const issues = await validatePluginStructure({ pluginRoot });

			// No errors or warnings for standard structure
			const errorsAndWarnings = issues.filter(
				(i) => i.severity === "error" || i.severity === "warning",
			);
			expect(errorsAndWarnings).toEqual([]);
		});

		it("should warn about 'core' folder (should be 'src')", async () => {
			const pluginRoot = createTestPlugin("core-folder", {
				".claude-plugin/plugin.json": JSON.stringify({
					name: "test-plugin",
				}),
				"core/index.ts": "export {}",
				"package.json": JSON.stringify({ name: "test" }),
			});
			tempDirs.push(pluginRoot);

			const issues = await validatePluginStructure({ pluginRoot });

			const coreWarning = issues.find(
				(i) => i.ruleId === "structure/deprecated-core-folder",
			);
			expect(coreWarning).toBeDefined();
			expect(coreWarning?.severity).toBe("warning");
			expect(coreWarning?.message).toContain("should be renamed to");
		});

		it("should report info for non-standard folders", async () => {
			const pluginRoot = createTestPlugin("non-standard-folder", {
				".claude-plugin/plugin.json": JSON.stringify({
					name: "test-plugin",
				}),
				"random-folder/file.ts": "export {}",
				"package.json": JSON.stringify({ name: "test" }),
			});
			tempDirs.push(pluginRoot);

			const issues = await validatePluginStructure({ pluginRoot });

			const nonStandardInfo = issues.find(
				(i) => i.ruleId === "structure/non-standard-folder",
			);
			expect(nonStandardInfo).toBeDefined();
			expect(nonStandardInfo?.severity).toBe("info");
			expect(nonStandardInfo?.message).toContain("random-folder");
		});
	});

	describe("hooks folder validation", () => {
		it("should warn if hooks/ exists without hooks.json", async () => {
			const pluginRoot = createTestPlugin("hooks-no-json", {
				".claude-plugin/plugin.json": JSON.stringify({
					name: "test-plugin",
				}),
				"hooks/my-hook.ts": "export {}",
				"package.json": JSON.stringify({ name: "test" }),
			});
			tempDirs.push(pluginRoot);

			const issues = await validatePluginStructure({ pluginRoot });

			const hooksWarning = issues.find(
				(i) => i.ruleId === "structure/missing-hooks-json",
			);
			expect(hooksWarning).toBeDefined();
			expect(hooksWarning?.severity).toBe("warning");
		});

		it("should pass if hooks/ has hooks.json", async () => {
			const pluginRoot = createTestPlugin("hooks-with-json", {
				".claude-plugin/plugin.json": JSON.stringify({
					name: "test-plugin",
				}),
				"hooks/hooks.json": JSON.stringify({ hooks: {} }),
				"hooks/my-hook.ts": "export {}",
				"package.json": JSON.stringify({ name: "test" }),
			});
			tempDirs.push(pluginRoot);

			const issues = await validatePluginStructure({ pluginRoot });

			const hooksWarning = issues.find(
				(i) => i.ruleId === "structure/missing-hooks-json",
			);
			expect(hooksWarning).toBeUndefined();
		});
	});

	describe("mcp-servers folder validation", () => {
		it("should error if MCP server is missing index.ts", async () => {
			const pluginRoot = createTestPlugin("mcp-no-index", {
				".claude-plugin/plugin.json": JSON.stringify({
					name: "test-plugin",
				}),
				"mcp-servers/my-server/package.json": JSON.stringify({
					name: "my-server",
				}),
				"package.json": JSON.stringify({ name: "test" }),
			});
			tempDirs.push(pluginRoot);

			const issues = await validatePluginStructure({ pluginRoot });

			const mcpError = issues.find(
				(i) => i.ruleId === "structure/mcp-server-missing-index",
			);
			expect(mcpError).toBeDefined();
			expect(mcpError?.severity).toBe("error");
			expect(mcpError?.message).toContain("my-server");
		});

		it("should warn if MCP server is missing package.json", async () => {
			const pluginRoot = createTestPlugin("mcp-no-package", {
				".claude-plugin/plugin.json": JSON.stringify({
					name: "test-plugin",
				}),
				"mcp-servers/my-server/index.ts": "export {}",
				"package.json": JSON.stringify({ name: "test" }),
			});
			tempDirs.push(pluginRoot);

			const issues = await validatePluginStructure({ pluginRoot });

			const mcpWarning = issues.find(
				(i) => i.ruleId === "structure/mcp-server-missing-package",
			);
			expect(mcpWarning).toBeDefined();
			expect(mcpWarning?.severity).toBe("warning");
		});

		it("should pass for valid MCP server structure", async () => {
			const pluginRoot = createTestPlugin("mcp-valid", {
				".claude-plugin/plugin.json": JSON.stringify({
					name: "test-plugin",
				}),
				"mcp-servers/my-server/index.ts": "export {}",
				"mcp-servers/my-server/package.json": JSON.stringify({
					name: "my-server",
				}),
				"package.json": JSON.stringify({ name: "test" }),
			});
			tempDirs.push(pluginRoot);

			const issues = await validatePluginStructure({ pluginRoot });

			const mcpIssues = issues.filter((i) =>
				i.ruleId.startsWith("structure/mcp-server"),
			);
			expect(mcpIssues).toEqual([]);
		});
	});

	describe("skills folder validation", () => {
		it("should error if skill is missing SKILL.md", async () => {
			const pluginRoot = createTestPlugin("skill-no-md", {
				".claude-plugin/plugin.json": JSON.stringify({
					name: "test-plugin",
				}),
				"skills/my-skill/helper.ts": "export {}",
				"package.json": JSON.stringify({ name: "test" }),
			});
			tempDirs.push(pluginRoot);

			const issues = await validatePluginStructure({ pluginRoot });

			const skillError = issues.find(
				(i) => i.ruleId === "structure/skill-missing-md",
			);
			expect(skillError).toBeDefined();
			expect(skillError?.severity).toBe("error");
			expect(skillError?.message).toContain("my-skill");
		});

		it("should pass for valid skill structure", async () => {
			const pluginRoot = createTestPlugin("skill-valid", {
				".claude-plugin/plugin.json": JSON.stringify({
					name: "test-plugin",
				}),
				"skills/my-skill/SKILL.md": "# My Skill",
				"package.json": JSON.stringify({ name: "test" }),
			});
			tempDirs.push(pluginRoot);

			const issues = await validatePluginStructure({ pluginRoot });

			const skillError = issues.find(
				(i) => i.ruleId === "structure/skill-missing-md",
			);
			expect(skillError).toBeUndefined();
		});
	});

	describe("commands folder validation", () => {
		it("should warn if command file is not markdown", async () => {
			const pluginRoot = createTestPlugin("command-not-md", {
				".claude-plugin/plugin.json": JSON.stringify({
					name: "test-plugin",
				}),
				"commands/my-command.ts": "export {}",
				"package.json": JSON.stringify({ name: "test" }),
			});
			tempDirs.push(pluginRoot);

			const issues = await validatePluginStructure({ pluginRoot });

			const commandWarning = issues.find(
				(i) => i.ruleId === "structure/command-not-markdown",
			);
			expect(commandWarning).toBeDefined();
			expect(commandWarning?.severity).toBe("warning");
			expect(commandWarning?.message).toContain("my-command.ts");
		});

		it("should pass for valid markdown command files", async () => {
			const pluginRoot = createTestPlugin("command-valid", {
				".claude-plugin/plugin.json": JSON.stringify({
					name: "test-plugin",
				}),
				"commands/my-command.md": "# My Command",
				"package.json": JSON.stringify({ name: "test" }),
			});
			tempDirs.push(pluginRoot);

			const issues = await validatePluginStructure({ pluginRoot });

			const commandWarning = issues.find(
				(i) => i.ruleId === "structure/command-not-markdown",
			);
			expect(commandWarning).toBeUndefined();
		});
	});

	describe("src folder validation", () => {
		it("should error if src/package.json is missing name", async () => {
			const pluginRoot = createTestPlugin("src-no-name", {
				".claude-plugin/plugin.json": JSON.stringify({
					name: "test-plugin",
				}),
				"src/package.json": JSON.stringify({ version: "1.0.0" }),
				"src/index.ts": "export {}",
				"package.json": JSON.stringify({ name: "test" }),
			});
			tempDirs.push(pluginRoot);

			const issues = await validatePluginStructure({ pluginRoot });

			const srcError = issues.find(
				(i) => i.ruleId === "structure/src-package-missing-name",
			);
			expect(srcError).toBeDefined();
			expect(srcError?.severity).toBe("error");
		});

		it("should error if src/package.json has invalid JSON", async () => {
			const pluginRoot = createTestPlugin("src-invalid-json", {
				".claude-plugin/plugin.json": JSON.stringify({
					name: "test-plugin",
				}),
				"src/package.json": "{ invalid json }",
				"src/index.ts": "export {}",
				"package.json": JSON.stringify({ name: "test" }),
			});
			tempDirs.push(pluginRoot);

			const issues = await validatePluginStructure({ pluginRoot });

			const srcError = issues.find(
				(i) => i.ruleId === "structure/src-package-invalid",
			);
			expect(srcError).toBeDefined();
			expect(srcError?.severity).toBe("error");
		});

		it("should pass for valid src workspace package", async () => {
			const pluginRoot = createTestPlugin("src-valid", {
				".claude-plugin/plugin.json": JSON.stringify({
					name: "test-plugin",
				}),
				"src/package.json": JSON.stringify({
					name: "@sidequest/test-plugin-core",
					version: "1.0.0",
				}),
				"src/index.ts": "export {}",
				"package.json": JSON.stringify({ name: "test" }),
			});
			tempDirs.push(pluginRoot);

			const issues = await validatePluginStructure({ pluginRoot });

			const srcErrors = issues.filter((i) =>
				i.ruleId.startsWith("structure/src-package"),
			);
			expect(srcErrors).toEqual([]);
		});
	});

	describe("allowed files and folders", () => {
		it("should allow common config files at root", async () => {
			const pluginRoot = createTestPlugin("allowed-files", {
				".claude-plugin/plugin.json": JSON.stringify({
					name: "test-plugin",
				}),
				"package.json": JSON.stringify({ name: "test" }),
				"tsconfig.json": JSON.stringify({}),
				"biome.json": JSON.stringify({}),
				"README.md": "# Readme",
				"CLAUDE.md": "# Claude",
				".gitignore": "node_modules",
				".mcp.json": JSON.stringify({}),
			});
			tempDirs.push(pluginRoot);

			const issues = await validatePluginStructure({ pluginRoot });

			// No unexpected file warnings
			const unexpectedFileIssues = issues.filter(
				(i) => i.ruleId === "structure/unexpected-root-file",
			);
			expect(unexpectedFileIssues).toEqual([]);
		});

		it("should allow build artifact folders", async () => {
			const pluginRoot = createTestPlugin("allowed-folders", {
				".claude-plugin/plugin.json": JSON.stringify({
					name: "test-plugin",
				}),
				"node_modules/.placeholder": "",
				"dist/index.js": "export {}",
				"build/output.js": "export {}",
				"package.json": JSON.stringify({ name: "test" }),
			});
			tempDirs.push(pluginRoot);

			const issues = await validatePluginStructure({ pluginRoot });

			// No non-standard folder warnings for build artifacts
			const nonStandardIssues = issues.filter(
				(i) => i.ruleId === "structure/non-standard-folder",
			);
			expect(nonStandardIssues).toEqual([]);
		});
	});
});
