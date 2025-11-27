/**
 * Kit Plugin Validators
 *
 * Input validation and security utilities for safe Kit CLI operations.
 */

import { existsSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, normalize, resolve } from 'node:path'
import { DEFAULT_KIT_PATH } from './types.js'

// ============================================================================
// Path Utilities
// ============================================================================

/**
 * Expand tilde (~) in paths to the user's home directory.
 * @param inputPath - Path that may contain tilde
 * @returns Expanded absolute path
 *
 * @example
 * expandTilde('~/code') // => '/Users/nathan/code'
 * expandTilde('/absolute/path') // => '/absolute/path'
 */
export function expandTilde(inputPath: string): string {
  if (inputPath.startsWith('~/')) {
    return inputPath.replace('~', homedir())
  }
  if (inputPath === '~') {
    return homedir()
  }
  return inputPath
}

/**
 * Normalize and resolve a path, expanding tilde and making it absolute.
 * @param inputPath - Path to normalize
 * @param basePath - Base path for relative paths (default: cwd)
 * @returns Normalized absolute path
 */
export function normalizePath(inputPath: string, basePath?: string): string {
  const expanded = expandTilde(inputPath)
  const resolved = isAbsolute(expanded)
    ? expanded
    : resolve(basePath ?? process.cwd(), expanded)
  return normalize(resolved)
}

// ============================================================================
// Path Validation
// ============================================================================

/**
 * Result of path validation.
 */
export interface PathValidationResult {
  /** Whether the path is valid */
  valid: boolean
  /** Normalized absolute path (only if valid) */
  path?: string
  /** Error message (only if invalid) */
  error?: string
}

/**
 * Validate a path for Kit operations.
 *
 * Checks:
 * - Path exists
 * - Path is a directory (for search operations)
 * - No path traversal attacks (.. sequences escaping base)
 *
 * @param inputPath - Path to validate
 * @param options - Validation options
 * @returns Validation result with normalized path or error
 */
export function validatePath(
  inputPath: string,
  options: {
    /** Base directory to restrict access within (optional) */
    basePath?: string
    /** Whether the path must be a directory (default: true) */
    mustBeDirectory?: boolean
    /** Whether the path must exist (default: true) */
    mustExist?: boolean
  } = {},
): PathValidationResult {
  const { basePath, mustBeDirectory = true, mustExist = true } = options

  // Empty path check
  if (!inputPath || inputPath.trim() === '') {
    return { valid: false, error: 'Path cannot be empty' }
  }

  // Normalize the path
  const normalizedPath = normalizePath(inputPath, basePath)

  // Path traversal check - if basePath is specified, ensure we stay within it
  if (basePath) {
    const normalizedBase = normalizePath(basePath)
    if (!normalizedPath.startsWith(normalizedBase)) {
      return {
        valid: false,
        error: 'Path traversal detected: path escapes base directory',
      }
    }
  }

  // Existence check
  if (mustExist && !existsSync(normalizedPath)) {
    return { valid: false, error: `Path does not exist: ${normalizedPath}` }
  }

  // Directory check
  if (mustExist && mustBeDirectory) {
    try {
      const stats = statSync(normalizedPath)
      if (!stats.isDirectory()) {
        return {
          valid: false,
          error: `Path is not a directory: ${normalizedPath}`,
        }
      }
    } catch {
      return { valid: false, error: `Cannot access path: ${normalizedPath}` }
    }
  }

  return { valid: true, path: normalizedPath }
}

// ============================================================================
// Glob Validation
// ============================================================================

/**
 * Characters that are valid in glob patterns.
 * Restricts to safe subset to prevent injection.
 */
const SAFE_GLOB_CHARS = /^[a-zA-Z0-9_\-.*?[\]{}/\\,!]+$/

/**
 * Validate a glob pattern for safety.
 * @param pattern - Glob pattern to validate
 * @returns True if pattern is safe
 */
export function isValidGlob(pattern: string): boolean {
  // Empty check
  if (!pattern || pattern.trim() === '') {
    return false
  }

  // Trim before checking (allow leading/trailing whitespace)
  const trimmed = pattern.trim()

  // Check for safe characters only
  if (!SAFE_GLOB_CHARS.test(trimmed)) {
    return false
  }

  // Check for balanced brackets
  let bracketDepth = 0
  let braceDepth = 0
  for (const char of trimmed) {
    if (char === '[') bracketDepth++
    if (char === ']') bracketDepth--
    if (char === '{') braceDepth++
    if (char === '}') braceDepth--
    if (bracketDepth < 0 || braceDepth < 0) return false
  }

  return bracketDepth === 0 && braceDepth === 0
}

