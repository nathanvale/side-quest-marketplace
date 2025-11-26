#!/usr/bin/env bun

import {
  type ClaudeConfig,
  type ProjectConfig,
  readClaudeConfig,
  writeClaudeConfig,
} from './config'

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
  }
}

/**
 * CLI for managing MCP servers
 */
async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  if (
    !command ||
    command === 'help' ||
    command === '--help' ||
    command === '-h'
  ) {
    showHelp()
    process.exit(0)
  }

  try {
    switch (command) {
      case 'list':
        await listServers()
        break
      case 'disable':
        await disableServers(args.slice(1))
        break
      case 'enable':
        await enableServers(args.slice(1))
        break
      default:
        console.error(`Unknown command: ${command}`)
        showHelp()
        process.exit(1)
    }
  } catch (error) {
    console.error(
      'Error:',
      error instanceof Error ? error.message : String(error),
    )
    process.exit(1)
  }
}

function showHelp() {
  console.log(`
MCP Manager CLI

Usage:
  mcp-manager <command> [options]

Commands:
  list                    List all MCP servers with their status
  disable <names...>      Disable one or more servers
  disable all             Disable all servers (current project)
  disable all --global    Disable all servers (all projects)
  enable <names...>       Enable one or more servers
  enable all              Enable all servers (current project)
  enable all --global     Enable all servers (all projects)

Examples:
  mcp-manager list
  mcp-manager disable filesystem tavily-mcp
  mcp-manager disable all
  mcp-manager disable all --global
  mcp-manager enable filesystem
  mcp-manager enable all

Note: Use /mcp command in Claude Code to add/remove servers.
`)
}

async function listServers() {
  const config = readClaudeConfig()
  const projectPath = process.cwd()
  const project = config.projects?.[projectPath]
  const disabledServers = new Set(project?.disabledMcpjsonServers || [])

  // Check if server is disabled in ANY project
  const disabledInAnyProject = new Set<string>()
  for (const proj of Object.values(config.projects || {})) {
    for (const server of proj.disabledMcpjsonServers || []) {
      disabledInAnyProject.add(server)
    }
  }

  console.log('\nMCP Servers:\n')
  console.log('  Status  Name')
  console.log('  ──────  ────')

  for (const [name, server] of Object.entries(config.mcpServers || {})) {
    const disabledHere = disabledServers.has(name)
    const disabledElsewhere = !disabledHere && disabledInAnyProject.has(name)
    const status = disabledHere ? '✗' : disabledElsewhere ? '○' : '✓'
    const command = server.command || 'unknown'
    const args = Array.isArray(server.args) ? server.args.join(' ') : ''
    console.log(`  ${status}       ${name.padEnd(25)} ${command} ${args}`)
  }

  console.log(
    '\n  ✓ = enabled    ✗ = disabled here    ○ = disabled in other projects\n',
  )
  console.log('Use "mcp-manager disable all" to disable in current project')
  console.log(
    'Use "mcp-manager disable all --global" to disable in ALL projects',
  )
  console.log('Restart Claude Code for changes to take effect\n')
}

