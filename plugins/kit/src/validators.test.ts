import { describe, expect, test } from 'bun:test'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  expandTilde,
  isRegexSafe,
  isValidGlob,
  normalizePath,
  validateGlob,
  validateGrepInputs,
  validatePath,
  validatePositiveInt,
  validateRegex,
  validateSemanticInputs,
  validateSymbolsInputs,
} from './validators'

// ============================================================================
// Path Utilities Tests
// ============================================================================

describe('expandTilde', () => {
  test('expands ~ to home directory', () => {
    expect(expandTilde('~')).toBe(homedir())
  })

  test('expands ~/ prefix', () => {
    expect(expandTilde('~/code')).toBe(join(homedir(), 'code'))
  })

  test('expands ~/nested/path', () => {
    expect(expandTilde('~/code/my-second-brain')).toBe(join(homedir(), 'code/my-second-brain'))
  })

  test('preserves absolute paths', () => {
    expect(expandTilde('/absolute/path')).toBe('/absolute/path')
  })

  test('preserves relative paths without tilde', () => {
    expect(expandTilde('relative/path')).toBe('relative/path')
  })

  test('does not expand tilde in middle of path', () => {
    expect(expandTilde('/some/~path')).toBe('/some/~path')
  })
})

describe('normalizePath', () => {
  test('expands tilde and normalizes', () => {
    const result = normalizePath('~/code')
    expect(result).toBe(join(homedir(), 'code'))
  })

  test('resolves relative paths from cwd', () => {
    const result = normalizePath('src')
    expect(result).toBe(resolve(process.cwd(), 'src'))
  })

  test('resolves relative paths from custom base', () => {
    const result = normalizePath('src', '/custom/base')
    expect(result).toBe('/custom/base/src')
  })

  test('normalizes .. sequences', () => {
    const result = normalizePath('/a/b/../c')
    expect(result).toBe('/a/c')
  })

  test('normalizes redundant separators', () => {
    const result = normalizePath('/a//b///c')
    expect(result).toBe('/a/b/c')
  })
})

// ============================================================================
// Path Validation Tests
// ============================================================================

describe('validatePath', () => {
  describe('basic validation', () => {
    test('rejects empty string', () => {
      const result = validatePath('')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('cannot be empty')
    })

    test('rejects whitespace-only string', () => {
      const result = validatePath('   ')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('cannot be empty')
    })

    test('validates existing directory', () => {
      const result = validatePath(homedir())
      expect(result.valid).toBe(true)
      expect(result.path).toBe(homedir())
    })

    test('expands tilde in path', () => {
      const result = validatePath('~')
      expect(result.valid).toBe(true)
      expect(result.path).toBe(homedir())
    })

    test('rejects non-existent path by default', () => {
      const result = validatePath('/this/path/does/not/exist')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('does not exist')
    })

    test('allows non-existent path when mustExist is false', () => {
      const result = validatePath('/this/path/does/not/exist', {
        mustExist: false,
      })
      expect(result.valid).toBe(true)
    })
  })

  describe('directory validation', () => {
    test('rejects file when mustBeDirectory is true', () => {
      // package.json should exist and be a file
      const result = validatePath(join(process.cwd(), 'package.json'))
      expect(result.valid).toBe(false)
      expect(result.error).toContain('not a directory')
    })

    test('allows file when mustBeDirectory is false', () => {
      const result = validatePath(join(process.cwd(), 'package.json'), {
        mustBeDirectory: false,
      })
      expect(result.valid).toBe(true)
    })
  })

  describe('path traversal prevention', () => {
    test('allows paths within base directory', () => {
      const base = homedir()
      const result = validatePath('~/code', { basePath: base })
      expect(result.valid).toBe(true)
    })

    test('rejects paths escaping base directory', () => {
      const base = join(homedir(), 'restricted')
      const result = validatePath('/etc/passwd', { basePath: base })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('traversal detected')
    })

    test('rejects .. sequences escaping base', () => {
      const base = join(homedir(), 'code')
      const result = validatePath(join(base, '../../etc'), {
        basePath: base,
        mustExist: false,
      })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('traversal detected')
    })
  })
})

// ============================================================================
// Glob Validation Tests
// ============================================================================

