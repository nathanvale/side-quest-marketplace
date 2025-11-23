import { describe, expect, test } from 'bun:test'
import { findPluginRoot, isPluginFile, processHook } from './validate-plugin'

describe('isPluginFile', () => {
  test('returns true for marketplace.json', () => {
    expect(isPluginFile('marketplace.json')).toBe(true)
  })

  test('returns true for plugin.json', () => {
    expect(isPluginFile('plugin.json')).toBe(true)
  })

  test('returns true for hooks.json', () => {
    expect(isPluginFile('hooks.json')).toBe(true)
  })

  test('returns false for package.json', () => {
    expect(isPluginFile('package.json')).toBe(false)
  })

  test('returns false for index.ts', () => {
    expect(isPluginFile('index.ts')).toBe(false)
  })

  test('returns false for random.json', () => {
    expect(isPluginFile('random.json')).toBe(false)
  })
})

describe('findPluginRoot', () => {
  const MARKETPLACE_ROOT = '/Users/nathanvale/code/side-quest-marketplace'
  const GIT_PLUGIN_ROOT = `${MARKETPLACE_ROOT}/plugins/git`

  test('finds root for file in .claude-plugin/', () => {
    const result = findPluginRoot(`${GIT_PLUGIN_ROOT}/.claude-plugin/plugin.json`)
    expect(result).toBe(GIT_PLUGIN_ROOT)
  })

  test('finds root for marketplace.json in .claude-plugin/', () => {
    const result = findPluginRoot(`${MARKETPLACE_ROOT}/.claude-plugin/marketplace.json`)
    expect(result).toBe(MARKETPLACE_ROOT)
  })

  test('finds root for hooks.json in hooks/ subdirectory', () => {
    const result = findPluginRoot(`${GIT_PLUGIN_ROOT}/hooks/hooks.json`)
    expect(result).toBe(GIT_PLUGIN_ROOT)
  })

  test('returns null for file with no plugin root', () => {
    const result = findPluginRoot('/tmp/some/random/hooks.json')
    expect(result).toBeNull()
  })

  test('returns null for non-plugin file', () => {
    // findPluginRoot still searches for plugin root even for non-plugin filenames
    // The isPluginFile check happens before calling findPluginRoot
    const result = findPluginRoot(`${GIT_PLUGIN_ROOT}/package.json`)
    expect(result).toBeNull()
  })
})

describe('processHook', () => {
  const MARKETPLACE_ROOT = '/Users/nathanvale/code/side-quest-marketplace'
  const GIT_PLUGIN_ROOT = `${MARKETPLACE_ROOT}/plugins/git`

  test('passes through when no file_path', async () => {
    const result = await processHook({})
    expect(result.status).toBe('pass')
  })

  test('passes through when tool_input is empty', async () => {
    const result = await processHook({ tool_input: {} })
    expect(result.status).toBe('pass')
  })

  test('passes through for non-plugin files', async () => {
    const result = await processHook({
      tool_input: { file_path: `${MARKETPLACE_ROOT}/package.json` },
    })
    expect(result.status).toBe('pass')
  })

  test('passes through for TypeScript files', async () => {
    const result = await processHook({
      tool_input: { file_path: `${GIT_PLUGIN_ROOT}/hooks/git-context-loader.ts` },
    })
    expect(result.status).toBe('pass')
  })

  test('validates and passes for valid marketplace.json', async () => {
    const result = await processHook({
      tool_input: { file_path: `${MARKETPLACE_ROOT}/.claude-plugin/marketplace.json` },
    })
    expect(result.status).toBe('pass')
  })

  test('validates and passes for valid plugin.json', async () => {
    const result = await processHook({
      tool_input: { file_path: `${GIT_PLUGIN_ROOT}/.claude-plugin/plugin.json` },
    })
    expect(result.status).toBe('pass')
  })

  test('validates and passes for valid hooks.json', async () => {
    const result = await processHook({
      tool_input: { file_path: `${GIT_PLUGIN_ROOT}/hooks/hooks.json` },
    })
    expect(result.status).toBe('pass')
  })

  test('fails for invalid plugin.json', async () => {
    // Create a temporary invalid plugin
    const tempDir = '/tmp/test-invalid-plugin'
    await Bun.$`mkdir -p ${tempDir}/.claude-plugin`
    await Bun.write(`${tempDir}/.claude-plugin/plugin.json`, '{"version": "1.0.0"}')

    const result = await processHook({
      tool_input: { file_path: `${tempDir}/.claude-plugin/plugin.json` },
    })

    expect(result.status).toBe('fail')
    expect(result.message).toContain('name')
    expect(result.message).toContain('Required')

    // Cleanup
    await Bun.$`rm -rf ${tempDir}`
  })

  test('fails for invalid marketplace.json', async () => {
    // Create a temporary invalid marketplace
    const tempDir = '/tmp/test-invalid-marketplace'
    await Bun.$`mkdir -p ${tempDir}/.claude-plugin`
    await Bun.write(`${tempDir}/.claude-plugin/marketplace.json`, '{"name": "test", "plugins": []}')

    const result = await processHook({
      tool_input: { file_path: `${tempDir}/.claude-plugin/marketplace.json` },
    })

    expect(result.status).toBe('fail')
    expect(result.message).toContain('owner')
    expect(result.message).toContain('Required')

    // Cleanup
    await Bun.$`rm -rf ${tempDir}`
  })

  test('passes through for non-existent file', async () => {
    const result = await processHook({
      tool_input: { file_path: '/tmp/does-not-exist/plugin.json' },
    })
    expect(result.status).toBe('pass')
  })

  test('passes through when plugin root not found', async () => {
    // Create a hooks.json file without a .claude-plugin parent
    const tempDir = '/tmp/test-no-plugin-root'
    await Bun.$`mkdir -p ${tempDir}/hooks`
    await Bun.write(`${tempDir}/hooks/hooks.json`, '{}')

    const result = await processHook({
      tool_input: { file_path: `${tempDir}/hooks/hooks.json` },
    })

    expect(result.status).toBe('pass')

    // Cleanup
    await Bun.$`rm -rf ${tempDir}`
  })
})