async function disableServers(args: string[]) {
  const config = readClaudeConfig()
  const projectPath = process.cwd()
  const isGlobal = args.includes('--global')
  const serverNames = args.filter((a) => a !== '--global')

  if (serverNames.length === 0) {
    console.error('Error: Please specify server names or "all"')
    process.exit(1)
  }

  const isAll = serverNames.includes('all')
  const allServerNames = Object.keys(config.mcpServers || {})

  // Helper to update top-level disabledMcpServers
  const updateTopLevelDisabled = (servers: string[]) => {
    const currentDisabled = new Set(config.disabledMcpServers || [])
    for (const name of servers) {
      currentDisabled.add(name)
    }
    config.disabledMcpServers = Array.from(currentDisabled).sort()
  }

  // Helper to update project-level disabledMcpServers (for user MCP servers)
  const updateProjectDisabled = (projPath: string, servers: string[]) => {
    if (!config.projects?.[projPath]) return
    const currentDisabled = new Set(
      config.projects[projPath].disabledMcpServers || [],
    )
    for (const name of servers) {
      currentDisabled.add(name)
    }
    config.projects[projPath].disabledMcpServers =
      Array.from(currentDisabled).sort()
  }

  if (isAll && isGlobal) {
    // Disable in ALL projects (including current) AND top-level
    if (!config.projects) config.projects = {}

    // Ensure current project exists
    if (!config.projects[projectPath]) {
      config.projects[projectPath] = createEmptyProject()
    }

    // Update all existing projects
    for (const projPath in config.projects) {
      const project = config.projects[projPath]
      if (!project) continue
      // disabledMcpjsonServers (for .mcp.json servers)
      if (!project.disabledMcpjsonServers) {
        project.disabledMcpjsonServers = []
      }
      project.disabledMcpjsonServers = [...allServerNames]
      // disabledMcpServers (for user MCP servers)
      project.disabledMcpServers = [...allServerNames]
    }

    // Also update top-level disabledMcpServers
    updateTopLevelDisabled(allServerNames)

    console.log(
      `Disabled all ${allServerNames.length} servers in ${Object.keys(config.projects).length} projects + top-level`,
    )
  } else if (isAll) {
    // Disable in current project only + top-level
    if (!config.projects) config.projects = {}
    if (!config.projects[projectPath]) {
      config.projects[projectPath] = createEmptyProject()
    }
    config.projects[projectPath].disabledMcpjsonServers = [...allServerNames]
    config.projects[projectPath].disabledMcpServers = [...allServerNames]

    // Also update top-level disabledMcpServers
    updateTopLevelDisabled(allServerNames)

    console.log(
      `Disabled all ${allServerNames.length} servers in current project + top-level`,
    )
  } else {
    // Disable specific servers
    if (!config.projects) config.projects = {}
    if (!config.projects[projectPath]) {
      config.projects[projectPath] = createEmptyProject()
    }

    const validServers: string[] = []
    const currentDisabled = new Set(
      config.projects[projectPath].disabledMcpjsonServers || [],
    )
    for (const name of serverNames) {
      if (!config.mcpServers?.[name]) {
        console.warn(`Warning: Server "${name}" not found`)
        continue
      }
      currentDisabled.add(name)
      validServers.push(name)
    }
    config.projects[projectPath].disabledMcpjsonServers =
      Array.from(currentDisabled)

    // Also update top-level disabledMcpServers
    updateTopLevelDisabled(validServers)
    // Also update project-level disabledMcpServers (for user MCP servers)
    updateProjectDisabled(projectPath, validServers)

    console.log(
      `Disabled ${validServers.length} server(s): ${validServers.join(', ')}`,
    )
  }

  writeClaudeConfig(config)
  console.log(
    '\n✓ Changes saved. Restart Claude Code for changes to take effect.\n',
  )
}

async function enableServers(args: string[]) {
  const config = readClaudeConfig()
  const projectPath = process.cwd()
  const isGlobal = args.includes('--global')
  const serverNames = args.filter((a) => a !== '--global')

  if (serverNames.length === 0) {
    console.error('Error: Please specify server names or "all"')
    process.exit(1)
  }

  const isAll = serverNames.includes('all')

  // Helper to update top-level disabledMcpServers (remove from disabled)
  const removeFromTopLevelDisabled = (servers: string[]) => {
    if (!config.disabledMcpServers) return
    const currentDisabled = new Set(config.disabledMcpServers)
    for (const name of servers) {
      currentDisabled.delete(name)
    }
    config.disabledMcpServers = Array.from(currentDisabled).sort()
  }

  // Helper to remove from project-level disabledMcpServers
  const removeFromProjectDisabled = (projPath: string, servers: string[]) => {
    if (!config.projects?.[projPath]?.disabledMcpServers) return
    const currentDisabled = new Set(
      config.projects[projPath].disabledMcpServers,
    )
    for (const name of servers) {
      currentDisabled.delete(name)
    }
    config.projects[projPath].disabledMcpServers =
      Array.from(currentDisabled).sort()
  }

  if (isAll && isGlobal) {
    // Enable in ALL projects + clear top-level
    for (const projPath in config.projects) {
      const project = config.projects[projPath]
      if (!project) continue
      project.disabledMcpjsonServers = []
      project.disabledMcpServers = []
    }
    config.disabledMcpServers = []
    console.log('Enabled all servers in ALL projects + top-level')
  } else if (isAll) {
    // Enable in current project only + clear top-level
    if (config.projects?.[projectPath]) {
      config.projects[projectPath].disabledMcpjsonServers = []
      config.projects[projectPath].disabledMcpServers = []
    }
    config.disabledMcpServers = []
    console.log('Enabled all servers in current project + top-level')
  } else {
    // Enable specific servers
    if (config.projects?.[projectPath]) {
      const currentDisabled = new Set(
        config.projects[projectPath].disabledMcpjsonServers || [],
      )
      for (const name of serverNames) {
        currentDisabled.delete(name)
      }
      config.projects[projectPath].disabledMcpjsonServers =
        Array.from(currentDisabled)
    }

    // Also remove from top-level disabledMcpServers
    removeFromTopLevelDisabled(serverNames)
    // Also remove from project-level disabledMcpServers
    removeFromProjectDisabled(projectPath, serverNames)

    console.log(
      `Enabled ${serverNames.length} server(s): ${serverNames.join(', ')}`,
    )
  }

  writeClaudeConfig(config)
  console.log(
    '\n✓ Changes saved. Restart Claude Code for changes to take effect.\n',
  )
}

main()
