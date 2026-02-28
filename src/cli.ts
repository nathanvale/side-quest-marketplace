#!/usr/bin/env bun

import { parseArgs } from 'node:util'
import { runList } from './commands/list.js'
import { runOpen } from './commands/open.js'
import { runSearch } from './commands/search.js'
import { loadConfig } from './config.js'
import { setupLogging, shutdownLogging } from './logging.js'
import { EXIT_CODES, writeError, writeSuccess } from './output.js'
import { buildIndex } from './parser.js'

const USAGE = `cortex - Agent-native knowledge system

Usage:
  cortex list [options]          List documents (alias: ls)
  cortex search "query" [opts]   Search documents (alias: s)
  cortex open "identifier"       Open document in viewer (alias: o)
  cortex help                    Show this help

List options:
  --type <type>       Filter by doc type (research, brainstorm, plan, etc.)
  --tags <t1,t2>      Filter by tags (comma-separated, OR semantics)
  --project <name>    Filter by project
  --status <status>   Filter by status (draft, reviewed, final, archived)

Search options:
  --limit <n>         Max results (default: 20)

Common options:
  --json              Force JSON output (auto-enabled when stdout is piped)
  --fields <f1,f2>    Project specific fields only (see Fields below)
  --debug             Show debug diagnostics on stderr
  --quiet             Suppress all output except errors
  --help              Show this help

Fields (for --fields):
  title, type, status, project, tags, created, updated,
  path, stem, body
`

const cliOptions = {
	type: { type: 'string' },
	tags: { type: 'string' },
	project: { type: 'string' },
	status: { type: 'string' },
	json: { type: 'boolean', default: false },
	fields: { type: 'string' },
	limit: { type: 'string' },
	debug: { type: 'boolean', default: false },
	quiet: { type: 'boolean', default: false },
	help: { type: 'boolean', default: false },
} as const

async function main(): Promise<number> {
	let values: ReturnType<
		typeof parseArgs<{ options: typeof cliOptions }>
	>['values']
	let positionals: string[]
	try {
		const parsed = parseArgs({
			args: process.argv.slice(2),
			options: cliOptions,
			allowPositionals: true,
		})
		values = parsed.values
		positionals = parsed.positionals
	} catch (err) {
		const msg = err instanceof Error ? err.message : 'Unknown argument error'
		writeError(msg, 'E_USAGE')
		return EXIT_CODES.INVALID_ARGS
	}

	try {
		await setupLogging({
			debug: values.debug,
			quiet: values.quiet,
			json: values.json,
		})
	} catch {
		// Logging setup failed -- continue without structured logging
	}

	const command = positionals[0]

	if (!command || command === 'help' || values.help) {
		if (values.json || !process.stdout.isTTY) {
			const helpData = {
				commands: [
					{
						name: 'list',
						aliases: ['ls'],
						description: 'List documents with optional filters',
					},
					{
						name: 'search',
						aliases: ['s'],
						description: 'Search documents with substring matching',
					},
					{
						name: 'open',
						aliases: ['o'],
						description: 'Open document in configured viewer',
					},
					{ name: 'help', aliases: [], description: 'Show help information' },
				],
				flags: [
					{
						name: '--type',
						type: 'string',
						description: 'Filter by doc type',
						commands: ['list'],
					},
					{
						name: '--tags',
						type: 'string',
						description: 'Filter by tags (comma-separated, OR)',
						commands: ['list'],
					},
					{
						name: '--project',
						type: 'string',
						description: 'Filter by project',
						commands: ['list'],
					},
					{
						name: '--status',
						type: 'string',
						description: 'Filter by status',
						commands: ['list'],
					},
					{
						name: '--limit',
						type: 'string',
						description: 'Max results (default: 20)',
						commands: ['search'],
					},
					{
						name: '--json',
						type: 'boolean',
						description: 'Force JSON output',
						commands: ['all'],
					},
					{
						name: '--fields',
						type: 'string',
						description: 'Project specific fields',
						commands: ['list', 'search'],
					},
					{
						name: '--debug',
						type: 'boolean',
						description: 'Show debug diagnostics',
						commands: ['all'],
					},
					{
						name: '--quiet',
						type: 'boolean',
						description: 'Suppress non-error output',
						commands: ['all'],
					},
				],
			}
			writeSuccess(helpData, { json: true })
		} else {
			process.stdout.write(USAGE)
		}
		return EXIT_CODES.SUCCESS
	}

	// Load config and build index
	let config: ReturnType<typeof loadConfig> | undefined
	try {
		config = loadConfig()
	} catch (err) {
		const msg = err instanceof Error ? err.message : 'Unknown config error'
		writeError(msg, 'E_CONFIG', { json: values.json })
		return EXIT_CODES.CONFIG_ERROR
	}

	const { docs, warnings } = buildIndex(config)

	switch (command) {
		case 'list':
		case 'ls':
			return runList(docs, {
				type: values.type,
				tags: values.tags,
				project: values.project,
				status: values.status,
				json: values.json,
				fields: values.fields,
				quiet: values.quiet,
				warnings,
			})

		case 'search':
		case 's': {
			const query = positionals[1]
			if (!query) {
				writeError(
					'Search requires a query. Usage: cortex search "query"',
					'E_USAGE',
					{ json: values.json },
				)
				return EXIT_CODES.INVALID_ARGS
			}
			let limit: number | undefined
			if (values.limit) {
				limit = Number.parseInt(values.limit, 10)
				if (Number.isNaN(limit) || limit < 1) {
					writeError(
						`Invalid --limit value: "${values.limit}". Must be a positive integer.`,
						'E_USAGE',
						{ json: values.json },
					)
					return EXIT_CODES.INVALID_ARGS
				}
			}
			return runSearch(docs, query, {
				json: values.json,
				limit,
				fields: values.fields,
				quiet: values.quiet,
				warnings,
			})
		}

		case 'open':
		case 'o': {
			const identifier = positionals[1]
			if (!identifier) {
				writeError(
					'Open requires an identifier. Usage: cortex open "doc-name"',
					'E_USAGE',
					{ json: values.json },
				)
				return EXIT_CODES.INVALID_ARGS
			}
			return runOpen(docs, identifier, config, {
				json: values.json,
				quiet: values.quiet,
				warnings,
			})
		}

		default:
			writeError(
				`Unknown command: ${command}. Run "cortex help" for usage.`,
				'E_USAGE',
				{ json: values.json },
			)
			return EXIT_CODES.INVALID_ARGS
	}
}

// Entry point with guaranteed shutdown
const exitCode = await main().finally(() => shutdownLogging())
process.exit(exitCode)
