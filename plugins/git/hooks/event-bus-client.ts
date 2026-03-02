import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { runGit } from './git-utils'

const EMISSION_TIMEOUT_MS = 500
const SCHEMA_VERSION = 1

/** Event types emitted by hook lifecycle */
export type HookEventType =
	| 'session.started'
	| 'safety.blocked'
	| 'command.executed'
	| 'session.compacted'
	| 'session.ended'

interface EventEnvelope {
	schemaVersion: number
	type: HookEventType
	timestamp: string
	correlationId: string
	source: 'hook'
	repo: string
	gitRoot: string
	data: Record<string, unknown>
}

/**
 * Module-level cache for repo identity.
 * Repo name and git root don't change mid-process, so we resolve once
 * and reuse for all subsequent postEvent calls (avoids 2 git spawns per call).
 */
let cachedIdentity: { repoName: string; gitRoot: string } | null = null

/** Negative cache -- if port file was missing on first check, skip future checks. */
let portCheckFailed = false

/** Resolve repo identity once, cache for process lifetime. */
async function getRepoIdentity(
	cwd: string,
): Promise<{ repoName: string; gitRoot: string }> {
	if (!cachedIdentity) {
		const gitRoot = (await resolveRepoRoot(cwd)) || cwd
		const repoName = getRepoKeyFromGitRoot(gitRoot)
		cachedIdentity = { repoName, gitRoot }
	}
	return cachedIdentity
}

async function resolveRepoRoot(cwd: string): Promise<string | null> {
	const commonDirResult = await runGit(
		['rev-parse', '--path-format=absolute', '--git-common-dir'],
		{ cwd },
	)
	if (commonDirResult.exitCode !== 0 || commonDirResult.stdout.length === 0) {
		return null
	}

	const normalized = commonDirResult.stdout.replace(/\\/g, '/')
	const match = normalized.match(/^(.*)\/\.git(?:\/.*)?$/)
	if (match?.[1]) {
		return match[1]
	}
	return null
}

function hashGitRoot(gitRoot: string): string {
	const normalized = gitRoot.replace(/\\/g, '/')
	return createHash('sha256').update(normalized).digest('hex').slice(0, 12)
}

export function getRepoKeyFromGitRoot(gitRoot: string): string {
	const baseName = gitRoot.split(/[/\\]/).pop() || 'unknown'
	const safeBaseName = sanitizeRepoName(baseName)
	return `${safeBaseName}-${hashGitRoot(gitRoot)}`
}

/**
 * Generate a simple correlation ID for event tracing.
 */
function generateCorrelationId(): string {
	return `hook-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Fire-and-forget event emission. Never throws, never blocks beyond timeout.
 *
 * Error policy: errors logged to stderr (diagnosable via claude --debug),
 * but never propagate -- the hook continues.
 */
export async function postEvent(
	cwd: string,
	type: HookEventType,
	data: Record<string, unknown>,
	correlationId?: string,
): Promise<void> {
	if (process.env.SIDE_QUEST_EVENTS === '0') return
	if (portCheckFailed) return
	try {
		const controller = new AbortController()
		const timeoutId = setTimeout(() => controller.abort(), EMISSION_TIMEOUT_MS)
		try {
			await postEventInner(cwd, type, data, correlationId, controller.signal)
		} finally {
			clearTimeout(timeoutId)
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err)
		console.error(`[event-bus] emission failed: ${message}`)
	}
}

/** Sanitize repo name to prevent path traversal. */
export function sanitizeRepoName(name: string): string {
	const safe = name.replace(/[^a-zA-Z0-9._-]/g, '_')
	return safe || 'unknown'
}

async function postEventInner(
	cwd: string,
	type: HookEventType,
	data: Record<string, unknown>,
	correlationId: string | undefined,
	signal: AbortSignal,
): Promise<void> {
	const { repoName, gitRoot } = await getRepoIdentity(cwd)
	const safeRepoName = sanitizeRepoName(repoName)

	// Prefer process.env.HOME (allows test overrides), fall back to homedir()
	// for non-interactive contexts where HOME is unset (launchd, cron).
	const home = process.env.HOME || homedir()

	// Primary: global observability server
	const globalPortFile = `${home}/.cache/side-quest-observability/events.port`
	// Fallback: per-repo path (V1 convention)
	const repoPortFile = `${home}/.cache/side-quest-git/${safeRepoName}/events.port`

	const globalPort = await readValidPort(globalPortFile)
	const repoPort = await readValidPort(repoPortFile)

	const port = globalPort ?? repoPort
	if (!port) {
		if (globalPort === null && repoPort === null) {
			portCheckFailed = true
		}
		return
	}

	const event: EventEnvelope = {
		schemaVersion: SCHEMA_VERSION,
		type,
		timestamp: new Date().toISOString(),
		correlationId: correlationId || generateCorrelationId(),
		source: 'hook',
		repo: repoName,
		gitRoot,
		data,
	}

	await fetch(`http://127.0.0.1:${port}/events`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(event),
		signal,
	})
}

async function readValidPort(portFilePath: string): Promise<number | null> {
	const file = Bun.file(portFilePath)
	if (!(await file.exists())) return null
	const port = parseInt(await file.text(), 10)
	if (Number.isNaN(port) || port < 1 || port > 65535) return null
	return port
}

/**
 * Reset module-level caches. Exposed for testing only.
 * @internal
 */
export function _resetCaches(): void {
	cachedIdentity = null
	portCheckFailed = false
}
