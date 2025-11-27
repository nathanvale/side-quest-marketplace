#!/usr/bin/env bun

/// <reference types="bun-types" />

/**
 * Smart Test Runner & Linter MCP Server
 *
 * Provides tools to run tests and linting with structured, token-efficient output.
 * Filters out passing tests and verbose logs, focusing agents on failures.
 *
 * Uses native Bun.spawn() for better performance over Node.js child_process.
 */

import { spawn } from 'bun'
import { startServer, tool, z } from 'mcpez'

// --- Types ---

/**
 * Response format options for tool output
 */
enum ResponseFormat {
  MARKDOWN = 'markdown',
  JSON = 'json',
}

export interface TestFailure {
  file: string
  message: string
  line?: number
  stack?: string
}

export interface TestSummary {
  passed: number
  failed: number
  total: number
  failures: TestFailure[]
}

export interface LintDiagnostic {
  file: string
  message: string
  code: string
  line: number
  severity: 'error' | 'warning' | 'info'
  suggestion?: string
}

export interface LintSummary {
  error_count: number
  warning_count: number
  diagnostics: LintDiagnostic[]
}

// --- Parsing Functions (exported for testing) ---

/**
 * Parse bun test output to extract test results
 */
export function parseBunTestOutput(output: string): TestSummary {
  const failures: TestFailure[] = []
  const lines = output.split('\n')
  let currentFailure: TestFailure | null = null

  for (const line of lines) {
    if (!line) continue

    // Start of a failure
    if (line.includes('✗') || line.includes('FAIL')) {
      if (currentFailure) failures.push(currentFailure)
      currentFailure = {
        file: 'unknown',
        message: line.trim(),
      }
    } else if (currentFailure) {
      // Capture stack trace or error message
      if (line.trim().startsWith('at ')) {
        // Try to extract file/line: at /path/to/file.ts:10:5
        const match = line.match(/at (.+):(\d+):(\d+)/)
        if (match?.[1] && match[2]) {
          currentFailure.file = match[1]
          currentFailure.line = Number.parseInt(match[2], 10)
        }
        currentFailure.stack = `${currentFailure.stack || ''}${line}\n`
      } else if (line.trim()) {
        // Likely error message continuation
        currentFailure.message += `\n${line.trim()}`
      }
    }
  }
  if (currentFailure) failures.push(currentFailure)

  // Parse summary numbers
  const passMatch = output.match(/(\d+) pass/)
  const failMatch = output.match(/(\d+) fail/)

  const passed = passMatch?.[1] ? Number.parseInt(passMatch[1], 10) : 0
  const failed = failMatch?.[1]
    ? Number.parseInt(failMatch[1], 10)
    : failures.length

  return {
    passed,
    failed,
    total: passed + failed,
    failures,
  }
}

/**
 * Parse Biome JSON output to extract lint diagnostics
 */
export function parseBiomeOutput(stdout: string): LintSummary {
  try {
    const report = JSON.parse(stdout)
    const diagnostics: LintDiagnostic[] = []

    if (report.diagnostics) {
      for (const d of report.diagnostics) {
        if (d.severity === 'error' || d.severity === 'warning') {
          diagnostics.push({
            file: d.location?.path?.file || 'unknown',
            line: d.location?.span?.start?.line || 0,
            message: d.description || d.message,
            code: d.category || 'unknown',
            severity: d.severity,
            suggestion: d.advice ? JSON.stringify(d.advice) : undefined,
          })
        }
      }
    }

    const summary = report.summary || {}

    return {
      error_count:
        summary.errorCount ||
        diagnostics.filter((d) => d.severity === 'error').length,
      warning_count:
        summary.warnCount ||
        diagnostics.filter((d) => d.severity === 'warning').length,
      diagnostics,
    }
  } catch (_e) {
    return {
      error_count: 1,
      warning_count: 0,
      diagnostics: [
        {
          file: 'unknown',
          line: 0,
          message: `Failed to parse Biome JSON output: ${stdout.substring(0, 200)}`,
          code: 'internal_error',
          severity: 'error',
        },
      ],
    }
  }
}

