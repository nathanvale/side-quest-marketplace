/**
 * Bin Script Runner
 *
 * Executes shell scripts from ~/code/dotfiles/bin/ safely.
 * Uses spawnSync with argument arrays to prevent command injection.
 */

import {
	type SpawnSyncOptionsWithStringEncoding,
	spawnSync,
} from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Logger interface compatible with LogTape loggers.
 * Using minimal interface to avoid direct @logtape/logtape dependency.
 */
interface BinRunnerLogger {
	warn(message: string, properties?: Record<string, unknown>): void;
	debug(message: string, properties?: Record<string, unknown>): void;
	error(message: string, properties?: Record<string, unknown>): void;
	info(message: string, properties?: Record<string, unknown>): void;
}

/** Default bin directory in dotfiles */
const BIN_DIR = join(homedir(), "code", "dotfiles", "bin");

/** Default timeout for bin script execution (30 seconds) */
const DEFAULT_TIMEOUT = 30_000;

/**
 * Result of running a bin script.
 */
export interface BinScriptResult {
	/** Standard output from the script */
	stdout: string;
	/** Standard error from the script */
	stderr: string;
	/** Exit code (0 = success) */
	exitCode: number;
	/** Whether the script was found */
	scriptFound: boolean;
}

/**
 * Options for running a bin script.
 */
export interface RunBinScriptOptions {
	/** Script name (e.g., "say", "quarantine", "downloads") */
	script: string;
	/** Arguments to pass to the script */
	args: string[];
	/** Logger for observability */
	logger: BinRunnerLogger;
	/** Correlation ID for request tracing */
	cid: string;
	/** Custom timeout in milliseconds (default: 30000) */
	timeout?: number;
	/** Custom bin directory (default: ~/code/dotfiles/bin) */
	binDir?: string;
}

/**
 * Run a bin script safely using spawnSync with argument arrays.
 *
 * @param options - Script execution options
 * @returns Result with stdout, stderr, and exit code
 *
 * @example
 * ```typescript
 * const result = runBinScript({
 *   script: "say",
 *   args: ["speak", "Hello world", "--voice", "Samantha"],
 *   logger: sayLogger,
 *   cid: createCorrelationId(),
 * });
 * ```
 */
export function runBinScript(options: RunBinScriptOptions): BinScriptResult {
	const {
		script,
		args,
		logger,
		cid,
		timeout = DEFAULT_TIMEOUT,
		binDir = BIN_DIR,
	} = options;

	const scriptPath = join(binDir, script);

	// Check if script exists
	if (!existsSync(scriptPath)) {
		logger.warn("Bin script not found", { cid, script, scriptPath });
		return {
			stdout: "",
			stderr: `Script not found: ${scriptPath}`,
			exitCode: 127,
			scriptFound: false,
		};
	}

	logger.debug("Executing bin script", {
		cid,
		script,
		args,
		timeout,
	});

	const startTime = Date.now();

	const spawnOptions: SpawnSyncOptionsWithStringEncoding = {
		encoding: "utf8",
		timeout,
		maxBuffer: 10 * 1024 * 1024, // 10MB
	};

	// Use argument array to prevent command injection
	const result = spawnSync(scriptPath, args, spawnOptions);

	const durationMs = Date.now() - startTime;

	// Log result
	if (result.error) {
		logger.error("Bin script execution error", {
			cid,
			script,
			error: result.error.message,
			durationMs,
		});
	} else {
		logger.debug("Bin script result", {
			cid,
			script,
			exitCode: result.status,
			durationMs,
			stdoutLength: result.stdout?.length ?? 0,
			stderrLength: result.stderr?.length ?? 0,
		});
	}

	return {
		stdout: result.stdout?.trim() ?? "",
		stderr: result.stderr?.trim() ?? "",
		exitCode: result.status ?? 1,
		scriptFound: true,
	};
}

/**
 * Check if a bin script exists.
 *
 * @param script - Script name
 * @param binDir - Bin directory (default: ~/code/dotfiles/bin)
 * @returns True if script exists
 */
export function binScriptExists(script: string, binDir = BIN_DIR): boolean {
	return existsSync(join(binDir, script));
}

/**
 * Get the full path to a bin script.
 *
 * @param script - Script name
 * @param binDir - Bin directory (default: ~/code/dotfiles/bin)
 * @returns Full path to the script
 */
export function getBinScriptPath(script: string, binDir = BIN_DIR): string {
	return join(binDir, script);
}
