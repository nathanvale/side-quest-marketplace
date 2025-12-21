/**
 * Unified session management for CLI commands.
 *
 * Provides consistent session tracking with correlation IDs, duration measurement,
 * and formatted output for command start/end events.
 *
 * @example
 * ```typescript
 * import { startSession } from "./shared/session";
 *
 * const session = startSession("para scan");
 * try {
 *   // ... do work ...
 *   session.end({ success: true });
 * } catch (error) {
 *   session.end({ error: error.message });
 * }
 * ```
 *
 * Output:
 * ```
 * ▸ para scan [para-x7k2m9]
 * ... command output ...
 * Session: para-x7k2m9 (3.2s)
 * ```
 *
 * Or on error:
 * ```
 * ▸ para scan [para-x7k2m9]
 * ... command output ...
 * Failed [para-x7k2m9]: Connection timeout (1.5s)
 * ```
 *
 * @module session
 */

import { color, emphasize } from "@sidequest/core/terminal";
import { createCorrelationId } from "../../shared/logger.js";

/**
 * Options for starting a session.
 */
export interface SessionStartOptions {
	/**
	 * Whether to suppress console output (e.g., for JSON mode).
	 * When true, no start/end lines are printed.
	 * @default false
	 */
	silent?: boolean;
}

/**
 * Options for ending a session.
 */
export interface SessionEndOptions {
	/**
	 * Whether the session completed successfully.
	 * If false or undefined with error, will show error output.
	 */
	success?: boolean;

	/**
	 * Error message to display if session failed.
	 * If provided, success is assumed to be false.
	 */
	error?: string;
}

/**
 * Session tracking object returned by startSession().
 */
export interface Session {
	/**
	 * Correlation ID for this session.
	 * Use this for logging and request tracing.
	 */
	sessionCid: string;

	/**
	 * Timestamp when session started (milliseconds since epoch).
	 */
	startTime: number;

	/**
	 * End the session and print duration/status.
	 *
	 * @param options - Success/error status
	 */
	end(options?: SessionEndOptions): void;
}

/**
 * Start a CLI command session with automatic correlation ID tracking.
 *
 * Prints a dim start line with the command name and session CID (unless silent).
 * Returns an object with utilities for ending the session.
 *
 * @param commandName - Human-readable command name (e.g., "para scan")
 * @param options - Session start options (e.g., { silent: true } for JSON mode)
 * @returns Session tracking object with end() function
 *
 * @example
 * ```typescript
 * // Normal mode - prints session start/end
 * const session = startSession("para process-inbox");
 * session.end({ success: true });
 *
 * // JSON mode - no console output
 * const session = startSession("para scan", { silent: true });
 * session.end();
 * ```
 */
export function startSession(
	commandName: string,
	options?: SessionStartOptions,
): Session {
	const sessionCid = createCorrelationId();
	const startTime = Date.now();
	const silent = options?.silent ?? false;

	// Print dim start line: ▸ commandName [sessionCid]
	if (!silent) {
		console.log(emphasize.dim(`▸ ${commandName} [${sessionCid}]`));
	}

	return {
		sessionCid,
		startTime,
		end(endOptions?: SessionEndOptions): void {
			const durationMs = Date.now() - startTime;
			const durationSec = (durationMs / 1000).toFixed(1);

			// Skip output in silent mode
			if (silent) {
				return;
			}

			// Determine if this is an error case
			const isError =
				endOptions?.error !== undefined || endOptions?.success === false;

			if (isError) {
				// Error line: Failed [sessionCid]: error (duration)
				const errorMsg = endOptions?.error ?? "Unknown error";
				console.log(
					color("red", `Failed [${sessionCid}]: ${errorMsg} (${durationSec}s)`),
				);
			} else {
				// Success line: Session: sessionCid (duration)
				console.log(emphasize.dim(`Session: ${sessionCid} (${durationSec}s)`));
			}
		},
	};
}
