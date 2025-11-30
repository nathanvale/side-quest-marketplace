/**
 * Validator for .mcp.json files
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ValidationIssue, ValidatorOptions } from "../types.ts";

type TransportType = "stdio" | "http" | "sse";

/**
 * Validates URL format
 */
function isValidUrl(url: string): boolean {
	try {
		new URL(url);
		return true;
	} catch {
		return false;
	}
}

/**
 * Validates environment variable syntax (${VAR} or ${VAR:-default})
 */
function isValidEnvVarSyntax(value: string): boolean {
	// Pattern to match ${VAR} or ${VAR:-default}
	const envVarPattern = /\$\{([A-Z_][A-Z0-9_]*)(:-[^}]*)?\}/g;
	const matches = value.matchAll(envVarPattern);
	const matchedRanges: Array<[number, number]> = [];

	// Collect all matched ranges
	for (const match of matches) {
		if (match.index !== undefined) {
			matchedRanges.push([match.index, match.index + match[0].length]);
		}
	}

	// Check if there are any unmatched ${ patterns
	let searchStart = 0;
	let index = value.indexOf("${", searchStart);
	while (index !== -1) {
		// Check if this ${ is within a valid match
		const isInValidMatch = matchedRanges.some(
			([start, end]) => index >= start && index < end,
		);
		if (!isInValidMatch) {
			return false;
		}
		searchStart = index + 2;
		index = value.indexOf("${", searchStart);
	}

	return true;
}

/**
 * Validates value that may contain environment variables
 */
