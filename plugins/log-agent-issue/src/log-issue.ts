#!/usr/bin/env bun
/**
 * Fire-and-forget agent issue logger.
 *
 * Reads JSON from stdin, appends a JSONL entry to ~/.claude/logs/agent-issues.jsonl.
 * Always exits 0 — never blocks the calling agent.
 *
 * Usage:
 *   echo '{"agentId":"worker","issues":[{"type":"error","message":"boom"}]}' \
 *     | bun log-issue.ts "session-id"
 */

import { appendFile, mkdir, rename, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const LOG_DIR = join(homedir(), ".claude", "logs");
const LOG_FILE = join(LOG_DIR, "agent-issues.jsonl");
const MAX_SIZE = 1024 * 1024; // 1 MiB

interface Issue {
	type: "error" | "warning" | "info";
	message: string;
	toolName?: string;
	filePath?: string;
	context?: Record<string, unknown>;
	suggestion?: string;
}

interface Payload {
	agentId: string;
	issues: Issue[];
}

function isValidPayload(data: unknown): data is Payload {
	if (typeof data !== "object" || data === null) return false;
	const obj = data as Record<string, unknown>;
	if (typeof obj.agentId !== "string" || obj.agentId.length === 0) return false;
	if (!Array.isArray(obj.issues) || obj.issues.length === 0) return false;
	return obj.issues.every(
		(issue: unknown) =>
			typeof issue === "object" &&
			issue !== null &&
			typeof (issue as Record<string, unknown>).type === "string" &&
			["error", "warning", "info"].includes(
				(issue as Record<string, unknown>).type as string,
			) &&
			typeof (issue as Record<string, unknown>).message === "string",
	);
}

async function rotateIfNeeded(): Promise<void> {
	try {
		const stats = await stat(LOG_FILE);
		if (stats.size <= MAX_SIZE) return;

		// Shift existing rotations: .2 -> .3, .1 -> .2, current -> .1
		for (let i = 2; i >= 1; i--) {
			try {
				await rename(`${LOG_FILE}.${i}`, `${LOG_FILE}.${i + 1}`);
			} catch {
				// File doesn't exist, skip
			}
		}
		await rename(LOG_FILE, `${LOG_FILE}.1`);
	} catch {
		// File doesn't exist yet, nothing to rotate
	}
}

async function main(): Promise<void> {
	try {
		const sessionId = process.argv[2] || "unknown";

		// Read all of stdin
		const chunks: Buffer[] = [];
		for await (const chunk of Bun.stdin.stream()) {
			chunks.push(Buffer.from(chunk));
		}
		const raw = Buffer.concat(chunks).toString("utf-8").trim();
		if (!raw) process.exit(0);

		const data: unknown = JSON.parse(raw);
		if (!isValidPayload(data)) process.exit(0);

		const entry = {
			timestamp: new Date().toISOString(),
			sessionId,
			agentId: data.agentId,
			issues: data.issues,
		};

		await mkdir(LOG_DIR, { recursive: true });
		await rotateIfNeeded();
		await appendFile(LOG_FILE, `${JSON.stringify(entry)}\n`);
	} catch {
		// Fire-and-forget: swallow all errors
	}
	process.exit(0);
}

main();
