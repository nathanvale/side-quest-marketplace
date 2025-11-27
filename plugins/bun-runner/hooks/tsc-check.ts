#!/usr/bin/env bun

/**
 * PostToolUse hook that runs TypeScript type checking on edited files.
 * Performs single-file type checking for fast feedback during implementation.
 *
 * Git-aware: Only processes files that are tracked by git or staged.
 *
 * Exit codes:
 * - 0: Success (no type errors, or unsupported file type)
 * - 2: Blocking error (type errors found, shown to Claude)
 */

import { spawn } from 'bun'
import { TSC_SUPPORTED_EXTENSIONS } from './shared/constants'
import { isFileInRepo } from './shared/git-utils'
import {
  extractFilePaths,
  parseHookInput,
  type TscError,
  type TscParseResult,
} from './shared/types'

/**
 * Parse TypeScript compiler output into structured format.
 *
 * @param output - Raw stdout/stderr from tsc command
 * @returns Structured error data with count and detailed error array
 */
export function parseTscOutput(output: string): TscParseResult {
  const errors: TscError[] = []

  // TSC output format: file(line,col): error TS1234: message
  const errorPattern = /^(.+?)\((\d+),(\d+)\):\s*error\s+TS\d+:\s*(.+)$/gm
  const matches = output.matchAll(errorPattern)

  for (const match of matches) {
    const [, file, line, col, message] = match
    if (file && line && col && message) {
      errors.push({
        file,
        line: Number.parseInt(line, 10),
        col: Number.parseInt(col, 10),
        message,
      })
    }
  }

  return { errorCount: errors.length, errors }
}

/**
 * Format errors for Claude-friendly output.
 *
 * @param parsed - Parsed TSC output
 * @param filePath - Path to filter errors by
 * @returns Formatted error string
 */
function formatErrors(parsed: TscParseResult, filePath: string): string {
  // Filter to only errors in the edited file
  const fileErrors = parsed.errors.filter(
    (e) => e.file === filePath || e.file.endsWith(filePath),
  )

  if (fileErrors.length === 0) return ''

  const lines: string[] = [`${fileErrors.length} type error(s) in ${filePath}:`]

  for (const e of fileErrors) {
    lines.push(`  ${e.file}:${e.line}:${e.col} - ${e.message}`)
  }

  return lines.join('\n')
}

async function main() {
  const input = await Bun.stdin.text()
  const hookInput = parseHookInput(input)

  if (!hookInput) {
    process.exit(0)
  }

  const filePaths = extractFilePaths(hookInput)

  if (filePaths.length === 0) {
    process.exit(0)
  }

  // Process each file
  const allErrors: string[] = []

  for (const filePath of filePaths) {
    // Skip non-TypeScript files
    if (!TSC_SUPPORTED_EXTENSIONS.some((ext) => filePath.endsWith(ext))) {
      continue
    }

    // Git-aware: Skip files outside the git repository
    const inRepo = await isFileInRepo(filePath)
    if (!inRepo) {
      continue
    }

    // Run tsc --noEmit on the single file
    const proc = spawn({
      cmd: ['bunx', 'tsc', '--noEmit', '--pretty', 'false', filePath],
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const exitCode = await proc.exited
    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const output = `${stdout}\n${stderr}`

    if (exitCode !== 0) {
      const parsed = parseTscOutput(output)
      const formatted = formatErrors(parsed, filePath)
      if (formatted) {
        allErrors.push(formatted)
      }
    }
  }

  if (allErrors.length > 0) {
    console.error(`TypeScript type errors:\n${allErrors.join('\n\n')}`)
    process.exit(2)
  }

  process.exit(0)
}

// Only run main() when executed directly, not when imported by tests
if (import.meta.main) {
  main()
}