// --- Helpers ---

/**
 * Run Bun tests and parse output using native Bun.spawn()
 * Uses AbortController for timeout instead of spawn's buggy timeout option
 */
async function runBunTests(pattern?: string): Promise<TestSummary> {
  const cmd = pattern ? ['bun', 'test', pattern] : ['bun', 'test']
  const TIMEOUT_MS = 30000

  // Use AbortController for timeout - Bun's timeout option is buggy
  // (sets killed=true and truncates stdout even when process completes normally)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  const proc = spawn({
    cmd,
    env: { ...process.env, CI: 'true' },
    stdout: 'pipe',
    stderr: 'pipe',
    signal: controller.signal,
  })

  // IMPORTANT: Consume streams in parallel with waiting for exit.
  // Reading after proc.exited resolves can miss output (race condition).
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  clearTimeout(timeoutId)

  // Check for timeout via AbortController
  if (controller.signal.aborted) {
    return {
      passed: 0,
      failed: 1,
      total: 1,
      failures: [
        {
          file: 'timeout',
          message:
            'Tests timed out after 30 seconds. Possible causes: open handles, infinite loops, or watch mode accidentally enabled.',
        },
      ],
    }
  }

  // Combine stdout and stderr - bun test outputs results to stderr
  const output = `${stdout}\n${stderr}`

  // If exit code is 0, all tests passed
  if (exitCode === 0) {
    const passMatch = output.match(/(\d+) pass/)
    const passed = passMatch?.[1] ? Number.parseInt(passMatch[1], 10) : 0

    return {
      passed,
      failed: 0,
      total: passed,
      failures: [],
    }
  }

  // Parse failures from combined output
  return parseBunTestOutput(output)
}

/**
 * Run Biome check and parse JSON output using native Bun.spawn()
 */
