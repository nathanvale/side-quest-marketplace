/**
 * Shared spawn utilities for biome-runner hooks.
 *
 * Why: Bun's process streams must be consumed in parallel with waiting for exit.
 * Reading stdout/stderr AFTER proc.exited can miss output due to a race condition
 * where the stream closes before being read. This utility enforces the correct
 * pattern across all spawn calls in the plugin.
 */

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
	},
): Promise<SpawnResult> {
	const proc = spawn({
		cmd,
		stdout: "pipe",
		stderr: "pipe",
		env: options?.env ? { ...process.env, ...options.env } : process.env,
		signal: options?.signal,
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
