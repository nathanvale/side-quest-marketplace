#!/usr/bin/env bun

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
	type ProjectConfig,
	readClaudeConfig,
	writeClaudeConfig,
} from "./config";
import { createEnableOptions, type Scope, selectMultiple } from "./interactive";

interface McpJsonConfig {
	mcpServers?: Record<string, unknown>;
}

interface InstalledPlugins {
	plugins?: Record<string, { installPath: string }>;
}

/**
 * Read project .mcp.json if it exists
 */
function readProjectMcpJson(projectPath: string): McpJsonConfig | null {
	const mcpJsonPath = join(projectPath, ".mcp.json");
	if (!existsSync(mcpJsonPath)) return null;
	try {
		return JSON.parse(readFileSync(mcpJsonPath, "utf-8"));
	} catch {
		return null;
	}
}

/**
 * Read MCP servers from installed plugins (via mcp.json files)
 */
function readPluginMcpServers(): Record<
	string,
	{ path: string; servers: Record<string, unknown> }
> {
	const pluginsJsonPath = join(
		process.env.HOME || "",
		".claude/plugins/installed_plugins.json",
	);
	if (!existsSync(pluginsJsonPath)) return {};

	try {
		const installed: InstalledPlugins = JSON.parse(
			readFileSync(pluginsJsonPath, "utf-8"),
		);
		const result: Record<
			string,
			{ path: string; servers: Record<string, unknown> }
		> = {};

		for (const [name, plugin] of Object.entries(installed.plugins || {})) {
			// Check for .mcp.json in plugin directory (note: dotfile)
			const mcpJsonPath = join(plugin.installPath, ".mcp.json");
			if (existsSync(mcpJsonPath)) {
				try {
					const mcpConfig = JSON.parse(readFileSync(mcpJsonPath, "utf-8"));
					if (
						mcpConfig.mcpServers &&
						Object.keys(mcpConfig.mcpServers).length > 0
					) {
						result[name] = { path: mcpJsonPath, servers: mcpConfig.mcpServers };
					}
				} catch {
					// Skip invalid JSON
				}
			}
		}
		return result;
	} catch {
		return {};
	}
}

interface ClaudeSettings {
	enabledPlugins?: Record<string, boolean>;
	disabledMcpjsonServers?: string[];
}

/**
 * Read Claude settings.json for enabled plugins
 */
function readClaudeSettings(): ClaudeSettings | null {
	const settingsPath = join(process.env.HOME || "", ".claude/settings.json");
	if (!existsSync(settingsPath)) return null;
	try {
		return JSON.parse(readFileSync(settingsPath, "utf-8"));
	} catch {
		return null;
	}
}

/**
 * Get list of enabled plugins that provide MCP tools
 */
function _getEnabledPluginMcpServers(): string[] {
	const settings = readClaudeSettings();
	if (!settings?.enabledPlugins) return [];

	return Object.entries(settings.enabledPlugins)
		.filter(([_, enabled]) => enabled)
		.map(([name]) => `plugin:${name.split("@")[0]}`);
}

function createEmptyProject(): ProjectConfig {
	return {
		allowedTools: [],
		mcpContextUris: [],
		mcpServers: {},
		enabledMcpjsonServers: [],
		disabledMcpjsonServers: [],
		hasTrustDialogAccepted: false,
		projectOnboardingSeenCount: 0,
		hasClaudeMdExternalIncludesApproved: false,
		hasClaudeMdExternalIncludesWarningShown: false,
		lastTotalWebSearchRequests: 0,
	};
}

/**
 * CLI for managing MCP servers
 */
