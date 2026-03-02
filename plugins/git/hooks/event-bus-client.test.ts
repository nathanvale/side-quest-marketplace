import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _resetCaches, getRepoKeyFromGitRoot, postEvent } from './event-bus-client'

async function getRepoRootForTest(cwd: string): Promise<string> {
	const proc = Bun.spawn(['git', 'rev-parse', '--path-format=absolute', '--git-common-dir'], {
		cwd,
		stdout: 'pipe',
		stderr: 'ignore',
	})
	const stdout = (await new Response(proc.stdout).text()).trim()
	const exitCode = await proc.exited
	if (exitCode !== 0 || stdout.length === 0) return cwd
	const normalized = stdout.replace(/\\/g, '/')
	const match = normalized.match(/^(.*)\/\.git(?:\/.*)?$/)
	return match?.[1] || cwd
}

/**
 * Helper to create a temp HOME directory with the expected port file path.
 * Returns the temp HOME path and cleanup function.
 */
async function createPortFileSetup(portContent: string): Promise<{
	tempHome: string
	cleanup: () => void
}> {
	const repoRoot = await getRepoRootForTest(process.cwd())
	const repoName = getRepoKeyFromGitRoot(repoRoot)
	const tempHome = join(
		tmpdir(),
		`event-bus-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
	)
	const portDir = join(tempHome, '.cache', 'side-quest-git', repoName)
	mkdirSync(portDir, { recursive: true })
	writeFileSync(join(portDir, 'events.port'), portContent)

	return {
		tempHome,
		cleanup: () => rmSync(tempHome, { recursive: true, force: true }),
	}
}

describe('event-bus-client', () => {
	const originalHome = process.env.HOME
	const originalFetch = globalThis.fetch

	afterEach(() => {
		process.env.HOME = originalHome
		delete process.env.SIDE_QUEST_EVENTS
		globalThis.fetch = originalFetch
		_resetCaches()
	})

	test('port file missing returns silently (no throw)', async () => {
		const tempHome = join(
			tmpdir(),
			`event-bus-no-port-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
		)
		mkdirSync(tempHome, { recursive: true })
		process.env.HOME = tempHome

		// Should resolve without throwing -- no port file exists
		await expect(postEvent(process.cwd(), 'session.started', {})).resolves.toBeUndefined()

		rmSync(tempHome, { recursive: true, force: true })
	})

	test('invalid port file content returns silently', async () => {
		const { tempHome, cleanup } = await createPortFileSetup('not-a-number')
		process.env.HOME = tempHome

		await expect(postEvent(process.cwd(), 'session.started', {})).resolves.toBeUndefined()

		cleanup()
	})

	test('successful POST sends correct EventEnvelope shape', async () => {
		let receivedBody: Record<string, unknown> | null = null
		let receivedUrl = ''
		globalThis.fetch = (async (input, init) => {
			receivedUrl = String(input)
			receivedBody = JSON.parse(String(init?.body))
			return new Response('ok', { status: 200 })
		}) as typeof fetch

		const { tempHome, cleanup } = await createPortFileSetup('43123')
		process.env.HOME = tempHome

		await postEvent(process.cwd(), 'session.started', { foo: 'bar' }, 'test-correlation-123')

		expect(receivedUrl).toBe('http://127.0.0.1:43123/events')
		expect(receivedBody).not.toBeNull()
		expect(receivedBody!.schemaVersion).toBe(1)
		expect(receivedBody!.type).toBe('session.started')
		expect(receivedBody!.timestamp).toBeTypeOf('string')
		expect(receivedBody!.correlationId).toBe('test-correlation-123')
		expect(receivedBody!.source).toBe('hook')
		expect(receivedBody!.repo).toBeTypeOf('string')
		expect(receivedBody!.gitRoot).toBeTypeOf('string')
		expect(receivedBody!.data).toEqual({ foo: 'bar' })

		cleanup()
	})

	test('AbortController fires when server hangs (completes within 1500ms)', async () => {
		globalThis.fetch = (async (_input, init) => {
			return await new Promise<Response>((_resolve, reject) => {
				const signal = init?.signal as AbortSignal | undefined
				if (!signal) return
				const onAbort = () => reject(new Error('aborted'))
				if (signal.aborted) {
					onAbort()
					return
				}
				signal.addEventListener('abort', onAbort, { once: true })
			})
		}) as typeof fetch

		const { tempHome, cleanup } = await createPortFileSetup('43124')
		process.env.HOME = tempHome

		const start = Date.now()
		// Should resolve without throwing even though the server hangs
		await expect(postEvent(process.cwd(), 'session.started', {})).resolves.toBeUndefined()
		const elapsed = Date.now() - start

		// Should complete in well under 1500ms (abort fires at 500ms + some overhead)
		expect(elapsed).toBeLessThan(1500)

		cleanup()
	}, 5000)

	test('server error (500) does not throw', async () => {
		globalThis.fetch = (async (_input: string | URL | Request, _init?: RequestInit) => {
			return new Response('Internal Server Error', { status: 500 })
		}) as typeof fetch

		const { tempHome, cleanup } = await createPortFileSetup('43125')
		process.env.HOME = tempHome

		await expect(
			postEvent(process.cwd(), 'safety.blocked', { reason: 'test' }),
		).resolves.toBeUndefined()

		cleanup()
	})

	test('SIDE_QUEST_EVENTS=0 skips emission entirely', async () => {
		let requestSent = false
		globalThis.fetch = (async (_input: string | URL | Request, _init?: RequestInit) => {
			requestSent = true
			return new Response('ok', { status: 200 })
		}) as typeof fetch

		const { tempHome, cleanup } = await createPortFileSetup('43126')
		process.env.HOME = tempHome
		process.env.SIDE_QUEST_EVENTS = '0'

		await postEvent(process.cwd(), 'session.started', { foo: 'bar' })

		expect(requestSent).toBe(false)

		cleanup()
	})

	test('portCheckFailed negative cache skips subsequent calls', async () => {
		// First call: no port file -- sets portCheckFailed
		const tempHome = join(
			tmpdir(),
			`event-bus-neg-cache-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
		)
		mkdirSync(tempHome, { recursive: true })
		process.env.HOME = tempHome

		await postEvent(process.cwd(), 'session.started', {})

		// Now create a valid port file -- second call should still skip due to negative cache
		let requestSent = false
		globalThis.fetch = (async (_input: string | URL | Request, _init?: RequestInit) => {
			requestSent = true
			return new Response('ok', { status: 200 })
		}) as typeof fetch

		const repoRoot = await getRepoRootForTest(process.cwd())
		const repoName = getRepoKeyFromGitRoot(repoRoot)
		const portDir = join(tempHome, '.cache', 'side-quest-git', repoName)
		mkdirSync(portDir, { recursive: true })
		writeFileSync(join(portDir, 'events.port'), '43127')

		await postEvent(process.cwd(), 'session.started', { foo: 'bar' })

		// The negative cache should prevent reaching fetch
		expect(requestSent).toBe(false)

		rmSync(tempHome, { recursive: true, force: true })
	})

	test('falls back to repo port when global port file is stale', async () => {
		let receivedUrl = ''
		globalThis.fetch = (async (input: string | URL | Request, _init?: RequestInit) => {
			receivedUrl = String(input)
			return new Response('ok', { status: 200 })
		}) as typeof fetch

		const repoRoot = await getRepoRootForTest(process.cwd())
		const repoName = getRepoKeyFromGitRoot(repoRoot)
		const tempHome = join(
			tmpdir(),
			`event-bus-global-fallback-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
		)
		const globalDir = join(tempHome, '.cache', 'side-quest-observability')
		const repoDir = join(tempHome, '.cache', 'side-quest-git', repoName)
		mkdirSync(globalDir, { recursive: true })
		mkdirSync(repoDir, { recursive: true })
		writeFileSync(join(globalDir, 'events.port'), 'stale-port')
		writeFileSync(join(repoDir, 'events.port'), '43128')
		process.env.HOME = tempHome

		await postEvent(process.cwd(), 'session.started', { mode: 'fallback' })

		expect(receivedUrl).toBe('http://127.0.0.1:43128/events')

		rmSync(tempHome, { recursive: true, force: true })
	})

	test('repo key includes hash so same basename roots do not collide', () => {
		const a = getRepoKeyFromGitRoot('/tmp/client/app')
		const b = getRepoKeyFromGitRoot('/tmp/side/app')
		expect(a).not.toBe(b)
		expect(a.startsWith('app-')).toBe(true)
		expect(b.startsWith('app-')).toBe(true)
	})

	test('nested cwd resolves to repo-root key for per-repo port lookup', async () => {
		let requestSent = false
		globalThis.fetch = (async (_input: string | URL | Request, _init?: RequestInit) => {
			requestSent = true
			return new Response('ok', { status: 200 })
		}) as typeof fetch

		const tempHome = join(
			tmpdir(),
			`event-bus-nested-cwd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
		)
		const repoRoot = await getRepoRootForTest(process.cwd())
		const repoName = getRepoKeyFromGitRoot(repoRoot)
		const repoDir = join(tempHome, '.cache', 'side-quest-git', repoName)
		mkdirSync(repoDir, { recursive: true })
		writeFileSync(join(repoDir, 'events.port'), '43129')
		process.env.HOME = tempHome

		await postEvent(join(process.cwd(), 'plugins', 'git'), 'session.started', {
			scope: 'nested-cwd',
		})

		expect(requestSent).toBe(true)
		rmSync(tempHome, { recursive: true, force: true })
	})
})
