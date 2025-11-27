import { describe, expect, test } from 'bun:test'
import {
  // Logger
  createCorrelationId,
  createErrorFromOutput,
  DEFAULT_KIT_PATH,
  DEFAULT_MAX_RESULTS,
  DEFAULT_TOP_K,
  detectErrorType,
  ERROR_MESSAGES,
  GREP_TIMEOUT,
  isError,
  isSemanticUnavailableError,
  KitError,
  // Errors
  KitErrorType,
  logDir,
  logFile,
  // Types
  ResponseFormat,
  SEMANTIC_INSTALL_HINT,
  SEMANTIC_TIMEOUT,
  SYMBOLS_TIMEOUT,
} from './index'

// ============================================================================
// Types Tests
// ============================================================================

describe('types', () => {
  describe('ResponseFormat', () => {
    test('has markdown and json values', () => {
      expect(String(ResponseFormat.MARKDOWN)).toBe('markdown')
      expect(String(ResponseFormat.JSON)).toBe('json')
    })
  })

  describe('isError', () => {
    test('returns true for error objects', () => {
      const errorResult = { error: 'Something failed', hint: 'Try again' }
      expect(isError(errorResult)).toBe(true)
    })

    test('returns false for success objects', () => {
      const successResult = { count: 5, matches: [], pattern: 'test', path: '.' }
      expect(isError(successResult)).toBe(false)
    })

    test('returns false for objects without error property', () => {
      const result = { data: 'something' }
      expect(isError(result)).toBe(false)
    })
  })

  describe('default constants', () => {
    test('DEFAULT_KIT_PATH is vault path', () => {
      expect(DEFAULT_KIT_PATH).toBe('~/code/my-second-brain')
    })

    test('timeout values are reasonable', () => {
      expect(GREP_TIMEOUT).toBe(30000)
      expect(SEMANTIC_TIMEOUT).toBe(60000)
      expect(SYMBOLS_TIMEOUT).toBe(45000)
    })

    test('default result limits are set', () => {
      expect(DEFAULT_MAX_RESULTS).toBe(100)
      expect(DEFAULT_TOP_K).toBe(5)
    })
  })
})

// ============================================================================
// Errors Tests
// ============================================================================