async function main() {
	const args = process.argv.slice(2);
	const command = args[0];
	const _isInteractive =
		command === "-i" ||
		command === "--interactive" ||
		args.includes("-i") ||
		args.includes("--interactive");

	// Interactive mode: mcp -i [--global] (TTY only)
	if (command === "-i" || command === "--interactive") {
		if (!process.stdout.isTTY) {
			console.error("Interactive mode requires a terminal (TTY)");
			process.exit(1);
		}
		const scope: Scope = args.includes("--global") ? "global" : "project";
		await interactiveMode(scope);
		return;
	}

	if (
		!command ||
		command === "help" ||
		command === "--help" ||
		command === "-h"
	) {
		showHelp();
		process.exit(0);
	}

	try {
		switch (command) {
			case "list":
				await listServers(args.includes("--debug"));
				break;
			case "disable":
				await disableServers(
					args.slice(1).filter((a) => a !== "-i" && a !== "--interactive"),
				);
				break;
			case "enable":
				await enableServers(
					args.slice(1).filter((a) => a !== "-i" && a !== "--interactive"),
				);
				break;
			case "reset":
				await resetConfig(
					args.slice(1).filter((a) => a !== "-i" && a !== "--interactive"),
				);
				break;
			default:
				console.error(`Unknown command: ${command}`);
				showHelp();
				process.exit(1);
		}
	} catch (error) {
		console.error(
			"Error:",
			error instanceof Error ? error.message : String(error),
		);
		process.exit(1);
	}
}

function showHelp() {
	// Detect if running in terminal (TTY) vs Claude Code
	const isTTY = process.stdout.isTTY;
	const cmd = isTTY ? "claude-mcp" : "mcp-manager";

	if (isTTY) {
		console.log(`
claude-mcp - Manage MCP servers for Claude Code

Enable or disable MCP servers in bulk. By default, changes only affect
Claude Code when running in this directory. Use --global to apply
changes everywhere.

Usage:
  ${cmd} -i                       Toggle servers interactively (project scope)
  ${cmd} -i --global              Toggle servers interactively (global scope)
  ${cmd} list                     Show all servers and their status
  ${cmd} disable <name> [name...] Disable specific servers
  ${cmd} enable <name> [name...]  Enable specific servers
  ${cmd} disable all [--global]   Disable all servers
  ${cmd} enable all [--global]    Enable all servers
  ${cmd} reset                    Clear all project overrides (inherit from global)
  ${cmd} reset --global           Clear global disabled list (enable all globally)

Flags:
  -i, --interactive   Visual multi-select UI (arrows, space, enter)
  --global            Apply everywhere, not just this directory

Scope:
  Project (default): Changes apply only to the current directory.
                     Creates a project-specific override.
  Global (--global): Resets ALL projects to the same state.
                     Use this for a clean slate everywhere.

Examples:
  ${cmd} -i                       Interactive toggle (this directory)
  ${cmd} -i --global              Interactive toggle (everywhere)
  ${cmd} disable filesystem       Disable filesystem in this project
  ${cmd} disable all --global     Disable all servers everywhere

Changes are saved to ~/.claude.json. Restart Claude Code to apply.
`);
	} else {
		console.log(`
MCP Manager CLI

Usage:
  ${cmd} <command> [options]

Commands:
  list                    List all MCP servers with their status
  disable <names...>      Disable one or more servers
  disable all             Disable all servers (current project)
  disable all --global    Disable all servers (global default)
  enable <names...>       Enable one or more servers
  enable all              Enable all servers (current project)
  enable all --global     Enable all servers (global default)
  reset                   Clear all project overrides (inherit from global)
  reset --global          Clear global disabled list (enable all globally)

Examples:
  ${cmd} list
  ${cmd} disable filesystem tavily-mcp
  ${cmd} disable all
  ${cmd} enable all

Note: Use /mcp-manager:add in Claude Code to add new servers.
`);
	}
}

