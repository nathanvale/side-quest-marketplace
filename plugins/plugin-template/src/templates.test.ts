import { describe, expect, test } from "bun:test";
import {
	hooksJsonTemplate,
	mcpJsonTemplate,
	mcpServerIndexTemplate,
	packageJsonForType,
	packageJsonMarkdownTemplate,
	packageJsonTemplate,
	pluginJsonTemplate,
	sampleCommandTemplate,
	skillMdTemplate,
	srcIndexTemplate,
	srcIndexTestTemplate,
	toKebabCase,
	toPascalCase,
	toSnakeCase,
	tsconfigTemplate,
} from "./templates";
import type { TemplateContext } from "./types";

const mockContext: TemplateContext = {
	name: "my-plugin",
	description: "A test plugin",
	authorName: "Test Author",
	authorEmail: "test@example.com",
	pascalName: "MyPlugin",
	snakeName: "my_plugin",
};

describe("toKebabCase", () => {
	test("converts spaces to hyphens", () => {
		expect(toKebabCase("my plugin name")).toBe("my-plugin-name");
	});

	test("converts camelCase to kebab-case", () => {
		expect(toKebabCase("myPluginName")).toBe("my-plugin-name");
	});

	test("converts PascalCase to kebab-case", () => {
		expect(toKebabCase("MyPluginName")).toBe("my-plugin-name");
	});

	test("lowercases all characters", () => {
		expect(toKebabCase("MY PLUGIN")).toBe("my-plugin");
	});

	test("handles already kebab-case", () => {
		expect(toKebabCase("my-plugin")).toBe("my-plugin");
	});
});

describe("toPascalCase", () => {
	test("converts kebab-case to PascalCase", () => {
		expect(toPascalCase("my-plugin-name")).toBe("MyPluginName");
	});

	test("converts spaces to PascalCase", () => {
		expect(toPascalCase("my plugin name")).toBe("MyPluginName");
	});

	test("handles single word", () => {
		expect(toPascalCase("plugin")).toBe("Plugin");
	});
});

describe("toSnakeCase", () => {
	test("converts kebab-case to snake_case", () => {
		expect(toSnakeCase("my-plugin-name")).toBe("my_plugin_name");
	});

	test("converts spaces to snake_case", () => {
		expect(toSnakeCase("my plugin name")).toBe("my_plugin_name");
	});
});

describe("packageJsonTemplate", () => {
	test("uses @sidequest/{name} namespace", () => {
		const result = packageJsonTemplate(mockContext);
		const parsed = JSON.parse(result);
		expect(parsed.name).toBe("@sidequest/my-plugin");
	});

	test("includes standard scripts", () => {
		const result = packageJsonTemplate(mockContext);
		const parsed = JSON.parse(result);
		expect(parsed.scripts.test).toBe("bun test --recursive");
		expect(parsed.scripts.typecheck).toBe("tsc --noEmit");
		expect(parsed.scripts.format).toBe("biome format --write .");
		expect(parsed.scripts.lint).toBe("biome lint .");
		expect(parsed.scripts.check).toBe("biome check --write .");
	});

	test("sets type to module", () => {
		const result = packageJsonTemplate(mockContext);
		const parsed = JSON.parse(result);
		expect(parsed.type).toBe("module");
	});

	test("includes devDependencies", () => {
		const result = packageJsonTemplate(mockContext);
		const parsed = JSON.parse(result);
		expect(parsed.devDependencies["@types/bun"]).toBe("latest");
	});
});

describe("pluginJsonTemplate", () => {
	test("includes required name field", () => {
		const result = pluginJsonTemplate(mockContext);
		const parsed = JSON.parse(result);
		expect(parsed.name).toBe("my-plugin");
	});

	test("includes description", () => {
		const result = pluginJsonTemplate(mockContext);
		const parsed = JSON.parse(result);
		expect(parsed.description).toBe("A test plugin");
	});

	test("includes author information", () => {
		const result = pluginJsonTemplate(mockContext);
		const parsed = JSON.parse(result);
		expect(parsed.author.name).toBe("Test Author");
		expect(parsed.author.email).toBe("test@example.com");
	});

	test("includes version", () => {
		const result = pluginJsonTemplate(mockContext);
		const parsed = JSON.parse(result);
		expect(parsed.version).toBe("1.0.0");
	});

	test("handles missing email", () => {
		const contextNoEmail = { ...mockContext, authorEmail: undefined };
		const result = pluginJsonTemplate(contextNoEmail);
		const parsed = JSON.parse(result);
		expect(parsed.author.email).toBeUndefined();
	});
});

describe("tsconfigTemplate", () => {
	test("extends base config", () => {
		const result = tsconfigTemplate();
		const parsed = JSON.parse(result);
		expect(parsed.extends).toBe("../../tsconfig.base.json");
	});

	test("includes src directory", () => {
		const result = tsconfigTemplate();
		const parsed = JSON.parse(result);
		expect(parsed.include).toContain("src/**/*.ts");
	});
});

