/**
 * Bun Shell utilities for executing shell commands safely.
 *
 * Uses Bun.$ (bun shell) for ergonomic shell command execution with proper
 * escaping and error handling. Provides consistent patterns matching
 * the spawn module's interface.
 *
 * @see https://bun.sh/docs/runtime/shell
 */

import { $ } from "bun";
import { buildEnhancedPath } from "../spawn";

export interface ShellResult {
	/** Standard output from the command */
	stdout: string;
	/** Standard error from the command */
	stderr: string;
	/** Exit code of the command */
	exitCode: number;
}

/**
 * Execute a shell command using Bun.$ and collect output.
 *
 * This is the preferred way to run shell commands that need:
 * - Pipes (|)
 * - Redirects (>, <, >>)
 * - Shell features (&&, ||, ;)
 * - Environment variable expansion
 *
 * For simple commands without shell features, prefer spawnSyncCollect.
 *
 * @param command - Shell command to execute
 * @param options - Optional execution options
 * @returns Promise resolving to stdout, stderr, and exit code
 *
 * @example
 * ```ts
 * // Simple command with pipe
 * const result = await shellExec("ls -la | grep '.ts'");
 *
 * // With custom working directory
 * const result = await shellExec("git status", { cwd: "/path/to/repo" });
 *
 * // Throws on non-zero exit (default)
 * try {
 *   await shellExec("command-that-fails");
 * } catch (error) {
 *   console.error("Command failed");
 * }
 *
 * // Don't throw on failure
 * const result = await shellExec("command-that-might-fail", { throws: false });
 * if (result.exitCode !== 0) {
 *   console.log("Failed but we handled it");
 * }
 * ```
 */
export async function shellExec(
	command: string,
	options?: {
		cwd?: string;
		env?: Record<string, string | undefined>;
		throws?: boolean;
	},
): Promise<ShellResult> {
	const { cwd, env, throws = true } = options ?? {};

	// Build shell with enhanced PATH for tool discovery
	let shell = $`${command}`.env({
		...process.env,
		PATH: buildEnhancedPath(),
		...env,
	});

	if (cwd) {
		shell = shell.cwd(cwd);
	}

	if (!throws) {
		shell = shell.nothrow();
	}

	// Capture output as text
	shell = shell.quiet();

	const result = await shell;

	return {
		stdout: result.stdout.toString(),
		stderr: result.stderr.toString(),
		exitCode: result.exitCode,
	};
}

/**
 * Execute a shell command synchronously.
 *
 * Note: Bun.$ is inherently async. For sync execution, use spawnSyncCollect
 * from the spawn module. This function is provided for convenience when
 * you can await.
 *
 * @deprecated Prefer shellExec (async) or spawnSyncCollect for sync needs
 */
export const shellExecSync = shellExec;

/**
 * Check if a command exists on PATH.
 *
 * @param cmd - Command name to check
 * @returns true if command is available
 */
export function commandExists(cmd: string): boolean {
	return Bun.which(cmd) !== null;
}

/**
 * Get the path to a command, or null if not found.
 *
 * @param cmd - Command name to resolve
 * @returns Absolute path to the command or null
 */
export function whichCommand(cmd: string): string | null {
	return Bun.which(cmd);
}
