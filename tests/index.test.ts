import { describe, expect, it } from 'bun:test'
import { greet, VERSION } from '../src/index'

describe('greet', () => {
	it('returns a greeting message', () => {
		expect(greet('World')).toBe('Hello, World!')
	})

	it('handles empty string', () => {
		expect(greet('')).toBe('Hello, !')
	})
})

describe('VERSION', () => {
	it('is defined', () => {
		expect(VERSION).toBeDefined()
		expect(typeof VERSION).toBe('string')
	})
})
