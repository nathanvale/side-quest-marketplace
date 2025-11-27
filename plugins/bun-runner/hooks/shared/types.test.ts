import { describe, expect, test } from 'bun:test'
import { extractFilePaths, type HookInput, parseHookInput } from './types'

describe('extractFilePaths', () => {
  test('extracts single file_path', () => {
    const input: HookInput = {
      tool_name: 'Write',
      tool_input: { file_path: '/path/to/file.ts' },
    }

    const result = extractFilePaths(input)

    expect(result).toEqual(['/path/to/file.ts'])
  })

  test('extracts multiple file_paths from edits', () => {
    const input: HookInput = {
      tool_name: 'Edit',
      tool_input: {
        edits: [{ file_path: '/path/a.ts' }, { file_path: '/path/b.ts' }],
      },
    }

    const result = extractFilePaths(input)

    expect(result).toEqual(['/path/a.ts', '/path/b.ts'])
  })

  test('deduplicates file_paths', () => {
    const input: HookInput = {
      tool_name: 'Edit',
      tool_input: {
        file_path: '/path/a.ts',
        edits: [{ file_path: '/path/a.ts' }, { file_path: '/path/b.ts' }],
      },
    }

    const result = extractFilePaths(input)

    expect(result).toEqual(['/path/a.ts', '/path/b.ts'])
  })

  test('returns empty array when tool_input is undefined', () => {
    const input: HookInput = {
      tool_name: 'SomeOtherTool',
      tool_input: undefined,
    }

    const result = extractFilePaths(input)

    expect(result).toEqual([])
  })

  test('returns empty array when tool_input has no file fields', () => {
    const input: HookInput = {
      tool_name: 'Read',
      tool_input: {},
    }

    const result = extractFilePaths(input)

    expect(result).toEqual([])
  })
})

describe('parseHookInput', () => {
  test('parses valid JSON', () => {
    const json = JSON.stringify({
      tool_name: 'Write',
      tool_input: { file_path: '/test.ts' },
    })

    const result = parseHookInput(json)

    expect(result).toEqual({
      tool_name: 'Write',
      tool_input: { file_path: '/test.ts' },
    })
  })

  test('returns null for invalid JSON', () => {
    const result = parseHookInput('not valid json')

    expect(result).toBeNull()
  })

  test('returns null for empty string', () => {
    const result = parseHookInput('')

    expect(result).toBeNull()
  })
})
