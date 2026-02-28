import { Writable } from 'node:stream'
import {
	configure,
	getJsonLinesFormatter,
	getLogger,
	getStreamSink,
	getTextFormatter,
	type LogLevel,
	reset,
} from '@logtape/logtape'

export type LoggingOptions = {
	debug?: boolean
	quiet?: boolean
	json?: boolean
}

/**
 * Determine if we should use JSON format for log output.
 * Auto-switches based on TTY detection.
 */
function shouldUseJsonLogs(options: LoggingOptions): boolean {
	if (process.env.LOG_FORMAT === 'text') return false
	if (process.env.LOG_FORMAT === 'json') return true
	if (options.json) return true
	return !process.stderr.isTTY
}

/**
 * Setup LogTape logging for the cortex CLI.
 * Must be called once at CLI startup. All diagnostics go to stderr.
 */
export async function setupLogging(
	options: LoggingOptions = {},
): Promise<void> {
	const useJson = shouldUseJsonLogs(options)

	let level: LogLevel = 'warning'
	if (options.debug) level = 'debug'
	if (options.quiet) level = 'error'

	const formatter = useJson
		? getJsonLinesFormatter({ categorySeparator: '.' })
		: getTextFormatter()

	await configure({
		sinks: {
			stderr: getStreamSink(Writable.toWeb(process.stderr) as WritableStream, {
				formatter,
			}),
		},
		loggers: [
			{
				category: ['logtape', 'meta'],
				lowestLevel: 'warning',
				sinks: ['stderr'],
			},
			{
				category: ['cortex'],
				lowestLevel: level,
				sinks: ['stderr'],
			},
		],
	})
}

/**
 * Shutdown logging. Safe to call multiple times.
 */
export async function shutdownLogging(): Promise<void> {
	await reset()
}

/** Re-export getLogger for convenience */
export { getLogger }