async function listServers(showDebug = false) {
	const config = readClaudeConfig();
	const projectPath = process.cwd();
	const project = config.projects?.[projectPath];

	// Use disabledMcpServers - this is what Claude Code's UI uses
	const effectiveDisabled = new Set(
		project?.disabledMcpServers ?? config.disabledMcpServers ?? [],
	);

	const allServers = Object.keys(config.mcpServers || {});

	if (allServers.length === 0) {
		console.log("\nNo MCP servers configured in ~/.claude.json\n");
		return;
	}

	if (showDebug) {
		const configPath = `${process.env.HOME}/.claude.json`;
		const projectMcpJson = readProjectMcpJson(projectPath);
		const pluginMcpServers = readPluginMcpServers();

		console.log("\n=== MCP Debug Info ===\n");
		console.log(`Project path:    ${projectPath}`);
		console.log(
			`Project config:  ${project ? "YES (has overrides)" : "NO (inherits global)"}`,
		);
		console.log();

		// Show disabled arrays
		console.log("Disabled servers:");
		console.log(
			`  Global:    ${JSON.stringify(config.disabledMcpServers || [])}`,
		);
		if (project) {
			console.log(
				`  Project:   ${JSON.stringify(project.disabledMcpServers ?? [])}`,
			);
		}
		console.log(
			`  Effective: ${JSON.stringify([...effectiveDisabled].sort())}`,
		);

		// 1. Global mcpServers from ~/.claude.json
		console.log("\n────────────────────────────────────────");
		console.log(`Source: ${configPath}`);
		console.log("────────────────────────────────────────");
		if (Object.keys(config.mcpServers || {}).length > 0) {
			console.log(JSON.stringify({ mcpServers: config.mcpServers }, null, 2));
		} else {
			console.log("(no servers configured)");
		}

		// 2. Project .mcp.json
		const projectMcpJsonPath = join(projectPath, ".mcp.json");
		console.log("\n────────────────────────────────────────");
		console.log(`Source: ${projectMcpJsonPath}`);
		console.log("────────────────────────────────────────");
		if (
			projectMcpJson?.mcpServers &&
			Object.keys(projectMcpJson.mcpServers).length > 0
		) {
			console.log(
				JSON.stringify({ mcpServers: projectMcpJson.mcpServers }, null, 2),
			);
		} else {
			console.log("(not found or no servers)");
		}

		// 3. Plugin MCP servers (from mcp.json files)
		console.log("\n────────────────────────────────────────");
		console.log("Source: Plugin mcp.json files");
		console.log("────────────────────────────────────────");
		if (Object.keys(pluginMcpServers).length > 0) {
			for (const [pluginName, { path, servers }] of Object.entries(
				pluginMcpServers,
			)) {
				console.log(`\n# ${pluginName}`);
				console.log(`# ${path}`);
				console.log(JSON.stringify({ mcpServers: servers }, null, 2));
			}
		} else {
			console.log("(no plugins with mcp.json found)");
		}

		// 4. Enabled plugins (provide MCP tools dynamically)
		const settingsPath = join(process.env.HOME || "", ".claude/settings.json");
		const installedPluginsPath = join(
			process.env.HOME || "",
			".claude/plugins/installed_plugins.json",
		);
		const settings = readClaudeSettings();

		// Load installed plugins for paths
		let installedPlugins: InstalledPlugins = { plugins: {} };
		try {
			if (existsSync(installedPluginsPath)) {
				installedPlugins = JSON.parse(
					readFileSync(installedPluginsPath, "utf-8"),
				);
			}
		} catch {
			// ignore
		}

		console.log("\n────────────────────────────────────────");
		console.log(`Source: ${settingsPath}`);
		console.log(`        ${installedPluginsPath}`);
		console.log("────────────────────────────────────────");
		if (settings?.enabledPlugins) {
			const enabled = Object.entries(settings.enabledPlugins)
				.filter(([_, isEnabled]) => isEnabled)
				.map(([name]) => name)
				.sort();

			console.log(
				"\nEnabled plugins (provide MCP tools as plugin:NAME:SERVER):",
			);
			if (enabled.length > 0) {
				for (const name of enabled) {
					const pluginInfo = installedPlugins.plugins?.[name];
					const path = pluginInfo?.installPath || "(path unknown)";
					console.log(`  ✓ ${name}`);
					console.log(`    ${path}`);
				}
			} else {
				console.log("  (none)");
			}
		} else {
			console.log("(no plugins configured)");
		}

		console.log();
		return;
	}

	// Normal list output
	console.log("\nMCP Servers:\n");
	console.log("  Status  Name");
	console.log("  ──────  ────");

	for (const [name, server] of Object.entries(config.mcpServers || {})) {
		const isDisabled = effectiveDisabled.has(name);
		const status = isDisabled ? "✗" : "✓";
		const command = server.command || "unknown";
		const args = Array.isArray(server.args) ? server.args.join(" ") : "";
		console.log(`  ${status}       ${name.padEnd(25)} ${command} ${args}`);
	}

	const enabledCount = allServers.filter(
		(s) => !effectiveDisabled.has(s),
	).length;
	const disabledCount = effectiveDisabled.size;

	const cmd = process.stdout.isTTY ? "claude-mcp" : "mcp-manager";
	console.log(
		`\n  ✓ = enabled (${enabledCount})    ✗ = disabled (${disabledCount})\n`,
	);
	if (process.stdout.isTTY) {
		console.log(`Tip: Use "${cmd} -i" for interactive toggle mode`);
		console.log(`     Use "${cmd} list --debug" for full config details\n`);
	}
}

