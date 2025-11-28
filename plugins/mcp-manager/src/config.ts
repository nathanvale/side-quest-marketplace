import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CLAUDE_CONFIG_PATH = join(homedir(), ".claude.json");

export interface McpServer {
	command?: string;
	args?: string[];
	env?: Record<string, string>;
	type?: string;
}

export interface ProjectConfig {
	allowedTools: string[];
	mcpContextUris: string[];
	mcpServers: Record<string, McpServer>;
	enabledMcpjsonServers: string[];
	disabledMcpjsonServers: string[];
	disabledMcpServers?: string[];
	hasTrustDialogAccepted: boolean;
	projectOnboardingSeenCount: number;
	hasClaudeMdExternalIncludesApproved: boolean;
	hasClaudeMdExternalIncludesWarningShown: boolean;
	lastTotalWebSearchRequests: number;
	[key: string]: unknown;
}

export interface ClaudeConfig {
	mcpServers?: Record<string, McpServer>;
	disabledMcpServers?: string[];
	projects?: Record<string, ProjectConfig>;
	[key: string]: unknown;
}

/**
 * Read the ~/.claude.json configuration file
 */
export function readClaudeConfig(): ClaudeConfig {
	if (!existsSync(CLAUDE_CONFIG_PATH)) {
		throw new Error(`Claude config not found at ${CLAUDE_CONFIG_PATH}`);
	}

	const content = readFileSync(CLAUDE_CONFIG_PATH, "utf-8");
	return JSON.parse(content) as ClaudeConfig;
}

/**
 * Write the ~/.claude.json configuration file
 */
export function writeClaudeConfig(config: ClaudeConfig): void {
	const content = JSON.stringify(config, null, 2);
	writeFileSync(CLAUDE_CONFIG_PATH, content, "utf-8");
}