/**
 * Validate and sanitize a glob pattern.
 * @param pattern - Glob pattern to validate
 * @returns Validation result
 */
export function validateGlob(pattern: string): {
  valid: boolean
  pattern?: string
  error?: string
} {
  if (!isValidGlob(pattern)) {
    return {
      valid: false,
      error: `Invalid glob pattern: ${pattern}. Use patterns like "*.py", "**/*.ts", or "src/**/*.js"`,
    }
  }

  return { valid: true, pattern: pattern.trim() }
}

// ============================================================================
// Regex Validation (ReDoS Prevention)
// ============================================================================

/**
 * Patterns known to cause catastrophic backtracking (ReDoS).
 * These are simplified heuristics - not exhaustive.
 */
const REDOS_PATTERNS = [
  // Nested quantifiers: (a+)+, (a*)*
  /\([^)]*[+*][^)]*\)[+*]/,
  // Overlapping alternation with quantifiers: (a|a)+
  /\(([^|)]+)\|\1\)[+*]/,
  // Long repeating groups: (.+.+)+
  /\(\.[+*]\.[+*]\)[+*]/,
]

/**
 * Check if a regex pattern is potentially vulnerable to ReDoS.
 * @param pattern - Regex pattern string
 * @returns True if pattern appears safe
 */
export function isRegexSafe(pattern: string): boolean {
  // Check for known dangerous patterns
  for (const dangerous of REDOS_PATTERNS) {
    if (dangerous.test(pattern)) {
      return false
    }
  }

  // Check for excessive quantifier nesting
  const quantifierNesting = (pattern.match(/[+*?]{2,}/g) || []).length
  if (quantifierNesting > 2) {
    return false
  }

  // Check pattern length (very long patterns can be problematic)
  if (pattern.length > 500) {
    return false
  }

  return true
}

/**
 * Validate a regex pattern for search operations.
 * @param pattern - Regex pattern to validate
 * @returns Validation result
 */
export function validateRegex(pattern: string): {
  valid: boolean
  pattern?: string
  error?: string
} {
  // Empty check
  if (!pattern || pattern.trim() === '') {
    return { valid: false, error: 'Search pattern cannot be empty' }
  }

  // ReDoS safety check
  if (!isRegexSafe(pattern)) {
    return {
      valid: false,
      error:
        'Pattern may cause performance issues. Simplify nested quantifiers.',
    }
  }

  // Try to compile the regex
  try {
    new RegExp(pattern)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return { valid: false, error: `Invalid regex: ${message}` }
  }

  return { valid: true, pattern: pattern.trim() }
}

// ============================================================================
// Integer Validation
// ============================================================================

/**
 * Validate a number is a positive integer within bounds.
 * @param value - Value to validate
 * @param options - Validation options
 * @returns Validation result
 */
export function validatePositiveInt(
  value: unknown,
  options: {
    /** Field name for error messages */
    name: string
    /** Minimum allowed value (default: 1) */
    min?: number
    /** Maximum allowed value (default: 10000) */
    max?: number
    /** Default value if undefined */
    defaultValue?: number
  },
): { valid: boolean; value?: number; error?: string } {
  const { name, min = 1, max = 10000, defaultValue } = options

  // Handle undefined with default
  if (value === undefined || value === null) {
    if (defaultValue !== undefined) {
      return { valid: true, value: defaultValue }
    }
    return { valid: false, error: `${name} is required` }
  }

  // Convert to number
  const num = typeof value === 'string' ? Number.parseInt(value, 10) : value

  // Type check
  if (typeof num !== 'number' || Number.isNaN(num)) {
    return { valid: false, error: `${name} must be a number` }
  }

  // Integer check
  if (!Number.isInteger(num)) {
    return { valid: false, error: `${name} must be an integer` }
  }

  // Range check
  if (num < min || num > max) {
    return { valid: false, error: `${name} must be between ${min} and ${max}` }
  }

  return { valid: true, value: num }
}

// ============================================================================
// Composite Validators
// ============================================================================

/**
 * Validate all inputs for a grep search operation.
 * @param inputs - Grep inputs to validate
 * @returns Combined validation result
 */
