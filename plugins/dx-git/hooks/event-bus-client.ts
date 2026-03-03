import { createHash } from 'node:crypto'
import { appendFileSync } from 'node:fs'

/** Event types emitted by hook lifecycle */
export type HookEventType =
	| 'session.started'
	| 'safety.blocked'
	| 'safety.warn'
	| 'command.executed'
	| 'session.compacted'
	| 'session.ended'

/**
 * Forward-looking event emission stub.
 *
 * The event bus client is designed to POST structured events to a local
 * observability server (side-quest-observability). That server does not
 * exist yet, so this function is intentionally a no-op. Once the server
 * ships, this stub will be replaced with the real HTTP POST logic.
 *
 * All hook call-sites already call postEvent in fire-and-forget style
 * with try/catch, so swapping in the real implementation will be seamless.
 */
export async function postEvent(
	_cwd: string,
	_type: HookEventType,
	_data: Record<string, unknown>,
	_correlationId?: string,
): Promise<void> {
	const capturePath = process.env.CLAUDE_HOOK_EVENT_LOG
	if (!capturePath) return
	const line = JSON.stringify({
		type: _type,
		cwd: _cwd,
		data: _data,
		correlationId: _correlationId,
		timestamp: new Date().toISOString(),
	})
	appendFileSync(capturePath, `${line}\n`, 'utf8')
}

/** Sanitize repo name to prevent path traversal. */
export function sanitizeRepoName(name: string): string {
	const safe = name.replace(/[^a-zA-Z0-9._-]/g, '_')
	return safe || 'unknown'
}

function hashGitRoot(gitRoot: string): string {
	const normalized = gitRoot.replace(/\\/g, '/')
	return createHash('sha256').update(normalized).digest('hex').slice(0, 12)
}

/** Returns a sanitized, hash-suffixed repo key safe for use in file paths. */
export function getRepoKeyFromGitRoot(gitRoot: string): string {
	const baseName = gitRoot.split(/[/\\]/).pop() || 'unknown'
	const safeBaseName = sanitizeRepoName(baseName)
	return `${safeBaseName}-${hashGitRoot(gitRoot)}`
}

/**
 * Reset module-level caches. Exposed for testing only.
 * Currently a no-op since the stub has no caches, but retained
 * so existing test imports do not break.
 * @internal
 */
export function _resetCaches(): void {}