describe('isValidGlob', () => {
  test('accepts simple extension pattern', () => {
    expect(isValidGlob('*.ts')).toBe(true)
  })

  test('accepts recursive pattern', () => {
    expect(isValidGlob('**/*.ts')).toBe(true)
  })

  test('accepts character class', () => {
    expect(isValidGlob('[abc].txt')).toBe(true)
  })

  test('accepts brace expansion', () => {
    expect(isValidGlob('*.{ts,js}')).toBe(true)
  })

  test('accepts negation pattern', () => {
    expect(isValidGlob('!*.test.ts')).toBe(true)
  })

  test('accepts complex path pattern', () => {
    expect(isValidGlob('src/**/[a-z]*.{ts,tsx}')).toBe(true)
  })

  test('rejects empty string', () => {
    expect(isValidGlob('')).toBe(false)
  })

  test('rejects pattern with shell injection chars', () => {
    expect(isValidGlob('*.ts; rm -rf /')).toBe(false)
  })

  test('rejects pattern with backticks', () => {
    expect(isValidGlob('`whoami`.ts')).toBe(false)
  })

  test('rejects pattern with $', () => {
    expect(isValidGlob('$HOME/*.ts')).toBe(false)
  })

  test('rejects unbalanced brackets', () => {
    expect(isValidGlob('[abc')).toBe(false)
  })

  test('rejects unbalanced braces', () => {
    expect(isValidGlob('{a,b')).toBe(false)
  })
})

describe('validateGlob', () => {
  test('returns valid for good patterns', () => {
    const result = validateGlob('**/*.ts')
    expect(result.valid).toBe(true)
    expect(result.pattern).toBe('**/*.ts')
  })

  test('trims whitespace', () => {
    const result = validateGlob('  *.ts  ')
    expect(result.valid).toBe(true)
    expect(result.pattern).toBe('*.ts')
  })

  test('returns error for invalid patterns', () => {
    const result = validateGlob('*.ts; echo pwned')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Invalid glob pattern')
  })
})

// ============================================================================
// Regex Validation Tests (ReDoS Prevention)
// ============================================================================

describe('isRegexSafe', () => {
  test('accepts simple patterns', () => {
    expect(isRegexSafe('hello')).toBe(true)
    expect(isRegexSafe('foo.*bar')).toBe(true)
    expect(isRegexSafe('^start')).toBe(true)
    expect(isRegexSafe('end$')).toBe(true)
  })

  test('accepts character classes', () => {
    expect(isRegexSafe('[a-z]+')).toBe(true)
    expect(isRegexSafe('\\d{3}-\\d{4}')).toBe(true)
  })

  test('rejects nested quantifiers (ReDoS)', () => {
    expect(isRegexSafe('(a+)+')).toBe(false)
    expect(isRegexSafe('(a*)*')).toBe(false)
  })

  test('rejects overlapping alternation with quantifiers', () => {
    expect(isRegexSafe('(a|a)+')).toBe(false)
  })

  test('rejects patterns with many consecutive quantifiers', () => {
    // Multiple groups with nested quantifiers trigger the safety check
    expect(isRegexSafe('(a+)+(b+)+(c+)+')).toBe(false)
  })

  test('rejects very long patterns', () => {
    const longPattern = 'a'.repeat(600)
    expect(isRegexSafe(longPattern)).toBe(false)
  })
})

describe('validateRegex', () => {
  test('accepts valid regex', () => {
    const result = validateRegex('function\\s+\\w+')
    expect(result.valid).toBe(true)
    expect(result.pattern).toBe('function\\s+\\w+')
  })

  test('rejects empty pattern', () => {
    const result = validateRegex('')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('cannot be empty')
  })

  test('rejects invalid regex syntax', () => {
    const result = validateRegex('[unclosed')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Invalid regex')
  })

  test('rejects ReDoS patterns', () => {
    const result = validateRegex('(a+)+')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('performance issues')
  })

  test('trims whitespace', () => {
    const result = validateRegex('  hello  ')
    expect(result.valid).toBe(true)
    expect(result.pattern).toBe('hello')
  })
})

// ============================================================================
// Integer Validation Tests
// ============================================================================

describe('validatePositiveInt', () => {
  test('accepts valid integer', () => {
    const result = validatePositiveInt(10, { name: 'count' })
    expect(result.valid).toBe(true)
    expect(result.value).toBe(10)
  })

  test('accepts string number', () => {
    const result = validatePositiveInt('42', { name: 'count' })
    expect(result.valid).toBe(true)
    expect(result.value).toBe(42)
  })

  test('uses default value for undefined', () => {
    const result = validatePositiveInt(undefined, {
      name: 'count',
      defaultValue: 100,
    })
    expect(result.valid).toBe(true)
    expect(result.value).toBe(100)
  })

  test('rejects undefined without default', () => {
    const result = validatePositiveInt(undefined, { name: 'count' })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('required')
  })

  test('rejects non-integer', () => {
    const result = validatePositiveInt(3.14, { name: 'count' })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('integer')
  })

  test('rejects below min', () => {
    const result = validatePositiveInt(0, { name: 'count', min: 1 })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('between')
  })

  test('rejects above max', () => {
    const result = validatePositiveInt(2000, { name: 'count', max: 1000 })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('between')
  })

  test('rejects NaN', () => {
    const result = validatePositiveInt('not a number', { name: 'count' })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('must be a number')
  })
})