async function disableServers(args: string[]) {
	const config = readClaudeConfig();
	const projectPath = process.cwd();
	const isGlobal = args.includes("--global");
	const serverNames = args.filter((a) => a !== "--global");

	if (serverNames.length === 0) {
		console.error('Error: Please specify server names or "all"');
		process.exit(1);
	}

	const isAll = serverNames.includes("all");
	const allServerNames = Object.keys(config.mcpServers || {});

	// Validate server names
	const validServers = isAll
		? allServerNames
		: serverNames.filter((name) => {
				if (!config.mcpServers?.[name]) {
					console.warn(`Warning: Server "${name}" not found`);
					return false;
				}
				return true;
			});

	if (isGlobal) {
		// Global: Only update top-level (projects inherit unless they have overrides)
		const currentDisabled = new Set(config.disabledMcpServers || []);
		for (const name of validServers) currentDisabled.add(name);
		config.disabledMcpServers = Array.from(currentDisabled).sort();

		console.log(
			isAll
				? `Disabled all ${validServers.length} servers globally`
				: `Disabled ${validServers.length} server(s) globally: ${validServers.join(", ")}`,
		);
	} else {
		// Project: Only update current project
		if (!config.projects) config.projects = {};
		if (!config.projects[projectPath]) {
			config.projects[projectPath] = createEmptyProject();
		}
		const currentDisabled = new Set(
			config.projects[projectPath].disabledMcpServers || [],
		);
		for (const name of validServers) currentDisabled.add(name);
		config.projects[projectPath].disabledMcpServers =
			Array.from(currentDisabled).sort();

		console.log(
			isAll
				? `Disabled all ${validServers.length} servers in current project`
				: `Disabled ${validServers.length} server(s): ${validServers.join(", ")}`,
		);
	}

	writeClaudeConfig(config);
}

async function enableServers(args: string[]) {
	const config = readClaudeConfig();
	const projectPath = process.cwd();
	const isGlobal = args.includes("--global");
	const serverNames = args.filter((a) => a !== "--global");

	if (serverNames.length === 0) {
		console.error('Error: Please specify server names or "all"');
		process.exit(1);
	}

	const isAll = serverNames.includes("all");

	// Validate server names
	const validServers = isAll
		? Object.keys(config.mcpServers || {})
		: serverNames.filter((name) => {
				if (!config.mcpServers?.[name]) {
					console.warn(`Warning: Server "${name}" not found`);
					return false;
				}
				return true;
			});

	if (isGlobal) {
		// Global: Only update top-level (projects inherit unless they have overrides)
		const currentDisabled = new Set(config.disabledMcpServers || []);
		for (const name of validServers) currentDisabled.delete(name);
		config.disabledMcpServers = Array.from(currentDisabled).sort();

		console.log(
			isAll
				? "Enabled all servers globally"
				: `Enabled ${validServers.length} server(s) globally: ${validServers.join(", ")}`,
		);
	} else {
		// Project: Only update current project
		if (config.projects?.[projectPath]) {
			const currentDisabled = new Set(
				config.projects[projectPath].disabledMcpServers || [],
			);
			for (const name of validServers) currentDisabled.delete(name);
			// If empty, remove the override so project inherits from global
			config.projects[projectPath].disabledMcpServers =
				currentDisabled.size > 0
					? Array.from(currentDisabled).sort()
					: (undefined as unknown as string[]);
		}

		console.log(
			isAll
				? "Enabled all servers in current project"
				: `Enabled ${validServers.length} server(s): ${validServers.join(", ")}`,
		);
	}

	writeClaudeConfig(config);
}

/**
 * Reset config based on scope.
 * - Without --global: Removes MCP overrides from all project configs
 *   (disabledMcpServers, enabledMcpjsonServers, disabledMcpjsonServers)
 * - With --global: Clears the global disabledMcpServers array
 */