async function runBiomeCheck(path = '.'): Promise<LintSummary> {
  const proc = spawn({
    cmd: ['bunx', '@biomejs/biome', 'check', '--reporter=json', path],
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const exitCode = await proc.exited
  const stdout = await new Response(proc.stdout).text()

  if (exitCode === 0) {
    return { error_count: 0, warning_count: 0, diagnostics: [] }
  }

  return parseBiomeOutput(stdout)
}

/**
 * Run Biome check --write and return what was fixed
 */
async function runBiomeFix(
  path = '.',
): Promise<{ fixed: number; remaining: LintSummary }> {
  // First run with --write to fix issues
  const fixProc = spawn({
    cmd: [
      'bunx',
      '@biomejs/biome',
      'check',
      '--write',
      '--reporter=json',
      path,
    ],
    stdout: 'pipe',
    stderr: 'pipe',
  })

  await fixProc.exited
  const fixStdout = await new Response(fixProc.stdout).text()

  // Count fixed issues from the output
  let fixed = 0
  try {
    const report = JSON.parse(fixStdout)
    fixed = report.summary?.fixedCount || 0
  } catch {
    // Ignore parse errors for fix count
  }

  // Then check for remaining issues
  const remaining = await runBiomeCheck(path)

  return { fixed, remaining }
}

/**
 * Run Biome format check (no write) using native Bun.spawn()
 */
async function runBiomeFormatCheck(
  path = '.',
): Promise<{ formatted: boolean; files: string[] }> {
  const proc = spawn({
    cmd: ['bunx', '@biomejs/biome', 'format', '--reporter=json', path],
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const exitCode = await proc.exited
  const stdout = await new Response(proc.stdout).text()

  if (exitCode === 0) {
    return { formatted: true, files: [] }
  }

  // Parse unformatted files from output
  const unformattedFiles: string[] = []
  try {
    const report = JSON.parse(stdout)
    if (report.diagnostics) {
      for (const d of report.diagnostics) {
        const file = d.location?.path?.file
        if (file && !unformattedFiles.includes(file)) {
          unformattedFiles.push(file)
        }
      }
    }
  } catch {
    // If parse fails, just report not formatted
  }

  return { formatted: false, files: unformattedFiles }
}

/**
 * Run Bun tests with coverage and parse output
 * Uses AbortController for timeout instead of spawn's buggy timeout option
 */
async function runBunTestCoverage(): Promise<{
  summary: TestSummary
  coverage: { percent: number; uncovered: string[] }
}> {
  const TIMEOUT_MS = 60000

  // Use AbortController for timeout - Bun's timeout option is buggy
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  const proc = spawn({
    cmd: ['bun', 'test', '--coverage'],
    env: { ...process.env, CI: 'true' },
    stdout: 'pipe',
    stderr: 'pipe',
    signal: controller.signal,
  })

  // IMPORTANT: Consume streams in parallel with waiting for exit.
  // Reading after proc.exited resolves can miss output (race condition).
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  clearTimeout(timeoutId)

  const output = `${stdout}\n${stderr}`

  // Check for timeout via AbortController
  if (controller.signal.aborted) {
    return {
      summary: {
        passed: 0,
        failed: 1,
        total: 1,
        failures: [
          {
            file: 'timeout',
            message: 'Tests timed out after 60 seconds.',
          },
        ],
      },
      coverage: { percent: 0, uncovered: [] },
    }
  }

  // Parse test results
  const summary =
    exitCode === 0 ? parseBunTestOutput(stdout) : parseBunTestOutput(output)

  // Parse coverage from output (e.g., "Coverage: 85.5%")
  const coverageMatch = output.match(/(\d+(?:\.\d+)?)\s*%/)
  const percent = coverageMatch?.[1] ? Number.parseFloat(coverageMatch[1]) : 0

  // Find uncovered files (lines with 0% or low coverage)
  const uncovered: string[] = []
  const lines = output.split('\n')
  for (const line of lines) {
    // Match lines like "src/file.ts | 0.00% | ..."
    const match = line.match(/^([^\s|]+)\s*\|\s*(\d+(?:\.\d+)?)\s*%/)
    if (match?.[1] && match[2]) {
      const file = match[1].trim()
      const fileCoverage = Number.parseFloat(match[2])
      if (fileCoverage < 50 && file.endsWith('.ts')) {
        uncovered.push(`${file} (${fileCoverage}%)`)
      }
    }
  }

  return {
    summary,
    coverage: { percent, uncovered },
  }
}

// --- Formatters ---

/**
 * Format test summary for display
 */
function formatTestSummary(
  summary: TestSummary,
  format: ResponseFormat = ResponseFormat.MARKDOWN,
  context?: string,
): string {
  if (format === ResponseFormat.JSON) {
    return JSON.stringify({ ...summary, context }, null, 2)
  }

  if (summary.failed === 0) {
    const ctx = context ? ` in ${context}` : ''
    return `All ${summary.passed} tests passed${ctx}.`
  }

  let output = `${summary.failed} tests failed${context ? ` in ${context}` : ''} (${summary.passed} passed)\n\n`

  summary.failures.forEach((f, i) => {
    output += `${i + 1}. ${f.file}:${f.line || '?'}\n`
    output += `   ${f.message.split('\n')[0]}\n`
    if (f.stack) {
      output += `${f.stack
        .split('\n')
        .map((l) => `      ${l}`)
        .join('\n')}\n`
    }
    output += '\n'
  })

  return output.trim()
}

/**
 * Format lint summary for display
 */
function formatLintSummary(
  summary: LintSummary,
  format: ResponseFormat = ResponseFormat.MARKDOWN,
): string {
  if (format === ResponseFormat.JSON) {
    return JSON.stringify(summary, null, 2)
  }

  if (summary.error_count === 0 && summary.warning_count === 0) {
    return 'No linting issues found.'
  }

  let output = `Found ${summary.error_count} errors and ${summary.warning_count} warnings:\n\n`

  summary.diagnostics.forEach((d) => {
    const icon = d.severity === 'error' ? '[error]' : '[warn]'
    output += `${icon} ${d.file}:${d.line} [${d.code}]\n`
    output += `   ${d.message}\n`
    if (d.suggestion) {
      output += '   Suggestion available\n'
    }
    output += '\n'
  })

  return output.trim()
}

/**
 * Format lint fix result for display
 */
function formatLintFixResult(
  fixed: number,
  remaining: LintSummary,
  format: ResponseFormat = ResponseFormat.MARKDOWN,
): string {
  if (format === ResponseFormat.JSON) {
    return JSON.stringify({ fixed, remaining }, null, 2)
  }

  let output = ''

  if (fixed > 0) {
    output += `Fixed ${fixed} issue(s)\n\n`
  }

  if (remaining.error_count === 0 && remaining.warning_count === 0) {
    if (fixed === 0) {
      return 'No issues to fix.'
    }
    return `${output}All issues resolved.`.trim()
  }

  output += `${remaining.error_count} error(s) and ${remaining.warning_count} warning(s) remain:\n\n`

  remaining.diagnostics.forEach((d) => {
    const icon = d.severity === 'error' ? '[error]' : '[warn]'
    output += `${icon} ${d.file}:${d.line} [${d.code}]\n`
    output += `   ${d.message}\n\n`
  })

  return output.trim()
}

/**
 * Format coverage result for display
 */
function formatCoverageResult(
  summary: TestSummary,
  coverage: { percent: number; uncovered: string[] },
  format: ResponseFormat = ResponseFormat.MARKDOWN,
): string {
  if (format === ResponseFormat.JSON) {
    return JSON.stringify({ summary, coverage }, null, 2)
  }

  let output = ''

  if (summary.failed === 0) {
    output += `All ${summary.passed} tests passed.\n\n`
  } else {
    output += `${summary.failed} tests failed (${summary.passed} passed)\n\n`
  }

  output += `Coverage: ${coverage.percent}%\n`

  if (coverage.uncovered.length > 0) {
    output += '\nFiles with low coverage (<50%):\n'
    coverage.uncovered.forEach((f) => {
      output += `   - ${f}\n`
    })
  }

  return output.trim()
}

/**
 * Format format check result for display
 */
function formatFormatCheckResult(
  formatted: boolean,
  files: string[],
  format: ResponseFormat = ResponseFormat.MARKDOWN,
): string {
  if (format === ResponseFormat.JSON) {
    return JSON.stringify({ formatted, unformatted_files: files }, null, 2)
  }

  if (formatted) {
    return 'All files are properly formatted.'
  }

  let output = `${files.length} file(s) need formatting:\n\n`
  files.forEach((f) => {
    output += `   - ${f}\n`
  })
  output += '\nRun bun_lintFix to auto-format these files.'

  return output.trim()
}

// --- Tools ---

tool(
  'bun_runTests',
  {
    description:
      "Run tests using Bun and return a concise summary of failures. Use this instead of 'bun test' to save tokens and get structured error reports.",
    inputSchema: {
      pattern: z
        .string()
        .optional()
        .describe(
          "File pattern or test name to filter tests (e.g., 'auth' or 'login.test.ts')",
        ),
      response_format: z
        .enum(['markdown', 'json'])
        .optional()
        .describe("Output format: 'markdown' (default) or 'json'"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async (args: { pattern?: string; response_format?: string }) => {
    const format =
      args.response_format === 'json'
        ? ResponseFormat.JSON
        : ResponseFormat.MARKDOWN
    const summary = await runBunTests(args.pattern)
    return {
      content: [
        { type: 'text' as const, text: formatTestSummary(summary, format) },
      ],
    }
  },
)

tool(
  'bun_testFile',
  {
    description:
      'Run tests for a specific file only. More targeted than bun_runTests with a pattern.',
    inputSchema: {
      file: z
        .string()
        .describe("Path to the test file to run (e.g., 'src/utils.test.ts')"),
      response_format: z
        .enum(['markdown', 'json'])
        .optional()
        .describe("Output format: 'markdown' (default) or 'json'"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async (args: Record<string, unknown>) => {
    const { file, response_format } = args as {
      file: string
      response_format?: string
    }
    const format =
      response_format === 'json' ? ResponseFormat.JSON : ResponseFormat.MARKDOWN
    const summary = await runBunTests(file)
    return {
      content: [
        {
          type: 'text' as const,
          text: formatTestSummary(summary, format, file),
        },
      ],
    }
  },
)

tool(
  'bun_testCoverage',
  {
    description:
      'Run tests with code coverage and return a summary. Shows overall coverage percentage and files with low coverage.',
    inputSchema: {
      response_format: z
        .enum(['markdown', 'json'])
        .optional()
        .describe("Output format: 'markdown' (default) or 'json'"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async (args: { response_format?: string }) => {
    const format =
      args.response_format === 'json'
        ? ResponseFormat.JSON
        : ResponseFormat.MARKDOWN
    const { summary, coverage } = await runBunTestCoverage()
    return {
      content: [
        {
          type: 'text' as const,
          text: formatCoverageResult(summary, coverage, format),
        },
      ],
    }
  },
)

tool(
  'bun_lintCheck',
  {
    description:
      'Run Biome linter on files and return structured errors. Use this to check for code quality issues without fixing them.',
    inputSchema: {
      path: z
        .string()
        .optional()
        .describe(
          'Path to file or directory to check (default: current directory)',
        ),
      response_format: z
        .enum(['markdown', 'json'])
        .optional()
        .describe("Output format: 'markdown' (default) or 'json'"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async (args: { path?: string; response_format?: string }) => {
    const format =
      args.response_format === 'json'
        ? ResponseFormat.JSON
        : ResponseFormat.MARKDOWN
    const summary = await runBiomeCheck(args.path)
    return {
      content: [
        { type: 'text' as const, text: formatLintSummary(summary, format) },
      ],
    }
  },
)

tool(
  'bun_lintFix',
  {
    description:
      'Run Biome linter with --write to auto-fix issues. Returns count of fixed issues and any remaining unfixable errors.',
    inputSchema: {
      path: z
        .string()
        .optional()
        .describe(
          'Path to file or directory to fix (default: current directory)',
        ),
      response_format: z
        .enum(['markdown', 'json'])
        .optional()
        .describe("Output format: 'markdown' (default) or 'json'"),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async (args: { path?: string; response_format?: string }) => {
    const format =
      args.response_format === 'json'
        ? ResponseFormat.JSON
        : ResponseFormat.MARKDOWN
    const { fixed, remaining } = await runBiomeFix(args.path)
    return {
      content: [
        {
          type: 'text' as const,
          text: formatLintFixResult(fixed, remaining, format),
        },
      ],
    }
  },
)

tool(
  'bun_formatCheck',
  {
    description:
      'Check if files are properly formatted without making changes. Returns list of unformatted files.',
    inputSchema: {
      path: z
        .string()
        .optional()
        .describe(
          'Path to file or directory to check (default: current directory)',
        ),
      response_format: z
        .enum(['markdown', 'json'])
        .optional()
        .describe("Output format: 'markdown' (default) or 'json'"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async (args: { path?: string; response_format?: string }) => {
    const format =
      args.response_format === 'json'
        ? ResponseFormat.JSON
        : ResponseFormat.MARKDOWN
    const { formatted, files } = await runBiomeFormatCheck(args.path)
    return {
      content: [
        {
          type: 'text' as const,
          text: formatFormatCheckResult(formatted, files, format),
        },
      ],
    }
  },
)

startServer('bun-runner', { version: '1.0.0' })