describe('errors', () => {
  describe('KitErrorType', () => {
    test('has all expected error types', () => {
      expect(String(KitErrorType.KitNotInstalled)).toBe('KitNotInstalled')
      expect(String(KitErrorType.InvalidPath)).toBe('InvalidPath')
      expect(String(KitErrorType.InvalidInput)).toBe('InvalidInput')
      expect(String(KitErrorType.SemanticNotAvailable)).toBe('SemanticNotAvailable')
      expect(String(KitErrorType.TooManyResults)).toBe('TooManyResults')
      expect(String(KitErrorType.KitCommandFailed)).toBe('KitCommandFailed')
      expect(String(KitErrorType.OutputParseError)).toBe('OutputParseError')
      expect(String(KitErrorType.Timeout)).toBe('Timeout')
    })
  })

  describe('ERROR_MESSAGES', () => {
    test('all error types have messages and hints', () => {
      for (const errorType of Object.values(KitErrorType)) {
        const errorInfo = ERROR_MESSAGES[errorType]
        expect(errorInfo).toBeDefined()
        expect(errorInfo.message).toBeTruthy()
        expect(errorInfo.hint).toBeTruthy()
      }
    })
  })

  describe('KitError', () => {
    test('creates error with type and message', () => {
      const error = new KitError(KitErrorType.InvalidPath)
      expect(error.type).toBe(KitErrorType.InvalidPath)
      expect(error.message).toContain('does not exist')
      expect(error.name).toBe('KitError')
    })

    test('includes details in message', () => {
      const error = new KitError(KitErrorType.InvalidPath, '/bad/path')
      expect(error.message).toContain('/bad/path')
      expect(error.details).toBe('/bad/path')
    })

    test('stores stderr', () => {
      const error = new KitError(KitErrorType.KitCommandFailed, undefined, 'command not found')
      expect(error.stderr).toBe('command not found')
    })

    test('hint getter returns recovery hint', () => {
      const error = new KitError(KitErrorType.KitNotInstalled)
      expect(error.hint).toContain('uv tool install')
    })

    test('toUserMessage formats for display', () => {
      const error = new KitError(KitErrorType.InvalidPath, '/bad/path', 'No such file')
      const message = error.toUserMessage()
      expect(message).toContain('Error:')
      expect(message).toContain('Hint:')
      expect(message).toContain('Details:')
      expect(message).toContain('No such file')
    })

    test('toJSON returns structured object', () => {
      const error = new KitError(KitErrorType.Timeout, 'took too long')
      const json = error.toJSON()
      expect(json.error).toContain('timed out')
      expect(json.type).toBe(KitErrorType.Timeout)
      expect(json.hint).toBeTruthy()
      expect(json.details).toBe('took too long')
    })
  })

  describe('SEMANTIC_INSTALL_HINT', () => {
    test('includes pip install command', () => {
      expect(SEMANTIC_INSTALL_HINT).toContain("pip install 'cased-kit[ml]'")
    })

    test('includes uv install command', () => {
      expect(SEMANTIC_INSTALL_HINT).toContain("uv tool install 'cased-kit[ml]'")
    })
  })

  describe('isSemanticUnavailableError', () => {
    test('detects sentence-transformers error', () => {
      expect(isSemanticUnavailableError('ModuleNotFoundError: sentence-transformers')).toBe(true)
    })

    test('detects chromadb error', () => {
      expect(isSemanticUnavailableError('chromadb not installed')).toBe(true)
    })

    test('detects semantic search error', () => {
      expect(isSemanticUnavailableError('semantic search is not available')).toBe(true)
    })

    test('returns false for unrelated errors', () => {
      expect(isSemanticUnavailableError('file not found')).toBe(false)
    })
  })

  describe('detectErrorType', () => {
    test('detects semantic unavailable from stderr', () => {
      const type = detectErrorType('chromadb not found', 1)
      expect(type).toBe(KitErrorType.SemanticNotAvailable)
    })

    test('detects invalid path', () => {
      const type = detectErrorType('No such file or directory', 1)
      expect(type).toBe(KitErrorType.InvalidPath)
    })

    test('detects timeout', () => {
      const type = detectErrorType('Operation timed out', 1)
      expect(type).toBe(KitErrorType.Timeout)
    })

    test('detects too many results', () => {
      const type = detectErrorType('Too many matches, limit exceeded', 1)
      expect(type).toBe(KitErrorType.TooManyResults)
    })

    test('defaults to KitCommandFailed for unknown errors', () => {
      const type = detectErrorType('Unknown error occurred', 1)
      expect(type).toBe(KitErrorType.KitCommandFailed)
    })
  })

  describe('createErrorFromOutput', () => {
    test('creates KitError from stderr and exit code', () => {
      const error = createErrorFromOutput('No such file or directory\n', 1)
      expect(error).toBeInstanceOf(KitError)
      expect(error.type).toBe(KitErrorType.InvalidPath)
      expect(error.stderr).toBe('No such file or directory')
    })
  })
})

// ============================================================================
// Logger Tests
// ============================================================================

describe('logger', () => {
  describe('createCorrelationId', () => {
    test('returns 8-character string', () => {
      const id = createCorrelationId()
      expect(id).toHaveLength(8)
    })

    test('returns different IDs each time', () => {
      const id1 = createCorrelationId()
      const id2 = createCorrelationId()
      expect(id1).not.toBe(id2)
    })

    test('contains only hex characters', () => {
      const id = createCorrelationId()
      expect(id).toMatch(/^[0-9a-f]{8}$/)
    })
  })

  describe('log paths', () => {
    test('logDir is in home directory', () => {
      expect(logDir).toContain('.kit')
      expect(logDir).toContain('logs')
    })

    test('logFile has .jsonl extension', () => {
      expect(logFile).toContain('.jsonl')
      expect(logFile).toContain(logDir)
    })
  })
})
