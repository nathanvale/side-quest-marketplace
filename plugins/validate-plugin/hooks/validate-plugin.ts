#!/usr/bin/env bun

/**
 * PostToolUse hook to validate plugin files after Edit/Write operations.
 * Validates: marketplace.json, plugin.json, hooks.json
 *
 * Input: JSON via stdin with tool_input.file_path
 * Output: JSON with pass/fail status
 */

import { existsSync } from 'node:fs'
import { basename, dirname } from 'node:path'
import { spawn } from 'bun'

// --- Types ---

export interface HookInput {
  tool_input?: {
    file_path?: string
  }
}

export interface HookResult {
  status: 'pass' | 'fail'
  message?: string
}

// --- Constants ---

const PLUGIN_FILES = new Set(['marketplace.json', 'plugin.json', 'hooks.json'])

// --- Exported Functions (for testing) ---

/**
 * Check if a filename is a plugin-related file that should be validated
 */
export function isPluginFile(filename: string): boolean {
  return PLUGIN_FILES.has(filename)
}

/**
 * Find the plugin root directory by walking up from the file path
 * Returns the directory containing .claude-plugin/
 */
export function findPluginRoot(filePath: string): string | null {
  const filename = basename(filePath)
  const dir = dirname(filePath)

  // If file is inside .claude-plugin/, the parent is the plugin root
  if (basename(dir) === '.claude-plugin') {
    return dirname(dir)
  }

  // For hooks.json or plugin.json outside .claude-plugin, walk up to find it
  if (filename === 'plugin.json' || filename === 'hooks.json') {
    let searchDir = dir
    while (searchDir !== '/') {
      if (existsSync(`${searchDir}/.claude-plugin`)) {
        return searchDir
      }
      searchDir = dirname(searchDir)
    }
  }

  return null
}

/**
 * Run claude plugin validate on a directory
 * Returns the validation output, whether it passed, and whether there are warnings
 */
export async function runValidation(
  pluginRoot: string,
): Promise<{ passed: boolean; hasWarnings: boolean; output: string }> {
  const proc = spawn({
    cmd: ['claude', 'plugin', 'validate', pluginRoot],
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const exitCode = await proc.exited
  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  const output = `${stdout}${stderr}`.trim()

  // Check if validation passed (exit code 0 or output contains "Validation passed")
  const passed = exitCode === 0 || output.includes('Validation passed')
  // Check if there are warnings
  const hasWarnings = output.includes('warning')

  return { passed, hasWarnings, output }
}

/**
 * Process the hook input and return the result
 */
export async function processHook(input: HookInput): Promise<HookResult> {
  const filePath = input.tool_input?.file_path

  // No file path - pass through
  if (!filePath) {
    return { status: 'pass' }
  }

  const filename = basename(filePath)

  // Not a plugin file - pass through
  if (!isPluginFile(filename)) {
    return { status: 'pass' }
  }

  // File doesn't exist (might have been deleted) - pass through
  if (!existsSync(filePath)) {
    return { status: 'pass' }
  }

  // Find the plugin root
  const pluginRoot = findPluginRoot(filePath)

  // Couldn't find plugin root - pass through
  if (!pluginRoot) {
    return { status: 'pass' }
  }

  // Run validation
  const { passed, hasWarnings, output } = await runValidation(pluginRoot)

  if (passed) {
    // Surface warnings to the user even on pass
    if (hasWarnings) {
      return {
        status: 'pass',
        message: `Plugin validation passed with warnings:\n\n${output}`,
      }
    }
    return { status: 'pass' }
  }

  return {
    status: 'fail',
    message: `Plugin validation failed:\n\n${output}\n\nPlease fix the issues before continuing.`,
  }
}

// --- Main ---

async function main() {
  try {
    // Read input from stdin
    const inputText = await Bun.stdin.text()
    const input: HookInput = inputText ? JSON.parse(inputText) : {}

    // Process and output result
    const result = await processHook(input)
    console.log(JSON.stringify(result))
  } catch (error) {
    // On any error, pass through to avoid blocking the user
    console.log(JSON.stringify({ status: 'pass' }))
  }
}

// Only run main when executed directly, not when imported for tests
if (import.meta.main) {
  main()
}
