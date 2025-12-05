/**
 * Shared spawn utilities for bun-runner hooks.
 *
 * Why: Bun's process streams must be consumed in parallel with waiting for exit.
 * Reading stdout/stderr AFTER proc.exited can miss output due to a race condition
 * where the stream closes before being read. This utility enforces the correct
 * pattern across all spawn calls in the plugin.
 *
 * @see CLAUDE.md "Race Condition Fix" section for detailed explanation
 */

import { homedir } from "node:os";
import path from "node:path";
import { spawn } from "bun";

/**
 * Result of spawning a process and collecting its output.
 */
export interface SpawnResult {
	/** Standard output from the process */
	stdout: string;
	/** Standard error from the process */
	stderr: string;
	/** Exit code of the process */
	exitCode: number;
}

/**
 * Ensure a command exists on PATH (uses Bun.which).
 *
 * @param cmd - Command name to resolve
 * @returns Resolved absolute path to the command
 * @throws Error if the command is not found
 */
export function ensureCommandAvailable(cmd: string): string {
	const resolved = Bun.which(cmd);
	if (!resolved) {
		throw new Error(`Command not found: ${cmd}`);
	}
	return resolved;
}

/**
 * Build an augmented PATH including common tool install locations.
 *
 * Ensures tools installed via uv, pipx, or Homebrew are discoverable
 * in non-interactive shells (like MCP servers) that don't source .zshrc/.bashrc.
 *
 * @param extraPaths - Additional paths to prepend (optional)
 * @returns PATH string with defaults + provided paths merged ahead of existing PATH
 *
 * @example
 * ```typescript
 * // Basic usage - adds ~/.local/bin, /opt/homebrew/bin, /usr/local/bin
 * const path = buildEnhancedPath();
 *
 * // With extra paths
 * const path = buildEnhancedPath(['/custom/bin', '/another/bin']);
 *
 * // Use in spawn options
 * spawnSyncCollect(['kit', 'index'], { env: { PATH: buildEnhancedPath() } });
 * ```
 */
export function buildEnhancedPath(
	extraPaths: ReadonlyArray<string> = [],
): string {
	const current = process.env.PATH ?? "";
	const currentPaths = new Set(current.split(":").filter(Boolean));
	const defaults = [
		path.join(homedir(), ".local", "bin"),
		"/opt/homebrew/bin",
		"/usr/local/bin",
	];

	// Deduplicate: track all paths we've seen (current + what we're adding)
	const seen = new Set(currentPaths);
	const additions: string[] = [];

	for (const p of [...defaults, ...extraPaths]) {
		if (p && !seen.has(p)) {
			additions.push(p);
			seen.add(p);
		}
	}

	return additions.length > 0
		? [...additions, current].filter(Boolean).join(":")
		: current;
}

/**
 * Spawn a process and collect its output safely.
 *
 * Why: This function enforces the correct pattern for consuming Bun process streams.
 * The streams MUST be read in parallel with waiting for exit to avoid race conditions.
 *
 * @param cmd - Command and arguments as an array (e.g., ["git", "status"])
 * @param options - Optional spawn options
 * @returns Promise resolving to stdout, stderr, and exit code
 *
 * @example
 * ```ts
 * const { stdout, stderr, exitCode } = await spawnAndCollect(
 *   ["git", "rev-parse", "--show-toplevel"]
 * );
 * if (exitCode === 0) {
 *   console.log("Git root:", stdout.trim());
 * }
 * ```
 */
export async function spawnAndCollect(
	cmd: string[],
	options?: {
		env?: Record<string, string | undefined>;
		signal?: AbortSignal;
		cwd?: string;
	},
): Promise<SpawnResult> {
	const proc = spawn({
		cmd,
		stdout: "pipe",
		stderr: "pipe",
		env: options?.env ? { ...process.env, ...options.env } : process.env,
		signal: options?.signal,
		cwd: options?.cwd,
	});

	// CRITICAL: Consume streams in parallel with waiting for exit.
	// Reading after proc.exited resolves can miss output (race condition).
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);

	return { stdout, stderr, exitCode };
}

/**
 * Spawn a process with a timeout and collect its output safely.
 *
 * Why: Some processes (like TypeScript compiler) can hang or run too long.
 * This wrapper adds timeout protection using AbortController, which is more
 * reliable than Bun's built-in timeout option (which has bugs).
 *
 * @param cmd - Command and arguments as an array
 * @param timeoutMs - Timeout in milliseconds
 * @param options - Optional spawn options (env)
 * @returns Promise resolving to stdout, stderr, exit code, and timeout flag
 *
 * @example
 * ```ts
 * const result = await spawnWithTimeout(
 *   ["bunx", "tsc", "--noEmit", "file.ts"],
 *   10000 // 10 second timeout
 * );
 * if (result.timedOut) {
 *   console.error("TypeScript check timed out");
 * }
 * ```
 */
export async function spawnWithTimeout(
	cmd: string[],
	timeoutMs: number,
	options?: {
		env?: Record<string, string | undefined>;
		cwd?: string;
	},
): Promise<SpawnResult & { timedOut: boolean }> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const result = await spawnAndCollect(cmd, {
			...options,
			signal: controller.signal,
		});
		clearTimeout(timeoutId);
		return { ...result, timedOut: false };
	} catch (error) {
		clearTimeout(timeoutId);
		if (controller.signal.aborted) {
			return {
				stdout: "",
				stderr: "",
				exitCode: -1,
				timedOut: true,
			};
		}
		throw error;
	}
}

/**
 * Synchronous spawn helper using Bun.spawnSync with consistent string output.
 *
 * @param cmd - Command and arguments as an array
 * @param options - Optional spawn options
 * @returns Stdout, stderr, exit code
 */
export function spawnSyncCollect(
	cmd: string[],
	options?: {
		env?: Record<string, string | undefined>;
		cwd?: string;
	},
): SpawnResult {
	const result = Bun.spawnSync({
		cmd,
		stdout: "pipe",
		stderr: "pipe",
		cwd: options?.cwd,
		env: options?.env ? { ...process.env, ...options.env } : process.env,
	});

	const stdout =
		typeof result.stdout === "string"
			? result.stdout
			: new TextDecoder().decode(result.stdout);
	const stderr =
		typeof result.stderr === "string"
			? result.stderr
			: new TextDecoder().decode(result.stderr);

	return {
		stdout,
		stderr,
		exitCode: result.exitCode ?? 1,
	};
}
