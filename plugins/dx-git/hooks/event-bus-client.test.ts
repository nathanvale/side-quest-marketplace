import { describe, expect, test } from 'bun:test'
import {
	_resetCaches,
	getRepoKeyFromGitRoot,
	postEvent,
	sanitizeRepoName,
} from './event-bus-client'

describe('event-bus-client', () => {
	test('postEvent is a no-op that resolves without throwing', async () => {
		await expect(
			postEvent(process.cwd(), 'session.started', { foo: 'bar' }),
		).resolves.toBeUndefined()
	})

	test('postEvent accepts optional correlationId', async () => {
		await expect(
			postEvent(process.cwd(), 'safety.blocked', { reason: 'test' }, 'test-correlation-123'),
		).resolves.toBeUndefined()
	})

	test('_resetCaches is callable (no-op)', () => {
		expect(() => _resetCaches()).not.toThrow()
	})

	test('repo key includes hash so same basename roots do not collide', () => {
		const a = getRepoKeyFromGitRoot('/tmp/client/app')
		const b = getRepoKeyFromGitRoot('/tmp/side/app')
		expect(a).not.toBe(b)
		expect(a.startsWith('app-')).toBe(true)
		expect(b.startsWith('app-')).toBe(true)
	})

	test('sanitizeRepoName strips unsafe characters', () => {
		expect(sanitizeRepoName('my-repo')).toBe('my-repo')
		expect(sanitizeRepoName('../evil')).toBe('.._evil')
		expect(sanitizeRepoName('')).toBe('unknown')
	})
})
