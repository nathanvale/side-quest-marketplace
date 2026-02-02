/**
 * Validator for MCP tool naming conventions
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { ValidationIssue, ValidatorOptions } from "../types.ts";

/**
 * Validates that MCP tools follow the naming convention:
 * mcp__<plugin-name>_<server-name>__<tool_name>
 */
export async function validateMcpToolNaming(
	options: ValidatorOptions,
): Promise<ValidationIssue[]> {
	const issues: ValidationIssue[] = [];
	const mcpDir = join(options.pluginRoot, "mcp");

	// If mcp directory doesn't exist, skip validation
	if (!existsSync(mcpDir)) {
		return issues;
	}

	try {
		// Get plugin name from package.json
		const packageJsonPath = join(options.pluginRoot, "package.json");
		let pluginName = "unknown";

		if (existsSync(packageJsonPath)) {
			const packageJson = JSON.parse(await Bun.file(packageJsonPath).text());
			pluginName = packageJson.name?.replace("@sidequest/", "") || "unknown";
		}

		// Get all server directories (skip node_modules, .git, etc.)
		const serverDirs = readdirSync(mcpDir, { withFileTypes: true })
			.filter(
				(dirent) =>
					dirent.isDirectory() &&
					!dirent.name.startsWith(".") &&
					dirent.name !== "node_modules",
			)
			.map((dirent) => dirent.name);

		for (const serverName of serverDirs) {
			const serverIndexPath = join(mcpDir, serverName, "index.ts");

			// Skip if index.ts doesn't exist
			if (!existsSync(serverIndexPath)) {
				issues.push({
					ruleId: "mcp/missing-server-index",
					severity: "warning",
					message: `MCP server '${serverName}' is missing index.ts`,
					file: join(mcpDir, serverName),
					suggestion: `Create an index.ts file in mcp/${serverName}/`,
				});
				continue;
			}

			// Read the server source code
			const sourceCode = await Bun.file(serverIndexPath).text();

			// Pattern to find ALL tool name definitions
			// We look for ANY name definition (including non-compliant ones) and validate them
			// Two common patterns:
			// 1. mcpez: tool("tool_name", ...)
			// 2. MCP SDK: name: "mcp__..." (should start with mcp__)
			// We filter to only names that look like MCP tool names (start with mcp__ or are function calls to tool())
			const mcpezPattern = /tool\(\s*["']([^"']+)["']/g;
			// For MCP SDK, only match names that start with "mcp__" to avoid false positives
			const mcpSdkPattern = /name:\s*["'](mcp__[^"']+)["']/g;

			const mcpezMatches = [...sourceCode.matchAll(mcpezPattern)];
			const mcpSdkMatches = [...sourceCode.matchAll(mcpSdkPattern)];
			const allToolMatches = [...mcpezMatches, ...mcpSdkMatches];

			if (allToolMatches.length === 0) {
				issues.push({
					ruleId: "mcp/no-tools-found",
					severity: "info",
					message: `No MCP tools found in server '${serverName}'`,
					file: serverIndexPath,
					suggestion: "Define tools using server.tool() or in the tools list",
				});
				continue;
			}

			// Expected format: mcp__<plugin-name>_<server-name>__<tool_name>
			// plugin and server names: kebab-case (lowercase letters, numbers, hyphens)
			// tool name: snake_case (lowercase letters, numbers, underscores)
			const validToolNamePattern =
				/^mcp__([a-z0-9-]+)_([a-z0-9-]+)__([a-z0-9_]+)$/;

			// Track tool names we've already seen to detect duplicates
			const seenToolNames = new Set<string>();

			// Validate each tool name
			for (const match of allToolMatches) {
				const toolName = match[1]; // The actual tool name (e.g., "mcp__plugin_kit_kit__kit_index_find")

				// Skip if toolName is undefined (shouldn't happen with our regex, but TypeScript requires the check)
				if (!toolName) {
					continue;
				}

				// Skip duplicates (tool name might appear in multiple places)
				if (seenToolNames.has(toolName)) {
					continue;
				}
				seenToolNames.add(toolName);

				// Check if it follows the convention
				const conventionMatch = toolName.match(validToolNamePattern);

				if (!conventionMatch) {
					// Tool name doesn't follow convention
					const expectedPrefix = `mcp__${pluginName}_${serverName}__`;
					issues.push({
						ruleId: "mcp/invalid-tool-naming",
						severity: "warning",
						message: `Tool "${toolName}" does not follow naming convention: mcp__<plugin>_<server>__<tool>`,
						file: serverIndexPath,
						suggestion: `Expected prefix: ${expectedPrefix}<tool_name>`,
					});
					// Don't continue - still check for response_format
				} else {
					// Extract parts from the valid tool name
					const [, toolPluginName, toolServerName, toolNamePart] =
						conventionMatch;

					// Verify plugin and server names match
					if (toolPluginName !== pluginName || toolServerName !== serverName) {
						issues.push({
							ruleId: "mcp/incorrect-plugin-server-name",
							severity: "error",
							message: `Tool "${toolName}" has incorrect plugin/server name. Expected: mcp__${pluginName}_${serverName}__${toolNamePart}`,
							file: serverIndexPath,
							suggestion: `Update tool name to: mcp__${pluginName}_${serverName}__${toolNamePart}`,
						});
					}
				}

				// Check for response_format parameter
				// Note: This is a simple heuristic check. We look for response_format anywhere in the file.
				// A more precise check would require AST parsing, but this catches most cases.
				// Patterns we look for:
				// 1. Zod schema: response_format: z.enum(["markdown", "json"])
				// 2. JSON schema: response_format: { type: "string", enum: ["markdown", "json"] }
				// 3. Allow .optional() or .default() suffixes
				// Note: Using [\s\S] instead of . to match across newlines
				const responseFormatPatterns = [
					/response_format:\s*z[\s\S]*?\.enum\(\["markdown",\s*"json"\]\)/,
					/response_format:\s*\{\s*type:\s*"string",\s*enum:\s*\["markdown",\s*"json"\]/,
					/"response_format":\s*\{\s*"type":\s*"string",\s*"enum":\s*\["markdown",\s*"json"\]/,
				];

				const hasResponseFormat = responseFormatPatterns.some((pattern) =>
					pattern.test(sourceCode),
				);

				if (!hasResponseFormat) {
					issues.push({
						ruleId: "mcp/missing-response-format",
						severity: "warning",
						message: `Tool "${toolName}" is missing response_format parameter`,
						file: serverIndexPath,
						suggestion: `Add to inputSchema: response_format: z.enum(["markdown", "json"]).optional()`,
					});
				}
			}
		}
	} catch (error) {
		issues.push({
			ruleId: "mcp/validation-error",
			severity: "error",
			message: `Failed to validate MCP tool naming: ${error instanceof Error ? error.message : String(error)}`,
			file: mcpDir,
			suggestion: "Check that mcp directory is accessible and readable",
		});
	}

	return issues;
}
