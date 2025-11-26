import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  hooksJsonTemplate,
  mcpJsonTemplate,
  mcpServerIndexTemplate,
  packageJsonForType,
  pluginJsonTemplate,
  sampleCommandTemplate,
  skillMdTemplate,
  srcIndexTemplate,
  srcIndexTestTemplate,
  toPascalCase,
  toSnakeCase,
  tsconfigTemplate,
} from './templates'
import type { GenerationResult, PluginConfig, TemplateContext } from './types'

/**
 * Create template context from plugin config.
 */
export function createTemplateContext(config: PluginConfig): TemplateContext {
  return {
    name: config.name,
    description: config.description,
    authorName: config.author.name,
    authorEmail: config.author.email,
    pascalName: toPascalCase(config.name),
    snakeName: toSnakeCase(config.name),
  }
}

/**
 * Generate base plugin structure with core files.
 */
export async function generatePluginStructure(
  config: PluginConfig,
  basePath: string,
): Promise<GenerationResult> {
  const pluginPath = join(basePath, config.name)
  const ctx = createTemplateContext(config)
  const filesCreated: string[] = []

  const isTypescript = config.implementationType === 'typescript'

  try {
    // Create directories
    mkdirSync(pluginPath, { recursive: true })
    mkdirSync(join(pluginPath, '.claude-plugin'), { recursive: true })

    // Create core files
    const packageJsonPath = join(pluginPath, 'package.json')
    writeFileSync(
      packageJsonPath,
      packageJsonForType(ctx, config.implementationType),
    )
    filesCreated.push(packageJsonPath)

    const pluginJsonPath = join(pluginPath, '.claude-plugin', 'plugin.json')
    writeFileSync(pluginJsonPath, pluginJsonTemplate(ctx))
    filesCreated.push(pluginJsonPath)

    // TypeScript-specific files
    if (isTypescript) {
      const tsconfigPath = join(pluginPath, 'tsconfig.json')
      writeFileSync(tsconfigPath, tsconfigTemplate())
      filesCreated.push(tsconfigPath)

      // Create src/ directory with index files
      const srcFiles = await generateSrcDirectory(pluginPath, ctx)
      filesCreated.push(...srcFiles)
    }

    // Generate optional components
    if (config.components.commands) {
      const commandFiles = await generateCommands(pluginPath, ctx)
      filesCreated.push(...commandFiles)
    }

    if (config.components.mcpServer) {
      const mcpFiles = await generateMcpServer(pluginPath, ctx)
      filesCreated.push(...mcpFiles)
    }

    if (config.components.hooks) {
      const hookFiles = await generateHooks(pluginPath, ctx)
      filesCreated.push(...hookFiles)
    }

    if (config.components.skills) {
      const skillFiles = await generateSkill(pluginPath, ctx)
      filesCreated.push(...skillFiles)
    }

    return {
      success: true,
      pluginPath,
      filesCreated,
    }
  } catch (error) {
    return {
      success: false,
      pluginPath,
      filesCreated,
      errors: [error instanceof Error ? error.message : String(error)],
    }
  }
}

/**
 * Generate src/ directory with index.ts and index.test.ts.
 */
export async function generateSrcDirectory(
  pluginPath: string,
  ctx: TemplateContext,
): Promise<string[]> {
  const srcDir = join(pluginPath, 'src')
  mkdirSync(srcDir, { recursive: true })
  const files: string[] = []

  const indexPath = join(srcDir, 'index.ts')
  writeFileSync(indexPath, srcIndexTemplate(ctx))
  files.push(indexPath)

  const testPath = join(srcDir, 'index.test.ts')
  writeFileSync(testPath, srcIndexTestTemplate(ctx))
  files.push(testPath)

  return files
}

/**
 * Generate commands/ directory with sample command.
 */
export async function generateCommands(
  pluginPath: string,
  ctx: TemplateContext,
): Promise<string[]> {
  const commandsDir = join(pluginPath, 'commands')
  mkdirSync(commandsDir, { recursive: true })

  const samplePath = join(commandsDir, 'sample.md')
  writeFileSync(samplePath, sampleCommandTemplate(ctx))

  return [samplePath]
}

/**
 * Generate MCP server with full setup.
 */
export async function generateMcpServer(
  pluginPath: string,
  ctx: TemplateContext,
): Promise<string[]> {
  const mcpDir = join(pluginPath, 'mcp-servers', ctx.name)
  mkdirSync(mcpDir, { recursive: true })
  const files: string[] = []

  // Create index.ts
  const indexPath = join(mcpDir, 'index.ts')
  writeFileSync(indexPath, mcpServerIndexTemplate(ctx))
  files.push(indexPath)

  // Create package.json for MCP server
  const pkgPath = join(mcpDir, 'package.json')
  const mcpPkg = {
    name: `@sidequest/mcp-${ctx.name}`,
    version: '1.0.0',
    private: true,
    type: 'module',
    main: 'index.ts',
    scripts: {
      start: 'bun run index.ts',
      test: "echo 'No tests yet'",
      typecheck: "echo 'No typecheck yet'",
    },
    dependencies: {
      mcpez: '^1.2.1',
    },
  }
  writeFileSync(pkgPath, JSON.stringify(mcpPkg, null, 2))
  files.push(pkgPath)

  // Create .mcp.json at plugin root
  const mcpJsonPath = join(pluginPath, '.mcp.json')
  writeFileSync(mcpJsonPath, mcpJsonTemplate(ctx))
  files.push(mcpJsonPath)

  return files
}

/**
 * Generate hooks/ directory with hooks.json.
 */
export async function generateHooks(
  pluginPath: string,
  ctx: TemplateContext,
): Promise<string[]> {
  const hooksDir = join(pluginPath, 'hooks')
  mkdirSync(hooksDir, { recursive: true })
  const files: string[] = []

  const hooksJsonPath = join(hooksDir, 'hooks.json')
  writeFileSync(hooksJsonPath, hooksJsonTemplate(ctx))
  files.push(hooksJsonPath)

  return files
}

/**
 * Generate skills/ directory with SKILL.md.
 */
export async function generateSkill(
  pluginPath: string,
  ctx: TemplateContext,
): Promise<string[]> {
  const skillDir = join(pluginPath, 'skills', ctx.name)
  mkdirSync(skillDir, { recursive: true })
  const files: string[] = []

  const skillPath = join(skillDir, 'SKILL.md')
  writeFileSync(skillPath, skillMdTemplate(ctx))
  files.push(skillPath)

  return files
}
