#!/usr/bin/env bun
/**
 * Changeset generation wrapper — supports interactive and non-interactive modes.
 *
 * Interactive (humans):
 *   bun version:gen
 *   → Spawns the interactive `changeset` CLI (requires TTY)
 *
 * Non-interactive (agents/CI):
 *   bun version:gen --bump minor --summary "Added new feature X"
 *   → Writes .changeset/<random-name>.md directly (no TTY needed)
 *
 * Flags:
 *   --bump, -b     Bump type: patch | minor | major (required for non-interactive)
 *   --summary, -s  Changeset summary text (required for non-interactive)
 *   --help, -h     Show usage
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'

// Word lists for changeset filenames (same pattern as @changesets/cli)
const ADJECTIVES = [
	'bright',
	'calm',
	'cool',
	'dry',
	'fair',
	'fast',
	'flat',
	'fresh',
	'gold',
	'green',
	'happy',
	'kind',
	'late',
	'lean',
	'light',
	'loud',
	'new',
	'nice',
	'old',
	'proud',
	'quick',
	'rare',
	'red',
	'rich',
	'shy',
	'slow',
	'soft',
	'tall',
	'warm',
	'wild',
]

const NOUNS = [
	'bees',
	'birds',
	'boats',
	'cats',
	'clouds',
	'cows',
	'dogs',
	'doors',
	'eels',
	'fish',
	'foxes',
	'frogs',
	'goats',
	'hats',
	'hills',
	'jars',
	'keys',
	'kings',
	'lamps',
	'maps',
	'mice',
	'owls',
	'paws',
	'pens',
	'rats',
	'seals',
	'snails',
	'trees',
	'waves',
	'wolves',
]

const VERBS = [
	'act',
	'beam',
	'burn',
	'cry',
	'dance',
	'dream',
	'fall',
	'flow',
	'fly',
	'glow',
	'grow',
	'hide',
	'jump',
	'kneel',
	'laugh',
	'lie',
	'melt',
	'play',
	'rest',
	'rise',
	'run',
	'sing',
	'sit',
	'spin',
	'stay',
	'swim',
	'talk',
	'turn',
	'wait',
	'walk',
]

const VALID_BUMPS = ['patch', 'minor', 'major'] as const
type BumpType = (typeof VALID_BUMPS)[number]

/** Pick a random element from an array. */
function pick<T>(arr: readonly T[]): T {
	return arr[Math.floor(Math.random() * arr.length)] as T
}

/** Generate a random changeset filename like "bright-dogs-fly". */
function generateChangesetName(): string {
	return `${pick(ADJECTIVES)}-${pick(NOUNS)}-${pick(VERBS)}`
}

/** Read the package name from the nearest package.json. */
function getPackageName(): string {
	const pkgPath = join(process.cwd(), 'package.json')
	if (!existsSync(pkgPath)) {
		console.error('Error: No package.json found in current directory.')
		process.exit(1)
	}
	const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
	if (!pkg.name || pkg.name.includes('{{')) {
		console.error(
			'Error: package.json has no valid "name" field. Run setup first.',
		)
		process.exit(1)
	}
	return pkg.name
}

function printUsage(): void {
	console.log(`Usage:
  bun version:gen                                    # Interactive (spawns changeset CLI)
  bun version:gen --bump <type> --summary "<text>"   # Non-interactive (writes file directly)

Flags:
  --bump, -b     Bump type: patch | minor | major
  --summary, -s  Changeset summary text
  --help, -h     Show this help`)
}

// --- Main ---

const { values: flags } = parseArgs({
	options: {
		bump: { type: 'string', short: 'b' },
		summary: { type: 'string', short: 's' },
		help: { type: 'boolean', short: 'h', default: false },
	},
	strict: true,
	allowPositionals: false,
})

if (flags.help) {
	printUsage()
	process.exit(0)
}

const hasBump = flags.bump !== undefined
const hasSummary = flags.summary !== undefined

// If neither flag provided → interactive mode (spawn changeset CLI)
if (!hasBump && !hasSummary) {
	const proc = Bun.spawn(['npx', 'changeset'], {
		stdio: ['inherit', 'inherit', 'inherit'],
		env: { ...process.env },
	})
	const exitCode = await proc.exited
	process.exit(exitCode)
}

// If only one flag provided → error
if (hasBump !== hasSummary) {
	console.error(
		'Error: Both --bump and --summary are required for non-interactive mode.',
	)
	console.error('')
	printUsage()
	process.exit(1)
}

// Validate bump type
const bump = flags.bump as string
if (!VALID_BUMPS.includes(bump as BumpType)) {
	console.error(
		`Error: Invalid bump type "${bump}". Must be one of: ${VALID_BUMPS.join(', ')}`,
	)
	process.exit(1)
}

// Validate summary
const summary = (flags.summary as string).trim()
if (summary.length === 0) {
	console.error('Error: --summary cannot be empty.')
	process.exit(1)
}

// Generate changeset file
const packageName = getPackageName()
const changesetDir = join(process.cwd(), '.changeset')

if (!existsSync(changesetDir)) {
	mkdirSync(changesetDir, { recursive: true })
}

// Ensure unique filename
let name = generateChangesetName()
while (existsSync(join(changesetDir, `${name}.md`))) {
	name = generateChangesetName()
}

const filePath = join(changesetDir, `${name}.md`)
const content = `---
"${packageName}": ${bump}
---

${summary}
`

writeFileSync(filePath, content)

console.log(`Created changeset: .changeset/${name}.md`)
console.log('')
console.log(content)