// ============================================================================
// Composite Validator Tests
// ============================================================================

describe('validateGrepInputs', () => {
  const validPath = homedir() // Use home directory which always exists

  test('validates correct inputs', () => {
    const result = validateGrepInputs({
      pattern: 'function',
      path: validPath,
      maxResults: 50,
    })
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.validated?.pattern).toBe('function')
    expect(result.validated?.maxResults).toBe(50)
  })

  test('uses default path when not provided', () => {
    const result = validateGrepInputs({
      pattern: 'test',
    })
    // Path may not exist, so we check that validation ran
    // The error should be about path if it doesn't exist
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('Path'))).toBe(true)
    }
  })

  test('validates optional include pattern', () => {
    const result = validateGrepInputs({
      pattern: 'test',
      path: validPath,
      include: '*.ts',
    })
    expect(result.valid).toBe(true)
    expect(result.validated?.include).toBe('*.ts')
  })

  test('validates optional exclude pattern', () => {
    const result = validateGrepInputs({
      pattern: 'test',
      path: validPath,
      exclude: 'node_modules/**',
    })
    expect(result.valid).toBe(true)
    expect(result.validated?.exclude).toBe('node_modules/**')
  })

  test('collects multiple errors', () => {
    const result = validateGrepInputs({
      pattern: '(a+)+', // ReDoS
      path: '/nonexistent/path',
      include: '*.ts; rm -rf /', // injection
    })
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(2)
  })

  test('uses default maxResults', () => {
    const result = validateGrepInputs({
      pattern: 'test',
      path: validPath,
    })
    expect(result.valid).toBe(true)
    expect(result.validated?.maxResults).toBe(100)
  })
})

describe('validateSemanticInputs', () => {
  const validPath = homedir()

  test('validates correct inputs', () => {
    const result = validateSemanticInputs({
      query: 'how does authentication work',
      path: validPath,
      topK: 10,
    })
    expect(result.valid).toBe(true)
    expect(result.validated?.query).toBe('how does authentication work')
    expect(result.validated?.topK).toBe(10)
  })

  test('rejects empty query', () => {
    const result = validateSemanticInputs({
      query: '',
      path: validPath,
    })
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('Query'))).toBe(true)
  })

  test('trims query whitespace', () => {
    const result = validateSemanticInputs({
      query: '  find auth code  ',
      path: validPath,
    })
    expect(result.valid).toBe(true)
    expect(result.validated?.query).toBe('find auth code')
  })

  test('uses default topK', () => {
    const result = validateSemanticInputs({
      query: 'test query',
      path: validPath,
    })
    expect(result.valid).toBe(true)
    expect(result.validated?.topK).toBe(5)
  })

  test('rejects topK out of range', () => {
    const result = validateSemanticInputs({
      query: 'test',
      path: validPath,
      topK: 100,
    })
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('topK'))).toBe(true)
  })
})

describe('validateSymbolsInputs', () => {
  const validPath = homedir()

  test('validates correct inputs', () => {
    const result = validateSymbolsInputs({
      path: validPath,
      pattern: '*.ts',
      symbolType: 'function',
    })
    expect(result.valid).toBe(true)
    expect(result.validated?.pattern).toBe('*.ts')
    expect(result.validated?.symbolType).toBe('function')
  })

  test('validates without optional fields', () => {
    const result = validateSymbolsInputs({
      path: validPath,
    })
    expect(result.valid).toBe(true)
    expect(result.validated?.pattern).toBeUndefined()
    expect(result.validated?.symbolType).toBeUndefined()
  })

  test('normalizes symbol type to lowercase', () => {
    const result = validateSymbolsInputs({
      path: validPath,
      symbolType: 'FUNCTION',
    })
    expect(result.valid).toBe(true)
    expect(result.validated?.symbolType).toBe('function')
  })

  test('rejects invalid symbol type', () => {
    const result = validateSymbolsInputs({
      path: validPath,
      symbolType: 'banana',
    })
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('Invalid symbol type'))).toBe(true)
  })

  test('validates all allowed symbol types', () => {
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
    for (const symbolType of validTypes) {
      const result = validateSymbolsInputs({ path: validPath, symbolType })
      expect(result.valid).toBe(true)
      expect(result.validated?.symbolType).toBe(symbolType)
    }
  })

  test('rejects invalid file pattern', () => {
    const result = validateSymbolsInputs({
      path: validPath,
      pattern: '*.ts; echo pwned',
    })
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('File pattern'))).toBe(true)
  })
})