function validateEnvVarValue(
	value: string,
	serverName: string,
	fieldName: string,
	mcpJsonPath: string,
	issues: ValidationIssue[],
): void {
	if (!isValidEnvVarSyntax(value)) {
		issues.push({
			ruleId: "mcp/invalid-env-var-syntax",
			severity: "error",
			message: `Server '${serverName}' has invalid environment variable syntax in '${fieldName}'`,
			file: mcpJsonPath,
			suggestion:
				// biome-ignore lint/suspicious/noTemplateCurlyInString: This is documentation text, not a template literal
				"Use ${VAR} or ${VAR:-default} syntax for environment variables",
		});
	}
}

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
					suggestion: `Make server '${serverName}' an object with transport configuration`,
				});
				continue;
			}

			const config = serverConfig as Record<string, unknown>;

			// Determine transport type
			const explicitType = config.type as string | undefined;
			const hasCommand = "command" in config;
			const hasUrl = "url" in config;

			// Validate transport type if explicitly provided
			if (explicitType !== undefined) {
				if (
					typeof explicitType !== "string" ||
					!["stdio", "http", "sse"].includes(explicitType)
				) {
					issues.push({
						ruleId: "mcp/invalid-transport-type",
						severity: "error",
						message: `Server '${serverName}' has invalid transport type`,
						file: mcpJsonPath,
						suggestion:
							"Use one of: 'stdio', 'http', or 'sse' for the 'type' field",
					});
					continue;
				}
			}

			// Infer transport type: stdio if command present, otherwise require explicit type
			const transportType: TransportType | undefined = explicitType
				? (explicitType as TransportType)
				: hasCommand
					? "stdio"
					: undefined;

			if (!transportType && !hasCommand) {
				issues.push({
					ruleId: "mcp/missing-transport-type",
					severity: "error",
					message: `Server '${serverName}' must specify a 'type' field or provide 'command' for stdio transport`,
					file: mcpJsonPath,
					suggestion:
						"Add a 'type' field ('http', 'sse') or 'command' field for stdio transport",
				});
				continue;
			}

			// Validate based on transport type
			if (transportType === "stdio") {
				// Stdio transport validation: only 'command' is REQUIRED, 'args' is OPTIONAL
				if (!config.command) {
					issues.push({
						ruleId: "mcp/missing-command",
						severity: "error",
						message: `Server '${serverName}' (stdio transport) is missing 'command' property`,
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
				} else {
					// Validate environment variables in command
					validateEnvVarValue(
						config.command,
						serverName,
						"command",
						mcpJsonPath,
						issues,
					);
				}

				// Validate 'args' only if present (it's optional)
				if ("args" in config) {
					if (!Array.isArray(config.args)) {
						issues.push({
							ruleId: "mcp/invalid-args-type",
							severity: "error",
							message: `Server '${serverName}' 'args' must be an array`,
							file: mcpJsonPath,
							suggestion: "Change 'args' to an array of strings",
						});
					} else {
						// Validate environment variables in args
						for (const arg of config.args) {
							if (typeof arg === "string") {
								validateEnvVarValue(
									arg,
									serverName,
									"args",
									mcpJsonPath,
									issues,
								);
							}
						}
					}
				}

				// Check for conflicting fields
				if (hasUrl) {
					issues.push({
						ruleId: "mcp/conflicting-transport-fields",
						severity: "error",
						message: `Server '${serverName}' (stdio transport) should not have 'url' field`,
						file: mcpJsonPath,
						suggestion: "Remove 'url' field for stdio transport servers",
					});
				}

				if ("headers" in config) {
					issues.push({
						ruleId: "mcp/conflicting-transport-fields",
						severity: "error",
						message: `Server '${serverName}' (stdio transport) should not have 'headers' field`,
						file: mcpJsonPath,
						suggestion: "Remove 'headers' field for stdio transport servers",
					});
				}
			} else if (transportType === "http" || transportType === "sse") {
				// HTTP/SSE transport validation
				if (!config.url) {
					issues.push({
						ruleId: "mcp/missing-url",
						severity: "error",
						message: `Server '${serverName}' (${transportType} transport) is missing 'url' property`,
						file: mcpJsonPath,
						suggestion: `Add a "url" property to server '${serverName}' configuration`,
					});
				} else if (typeof config.url !== "string") {
					issues.push({
						ruleId: "mcp/invalid-url",
						severity: "error",
						message: `Server '${serverName}' 'url' must be a string`,
						file: mcpJsonPath,
						suggestion: "Change 'url' to a valid URL string",
					});
				} else {
					// Validate URL format (allow environment variables)
					if (config.url.includes("${")) {
						validateEnvVarValue(
							config.url,
							serverName,
							"url",
							mcpJsonPath,
							issues,
						);
					} else if (!isValidUrl(config.url)) {
						issues.push({
							ruleId: "mcp/invalid-url",
							severity: "error",
							message: `Server '${serverName}' has invalid 'url' format`,
							file: mcpJsonPath,
							suggestion:
								"Provide a valid URL (e.g., 'https://api.example.com/mcp')",
						});
					}
				}

				// Validate optional headers
				if ("headers" in config) {
					if (
						typeof config.headers !== "object" ||
						config.headers === null ||
						Array.isArray(config.headers)
					) {
						issues.push({
							ruleId: "mcp/invalid-headers-type",
							severity: "error",
							message: `Server '${serverName}' 'headers' must be an object`,
							file: mcpJsonPath,
							suggestion: "Change 'headers' to an object with key-value pairs",
						});
					} else {
						// Validate environment variables in header values
						for (const [key, value] of Object.entries(config.headers)) {
							if (typeof value === "string") {
								validateEnvVarValue(
									value,
									serverName,
									`headers.${key}`,
									mcpJsonPath,
									issues,
								);
							}
						}
					}
				}

				// Check for conflicting fields
				if (hasCommand) {
					issues.push({
						ruleId: "mcp/conflicting-transport-fields",
						severity: "error",
						message: `Server '${serverName}' (${transportType} transport) should not have 'command' field`,
						file: mcpJsonPath,
						suggestion: `Remove 'command' field for ${transportType} transport servers`,
					});
				}

				if ("args" in config) {
					issues.push({
						ruleId: "mcp/conflicting-transport-fields",
						severity: "error",
						message: `Server '${serverName}' (${transportType} transport) should not have 'args' field`,
						file: mcpJsonPath,
						suggestion: `Remove 'args' field for ${transportType} transport servers`,
					});
				}
			}

			// Validate optional 'env' property (common to all transports)
			if (config.env !== undefined) {
				if (typeof config.env !== "object" || config.env === null) {
					issues.push({
						ruleId: "mcp/invalid-env-type",
						severity: "error",
						message: `Server '${serverName}' 'env' must be an object`,
						file: mcpJsonPath,
						suggestion: "Change 'env' to an object with key-value pairs",
					});
				} else {
					// Validate environment variables in env values
					for (const [key, value] of Object.entries(config.env)) {
						if (typeof value === "string") {
							validateEnvVarValue(
								value,
								serverName,
								`env.${key}`,
								mcpJsonPath,
								issues,
							);
						}
					}
				}
			}

			// Validate optional 'cwd' property
			if ("cwd" in config) {
				if (typeof config.cwd !== "string") {
					issues.push({
						ruleId: "mcp/invalid-cwd",
						severity: "error",
						message: `Server '${serverName}' 'cwd' must be a string`,
						file: mcpJsonPath,
						suggestion:
							"Change 'cwd' to a string representing a directory path",
					});
				} else {
					// Validate environment variables in cwd
					validateEnvVarValue(
						config.cwd,
						serverName,
						"cwd",
						mcpJsonPath,
						issues,
					);
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
