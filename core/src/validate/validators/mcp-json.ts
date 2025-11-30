/**
 * Validator for .mcp.json files
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ValidationIssue, ValidatorOptions } from "../types.ts";

/**
 * Validates .mcp.json structure and server configurations
 */
export async function validateMcpJson(
	options: ValidatorOptions,
): Promise<ValidationIssue[]> {
	const issues: ValidationIssue[] = [];
	const mcpJsonPath = join(options.pluginRoot, ".mcp.json");

	// If .mcp.json doesn't exist, skip validation (not required)
	if (!existsSync(mcpJsonPath)) {
		return issues;
	}

	try {
		// Read and parse .mcp.json
		const content = await Bun.file(mcpJsonPath).text();
		const mcpConfig = JSON.parse(content);

		// Validate top-level structure
		if (!mcpConfig.mcpServers) {
			issues.push({
				ruleId: "mcp/missing-servers",
				severity: "error",
				message: ".mcp.json must contain an 'mcpServers' object",
				file: mcpJsonPath,
				suggestion:
					'Add an "mcpServers" object containing your MCP server configurations',
			});
			return issues;
		}

		if (typeof mcpConfig.mcpServers !== "object") {
			issues.push({
				ruleId: "mcp/invalid-servers-type",
				severity: "error",
				message: "'mcpServers' must be an object",
				file: mcpJsonPath,
				suggestion: "Change mcpServers to an object with server names as keys",
			});
			return issues;
		}

		// Validate each server configuration
		for (const [serverName, serverConfig] of Object.entries(
			mcpConfig.mcpServers,
		)) {
			if (typeof serverConfig !== "object" || serverConfig === null) {
				issues.push({
					ruleId: "mcp/invalid-server-config",
					severity: "error",
					message: `Server '${serverName}' configuration must be an object`,
					file: mcpJsonPath,
					suggestion: `Make server '${serverName}' an object with 'command' and 'args' properties`,
				});
				continue;
			}

			const config = serverConfig as Record<string, unknown>;

			// Validate required 'command' property
			if (!config.command) {
				issues.push({
					ruleId: "mcp/missing-command",
					severity: "error",
					message: `Server '${serverName}' is missing 'command' property`,
					file: mcpJsonPath,
					suggestion: `Add a "command" property to server '${serverName}' configuration`,
				});
			} else if (typeof config.command !== "string") {
				issues.push({
					ruleId: "mcp/invalid-command-type",
					severity: "error",
					message: `Server '${serverName}' 'command' must be a string`,
					file: mcpJsonPath,
					suggestion:
						"Change the 'command' value to a string (e.g., 'bun', 'node')",
				});
			}

			// Validate required 'args' property
			if (!config.args) {
				issues.push({
					ruleId: "mcp/missing-args",
					severity: "error",
					message: `Server '${serverName}' is missing 'args' property`,
					file: mcpJsonPath,
					suggestion: `Add an "args" property to server '${serverName}' configuration`,
				});
			} else if (!Array.isArray(config.args)) {
				issues.push({
					ruleId: "mcp/invalid-args-type",
					severity: "error",
					message: `Server '${serverName}' 'args' must be an array`,
					file: mcpJsonPath,
					suggestion: "Change 'args' to an array of strings",
				});
			}

			// Validate optional 'env' property
			if (config.env !== undefined) {
				if (typeof config.env !== "object" || config.env === null) {
					issues.push({
						ruleId: "mcp/invalid-env-type",
						severity: "error",
						message: `Server '${serverName}' 'env' must be an object`,
						file: mcpJsonPath,
						suggestion: "Change 'env' to an object with key-value pairs",
					});
				}
			}
		}
	} catch (error) {
		issues.push({
			ruleId: "mcp/parse-error",
			severity: "error",
			message: `Failed to parse .mcp.json: ${error instanceof Error ? error.message : String(error)}`,
			file: mcpJsonPath,
			suggestion: "Ensure .mcp.json is valid JSON with proper syntax",
		});
	}

	return issues;
}