async function resetConfig(args: string[]) {
	const config = readClaudeConfig();
	const isGlobal = args.includes("--global");

	if (isGlobal) {
		// Reset global: clear the disabledMcpServers array
		if (!config.disabledMcpServers || config.disabledMcpServers.length === 0) {
			console.log("No global disabled servers to reset.");
			return;
		}

		config.disabledMcpServers = [];
		writeClaudeConfig(config);
		console.log(
			"Cleared global disabled servers list (all servers now enabled globally).",
		);
	} else {
		// Reset projects: remove all MCP overrides from all project configs
		let resetCount = 0;
		for (const projPath in config.projects) {
			const project = config.projects[projPath];
			if (!project) continue;

			let hadOverrides = false;

			// Clear disabledMcpServers
			if (project.disabledMcpServers) {
				project.disabledMcpServers = undefined as unknown as string[];
				hadOverrides = true;
			}

			// Clear enabledMcpjsonServers (servers from .mcp.json that were enabled)
			if (project.enabledMcpjsonServers?.length > 0) {
				project.enabledMcpjsonServers = [];
				hadOverrides = true;
			}

			// Clear disabledMcpjsonServers (servers from .mcp.json that were disabled)
			if (project.disabledMcpjsonServers?.length > 0) {
				project.disabledMcpjsonServers = [];
				hadOverrides = true;
			}

			if (hadOverrides) {
				resetCount++;
			}
		}

		if (resetCount === 0) {
			console.log("No project overrides to reset.");
			return;
		}

		writeClaudeConfig(config);
		console.log(
			`Reset ${resetCount} project(s) to inherit from global settings.`,
		);
	}
}

/**
 * Unified interactive mode.
 * Shows multi-select UI where checked = ENABLED (intuitive).
 *
 * @param scope - Whether to apply changes to 'project' (current directory) or 'global' (all directories)
 */
async function interactiveMode(scope: Scope = "project") {
	const config = readClaudeConfig();
	const projectPath = process.cwd();

	// Use disabledMcpServers - this is what Claude Code's UI uses
	const project = config.projects?.[projectPath];
	const disabled =
		scope === "global"
			? new Set(config.disabledMcpServers || [])
			: new Set(project?.disabledMcpServers ?? config.disabledMcpServers ?? []);

	const servers = config.mcpServers || {};
	if (Object.keys(servers).length === 0) {
		console.log("No MCP servers configured.");
		return;
	}

	// Use enable options: checked = enabled (more intuitive)
	const options = createEnableOptions(servers, disabled);
	const enabledServers = await selectMultiple(
		options,
		"Toggle MCP servers (checked = enabled):",
		scope,
	);

	// Calculate disabled = all servers minus enabled
	const allServers = Object.keys(servers);
	const newDisabled = allServers.filter((s) => !enabledServers.includes(s));

	// Update config based on scope - only use disabledMcpServers
	if (scope === "global") {
		// Global: Only update top-level (projects inherit unless they have overrides)
		config.disabledMcpServers = newDisabled.sort();
	} else {
		// Project: Only update current project
		if (!config.projects) config.projects = {};
		if (!config.projects[projectPath]) {
			config.projects[projectPath] = createEmptyProject();
		}
		// If empty, remove the override so project inherits from global
		config.projects[projectPath].disabledMcpServers =
			newDisabled.length > 0
				? newDisabled.sort()
				: (undefined as unknown as string[]);
	}

	writeClaudeConfig(config);
	const disabledCount = newDisabled.length;
	const enabledCount = enabledServers.length;
	const scopeLabel = scope === "global" ? "GLOBAL" : "PROJECT";

	console.log(`\n✓ Saved (${scopeLabel})`);
	console.log(
		`  Enabled (${enabledCount}): ${enabledServers.length > 0 ? enabledServers.join(", ") : "none"}`,
	);
	console.log(
		`  Disabled (${disabledCount}): ${newDisabled.length > 0 ? newDisabled.join(", ") : "none"}`,
	);
	if (scope === "project") {
		console.log(`\n  Location: ${projectPath}`);
	}
	console.log();
}

main();