describe("sampleCommandTemplate", () => {
	test("includes description frontmatter", () => {
		const result = sampleCommandTemplate(mockContext);
		expect(result).toContain("description:");
	});

	test("includes plugin name in content", () => {
		const result = sampleCommandTemplate(mockContext);
		expect(result).toContain("my-plugin");
	});
});

describe("mcpServerIndexTemplate", () => {
	test("imports mcpez", () => {
		const result = mcpServerIndexTemplate(mockContext);
		expect(result).toContain("from 'mcpez'");
	});

	test("uses plugin name in tool names", () => {
		const result = mcpServerIndexTemplate(mockContext);
		expect(result).toContain("my_plugin");
	});

	test("exports types for testing", () => {
		const result = mcpServerIndexTemplate(mockContext);
		expect(result).toContain("export");
	});
});

describe("mcpJsonTemplate", () => {
	test("uses ${CLAUDE_PLUGIN_ROOT} for paths", () => {
		const result = mcpJsonTemplate(mockContext);
		expect(result).toContain("${CLAUDE_PLUGIN_ROOT}");
	});

	test("includes server configuration", () => {
		const result = mcpJsonTemplate(mockContext);
		const parsed = JSON.parse(result);
		expect(parsed.mcpServers).toBeDefined();
		expect(parsed.mcpServers["my-plugin"]).toBeDefined();
	});
});

describe("hooksJsonTemplate", () => {
	test("includes hooks object", () => {
		const result = hooksJsonTemplate(mockContext);
		const parsed = JSON.parse(result);
		expect(parsed.hooks).toBeDefined();
	});

	test("includes description", () => {
		const result = hooksJsonTemplate(mockContext);
		const parsed = JSON.parse(result);
		expect(parsed.description).toBeDefined();
	});
});

describe("skillMdTemplate", () => {
	test("includes name in frontmatter", () => {
		const result = skillMdTemplate(mockContext);
		expect(result).toContain("name: my-plugin");
	});

	test("includes description in frontmatter", () => {
		const result = skillMdTemplate(mockContext);
		expect(result).toContain("description:");
	});

	test("has markdown content", () => {
		const result = skillMdTemplate(mockContext);
		expect(result).toContain("# ");
	});
});

describe("packageJsonMarkdownTemplate", () => {
	test("uses @sidequest/{name} namespace", () => {
		const result = packageJsonMarkdownTemplate(mockContext);
		const parsed = JSON.parse(result);
		expect(parsed.name).toBe("@sidequest/my-plugin");
	});

	test("has stub scripts", () => {
		const result = packageJsonMarkdownTemplate(mockContext);
		const parsed = JSON.parse(result);
		expect(parsed.scripts.test).toBe("echo 'No tests'");
		expect(parsed.scripts.typecheck).toBe("echo 'No typecheck'");
	});

	test("does not include format/lint scripts", () => {
		const result = packageJsonMarkdownTemplate(mockContext);
		const parsed = JSON.parse(result);
		expect(parsed.scripts.format).toBeUndefined();
		expect(parsed.scripts.lint).toBeUndefined();
	});

	test("does not include devDependencies", () => {
		const result = packageJsonMarkdownTemplate(mockContext);
		const parsed = JSON.parse(result);
		expect(parsed.devDependencies).toBeUndefined();
	});
});

describe("packageJsonForType", () => {
	test("returns typescript template for typescript type", () => {
		const result = packageJsonForType(mockContext, "typescript");
		const parsed = JSON.parse(result);
		expect(parsed.scripts.test).toBe("bun test --recursive");
		expect(parsed.devDependencies).toBeDefined();
	});

	test("returns markdown template for markdown type", () => {
		const result = packageJsonForType(mockContext, "markdown");
		const parsed = JSON.parse(result);
		expect(parsed.scripts.test).toBe("echo 'No tests'");
		expect(parsed.devDependencies).toBeUndefined();
	});
});

describe("srcIndexTemplate", () => {
	test("includes plugin interface", () => {
		const result = srcIndexTemplate(mockContext);
		expect(result).toContain("export interface MyPluginResult");
	});

	test("includes process function", () => {
		const result = srcIndexTemplate(mockContext);
		expect(result).toContain("export function processMyPlugin");
	});

	test("includes JSDoc comments", () => {
		const result = srcIndexTemplate(mockContext);
		expect(result).toContain("/**");
		expect(result).toContain("@param");
		expect(result).toContain("@returns");
	});
});

describe("srcIndexTestTemplate", () => {
	test("imports from bun:test", () => {
		const result = srcIndexTestTemplate(mockContext);
		expect(result).toContain("from 'bun:test'");
	});

	test("imports process function", () => {
		const result = srcIndexTestTemplate(mockContext);
		expect(result).toContain("import { processMyPlugin } from './index'");
	});

	test("includes test case", () => {
		const result = srcIndexTestTemplate(mockContext);
		expect(result).toContain("describe(");
		expect(result).toContain("test(");
		expect(result).toContain("expect(");
	});
});
