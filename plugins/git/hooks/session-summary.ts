#!/usr/bin/env bun

/**
 * Session Summary Hook (Cortex Pattern)
 *
 * PreCompact hook that extracts salient content from the transcript before
 * context compaction. Appends entries to ~/.claude/cortex/<repo-name>.jsonl
 * and saves git state as additionalContext to influence what Claude preserves.
 */

import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { PreCompactHookInput } from "@anthropic-ai/claude-agent-sdk";

/** A single cortex entry extracted from the transcript */
export interface CortexEntry {
	timestamp: string;
	type: "decision" | "error_fix" | "learning" | "preference";
	salience: number;
	content: string;
	context?: string;
}

/** Pattern matcher for extracting salient content */
interface SaliencePattern {
	type: CortexEntry["type"];
	salience: number;
	patterns: RegExp[];
}

const SALIENCE_PATTERNS: SaliencePattern[] = [
	{
		type: "decision",
		salience: 0.9,
		patterns: [
			/decided to\s+(.+)/i,
			/going with\s+(.+)/i,
			/the approach is\s+(.+)/i,
			/we(?:'ll| will) use\s+(.+)/i,
			/let(?:'s| us) go with\s+(.+)/i,
		],
	},
	{
		type: "error_fix",
		salience: 0.8,
		patterns: [
			/(?:fixed|resolved|solved)\s+(?:by|with|the)\s+(.+)/i,
			/the (?:fix|solution) (?:was|is)\s+(.+)/i,
			/error was caused by\s+(.+)/i,
			/root cause(?::| was)\s+(.+)/i,
		],
	},
	{
		type: "learning",
		salience: 0.7,
		patterns: [
			/(?:TIL|learned that)\s+(.+)/i,
			/turns out\s+(.+)/i,
			/the issue was\s+(.+)/i,
			/(?:discovered|found out)\s+(?:that\s+)?(.+)/i,
		],
	},
	{
		type: "preference",
		salience: 0.7,
		patterns: [
			/always\s+(.+)/i,
			/never\s+(.+)/i,
			/prefer\s+(.+)/i,
			/(?:I|we) want\s+(.+)/i,
		],
	},
];

/**
 * Extract salient content from transcript text
 */
export function extractFromTranscript(transcriptText: string): CortexEntry[] {
	const entries: CortexEntry[] = [];
	const now = new Date().toISOString();

	// Parse JSONL lines and extract user + assistant text
	const lines = transcriptText.split("\n").filter((l) => l.trim());
	const textContent: string[] = [];

	for (const line of lines) {
		try {
			const parsed = JSON.parse(line);
			if (
				parsed.type === "user" &&
				typeof parsed.message?.content === "string"
			) {
				textContent.push(parsed.message.content);
			}
			if (
				parsed.type === "assistant" &&
				typeof parsed.message?.content === "string"
			) {
				textContent.push(parsed.message.content);
			}
			// Handle content array format
			if (
				parsed.type === "assistant" &&
				Array.isArray(parsed.message?.content)
			) {
				for (const block of parsed.message.content) {
					if (block.type === "text" && typeof block.text === "string") {
						textContent.push(block.text);
					}
				}
			}
		} catch {
			// Skip malformed lines
		}
	}

	const fullText = textContent.join("\n");
	const sentences = fullText
		.split(/[.!?\n]+/)
		.filter((s) => s.trim().length > 10);

	for (const sentence of sentences) {
		for (const pattern of SALIENCE_PATTERNS) {
			for (const regex of pattern.patterns) {
				const match = sentence.match(regex);
				if (match?.[1]) {
					entries.push({
						timestamp: now,
						type: pattern.type,
						salience: pattern.salience,
						content: match[1].trim().slice(0, 200),
						context: sentence.trim().slice(0, 300),
					});
					break; // One match per sentence per pattern type
				}
			}
		}
	}

	// Deduplicate by content
	const seen = new Set<string>();
	return entries.filter((e) => {
		const key = `${e.type}:${e.content}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

async function exec(
	command: string,
	cwd: string,
): Promise<{ stdout: string; exitCode: number }> {
	const proc = Bun.spawn(["sh", "-c", command], {
		cwd,
		stdout: "pipe",
		stderr: "pipe",
	});

	const stdout = await new Response(proc.stdout).text();
	const exitCode = await proc.exited;

	return { stdout: stdout.trim(), exitCode };
}

async function isGitRepo(cwd: string): Promise<boolean> {
	const { exitCode } = await exec("git rev-parse --git-dir", cwd);
	return exitCode === 0;
}

async function getGitRoot(cwd: string): Promise<string | null> {
	const { stdout, exitCode } = await exec("git rev-parse --show-toplevel", cwd);
	return exitCode === 0 ? stdout : null;
}

/**
 * Get git state summary for compaction context
 */
async function getGitStateSummary(cwd: string): Promise<string> {
	const { stdout: branch } = await exec(
		"git branch --show-current 2>/dev/null || echo '(detached)'",
		cwd,
	);
	const { stdout: commitsOut } = await exec(
		'git log --oneline --since="1 hour ago" 2>/dev/null | head -10',
		cwd,
	);
	const { stdout: statusOut } = await exec(
		"git status --porcelain 2>/dev/null | head -20",
		cwd,
	);

	let summary = `Branch: ${branch || "(detached)"}`;
	if (commitsOut.trim()) {
		summary += `\nSession commits:\n${commitsOut}`;
	}
	if (statusOut.trim()) {
		summary += `\nUncommitted:\n${statusOut}`;
	}
	return summary;
}

/**
 * Ensure directory exists (no external deps)
 */
async function ensureDirectory(dir: string): Promise<void> {
	const proc = Bun.spawn(["mkdir", "-p", dir], {
		stdout: "pipe",
		stderr: "pipe",
	});
	await proc.exited;
}

// Main execution
if (import.meta.main) {
	try {
		let input: PreCompactHookInput;
		try {
			input = (await Bun.stdin.json()) as PreCompactHookInput;
		} catch {
			process.exit(0);
		}

		const { cwd } = input;

		if (!(await isGitRepo(cwd))) {
			process.exit(0);
		}

		const gitRoot = await getGitRoot(cwd);
		if (!gitRoot) {
			process.exit(0);
		}

		const repoName = gitRoot.split("/").pop() || "unknown";

		// Extract cortex entries from transcript
		let cortexEntries: CortexEntry[] = [];
		if (input.transcript_path) {
			try {
				const transcriptText = await readFile(input.transcript_path, "utf-8");
				cortexEntries = extractFromTranscript(transcriptText);
			} catch {
				// Transcript not readable — proceed with git state only
			}
		}

		// Append cortex entries to JSONL (never overwrite)
		if (cortexEntries.length > 0) {
			const cortexDir = join(homedir(), ".claude", "cortex");
			await ensureDirectory(cortexDir);
			const cortexPath = join(cortexDir, `${repoName}.jsonl`);
			const jsonlLines = cortexEntries.map((e) => JSON.stringify(e)).join("\n");
			const file = Bun.file(cortexPath);
			const existing = (await file.exists()) ? await file.text() : "";
			const separator = existing.endsWith("\n") || existing === "" ? "" : "\n";
			await Bun.write(cortexPath, `${existing}${separator}${jsonlLines}\n`);
		}

		// Append git state to session summaries (not overwrite)
		const gitState = await getGitStateSummary(cwd);
		const summaryDir = join(homedir(), ".claude", "session-summaries");
		await ensureDirectory(summaryDir);
		const summaryPath = join(summaryDir, `${repoName}.md`);
		const summaryFile = Bun.file(summaryPath);
		const existingSummary = (await summaryFile.exists())
			? await summaryFile.text()
			: "";
		const timestamp = new Date().toISOString();
		const newEntry = `\n---\n## Compaction ${timestamp}\n\n${gitState}\n`;
		await Bun.write(summaryPath, existingSummary + newEntry);

		// Output additionalContext to influence what Claude preserves
		const contextParts: string[] = [];
		contextParts.push(`Git state at compaction:\n${gitState}`);

		if (cortexEntries.length > 0) {
			contextParts.push(
				`Extracted ${cortexEntries.length} salient items to cortex:`,
			);
			for (const entry of cortexEntries.slice(0, 5)) {
				contextParts.push(`  [${entry.type}] ${entry.content}`);
			}
		}

		const output = {
			hookSpecificOutput: {
				hookEventName: "PreCompact",
				additionalContext: contextParts.join("\n"),
			},
		};
		console.log(JSON.stringify(output));
	} catch {
		// Top-level catch — never crash the hook
	}

	process.exit(0);
}
