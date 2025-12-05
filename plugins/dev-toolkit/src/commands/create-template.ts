import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { OutputFormat } from "@sidequest/core/formatters";
import { color } from "@sidequest/core/formatters";

/**
 * Create a new CLI template with all Bun CLI patterns
 *
 * Scaffolds:
 * - src/cli.ts with argument parsing, usage, subcommands
 * - src/commands/ directory for command handlers
 * - src/*.test.ts with example tests
 * - package.json with proper configuration
 * - tsconfig.json
 */
export async function createTemplateCommand(
	name: string,
	dest: string,
	format: OutputFormat,
): Promise<void> {
	const targetDir = join(dest, name);

	// Check if directory exists
	if (existsSync(targetDir)) {
		throw new Error(`Directory ${targetDir} already exists`);
	}

	// Create directory structure
	mkdirSync(join(targetDir, "src", "commands"), { recursive: true });

	// Create main CLI entry point
	const cliTemplate = generateCliTemplate(name);
	writeFileSync(join(targetDir, "src", "cli.ts"), cliTemplate);

	// Create example test
	const testTemplate = generateTestTemplate();
	writeFileSync(join(targetDir, "src", "cli.test.ts"), testTemplate);

	// Create package.json
	const packageJson: Record<string, unknown> = {
		name: `@sidequest/${name}`,
		version: "1.0.0",
		private: true,
		description: `${name} CLI tool`,
		type: "module",
		bin: {
			[name]: "./src/cli.ts",
		},
		scripts: {
			test: "bun test",
			typecheck: "tsc --noEmit",
			check: "biome check --write .",
		},
		dependencies: {
			"@sidequest/core": "workspace:*",
		},
	};

	writeFileSync(
		join(targetDir, "package.json"),
		JSON.stringify(packageJson, null, 2),
	);

	// Create tsconfig.json
	const tsconfig: Record<string, unknown> = {
		extends: "../../tsconfig.json",
		compilerOptions: {
			outDir: "./dist",
		},
		include: ["src"],
	};

	writeFileSync(
		join(targetDir, "tsconfig.json"),
		JSON.stringify(tsconfig, null, 2),
	);

	// Create CLAUDE.md
	const claudeTemplate = generateClaudeTemplate(name, targetDir);
	writeFileSync(join(targetDir, "CLAUDE.md"), claudeTemplate);

	// Create commands index
	writeFileSync(
		join(targetDir, "src", "commands", "index.ts"),
		"// Command handlers go here\n",
	);

	// Output success message
	if (format === "json") {
		console.log(
			JSON.stringify(
				{
					success: true,
					name,
					path: targetDir,
					files: [
						"src/cli.ts",
						"src/cli.test.ts",
						"package.json",
						"tsconfig.json",
						"CLAUDE.md",
					],
					next: [`cd ${targetDir}`, "bun install", "bun test"],
				},
				null,
				2,
			),
		);
	} else {
		console.log(color("green", "✅ Template created successfully\n"));
		console.log(`${color("cyan", "Path:")} ${targetDir}`);
		console.log(`\n${color("cyan", "Generated files:")}`);
		console.log("  - src/cli.ts (main CLI entry point)");
		console.log("  - src/cli.test.ts (example tests)");
		console.log("  - package.json (with @sidequest/core dependency)");
		console.log("  - tsconfig.json (TypeScript configuration)");
		console.log("  - CLAUDE.md (documentation)");
		console.log(`\n${color("cyan", "Next steps:")}`);
		console.log(`  1. cd ${targetDir}`);
		console.log("  2. bun install");
		console.log("  3. bun test");
		console.log("  4. bun run src/cli.ts --help");
	}
}

/**
 * Generate the main CLI template
 */
function generateCliTemplate(name: string): string {
	const title = formatTitle(name);
	return `#!/usr/bin/env bun

/**
 * ${title} CLI
 *
 * Production-grade CLI tool with argument parsing, subcommands, and output formatting.
 * Follows the Bun CLI standard: supports --flag value, --flag=value, --flag formats.
 */

import { parseArgs } from "@sidequest/core/cli";
import {
	color,
	OutputFormat,
	parseOutputFormat,
} from "@sidequest/core/formatters";

/**
 * Print CLI usage information
 */
function printUsage(): void {
	const lines = [
		color("cyan", "${title} CLI"),
		"",
		"Usage:",
		"  ${name} config [--format md|json]",
		"  ${name} help",
		"",
		"Options:",
		"  --format md|json Output format (default: md)",
		"",
		"Examples:",
		"  ${name} config --format json",
		"  ${name} config --format md",
	];

	console.log(lines.map((line) => (line === "" ? "" : color("cyan", line))).join("\\n"));
}

/**
 * Handle config command
 */
async function handleConfig(format: OutputFormat): Promise<void> {
	const config = {
		name: "${name}",
		version: "1.0.0",
		description: "Your CLI tool here",
	};

	if (format === "json") {
		console.log(JSON.stringify(config, null, 2));
	} else {
		console.log("# " + config.name);
		console.log("");
		console.log("Version: " + config.version);
		console.log("Description: " + config.description);
	}
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
	try {
		const args = process.argv.slice(2);
		const parsed = parseArgs(args);
		const { command, flags } = parsed;
		const format = parseOutputFormat(flags.format) ?? "md";

		if (!command || command === "help" || flags.help) {
			printUsage();
			process.exit(0);
		}

		switch (command) {
			case "config": {
				await handleConfig(format);
				break;
			}

			default: {
				console.error("Error: Unknown command: " + command);
				console.error("Run '${name} help' for usage");
				process.exit(1);
			}
		}
	} catch (error) {
		console.error(
			"Error:",
			error instanceof Error ? error.message : String(error),
		);
		process.exit(1);
	}
}

main();
`;
}

/**
 * Generate test template
 */
function generateTestTemplate(): string {
	return `import { describe, expect, test } from "bun:test";
import { parseArgs } from "@sidequest/core/cli";

describe("CLI argument parsing", () => {
	test("parses commands", () => {
		const result = parseArgs(["config", "--format", "json"]);
		expect(result.command).toBe("config");
		expect(result.flags.format).toBe("json");
	});

	test("parses --flag=value format", () => {
		const result = parseArgs(["config", "--format=md"]);
		expect(result.flags.format).toBe("md");
	});

	test("handles boolean flags", () => {
		const result = parseArgs(["config", "--verbose"]);
		expect(result.flags.verbose).toBe(true);
	});
});
`;
}

/**
 * Generate CLAUDE.md template
 */
function generateClaudeTemplate(name: string, _targetDir: string): string {
	const title = formatTitle(name);
	return `# ${title} CLI

Production-grade CLI tool following the Bun CLI standard.

## Quick Start

\`\`\`bash
bun run src/cli.ts --help
bun run src/cli.ts config --format json
\`\`\`

## Commands

- \`config\` — Show configuration

## Development

\`\`\`bash
bun test
bun run typecheck
bun run check
\`\`\`

## References

- [Bun CLI Development Skill](../../skills/bun-cli/SKILL.md)
- [CLI Patterns Reference](../../skills/bun-cli/references/bun-cli-patterns.md)
- [Para Obsidian CLI (10/10 Reference)](../../../para-obsidian/CLAUDE.md)
`;
}

/**
 * Format a CLI name to Title Case
 */
function formatTitle(name: string): string {
	return name
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}