export function validateGrepInputs(inputs: {
  pattern: string
  path?: string
  include?: string
  exclude?: string
  maxResults?: number
}): {
  valid: boolean
  errors: string[]
  validated?: {
    pattern: string
    path: string
    include?: string
    exclude?: string
    maxResults: number
  }
} {
  const errors: string[] = []

  // Validate pattern
  const patternResult = validateRegex(inputs.pattern)
  if (!patternResult.valid) {
    errors.push(patternResult.error!)
  }

  // Validate path
  const pathResult = validatePath(inputs.path || DEFAULT_KIT_PATH)
  if (!pathResult.valid) {
    errors.push(pathResult.error!)
  }

  // Validate include glob (optional)
  let validatedInclude: string | undefined
  if (inputs.include) {
    const includeResult = validateGlob(inputs.include)
    if (!includeResult.valid) {
      errors.push(`Include pattern: ${includeResult.error}`)
    } else {
      validatedInclude = includeResult.pattern
    }
  }

  // Validate exclude glob (optional)
  let validatedExclude: string | undefined
  if (inputs.exclude) {
    const excludeResult = validateGlob(inputs.exclude)
    if (!excludeResult.valid) {
      errors.push(`Exclude pattern: ${excludeResult.error}`)
    } else {
      validatedExclude = excludeResult.pattern
    }
  }

  // Validate maxResults
  const maxResultsResult = validatePositiveInt(inputs.maxResults, {
    name: 'maxResults',
    min: 1,
    max: 1000,
    defaultValue: 100,
  })
  if (!maxResultsResult.valid) {
    errors.push(maxResultsResult.error!)
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  return {
    valid: true,
    errors: [],
    validated: {
      pattern: patternResult.pattern!,
      path: pathResult.path!,
      include: validatedInclude,
      exclude: validatedExclude,
      maxResults: maxResultsResult.value!,
    },
  }
}

/**
 * Validate all inputs for a semantic search operation.
 * @param inputs - Semantic search inputs to validate
 * @returns Combined validation result
 */
export function validateSemanticInputs(inputs: {
  query: string
  path?: string
  topK?: number
}): {
  valid: boolean
  errors: string[]
  validated?: {
    query: string
    path: string
    topK: number
  }
} {
  const errors: string[] = []

  // Validate query (not a regex, just non-empty)
  if (!inputs.query || inputs.query.trim() === '') {
    errors.push('Query cannot be empty')
  }

  // Validate path
  const pathResult = validatePath(inputs.path || DEFAULT_KIT_PATH)
  if (!pathResult.valid) {
    errors.push(pathResult.error!)
  }

  // Validate topK
  const topKResult = validatePositiveInt(inputs.topK, {
    name: 'topK',
    min: 1,
    max: 50,
    defaultValue: 5,
  })
  if (!topKResult.valid) {
    errors.push(topKResult.error!)
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  return {
    valid: true,
    errors: [],
    validated: {
      query: inputs.query.trim(),
      path: pathResult.path!,
      topK: topKResult.value!,
    },
  }
}

/**
 * Validate all inputs for a symbols extraction operation.
 * @param inputs - Symbols inputs to validate
 * @returns Combined validation result
 */
export function validateSymbolsInputs(inputs: {
  path?: string
  pattern?: string
  symbolType?: string
}): {
  valid: boolean
  errors: string[]
  validated?: {
    path: string
    pattern?: string
    symbolType?: string
  }
} {
  const errors: string[] = []

  // Validate path
  const pathResult = validatePath(inputs.path || DEFAULT_KIT_PATH)
  if (!pathResult.valid) {
    errors.push(pathResult.error!)
  }

  // Validate file pattern (optional glob)
  let validatedPattern: string | undefined
  if (inputs.pattern) {
    const patternResult = validateGlob(inputs.pattern)
    if (!patternResult.valid) {
      errors.push(`File pattern: ${patternResult.error}`)
    } else {
      validatedPattern = patternResult.pattern
    }
  }

  // Validate symbol type (optional, just sanitize)
  let validatedSymbolType: string | undefined
  if (inputs.symbolType) {
    const sanitized = inputs.symbolType.trim().toLowerCase()
    const validTypes = [
      'function',
      'class',
      'variable',
      'type',
      'interface',
      'method',
      'property',
      'constant',
    ]
    if (sanitized && !validTypes.includes(sanitized)) {
      errors.push(
        `Invalid symbol type: ${inputs.symbolType}. Valid types: ${validTypes.join(', ')}`,
      )
    } else {
      validatedSymbolType = sanitized || undefined
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  return {
    valid: true,
    errors: [],
    validated: {
      path: pathResult.path!,
      pattern: validatedPattern,
      symbolType: validatedSymbolType,
    },
  }
}
