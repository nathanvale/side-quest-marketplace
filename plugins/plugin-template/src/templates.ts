import type { ImplementationType, TemplateContext } from "./types";

/**
 * Convert string to kebab-case.
 */
export function toKebabCase(str: string): string {
	return str
		.replace(/([a-z])([A-Z])/g, "$1-$2")
		.replace(/[\s_]+/g, "-")
		.toLowerCase();
}

/**
 * Convert string to PascalCase.
 */
export function toPascalCase(str: string): string {
	return str
		.replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
		.replace(/^(.)/, (c) => c.toUpperCase());
}

/**
 * Convert string to snake_case.
 */
export function toSnakeCase(str: string): string {
	return str.replace(/[-\s]+/g, "_").toLowerCase();
}

/**
 * Generate package.json content for TypeScript plugins.
 */
export function packageJsonTemplate(ctx: TemplateContext): string {
	const pkg = {
		name: `@sidequest/${ctx.name}`,
		version: "1.0.0",
		private: true,
		description: ctx.description,
		type: "module",
		scripts: {
			test: "bun test --recursive",
			typecheck: "tsc --noEmit",
			format: "biome format --write .",
			"format:check": "biome format .",
			lint: "biome lint .",
			check: "biome check --write .",
		},
		devDependencies: {
			"@types/bun": "latest",
		},
	};
	return JSON.stringify(pkg, null, 2);
}

/**
 * Generate package.json content for markdown-only plugins (stub scripts).
 */
export function packageJsonMarkdownTemplate(ctx: TemplateContext): string {
	const pkg = {
		name: `@sidequest/${ctx.name}`,
		version: "1.0.0",
		private: true,
		description: ctx.description,
		type: "module",
		scripts: {
			test: "echo 'No tests'",
			typecheck: "echo 'No typecheck'",
		},
	};
	return JSON.stringify(pkg, null, 2);
}

/**
 * Generate package.json based on implementation type.
 */
export function packageJsonForType(
	ctx: TemplateContext,
	implementationType: ImplementationType,
): string {
	return implementationType === "typescript"
		? packageJsonTemplate(ctx)
		: packageJsonMarkdownTemplate(ctx);
}

/**
 * Generate .claude-plugin/plugin.json content.
 */
export function pluginJsonTemplate(ctx: TemplateContext): string {
	const plugin: Record<string, unknown> = {
		name: ctx.name,
		description: ctx.description,
		version: "1.0.0",
		author: {
			name: ctx.authorName,
			...(ctx.authorEmail && { email: ctx.authorEmail }),
		},
		keywords: [ctx.name],
		license: "MIT",
	};
	return JSON.stringify(plugin, null, 2);
}

/**
 * Generate tsconfig.json content.
 */
export function tsconfigTemplate(): string {
	const config = {
		extends: "../../tsconfig.json",
		include: ["src/**/*.ts"],
		exclude: ["**/node_modules/**"],
	};
	return JSON.stringify(config, null, 2);
}

/**
 * Generate sample command markdown.
 */
export function sampleCommandTemplate(ctx: TemplateContext): string {
	return `---
description: Sample command for ${ctx.name}
argument-hint: [arg1?]
---

# ${ctx.pascalName} Sample Command

This is a sample command for the ${ctx.name} plugin.

## Instructions

1. Parse arguments from \`$ARGUMENTS\` or \`$1\`, \`$2\`, etc.
2. Perform the command action
3. Output the result

## Example Usage

\`\`\`
/${ctx.name}:sample hello
\`\`\`
`;
}

/**
 * Generate MCP server index.ts content.
 */
export function mcpServerIndexTemplate(ctx: TemplateContext): string {
	return `import { tool, serve } from 'mcpez'
import { z } from 'zod'

/**
 * ${ctx.pascalName} MCP Server
 *
 * Provides tools for ${ctx.description.toLowerCase()}.
 */

export interface SampleResult {
  success: boolean
  message: string
}

/**
 * Sample function that can be tested.
 */
export function processSample(input: string): SampleResult {
  return {
    success: true,
    message: \`Processed: \${input}\`,
  }
}

// Register tools
tool(
  '${ctx.snakeName}_sample',
  {
    description: 'Sample tool for ${ctx.name}',
    inputSchema: {
      input: z.string().describe('Input to process'),
    },
  },
  async (args: { input: string }) => {
    const result = processSample(args.input)
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  }
)

// Start the server
serve()
`;
}

/**
 * Generate .mcp.json content.
 */
export function mcpJsonTemplate(ctx: TemplateContext): string {
	const config = {
		mcpServers: {
			[ctx.name]: {
				command: "bun",
				args: [
					"run",
					`\${CLAUDE_PLUGIN_ROOT}/mcp-servers/${ctx.name}/index.ts`,
				],
				env: {},
			},
		},
	};
	return JSON.stringify(config, null, 2);
}

/**
 * Generate hooks/hooks.json content.
 */
export function hooksJsonTemplate(ctx: TemplateContext): string {
	const config = {
		description: `Hooks for ${ctx.name} plugin`,
		hooks: {
			// Example PostToolUse hook - uncomment and customize as needed
			// PostToolUse: [
			//   {
			//     matcher: 'Write|Edit',
			//     hooks: [
			//       {
			//         type: 'command',
			//         command: '${CLAUDE_PLUGIN_ROOT}/hooks/on-file-change.ts',
			//         timeout: 30,
			//       },
			//     ],
			//   },
			// ],
		},
	};
	return JSON.stringify(config, null, 2);
}

/**
 * Generate SKILL.md content.
 */
export function skillMdTemplate(ctx: TemplateContext): string {
	return `---
name: ${ctx.name}
description: ${ctx.description}. Use when working with ${ctx.name} functionality.
---

# ${ctx.pascalName}

## Overview

${ctx.description}

## When to Use This Skill

- When the user asks about ${ctx.name}
- When tasks relate to ${ctx.name} functionality

## Instructions

1. Understand what the user wants to accomplish
2. Use the appropriate tools and patterns
3. Provide clear feedback on actions taken

## Quick Reference

| Action | How |
|--------|-----|
| Basic usage | Describe basic usage |
| Advanced | Describe advanced patterns |

## Examples

### Example 1: Basic Usage

\`\`\`
User: Help me with ${ctx.name}
Assistant: [Describes how to help]
\`\`\`
`;
}

/**
 * Generate src/index.ts for TypeScript plugins.
 */
export function srcIndexTemplate(ctx: TemplateContext): string {
	return `/**
 * ${ctx.pascalName} Plugin
 *
 * ${ctx.description}
 */

export interface ${ctx.pascalName}Result {
  success: boolean
  message: string
}

/**
 * Sample function demonstrating plugin functionality.
 * @param input - Input to process
 * @returns Result object with success status and message
 */
export function process${ctx.pascalName}(input: string): ${ctx.pascalName}Result {
  return {
    success: true,
    message: \`Processed: \${input}\`,
  }
}
`;
}

/**
 * Generate src/index.test.ts for TypeScript plugins.
 */
export function srcIndexTestTemplate(ctx: TemplateContext): string {
	return `import { describe, expect, test } from 'bun:test'
import { process${ctx.pascalName} } from './index'

describe('process${ctx.pascalName}', () => {
  test('returns success with message', () => {
    const result = process${ctx.pascalName}('test input')
    expect(result.success).toBe(true)
    expect(result.message).toBe('Processed: test input')
  })
})
`;
}
