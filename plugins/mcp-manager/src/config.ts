import { homedir } from "node:os";
import { join } from "node:path";
import {
	pathExistsSync,
	readJsonFileSync,
	writeJsonFileSync,
} from "@sidequest/core/fs";

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
	if (!pathExistsSync(CLAUDE_CONFIG_PATH)) {
		throw new Error(`Claude config not found at ${CLAUDE_CONFIG_PATH}`);
	}

	return readJsonFileSync<ClaudeConfig>(CLAUDE_CONFIG_PATH);
}

/**
 * Write the ~/.claude.json configuration file
 */
export function writeClaudeConfig(config: ClaudeConfig): void {
	writeJsonFileSync(CLAUDE_CONFIG_PATH, config);
}
