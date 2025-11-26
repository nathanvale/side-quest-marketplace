import { describe, expect, test } from 'bun:test'
import { readClaudeConfig, writeClaudeConfig } from './config'

describe('config', () => {
  test('exports readClaudeConfig', () => {
    expect(typeof readClaudeConfig).toBe('function')
  })

  test('exports writeClaudeConfig', () => {
    expect(typeof writeClaudeConfig).toBe('function')
  })
})
