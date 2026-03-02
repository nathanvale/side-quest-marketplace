#!/usr/bin/env bun

/**
 * Command Logger Hook
 *
 * PostToolUse hook that logs Bash commands to an audit trail.
 */

import { appendFile, mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { postEvent } from './event-bus-client'

interface PostToolUseHookInput {
	tool_name: string
	tool_input?: {
		command?: unknown
	}
	session_id?: string
	cwd?: string
}

function isPostToolUseHookInput(value: unknown): value is PostToolUseHookInput {
	if (!value || typeof value !== 'object') return false
	return 'tool_name' in value && typeof value.tool_name === 'string'
}

export interface CommandLogEntry {
	timestamp: string
	session_id: string
	cwd: string
	command: string
}

/**
 * Builds a structured log entry from a PostToolUse hook payload. Returns null
 * for non-Bash tools so only shell commands are recorded in the audit trail.
 */
export function createLogEntry(
	input: PostToolUseHookInput,
): CommandLogEntry | null {
	if (input.tool_name !== 'Bash') {
		return null
	}

	const command = input.tool_input?.command
	if (typeof command !== 'string') {
		return null
	}

	return {
		timestamp: new Date().toISOString(),
		session_id: input.session_id || 'unknown',
		cwd: input.cwd || 'unknown',
		command,
	}
}

if (import.meta.main) {
	// Self-destruct timer: first executable line when run as entry point.
	// Set to 80% of hooks.json timeout (5s).
	const selfDestruct = setTimeout(() => {
		process.stderr.write('command-logger: timed out\n')
		process.exit(1)
	}, 4_000)
	selfDestruct.unref()

	try {
		let input: PostToolUseHookInput
		try {
			const parsed = await Bun.stdin.json()
			if (!isPostToolUseHookInput(parsed)) {
				process.exit(0)
			}
			input = parsed
		} catch {
			process.exit(0)
		}

		const entry = createLogEntry(input)
		if (!entry) {
			process.exit(0)
		}

		const logDir = join(homedir(), '.claude', 'logs')
		const logPath = join(logDir, 'git-command-log.jsonl')

		await mkdir(logDir, { recursive: true })
		await appendFile(logPath, `${JSON.stringify(entry)}\n`)

		try {
			await postEvent(entry.cwd, 'command.executed', {
				command: entry.command,
				session_id: entry.session_id,
			})
		} catch {
			// event emission is best-effort
		}
	} catch {
		// fire and forget
	}

	process.exit(0)
}
