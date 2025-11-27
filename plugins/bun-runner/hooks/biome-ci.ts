#!/usr/bin/env bun

/**
 * Stop hook that runs Biome CI on staged/changed files at end of turn.
 * Provides a final quality gate before Claude completes its response.
 *
 * Git-aware: Only checks files that have been modified or staged.
 * Uses `biome ci` (read-only, strict) for project-wide validation.
 *
 * Exit codes:
 * - 0: Success (all files pass or no relevant changes)
 * - 2: Blocking error (lint/format errors found, shown to Claude for follow-up)
 */

import { spawn } from 'bun'
import { parseBiomeOutput } from '../mcp-servers/bun-runner/index'
import { BIOME_SUPPORTED_EXTENSIONS } from './shared/constants'
import { getChangedFiles } from './shared/git-utils'

function formatDiagnostics(
  summary: ReturnType<typeof parseBiomeOutput>,
): string {
  if (summary.error_count === 0 && summary.warning_count === 0) {
    return ''
  }

  const lines: string[] = []
  lines.push(
    `${summary.error_count} error(s), ${summary.warning_count} warning(s):`,
  )

  for (const d of summary.diagnostics) {
    lines.push(`  ${d.file}:${d.line} [${d.code}] ${d.message}`)
  }

  return lines.join('\n')
}

async function main() {
  // Get changed files filtered by Biome-supported extensions
  const filesToCheck = await getChangedFiles(BIOME_SUPPORTED_EXTENSIONS)

  if (filesToCheck.length === 0) {
    // No relevant files changed, nothing to check
    process.exit(0)
  }

  // Run biome ci (strict, read-only) on changed files
  const proc = spawn({
    cmd: [
      'bunx',
      '@biomejs/biome',
      'ci',
      '--reporter=json',
      '--no-errors-on-unmatched',
      ...filesToCheck,
    ],
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const exitCode = await proc.exited
  const stdout = await new Response(proc.stdout).text()

  if (exitCode === 0) {
    // All checks passed
    process.exit(0)
  }

  // Parse and report errors
  if (stdout.trim()) {
    const summary = parseBiomeOutput(stdout)
    if (summary.error_count > 0 || summary.warning_count > 0) {
      const diagnostics = formatDiagnostics(summary)
      console.error(
        `Biome CI found issues in ${filesToCheck.length} changed file(s):\n${diagnostics}`,
      )
      console.error('\nRun "biome check --write" to auto-fix safe issues.')
      process.exit(2)
    }
  }

  process.exit(0)
}

main()
